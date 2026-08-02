import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleOAuthSchema,
  appleOAuthSchema,
  accountTypeSchema,
} from "@zika/validators";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { generateToken, hashToken } from "../lib/crypto";
import { z } from "zod";
import {
  signAccessToken,
  signGuestToken,
  generateRefreshToken,
  verifyAccessToken,
} from "../lib/jwt";
import { randomUUID, createHash } from "crypto";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../lib/email";
import { incrementCounter, getCooldown, setCooldown } from "../lib/redis";
import { sendError, sendSuccess, zodFieldErrors } from "../lib/errors";
import { signPhotoUrl } from "../lib/s3";
import { OAuth2Client } from "google-auth-library";
import * as jose from "jose";

const REFRESH_TTL = Number(process.env["JWT_REFRESH_TTL_SECONDS"] ?? 2592000);
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "lax" as const,
  domain: process.env["COOKIE_DOMAIN"] ?? ".kainook.com",
  maxAge: REFRESH_TTL,
  path: "/",
};

const GUEST_TOKEN_TTL = Number(process.env["JWT_GUEST_ACCESS_TTL_SECONDS"] ?? 1800);
const LISTING_API_URL = process.env["LISTING_API_URL"] ?? "http://localhost:3003";

// ── Guest booking claim (best-effort, fire-and-forget) ───────────────────────
// After a successful login/register the freshly-minted access token is used to
// re-point every anonymous booking that carries the same email onto the real
// user (adopt-by-email). Failures are logged and never block auth.
async function fireAndForgetBookingClaim(email: string, accessToken: string) {
  try {
    await fetch(`${LISTING_API_URL}/bookings/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    console.error("[Auth] Booking claim failed (non-fatal):", (err as Error)?.message ?? err);
  }
}


// POST schema - only photoUrl is allowed
export const postProfileSchema = z.object({
  photoUrl: z.string().url("Invalid photo URL"),
});

// PATCH schema - name, photoUrl, businessName (for providers), and country
export const patchProfileSchema = z.object({
  firstName: z.string().min(1, "First name cannot be empty").optional(),
  lastName: z.string().min(1, "Last name cannot be empty").optional(),
  photoUrl: z.string().url("Invalid photo URL").optional().nullable(),
  businessName: z.string().max(255).optional().nullable(),
  country: z.string().length(2).toUpperCase().optional().nullable(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone number must be in international format (e.g. +254712345678)")
    .optional()
    .nullable(),
});

// ── Helper: issue tokens and set cookie ─────────────────────────────────────

async function issueTokens(
  reply: FastifyReply,
  userId: string,
  userType: string,
  status: string,
  country: string | null,
) {
  const accessToken = await signAccessToken({ sub: userId, type: userType as "guest" | "provider", status, country: country ?? undefined });
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);

  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  reply.setCookie("web_refresh_token", refreshToken, COOKIE_OPTS);

  return { accessToken, expiresIn: Number(process.env["JWT_ACCESS_TTL_SECONDS"] ?? 900) };
}

// ── Helper: map User to public shape ─────────────────────────────────────────

// ── Legal document versions ───────────────────────────────────────────────────
// Bump these when the published Terms or Privacy Policy change. Users whose
// stored version no longer matches are re-prompted by the in-app consent screen.
export const CURRENT_TERMS_VERSION = "1.0";
export const CURRENT_PRIVACY_VERSION = "1.0";

// The two documents are gated at different points, per the client's spec:
//   • Privacy Policy  — at registration (or at the latest before a first booking)
//   • Terms & Conditions — before completing a payment or booking
// They are therefore tracked and reported independently rather than as one flag.

/** True when the user must accept the Terms before completing a payment/booking. */
export function requiresTermsAcceptance(u: {
  termsAcceptedAt: Date | null; termsVersion: string | null;
}): boolean {
  return u.termsAcceptedAt === null || u.termsVersion !== CURRENT_TERMS_VERSION;
}

/**
 * True when the user must accept the Privacy Policy before entering the app.
 * Always true for accounts created via Google/Apple OAuth, which show no
 * consent UI at sign-up.
 */
export function requiresPrivacyAcceptance(u: {
  privacyAcceptedAt: Date | null; privacyVersion: string | null;
}): boolean {
  return u.privacyAcceptedAt === null || u.privacyVersion !== CURRENT_PRIVACY_VERSION;
}

function publicUser(u: {
  id: string; firstName: string; lastName: string; email: string;
  status: string; userType: string; businessName: string | null;
  country: string | null; phone: string | null; emailVerified: boolean;
  currentTier: string; loyaltyPoints: number;
  termsAcceptedAt?: Date | null; termsVersion?: string | null;
  privacyAcceptedAt?: Date | null; privacyVersion?: string | null;
}) {
  const legal = {
    termsAcceptedAt: u.termsAcceptedAt ?? null,
    termsVersion: u.termsVersion ?? null,
    privacyAcceptedAt: u.privacyAcceptedAt ?? null,
    privacyVersion: u.privacyVersion ?? null,
  };
  return {
    id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
    status: u.status, userType: u.userType, businessName: u.businessName,
    country: u.country, phone: u.phone, emailVerified: u.emailVerified,
    currentTier: u.currentTier, loyaltyPoints: u.loyaltyPoints,
    termsAcceptedAt: legal.termsAcceptedAt,
    privacyAcceptedAt: legal.privacyAcceptedAt,
    // Two independent gates — see the helpers above. Computed server-side so
    // the version-comparison rule is not re-implemented per platform.
    requiresTermsAcceptance: requiresTermsAcceptance(legal),
    requiresPrivacyAcceptance: requiresPrivacyAcceptance(legal),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // ── POST /auth/register  (UC-1.1, UC-1.2) ──────────────────────────────────
  app.post("/auth/register", {
    schema: {
      tags: ["User Auth"],
      body: {
        type: "object",
        required: [
          "firstName",
          "lastName",
          "email",
          "password",
          "confirmPassword",
          "userType"
        ],
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string" },
          confirmPassword: { type: "string" },
          userType: { type: "string", enum: ["guest", "provider"] },
          businessName: { type: "string" },
          phone: { type: "string", description: "International format, required for providers" },
          country: {
            type: "string",
            minLength: 2,
            maxLength: 2,
            description: "2-letter ISO country code (e.g. 'IN', 'US')"
          },
          acceptedTerms: {
            type: "boolean",
            description: "User ticked the Terms & Conditions checkbox. Recorded with a timestamp and version."
          },
          acceptedPrivacy: {
            type: "boolean",
            description: "User ticked the Privacy Policy checkbox. Recorded with a timestamp and version."
          }
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(
        reply,
        422,
        "VALIDATION_ERROR",
        "Validation failed",
        zodFieldErrors((parsed.error as ZodError).issues)
      );
    }

    const {
      firstName,
      lastName,
      email,
      password,
      userType,
      businessName,
      country,
      phone,
      acceptedTerms,
      acceptedPrivacy
    } = parsed.data;

    // Stamped only when the client explicitly reports the boxes were ticked.
    // Older clients omit these and the account is prompted on first sign-in.
    const acceptedAt = new Date();
    const legalAcceptance = {
      ...(acceptedTerms ? { termsAcceptedAt: acceptedAt, termsVersion: CURRENT_TERMS_VERSION } : {}),
      ...(acceptedPrivacy ? { privacyAcceptedAt: acceptedAt, privacyVersion: CURRENT_PRIVACY_VERSION } : {}),
    };

    try {
      const existing = await prisma.user.findUnique({
        where: { email },
        include: {
          verificationTokens: {
            where: { tokenType: "email_verification", used: false },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (existing) {
        // Active, suspended, or banned accounts — block registration
        if (existing.status !== "pending_verification") {
          return sendError(
            reply,
            409,
            "EMAIL_EXISTS",
            "An account with this email already exists.",
            {
              email: "An account with this email already exists."
            }
          );
        }

        // Pending verification — check if the token is still valid
        const latestToken = existing.verificationTokens[0];
        const tokenStillValid = latestToken && latestToken.expiresAt >= new Date();

        if (tokenStillValid) {
          // Token is still valid — resend verification email
          const plainToken = generateToken();

          // Invalidate old tokens
          await prisma.verificationToken.updateMany({
            where: { userId: existing.id, used: false, tokenType: "email_verification" },
            data: { used: true, usedAt: new Date(), invalidatedReason: "superseded" },
          });

          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await prisma.verificationToken.create({
            data: {
              userId: existing.id,
              tokenHash: hashToken(plainToken),
              tokenType: "email_verification",
              expiresAt,
            },
          });

          try {
            await sendVerificationEmail(email, plainToken);
            await prisma.emailLog.create({
              data: {
                userId: existing.id,
                type: "verification_resend",
                recipient: email,
                status: "sent",
                sentAt: new Date(),
              },
            });
          } catch (error) {
            console.error("[Auth] Verification email delivery failed", error);
            await prisma.emailLog.create({
              data: {
                userId: existing.id,
                type: "verification_resend",
                recipient: email,
                status: "failed",
                sentAt: new Date(),
              },
            });
          }

          return sendSuccess(reply, 200, {
            message: "An account with this email is pending verification. A new verification email has been sent. Please check your inbox.",
          });
        }

        // Token expired — delete the old unverified user and allow fresh registration
        try {
          await prisma.user.delete({ where: { id: existing.id } });
        } catch (delErr: any) {
          if (delErr?.code !== "P2025") throw delErr;
        }
      }

      const passwordHash = await hashPassword(password);

      const skipVerification =
        process.env["SKIP_EMAIL_VERIFICATION"] === "true";

      const status = skipVerification
        ? "active"
        : "pending_verification";

      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          passwordHash,
          userType: userType as "guest" | "provider",
          businessName: businessName ?? null,
          country: country ?? null,
          phone: phone ?? null,
          ...legalAcceptance,
          ...(skipVerification
            ? {
              status: "active",
              emailVerified: true,
              emailVerifiedAt: new Date()
            }
            : {
              status: "pending_verification"
            })
        }
      });

      // Skip email verification
      if (skipVerification) {
        const tokens = await issueTokens(
          reply,
          user.id,
          user.userType,
          "active",
          user.country
        );

        fireAndForgetBookingClaim(email, tokens.accessToken);

        return sendSuccess(reply, 201, {
          user: publicUser(user),
          tokens
        });
      }

      // Email verification flow
      const plainToken = generateToken();

     // console.log("EMAIL VERIFICATION TOKEN:", plainToken);

      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(plainToken),
          tokenType: "email_verification",
          expiresAt
        }
      });

      try {
        await sendVerificationEmail(email, plainToken);

        await prisma.emailLog.create({
          data: {
            userId: user.id,
            type: "verification",
            recipient: email,
            status: "sent",
            sentAt: new Date()
          }
        });
      } catch (error) {
        console.error(
          "[Auth] Verification email delivery failed",
          error
        );

        await prisma.emailLog.create({
          data: {
            userId: user.id,
            type: "verification",
            recipient: email,
            status: "failed",
            sentAt: new Date()
          }
        });

        return sendError(
          reply,
          503,
          "EMAIL_DELIVERY_FAILED",
          "We could not send the verification email. Please try again in a few minutes."
        );
      }

      return sendSuccess(reply, 201, {
        message:
          "Registration successful. Please check your email to verify your account."
      });
    } catch (err) {
      return sendError(reply, 400, "REGISTRATION_FAILED", "Registration could not be completed. Please try again.");
    }
  });

  // ── POST /auth/guest-token  (Guest checkout — no sign-in required) ─────────
  app.post("/auth/guest-token", {
    schema: {
      tags: ["User Auth"],
      summary: "Mint a stateless guest access token for anonymous checkout",
      body: {
        type: "object",
        properties: {
          deviceId: {
            type: "string",
            description: "Optional stable device identifier. When present the anon id is derived from it so retries reuse the same id.",
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Public endpoint → conservative per-IP rate limit.
      const rlCount = await incrementCounter(`rl:guest-token:${req.ip}`, 3600);
      if (rlCount > 120) {
        return sendError(reply, 429, "RATE_LIMITED", "Too many guest tokens requested. Please try again later.");
      }

      const body = (req.body ?? {}) as { deviceId?: string };
      let sub: string;
      if (body.deviceId && typeof body.deviceId === "string" && body.deviceId.trim()) {
        // Stable anon id derived from the device so a refresh resumes the same checkout.
        sub = `guest_${createHash("sha256").update(body.deviceId.trim()).digest("hex").slice(0, 24)}`;
      } else {
        // Fresh anon id per mint — the client must persist and reuse the token.
        sub = `guest_${randomUUID().replace(/-/g, "")}`;
      }

      const accessToken = await signGuestToken({
        sub,
        type: "guest",
        status: "active",
      });

      return sendSuccess(reply, 200, {
        accessToken,
        expiresIn: GUEST_TOKEN_TTL,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to mint guest token");
      return sendError(reply, 500, "GUEST_TOKEN_FAILED", "Could not issue a guest token. Please try again.");
    }
  });

  // ── GET /verify  (Email link landing — HTML page for all clients) ───────────
  app.get("/verify", async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.query as { token?: string };
    const userAgent = req.headers["user-agent"] ?? "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

    function html(icon: string, title: string, body: string, color = "#16a34a", showOpenBtn = false) {
      const deepLinkScript = showOpenBtn ? `
  <script>
    function openApp() {
      window.location.href = 'Kainook://';
      setTimeout(function() {
        var msg = document.getElementById('fallback-msg');
        if (msg) { msg.style.display = 'block'; }
      }, 2000);
    }
  </script>` : "";

      const openBtn = showOpenBtn
        ? isMobile
          ? `
    <button class="btn" onclick="openApp()">Open Kainook App</button>
    <div id="fallback-msg" style="display:none;margin-top:16px;padding:14px 16px;background:#f1f5f9;border-radius:10px;font-size:13px;color:#475569;line-height:1.7;text-align:left">
      <strong>App didn't open?</strong><br/>
      • Make sure the Kainook app is installed<br/>
      • Open the app manually and sign in
    </div>`
          : `
    <div style="margin-top:8px;padding:16px;background:#f0fdf4;border-radius:10px;font-size:14px;color:#166534;line-height:1.7;border:1px solid #bbf7d0">
      Your email is verified!<br/>
      <strong>Open the Kainook app on your phone</strong> and sign in.
    </div>`
        : `<p style="font-size:13px;color:#94a3b8;margin-top:8px">Please open the Kainook app and sign in.</p>`;

      return reply
        .code(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — Kainook</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:linear-gradient(135deg,#0f3443 0%,#1a5276 50%,#0f3443 100%);
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:20px;padding:48px 36px;max-width:420px;width:100%;
          text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
    .icon{font-size:64px;margin-bottom:20px;display:block}
    h1{font-size:24px;font-weight:800;color:#0f3443;margin-bottom:12px}
    p{font-size:15px;color:#64748b;line-height:1.6;margin-bottom:24px}
    .btn{display:inline-block;background:${color};color:#fff;padding:14px 32px;
         border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;
         border:none;cursor:pointer;width:100%;margin-top:8px}
    .btn:hover{opacity:.85}
    .brand{margin-top:32px;font-size:13px;color:#94a3b8;font-weight:600;letter-spacing:.5px}
  </style>
  ${deepLinkScript}
</head>
<body>
  <div class="card">
    <span class="icon">${icon}</span>
    <h1>${title}</h1>
    <p>${body}</p>
    ${openBtn}
    <div class="brand">Kainook</div>
  </div>
</body>
</html>`);
    }

    try {
      // ── Validate token presence ────────────────────────────────────────────────
      if (!token || token.length !== 64) {
        return html( "Invalid Link", "This verification link is invalid or incomplete. Please request a new verification email from the app.", "#dc2626");
      }

      // ── Rate limit ─────────────────────────────────────────────────────────────
      const ip = req.ip;
      const rlCount = await incrementCounter(`rl:verify:${ip}`, 60);
      if (rlCount > 10) {
        return html( "Too Many Requests", "You've made too many requests. Please wait a moment and try again.", "#d97706");
      }

      const tokenHash = hashToken(token);
      const record = await prisma.verificationToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!record || record.tokenType !== "email_verification") {
        return html( "Invalid Link", "This verification link is invalid. Please request a new verification email from the app.", "#dc2626");
      }

      if (record.used) {
        return html("🔒", "Already Used", "This verification link has already been used. Your email may already be verified — please open the app and sign in.", "#7c3aed", true);
      }

      if (record.expiresAt < new Date()) {
        return html("⌛", "Link Expired", "Your verification link has expired (links are valid for 24 hours). Please sign in to request a new verification email.", "#d97706");
      }

      // Already verified
      if (record.user.emailVerified && record.user.status === "active") {
        return html("✅", "Already Verified!", "Your email address is already verified. Open the app and sign in to your account.", "#16a34a", true);
      }

      // ── Perform verification ───────────────────────────────────────────────────
      try {
        await prisma.$transaction([
          prisma.verificationToken.update({
            where: { id: record.id },
            data: { used: true, usedAt: new Date() },
          }),
          prisma.user.update({
            where: { id: record.userId },
            data: { status: "active", emailVerified: true, emailVerifiedAt: new Date() },
          }),
        ]);
      } catch {
        return html("⚠️", "Something Went Wrong", "We could not complete your verification. Please try again or contact support.", "#dc2626");
      }

      return html("🎉", "Email Verified!", "Your Kainook account is now active. Tap the button below to open the app and sign in.", "#16a34a", true);
    } catch (err) {
      return html("⚠️", "Something Went Wrong", "We could not complete your verification. Please try again or contact support.", "#dc2626");
    }
  });

  // ── GET /auth/verify  (UC-1.3) ─────────────────────────────────────────────
  app.get(
    "/auth/verify",
    {
      schema: {
        tags: ["User Auth"],
        querystring: {
          type: "object",
          required: ["token"],
          properties: {
            token: {
              type: "string",
              description:
                "64-character email verification token from the verification link",
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { token } = req.query as { token?: string };

      if (!token || token.length !== 64) {
        return sendError(
          reply,
          400,
          "INVALID_TOKEN",
          "This verification link is invalid. Please request a new one."
        );
      }

      try {
        const ip = req.ip;
        const rlCount = await incrementCounter(`rl:verify:${ip}`, 60);

        if (rlCount > 10) {
          return sendError(
            reply,
            429,
            "RATE_LIMITED",
            "Too many requests. Please wait a moment and try again."
          );
        }

        const tokenHash = hashToken(token);

        const record = await prisma.verificationToken.findUnique({
          where: { tokenHash },
          include: { user: true },
        });

        if (!record || record.tokenType !== "email_verification") {
          return sendError(
            reply,
            400,
            "INVALID_TOKEN",
            "This verification link is invalid. Please request a new one."
          );
        }

        if (record.used) {
          return sendError(
            reply,
            400,
            "TOKEN_USED",
            "This verification link has already been used. If you need to verify your email, please request a new link."
          );
        }

        if (record.expiresAt < new Date()) {
          return sendError(
            reply,
            410,
            "TOKEN_EXPIRED",
            "Your verification link has expired.",
            { email: record.user.email }
          );
        }

        // Already verified
        if (record.user.emailVerified && record.user.status === "active") {
          const tokens = await issueTokens(
            reply,
            record.user.id,
            record.user.userType,
            "active",
            record.user.country
          );

          fireAndForgetBookingClaim(record.user.email, tokens.accessToken);

          return sendSuccess(reply, 200, {
            message: "You're already verified. Welcome back!",
            user: publicUser(record.user),
            tokens,
          });
        }

        try {
          await prisma.$transaction([
            prisma.verificationToken.update({
              where: { id: record.id },
              data: {
                used: true,
                usedAt: new Date(),
              },
            }),

            prisma.user.update({
              where: { id: record.userId },
              data: {
                status: "active",
                emailVerified: true,
                emailVerifiedAt: new Date(),
              },
            }),
          ]);

          const updatedUser = await prisma.user.findUniqueOrThrow({
            where: { id: record.userId },
          });

          const tokens = await issueTokens(
            reply,
            updatedUser.id,
            updatedUser.userType,
            "active",
            updatedUser.country
          );

          fireAndForgetBookingClaim(updatedUser.email, tokens.accessToken);

          return sendSuccess(reply, 200, {
            message: "Email verified — welcome to Kainook!",
            user: publicUser(updatedUser),
            tokens,
          });
        } catch (err: any) {
          if (err?.code === "P2025") {
            return sendError(reply, 404, "USER_NOT_FOUND", "User account not found.");
          }
          return sendError(reply, 400, "VERIFICATION_FAILED", "Email verification could not be completed. Please try again.");
        }
      } catch (err) {
        return sendError(reply, 400, "VERIFICATION_FAILED", "Email verification could not be completed. Please try again.");
      }
    }
  );
  // ── POST /auth/resend-verification  (UC-1.4) ───────────────────────────────
  app.post("/auth/resend-verification", {
    schema: {
      tags: ["User Auth"],
      body: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid email.");
    const { email } = parsed.data;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.status !== "pending_verification" || user.emailVerified) {
        // Don't reveal account existence — return same response
        return sendSuccess(reply, 200, { message: "If the email is pending verification, a new link has been sent." });
      }

      // 60-second cooldown (BR-1.6)
      const cooldownKey = `cooldown:resend:${user.id}`;
      if (await getCooldown(cooldownKey)) {
        return sendError(reply, 429, "COOLDOWN", "Please wait before requesting another email.");
      }

      // Hourly limit: 3 resends (BR-1.6)
      const hourlyKey = `rl:resend:${user.id}`;
      const hourlyCount = await incrementCounter(hourlyKey, 3600);
      if (hourlyCount > 3) {
        return sendError(reply, 429, "RATE_LIMITED", "You've requested the maximum number of verification emails. Please wait before trying again, or contact support.");
      }

      // Invalidate old tokens
      await prisma.verificationToken.updateMany({
        where: { userId: user.id, used: false, tokenType: "email_verification" },
        data: { used: true, usedAt: new Date(), invalidatedReason: "superseded" },
      });

      // New token
      const plainToken = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.verificationToken.create({
        data: { userId: user.id, tokenHash: hashToken(plainToken), tokenType: "email_verification", expiresAt },
      });

      await setCooldown(cooldownKey, 60);

      try {
        await sendVerificationEmail(email, plainToken);
        await prisma.emailLog.create({
          data: { userId: user.id, type: "verification_resend", recipient: email, status: "sent", sentAt: new Date() },
        });
      } catch (error) {
        console.error("[Auth] Resend verification email delivery failed", error);
        await prisma.emailLog.create({
          data: { userId: user.id, type: "verification_resend", recipient: email, status: "failed", sentAt: new Date() },
        });
        return sendError(reply, 503, "EMAIL_DELIVERY_FAILED", "We could not resend the verification email. Please try again in a few minutes.");
      }

      return sendSuccess(reply, 200, { message: "Verification email resent. Please check your inbox." });
    } catch (err) {
      return sendError(reply, 400, "RESEND_FAILED", "Could not resend the verification email. Please try again.");
    }
  });

  // ── POST /auth/login  (UC-1.5) ─────────────────────────────────────────────
  app.post("/auth/login", {
    schema: {
      tags: ["User Auth"],
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    // ── DEBUG: log raw body and parsed result ─────────────────────────────────
    console.log("[Login] Content-Type:", req.headers["content-type"]);
    console.log("[Login] Raw body:", JSON.stringify(req.body));

    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      console.log("[Login] Zod validation FAILED:", JSON.stringify(parsed.error.flatten()));
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid credentials.");
    }

    const { email, password } = parsed.data;
    console.log("[Login] Normalized email from Zod:", email);

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      console.log("[Login] DB user found:", user ? "YES" : "NO");
      if (user) {
        console.log("[Login] user.status:", user.status);
        console.log("[Login] user.emailVerified:", user.emailVerified);
        console.log("[Login] user.passwordHash is null:", user.passwordHash === null);
        console.log("[Login] user.oauthProvider:", user.oauthProvider);
      }

      const GENERIC = "Incorrect email or password.";

      // Timing-safe: always run bcrypt even if user not found (prevents timing attacks)
      const dummyHash = "$2b$12$invalidhashfortimingprotection000000000000000000000000000";
      const passwordOk = user?.passwordHash
        ? await verifyPassword(password, user.passwordHash)
        : await verifyPassword(password, dummyHash).then(() => false);

      console.log("[Login] passwordOk:", passwordOk);

      if (!user || !passwordOk) {
        console.log("[Login] FAIL → INVALID_CREDENTIALS (user found:", !!user, "passwordOk:", passwordOk, ")");
        return sendError(reply, 401, "INVALID_CREDENTIALS", GENERIC);
      }

      if (user.status === "pending_verification") {
        console.log("[Login] FAIL → EMAIL_NOT_VERIFIED");
        return sendError(
          reply,
          403,
          "EMAIL_NOT_VERIFIED",
          "Please verify your email address to sign in."
        );
      }
      if (user.status === "suspended") {
        return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended. Please contact support for assistance.");
      }
      if (user.status === "banned") {
        return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from Kainook.");
      }

      console.log("[Login] SUCCESS → issuing tokens for user:", user.id);
      const tokens = await issueTokens(reply, user.id, user.userType, user.status, user.country);
      // Adopt-by-email: attach any anonymous bookings made under this email.
      fireAndForgetBookingClaim(email, tokens.accessToken);
      return sendSuccess(reply, 200, { user: publicUser(user), tokens });
    } catch {
      return sendError(reply, 400, "LOGIN_FAILED", "Unable to complete sign-in. Please check your credentials and try again.");
    }
  });

  // ── GET /auth/me  (Loyalty & Profile) ──────────────────────────────────────
  app.get("/auth/me", {
    schema: {
      tags: ["User Auth"],
      summary: "Get current user profile including loyalty status",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                user: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    firstName: { type: "string" },
                    lastName: { type: "string" },
                    email: { type: "string" },
                    status: { type: "string" },
                    userType: { type: "string" },
                    businessName: { type: "string", nullable: true },
                    country: { type: "string", nullable: true },
                    emailVerified: { type: "boolean" },
                    currentTier: { type: "string" },
                    loyaltyPoints: { type: "integer" },
                  }
                },
                pointsToNextTier: { type: "integer", nullable: true },
                nextTier: { type: "string", nullable: true },
              }
            }
          }
        },
        401: { type: "object" },
        404: { type: "object" }
      }
    },
    preHandler: [requireAuth]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as FastifyRequest & { userId: string }).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return sendError(reply, 404, "USER_NOT_FOUND", "User not found.");
    }
    
    let nextTier: string | null = null;
    let pointsToNextTier: number | null = null;
    
    if (user.loyaltyPoints < 500) {
      nextTier = "silver";
      pointsToNextTier = 500 - user.loyaltyPoints;
    } else if (user.loyaltyPoints < 2000) {
      nextTier = "gold";
      pointsToNextTier = 2000 - user.loyaltyPoints;
    } else if (user.loyaltyPoints < 5000) {
      nextTier = "diamond";
      pointsToNextTier = 5000 - user.loyaltyPoints;
    }
    
    return sendSuccess(reply, 200, {
      user: publicUser(user),
      nextTier,
      pointsToNextTier
    });
  });

  // ── POST /auth/logout  (UC-1.9) ────────────────────────────────────────────
  app.post("/auth/logout", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const refreshToken = req.cookies["web_refresh_token"];
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await prisma.session.updateMany({ where: { tokenHash }, data: { revoked: true } });
      }
      reply.clearCookie("web_refresh_token", { path: "/" });
      return sendSuccess(reply, 200, { message: "Signed out successfully." });
    } catch {
      return sendError(reply, 400, "LOGOUT_FAILED", "Sign-out could not be completed. Please try again.");
    }
  });

  // ── POST /auth/logout-all  (UC-1.9 A2) ────────────────────────────────────
  app.post("/auth/logout-all", { schema: { tags: ["User Auth"] }, preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (req as FastifyRequest & { userId: string }).userId;
      await prisma.session.updateMany({ where: { userId }, data: { revoked: true } });
        reply.clearCookie("web_refresh_token", { path: "/" });
      return sendSuccess(reply, 200, { message: "Signed out from all devices." });
    } catch {
      return sendError(reply, 400, "LOGOUT_FAILED", "Sign-out from all devices could not be completed. Please try again.");
    }
  });

  // ── POST /auth/refresh  (UC-1.5) ───────────────────────────────────────────
  app.post("/auth/refresh", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = req.cookies["web_refresh_token"];
    if (!refreshToken) return sendError(reply, 401, "NO_TOKEN", "No refresh token.");

    try {
      const tokenHash = hashToken(refreshToken);
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!session || session.revoked || session.expiresAt < new Date()) {
      reply.clearCookie("web_refresh_token", { path: "/" });
        return sendError(reply, 401, "INVALID_TOKEN", "Session expired. Please sign in again.");
      }
      if (session.user.status !== "active") {
        return sendError(reply, 403, "ACCOUNT_INACTIVE", "Account is not active.");
      }

      // Rotate: revoke old, issue new
      await prisma.session.update({ where: { id: session.id }, data: { revoked: true } });
      const tokens = await issueTokens(reply, session.userId, session.user.userType, session.user.status, session.user.country);
      return sendSuccess(reply, 200, { tokens });
    } catch {
      return sendError(reply, 400, "REFRESH_FAILED", "Token refresh failed. Please sign in again.");
    }
  });

  // ── POST /auth/forgot-password  (UC-1.8) ───────────────────────────────────
  app.post("/auth/forgot-password", {
    schema: {
      tags: ["User Auth"],
      body: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    // Always 200 regardless (BR: prevents enumeration)
    if (!parsed.success) return sendSuccess(reply, 200, { message: "If an account with that email exists, we've sent a password reset link." });
    const { email } = parsed.data;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.status === "active" && user.passwordHash) {
        const plainToken = generateToken();

        await prisma.verificationToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(plainToken),
            tokenType: "password_reset",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });

        try {
          await sendPasswordResetEmail(email, plainToken);
        } catch (error) {
          console.error("Email sending failed:", error);
        }
      }

      return sendSuccess(reply, 200, {
        message: "If an account with that email exists, we've sent a password reset link.",
      });
    } catch (err) {
      return sendError(reply, 400, "FORGOT_PASSWORD_FAILED", "Unable to process password reset request. Please try again.");
    }
  });

  // ── POST /auth/reset-password  (UC-1.8) ────────────────────────────────────
  app.post("/auth/reset-password", {
    schema: {
      tags: ["User Auth"],
      body: {
        type: "object",
        required: ["token", "password", "confirmPassword"],
        properties: {
          token: { type: "string" },
          password: { type: "string" },
          confirmPassword: { type: "string" },
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {


    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(JSON.stringify(parsed.error.format(), null, 2));
      return sendError(
        reply,
        422,
        "VALIDATION_ERROR",
        "Validation failed",
        zodFieldErrors(parsed.error.issues)
      );
    }

    const { token, password } = parsed.data;

    try {
      const tokenHash = hashToken(token);
      const record = await prisma.verificationToken.findUnique({
        where: { tokenHash }, include: { user: true },
      });

      if (!record || record.tokenType !== "password_reset") {
        return sendError(reply, 400, "INVALID_TOKEN", "This password reset link is invalid. Please request a new one.");
      }
      if (record.used) {
        return sendError(reply, 400, "TOKEN_USED", "This reset link has already been used.");
      }
      if (record.expiresAt < new Date()) {
        return sendError(reply, 410, "TOKEN_EXPIRED", "This password reset link has expired. Please request a new one.");
      }

      try {
        const passwordHash = await hashPassword(password);
        await prisma.$transaction([
          prisma.verificationToken.update({ where: { id: record.id }, data: { used: true, usedAt: new Date() } }),
          prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
          prisma.session.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
        ]);

        const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
        const tokens = await issueTokens(reply, updatedUser.id, updatedUser.userType, updatedUser.status, updatedUser.country);

        fireAndForgetBookingClaim(updatedUser.email, tokens.accessToken);

        return sendSuccess(reply, 200, { message: "Your password has been updated. You're now signed in.", user: publicUser(updatedUser), tokens });
      } catch (err: any) {
        if (err?.code === "P2025") {
          return sendError(reply, 404, "USER_NOT_FOUND", "User account not found. The account may have been deleted.");
        }
        return sendError(reply, 400, "RESET_FAILED", "Password reset could not be completed. Please request a new reset link.");
      }
    } catch (err) {
      return sendError(reply, 400, "RESET_FAILED", "Password reset could not be completed. Please request a new reset link.");
    }
  });

  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
      confirmPassword: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "New password and confirmation do not match",
          path: ["confirmPassword"],
        });
      }
    });

  // ── POST /auth/change-password  (UC-1.8) ───────────────────────────────────
  app.post(
    "/auth/change-password",
    {
      schema: {
        tags: ["User Auth"],
        summary: "Change user password when logged in",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["currentPassword", "newPassword", "confirmPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string" },
            confirmPassword: { type: "string" },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          422,
          "VALIDATION_ERROR",
          "Validation failed",
          zodFieldErrors(parsed.error.issues)
        );
      }

      const { currentPassword, newPassword } = parsed.data;
      const userId = (req as FastifyRequest & { userId: string }).userId;

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return sendError(reply, 404, "USER_NOT_FOUND", "User account not found.");
        }

        // Verify current password
        const passwordOk = user.passwordHash
          ? await verifyPassword(currentPassword, user.passwordHash)
          : false;

        if (!passwordOk) {
          return sendError(
            reply,
            400,
            "INVALID_CREDENTIALS",
            "Incorrect current password."
          );
        }

        // Hash new password and save it
        const passwordHash = await hashPassword(newPassword);
        await prisma.user.update({
          where: { id: userId },
          data: { passwordHash },
        });

        return sendSuccess(reply, 200, {
          message: "Password updated successfully.",
        });
      } catch (err) {
        return sendError(
          reply,
          500,
          "CHANGE_PASSWORD_FAILED",
          "An error occurred while changing password."
        );
      }
    }
  );

  // ── GET /auth/profile  (Get profile details with dynamic payment methods) ──
  app.get(
    "/auth/profile",
    {
      schema: {
        tags: ["User Auth"],
        summary: "Get current user profile (with loyalty, tier, and payment methods)",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as FastifyRequest & { userId: string }).userId;

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true,
            photoUrl: true,
            loyaltyPoints: true,
            currentTier: true,
            businessName: true,
            country: true,
            phone: true,
            termsAcceptedAt: true,
            termsVersion: true,
            privacyAcceptedAt: true,
            privacyVersion: true,
          }
        });

        if (!user) {
          return sendError(reply, 404, "USER_NOT_FOUND", "Profile not found.");
        }

        return sendSuccess(reply, 200, {
          profile: {
            id: user.id,
            firstname: user.firstName,
            lastname: user.lastName,
            email: user.email,
            userType: user.userType,
            photoUrl: await signPhotoUrl(user.photoUrl),
            loyaltyPoints: user.loyaltyPoints,
            currentTier: user.currentTier,
            businessName: user.businessName,
            country: user.country,
            phone: user.phone,
            termsAcceptedAt: user.termsAcceptedAt,
            privacyAcceptedAt: user.privacyAcceptedAt,
            // Lets a long-lived session discover a policy bump without re-login.
            requiresTermsAcceptance: requiresTermsAcceptance(user),
            requiresPrivacyAcceptance: requiresPrivacyAcceptance(user),
          }
        });
      } catch (err: any) {
        req.log.error(err, "Failed to fetch profile");
        return sendError(reply, 500, "SERVER_ERROR", "Could not fetch profile. Please try again.");
      }
    }
  );

  // ── POST /auth/accept-terms ────────────────────────────────────────────────
  // Records acceptance for users who never gave one at sign-up — principally
  // accounts created through Google/Apple OAuth, where no consent UI is shown —
  // and for anyone whose stored version has been superseded.
  app.post(
    "/auth/accept-terms",
    {
      schema: {
        tags: ["User Auth"],
        summary: "Record the current user's acceptance of the Terms & Privacy Policy",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            acceptedTerms: { type: "boolean", description: "Defaults to true when omitted" },
            acceptedPrivacy: { type: "boolean", description: "Defaults to true when omitted" },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as FastifyRequest & { userId: string }).userId;
        const body = (req.body ?? {}) as { acceptedTerms?: boolean; acceptedPrivacy?: boolean };

        // The two documents are accepted at different points in the journey —
        // Privacy at registration, Terms at checkout — so each is recorded
        // independently and callers send only the one they collected.
        if (body.acceptedTerms !== true && body.acceptedPrivacy !== true) {
          return sendError(
            reply,
            422,
            "ACCEPTANCE_REQUIRED",
            "Nothing to record — pass acceptedTerms and/or acceptedPrivacy as true."
          );
        }

        const acceptedAt = new Date();
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(body.acceptedTerms === true
              ? { termsAcceptedAt: acceptedAt, termsVersion: CURRENT_TERMS_VERSION }
              : {}),
            ...(body.acceptedPrivacy === true
              ? { privacyAcceptedAt: acceptedAt, privacyVersion: CURRENT_PRIVACY_VERSION }
              : {}),
          },
        });

        return sendSuccess(reply, 200, {
          user: publicUser(user),
          acceptedAt: acceptedAt.toISOString(),
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
        });
      } catch (err: any) {
        req.log.error(err, "Failed to record terms acceptance");
        return sendError(reply, 500, "SERVER_ERROR", "Could not record your acceptance. Please try again.");
      }
    }
  );

  // ── POST /auth/profile  (Post only photo) ──────────────────────────────────
  app.post(
    "/auth/profile",
    {
      schema: {
        tags: ["User Auth"],
        summary: "Upload or set the profile photo URL",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["photoUrl"],
          properties: {
            photoUrl: { type: "string", format: "uri", description: "URL of the uploaded profile photo" },
          },
        },
       
      },
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as FastifyRequest & { userId: string }).userId;

        const parsed = postProfileSchema.safeParse(req.body);
        if (!parsed.success) {
          return sendError(
            reply,
            422,
            "VALIDATION_ERROR",
            "Validation failed",
            zodFieldErrors((parsed.error as ZodError).issues)
          );
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { photoUrl: parsed.data.photoUrl },
          select: { photoUrl: true }
        });

        return sendSuccess(reply, 201, {
          message: "Profile photo set successfully.",
          photoUrl: updatedUser.photoUrl,
        });
      } catch (err: any) {
        req.log.error(err, "Failed to set photo");
        return sendError(reply, 500, "SERVER_ERROR", "Could not set photo. Please try again.");
      }
    }
  );

  // ── Shared PATCH /auth/profile handler ────────────────────────────────────
  // Supports both `PATCH /auth/profile/:id` (explicit id with ownership guard)
  // and `PATCH /auth/profile` (uses the authenticated user's id).
  async function patchProfileHandler(req: FastifyRequest, reply: FastifyReply, id: string) {
    try {
      const authUserId = (req as FastifyRequest & { userId: string }).userId;

      // Guard: Prevent users from updating profiles other than their own
      if (authUserId !== id) {
        return sendError(reply, 403, "FORBIDDEN", "You are not authorized to update this profile.");
      }

      // Validate request body using Zod
      const parsed = patchProfileSchema.safeParse(req.body);
        if (!parsed.success) {
          return sendError(
            reply,
            422,
            "VALIDATION_ERROR",
            "Validation failed",
            zodFieldErrors((parsed.error as ZodError).issues)
          );
        }

        const { firstName, lastName, photoUrl, businessName, country, phone } = parsed.data;

        // Fetch current user type to validate business name restriction
        const userRecord = await prisma.user.findUnique({
          where: { id },
          select: { userType: true }
        });

        if (!userRecord) {
          return sendError(reply, 404, "USER_NOT_FOUND", "Profile not found.");
        }

        // Restrict businessName to providers
        if (businessName !== undefined && userRecord.userType !== "provider") {
          return sendError(reply, 400, "BAD_REQUEST", "businessName can only be updated for provider accounts.");
        }

        // Map updates
        const updateData: Record<string, any> = {};
        if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
        if (businessName !== undefined) updateData.businessName = businessName;
        if (country !== undefined) updateData.country = country;
        if (phone !== undefined) updateData.phone = phone;
        
        // Split name into firstName & lastName
         if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;

        const updatedUser = await prisma.user.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            businessName: true,
            country: true,
            phone: true,
          }
        });

        const signedPhotoUrl = await signPhotoUrl(updatedUser.photoUrl);
        return sendSuccess(reply, 200, {
          message: "Profile updated successfully.",
          profile: {
            id: updatedUser.id,
            name: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
            photoUrl: signedPhotoUrl,
            businessName: updatedUser.businessName,
            country: updatedUser.country,
            phone: updatedUser.phone,
          },
          user: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            photoUrl: signedPhotoUrl,
            businessName: updatedUser.businessName,
            country: updatedUser.country,
            phone: updatedUser.phone,
          },
        });
      } catch (err: any) {
        req.log.error(err, "Failed to update profile");
        return sendError(reply, 500, "SERVER_ERROR", "Could not update profile. Please try again.");
      }
    }

  // ── PATCH /auth/profile  (Update the authenticated user's own profile) ──
  app.patch(
    "/auth/profile",
    {
      schema: {
        tags: ["User Auth"],
        summary: "Partially update the authenticated user's profile (name, photo, business name)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            photoUrl: { type: "string", format: "uri", nullable: true },
            businessName: { type: "string", nullable: true, description: "Provider business name (only allowed for providers)" },
            country: { type: "string", minLength: 2, maxLength: 2, description: "ISO 3166-1 alpha-2 country code" },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const authUserId = (req as FastifyRequest & { userId: string }).userId;
      return patchProfileHandler(req, reply, authUserId);
    }
  );

  // ── PATCH /auth/profile/:id  (Partially Update Profile by User ID) ──────────
  app.patch(
    "/auth/profile/:id",
    {
      schema: {
        tags: ["User Auth"],
        summary: "Partially update profile details (name, photo, business name)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "The User ID to update" },
          },
        },
        body: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            photoUrl: { type: "string", format: "uri", nullable: true },
            businessName: { type: "string", nullable: true, description: "Provider business name (only allowed for providers)" },
            country: { type: "string", minLength: 2, maxLength: 2, description: "ISO 3166-1 alpha-2 country code" },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      return patchProfileHandler(req, reply, id);
    }
  );

  // ── POST /auth/oauth/google  (UC-1.6) ──────────────────────────────────────
  app.post("/auth/oauth/google", {
    schema: { 
      tags: ["User Auth"], body: {
        type: "object",
        required: ["idToken"],
        properties: {
          idToken: {
            type: "string",
          }
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = googleOAuthSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid payload.");
    const { idToken, userType, businessName, country } = parsed.data;

    let googlePayload: { email: string; given_name?: string; family_name?: string; sub: string } | null = null;
    try {
      const client = new OAuth2Client();
      const ticket = await client.verifyIdToken({
        idToken,
        audience: [
          process.env["GOOGLE_CLIENT_ID_WEB"] ?? "",
          process.env["GOOGLE_CLIENT_ID_IOS"] ?? "",
          process.env["GOOGLE_CLIENT_ID_ANDROID"] ?? "",
        ],
      });
      const p = ticket.getPayload();



      if (!p?.email || !p?.sub) throw new Error("Missing fields");
      googlePayload = { email: p.email, given_name: p.given_name, family_name: p.family_name, sub: p.sub };
    } catch {
      return sendError(reply, 401, "OAUTH_FAILED", "Sign in with Google failed. Please try again.");
    }

        try {
      const { email, given_name: firstName, family_name: lastName, sub: googleSub } = googlePayload;

      // Check if account exists
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (!existingByEmail) {
        // Prevent Providers from creating new accounts through Google OAuth.
        if (userType === "provider") {
          return sendError(
            reply,
            400,
            "REGISTRATION_DENIED",
            "Providers are not allowed to use Google OAuth for initial registration."
          );
        }

        // Guest is allowed to register
        const user = await prisma.user.create({
          data: {
            firstName: firstName ?? "User",
            lastName: lastName ?? "",
            email,
            status: "active",
            emailVerified: true,
            emailVerifiedAt: new Date(),
            oauthProvider: "google",
            oauthSub: googleSub,
            userType: "guest",
            businessName: businessName ?? null,
            country: country ?? null,
          },
        });
        await sendWelcomeEmail(email, user.firstName).catch(() => null);
        const tokens = await issueTokens(reply, user.id, user.userType, user.status, user.country);
        fireAndForgetBookingClaim(email, tokens.accessToken);
        return sendSuccess(reply, 201, { user: publicUser(user), tokens, needsAccountType: false });
      }

      let user = existingByEmail;

      if (user.userType === "provider") {
        // After a Provider account has been created and verified, the Provider may use "Continue with Google" to sign in
        if (!user.emailVerified || user.status !== "active") {
          return sendError(
            reply,
            403,
            "EMAIL_NOT_VERIFIED",
            "Please verify your email address to sign in."
          );
        }

        // Google email exactly matches the Provider's registered email (since we did a findUnique by email).
        // Link the oauth provider details if they are not already set.
        if (!user.oauthProvider || user.oauthProvider !== "google") {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              oauthProvider: "google",
              oauthSub: googleSub,
            },
          });
        }
      } else {
        // Existing Guest user
        if (!user.oauthProvider) {
          return sendError(
            reply,
            409,
            "ACCOUNT_EXISTS",
            "An account with this email already exists. Please sign in with your password."
          );
        }
      }

      // Returning user
      if (user.status === "suspended") {
        return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
      }
      if (user.status === "banned") {
        return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from Kainook.");
      }

      const tokens = await issueTokens(reply, user.id, user.userType, user.status, user.country);
      fireAndForgetBookingClaim(user.email, tokens.accessToken);
      return sendSuccess(reply, 200, { user: publicUser(user), tokens, needsAccountType: false });
    } catch (err) {
      return sendError(reply, 400, "OAUTH_FAILED", "Sign in with Google could not be completed. Please try again.");
    }
  });

  // ── POST /auth/oauth/apple  (UC-1.7) ───────────────────────────────────────
  app.post("/auth/oauth/apple", {
    schema: {
      tags: ["User Auth"], body: {
        type: "object",
        required: ["identityToken"],
        properties: {
          identityToken: {
            type: "string"
          },
          userType: {
            type: "string",
          },
          // businessName: {
          //   type: "string"
          // },
          // country: {
          //   type: "string"
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = appleOAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        JSON.stringify(parsed.error.format(), null, 2)
      );

      return reply.status(422).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid payload",
          details: parsed.error.flatten(),
        },
      });
    }
    const { identityToken, userType, businessName, country, phone } = parsed.data;

    let appleSub: string;
    let appleEmail: string;
    try {
      // Verify Apple identity token (public keys from Apple's JWKS endpoint)
      const JWKS = jose.createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
      const { payload } = await jwtVerify(identityToken, JWKS, { issuer: "https://appleid.apple.com", audience: process.env["APPLE_CLIENT_ID"] ?? "" });
      if (!payload.sub) throw new Error("Missing sub");
      appleSub = payload.sub as string;
      appleEmail = (payload.email as string) ?? `${appleSub}@privaterelay.appleid.com`;
    } catch {
      return sendError(reply, 401, "OAUTH_FAILED", "Sign in with Apple failed. Please try again.");
    }

    try {
      // Look up by sub first, then email
      let user = await prisma.user.findFirst({ where: { oauthProvider: "apple", oauthSub: appleSub } })
        ?? await prisma.user.findUnique({ where: { email: appleEmail } });

      if (user && !user.oauthProvider) {
        return sendError(reply, 409, "ACCOUNT_EXISTS", "An account with this email already exists. Please sign in with your password.");
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            firstName: "User",
            lastName: "",
            email: appleEmail,
            status: "active",
            emailVerified: true,
            emailVerifiedAt: new Date(),
            oauthProvider: "apple",
            oauthSub: appleSub,
            userType: (userType ?? "guest") as "guest" | "provider",
            businessName: businessName ?? null,
            country: country ?? null,
            phone: phone ?? null,
          },
        });
        await sendWelcomeEmail(appleEmail, user.firstName).catch(() => null);
        const tokens = await issueTokens(reply, user.id, user.userType, user.status, user.country);
        fireAndForgetBookingClaim(user.email, tokens.accessToken);
        return sendSuccess(reply, 201, { user: publicUser(user), tokens, needsAccountType: !userType });
      }
      if (user.status === "pending_verification") {
        return sendError(reply, 403, "EMAIL_NOT_VERIFIED", "Please verify your email address to sign in.");
      }
      if (user.status === "suspended") return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
      if (user.status === "banned") return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from Kainook.");

      const tokens = await issueTokens(reply, user.id, user.userType, user.status, user.country);
      fireAndForgetBookingClaim(user.email, tokens.accessToken);
      return sendSuccess(reply, 200, { user: publicUser(user), tokens, needsAccountType: false });
    } catch (err) {
      return sendError(reply, 400, "OAUTH_FAILED", "Sign in with Apple could not be completed. Please try again.");
    }
  });

  // ── POST /auth/account-type  (post-OAuth account type selection) ──────────
  app.post("/auth/account-type", {
    schema: {
      tags: ["User Auth"],
      body: {
        type: "object",
        required: ["userType"],
        properties: {
          userType: {
            type: "string",
            enum: ["guest", "provider"],
          },
          businessName: {
            type: "string",
          },
          country: {
            type: "string",
            minLength: 2,
            maxLength: 2,
            description: "2-letter ISO country code (e.g. IN, US)",
          },
          phone: {
            type: "string",
            description: "International format, required for providers",
          },
        },
      },
    },
    preHandler: [requireAuth],
  },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = accountTypeSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(
          reply,
          422,
          "VALIDATION_ERROR",
          "Validation failed",
          zodFieldErrors((parsed.error as ZodError).issues)
        );
      }

      const userId = (req as FastifyRequest & { userId: string }).userId;
      const { userType, businessName, country, phone } = parsed.data;

      try {
        const updated = await prisma.user.update({
          where: { id: userId },
          data: {
            userType,
            businessName: businessName ?? null,
            country: country ?? null,
            phone: phone ?? null,
          },
        });

        return sendSuccess(reply, 200, {
          message: "Account type updated successfully.",
          user: publicUser(updated),
        });
      } catch (err: any) {
        if (err?.code === "P2025") {
          return sendError(reply, 404, "USER_NOT_FOUND", "Your account could not be found.");
        }
        return sendError(reply, 400, "UPDATE_FAILED", "Account type could not be updated. Please try again.");
      }
    }
  );


  // ── GET /auth/oauth/google/redirect (Web OAuth Start) ──────────────────────
  app.get("/auth/oauth/google/redirect", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const redirectUri = `${process.env["WEB_BASE_URL"] ?? "http://localhost:3000"}/api/auth/oauth/google/callback`;
      const client = new OAuth2Client({
        clientId: process.env["GOOGLE_CLIENT_ID_WEB"],
        clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
        redirectUri,
      });

      const authUrl = client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/userinfo.email",
        ],
        prompt: "select_account",
      });

      reply.redirect(authUrl);
    } catch {
      return sendError(reply, 400, "OAUTH_INIT_FAILED", "Google sign-in could not be initiated. Please try again.");
    }
  });


  // ── GET /auth/oauth/google/callback (Web OAuth Callback) ──────────────────
  app.get("/auth/oauth/google/callback", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { code, error } = req.query as { code?: string; error?: string };

    const webBaseUrl = process.env["WEB_BASE_URL"] ?? "http://localhost:3000";

    if (error || !code) {
      const errMsg = error || "Google authentication failed";
      return reply.redirect(`${webBaseUrl}/auth/login?error=OAUTH_FAILED&message=${encodeURIComponent(errMsg)}`);
    }

    try {
      const redirectUri = `${webBaseUrl}/api/auth/oauth/google/callback`;
      const client = new OAuth2Client({
        clientId: process.env["GOOGLE_CLIENT_ID_WEB"],
        clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
        redirectUri,
      });

      const { tokens: googleTokens } = await client.getToken(code);
      client.setCredentials(googleTokens);

      const idToken = googleTokens.id_token;
      if (!idToken) throw new Error("Missing ID Token from Google");

      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env["GOOGLE_CLIENT_ID_WEB"],
      });

      const payload = ticket.getPayload();
      if (!payload?.email || !payload?.sub) throw new Error("Missing email or sub in ID Token");

      const { email, given_name: firstName, family_name: lastName, sub: googleSub } = payload;

      // Check if account exists with a different auth method
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail && !existingByEmail.oauthProvider) {
        const errMsg = "An account with this email already exists. Please sign in with your password.";
        return reply.redirect(`${webBaseUrl}/auth/login?error=ACCOUNT_EXISTS&message=${encodeURIComponent(errMsg)}`);
      }

      let user = existingByEmail;

      if (!user) {
        // New user
        user = await prisma.user.create({
          data: {
            firstName: firstName ?? "User",
            lastName: lastName ?? "",
            email,
            status: "active",
            emailVerified: true,
            emailVerifiedAt: new Date(),
            oauthProvider: "google",
            oauthSub: googleSub,
            userType: "guest", // Default to guest
          },
        });
        await sendWelcomeEmail(email, user.firstName).catch(() => null);
      } else {
        // Returning user
        if (user.status === "suspended") {
          return reply.redirect(`${webBaseUrl}/auth/login?error=ACCOUNT_SUSPENDED&message=${encodeURIComponent("Your account has been suspended.")}`);
        }
        if (user.status === "banned") {
          return reply.redirect(`${webBaseUrl}/auth/login?error=ACCOUNT_BANNED&message=${encodeURIComponent("Your account has been permanently removed.")}`);
        }
      }

      // Issue Zika tokens and set HTTP-only cookie
      const tokens = await issueTokens(reply, user.id, user.userType, user.status, user.country);
      fireAndForgetBookingClaim(user.email, tokens.accessToken);

      // Return a beautiful loading HTML that initializes sessionStorage and redirects
      reply.type("text/html").send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticating...</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: radial-gradient(circle at 10% 20%, rgb(87, 108, 117) 0%, rgb(37, 50, 55) 100.2%);
      font-family: 'Outfit', sans-serif;
      color: #ffffff;
      overflow: hidden;
    }
    .container {
      text-align: center;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 3rem;
      border-radius: 24px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      max-width: 400px;
      width: 90%;
      animation: fadeIn 0.8s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .logo {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.05em;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #a5f3fc 0%, #0284c7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 1rem;
      margin-bottom: 2rem;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-left-color: #38bdf8;
      border-radius: 50%;
      margin: 0 auto 2rem;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .status {
      font-size: 1.1rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 0.5rem;
    }
    .redirect-text {
      font-size: 0.875rem;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Kainook</div>
    <div class="subtitle">Secure Google Authentication</div>
    <div class="spinner"></div>
    <div class="status" id="status-text">Completing sign-in...</div>
    <div class="redirect-text">Please wait while we redirect you.</div>
  </div>

  <script>
    try {
      const accessToken = "${tokens.accessToken}";
      const userType = "${user.userType}";
      
      // Store token in session storage
      sessionStorage.setItem("zika:access_token", accessToken);
      
      // Redirect based on user type
      setTimeout(() => {
        const dest = userType === "provider" ? "/listings" : "/traveller";
        window.location.href = dest;
      }, 800);
    } catch (e) {
      console.error(e);
      document.getElementById('status-text').innerText = "An error occurred during redirection.";
      setTimeout(() => {
        window.location.href = "/auth/login?error=REDIRECT_FAILED";
      }, 2000);
    }
  </script>
</body>
</html>
      `);
    } catch (err: any) {
      app.log.error(err);
      return reply.redirect(`${webBaseUrl}/auth/login?error=OAUTH_FAILED&message=${encodeURIComponent(err.message || "OAuth verification failed")}`);
    }
  });
}

// ── Auth middleware for protected routes ─────────────────────────────────────

async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return sendError(reply, 401, "NO_TOKEN", "Authentication required.");
  try {
    const payload = await verifyAccessToken(authHeader.slice(7));
    (req as FastifyRequest & { userId: string }).userId = payload.sub;
  } catch {
    return sendError(reply, 401, "INVALID_TOKEN", "Invalid or expired token.");
  }
}

// Re-export so admin routes can use it
export { requireAuth };

// Fix jose import collision
async function jwtVerify(token: string, jwks: ReturnType<typeof jose.createRemoteJWKSet>, options: { issuer: string; audience: string }) {
  return jose.jwtVerify(token, jwks, options);
}
