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
import {
  signAccessToken,
  generateRefreshToken,
  verifyAccessToken,
} from "../lib/jwt";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../lib/email";
import { incrementCounter, getCooldown, setCooldown } from "../lib/redis";
import { sendError, sendSuccess, zodFieldErrors } from "../lib/errors";
import { OAuth2Client } from "google-auth-library";
import * as jose from "jose";

const REFRESH_TTL = Number(process.env["JWT_REFRESH_TTL_SECONDS"] ?? 2592000);
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "strict" as const,
  maxAge: REFRESH_TTL,
  path: "/",
};

// ── Helper: issue tokens and set cookie ─────────────────────────────────────

async function issueTokens(
  reply: FastifyReply,
  userId: string,
  userType: string,
  status: string,
) {
  const accessToken = await signAccessToken({ sub: userId, type: userType as "guest" | "provider", status });
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);

  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  reply.setCookie("refreshToken", refreshToken, COOKIE_OPTS);

  return { accessToken, expiresIn: Number(process.env["JWT_ACCESS_TTL_SECONDS"] ?? 900) };
}

// ── Helper: map User to public shape ─────────────────────────────────────────

function publicUser(u: {
  id: string; firstName: string; lastName: string; email: string;
  status: string; userType: string; businessName: string | null;
  country: string | null; emailVerified: boolean; currentTier: string;
  loyaltyPoints: number;
}) {
  return {
    id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
    status: u.status, userType: u.userType, businessName: u.businessName,
    country: u.country, emailVerified: u.emailVerified,
    currentTier: u.currentTier, loyaltyPoints: u.loyaltyPoints,
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
          country: {
            type: "string",
            minLength: 2,
            maxLength: 2,
            description: "2-letter ISO country code (e.g. 'IN', 'US')"
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
      country
    } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
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
        "active"
      );

      return sendSuccess(reply, 201, {
        user: publicUser(user),
        tokens
      });
    }

    // Email verification flow
    const plainToken = generateToken();

    console.log("EMAIL VERIFICATION TOKEN:", plainToken);

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
          "Your verification link has expired."
        );
      }

      // Already verified
      if (record.user.emailVerified && record.user.status === "active") {
        const tokens = await issueTokens(
          reply,
          record.user.id,
          record.user.userType,
          "active"
        );

        return sendSuccess(reply, 200, {
          message: "You're already verified. Welcome back!",
          user: publicUser(record.user),
          tokens,
        });
      }

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
        "active"
      );

      return sendSuccess(reply, 200, {
        message: "Email verified — welcome to ZikaBooking!",
        user: publicUser(updatedUser),
        tokens,
      });
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
      return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from ZikaBooking.");
    }

    console.log("[Login] SUCCESS → issuing tokens for user:", user.id);
    const tokens = await issueTokens(reply, user.id, user.userType, user.status);
    return sendSuccess(reply, 200, { user: publicUser(user), tokens });
  });

  // ── POST /auth/logout  (UC-1.9) ────────────────────────────────────────────
  app.post("/auth/logout", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = req.cookies["refreshToken"];
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.session.updateMany({ where: { tokenHash }, data: { revoked: true } });
    }
    reply.clearCookie("refreshToken", { path: "/" });
    return sendSuccess(reply, 200, { message: "Signed out successfully." });
  });

  // ── POST /auth/logout-all  (UC-1.9 A2) ────────────────────────────────────
  app.post("/auth/logout-all", { schema: { tags: ["User Auth"] }, preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as FastifyRequest & { userId: string }).userId;
    await prisma.session.updateMany({ where: { userId }, data: { revoked: true } });
    reply.clearCookie("refreshToken", { path: "/" });
    return sendSuccess(reply, 200, { message: "Signed out from all devices." });
  });

  // ── POST /auth/refresh  (UC-1.5) ───────────────────────────────────────────
  app.post("/auth/refresh", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = req.cookies["refreshToken"];
    if (!refreshToken) return sendError(reply, 401, "NO_TOKEN", "No refresh token.");

    const tokenHash = hashToken(refreshToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revoked || session.expiresAt < new Date()) {
      reply.clearCookie("refreshToken", { path: "/" });
      return sendError(reply, 401, "INVALID_TOKEN", "Session expired. Please sign in again.");
    }
    if (session.user.status !== "active") {
      return sendError(reply, 403, "ACCOUNT_INACTIVE", "Account is not active.");
    }

    // Rotate: revoke old, issue new
    await prisma.session.update({ where: { id: session.id }, data: { revoked: true } });
    const tokens = await issueTokens(reply, session.userId, session.user.userType, session.user.status);
    return sendSuccess(reply, 200, { tokens });
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

    const user = await prisma.user.findUnique({ where: { email } });

    //   if (user && user.status === "active" && user.passwordHash) {
    //     const plainToken = generateToken();
    //     const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    //     await prisma.verificationToken.create({
    //       data: { userId: user.id, tokenHash: hashToken(plainToken), tokenType: "password_reset", expiresAt },
    //     });
    //     await sendPasswordResetEmail(email, plainToken).catch(() => null);
    //   }

    //   return sendSuccess(reply, 200, { message: "If an account with that email exists, we've sent a password reset link." });
    // });



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

      console.log("RESET TOKEN:", plainToken);

      await sendPasswordResetEmail(email, plainToken).catch(() => null);
    }

    return sendSuccess(reply, 200, {
      message: "If an account with that email exists, we've sent a password reset link.",

    });
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
    // const parsed = resetPasswordSchema.safeParse(req.body);
    // if (!parsed.success) {
    //   return sendError(reply, 422, "VALIDATION_ERROR", "Validation failed",
    //     zodFieldErrors((parsed.error as ZodError).issues));
    // }


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

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: record.id }, data: { used: true, usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.session.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
    ]);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
    const tokens = await issueTokens(reply, updatedUser.id, updatedUser.userType, updatedUser.status);

    return sendSuccess(reply, 200, { message: "Your password has been updated. You're now signed in.", user: publicUser(updatedUser), tokens });
  });

  // ── POST /auth/oauth/google  (UC-1.6) ──────────────────────────────────────
  app.post("/auth/oauth/google", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    const { email, given_name: firstName, family_name: lastName, sub: googleSub } = googlePayload;

    // Check if account exists with a different auth method
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail && !existingByEmail.oauthProvider) {
      return sendError(reply, 409, "ACCOUNT_EXISTS", "An account with this email already exists. Please sign in with your password.");
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
          userType: (userType ?? "guest") as "guest" | "provider",
          businessName: businessName ?? null,
          country: country ?? null,
        },
      });
      await sendWelcomeEmail(email, user.firstName).catch(() => null);
      const tokens = await issueTokens(reply, user.id, user.userType, user.status);
      const needsAccountType = !userType;
      return sendSuccess(reply, 201, { user: publicUser(user), tokens, needsAccountType });
    }

    // Returning user
    if (user.status === "pending_verification") {
      return sendError(reply, 403, "EMAIL_NOT_VERIFIED", "Please verify your email address to sign in.");
    }
    if (user.status === "suspended") return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
    if (user.status === "banned") return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from ZikaBooking.");

    const tokens = await issueTokens(reply, user.id, user.userType, user.status);
    return sendSuccess(reply, 200, { user: publicUser(user), tokens, needsAccountType: false });
  });

  // ── POST /auth/oauth/apple  (UC-1.7) ───────────────────────────────────────
  app.post("/auth/oauth/apple", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = appleOAuthSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid payload.");
    const { identityToken, userType, businessName, country } = parsed.data;

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
        },
      });
      await sendWelcomeEmail(appleEmail, user.firstName).catch(() => null);
      const tokens = await issueTokens(reply, user.id, user.userType, user.status);
      return sendSuccess(reply, 201, { user: publicUser(user), tokens, needsAccountType: !userType });
    }

    if (user.status === "pending_verification") {
      return sendError(reply, 403, "EMAIL_NOT_VERIFIED", "Please verify your email address to sign in.");
    }
    if (user.status === "suspended") return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
    if (user.status === "banned") return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from ZikaBooking.");

    const tokens = await issueTokens(reply, user.id, user.userType, user.status);
    return sendSuccess(reply, 200, { user: publicUser(user), tokens, needsAccountType: false });
  });

  // ── POST /auth/account-type  (post-OAuth account type selection) ───────────
  // app.post("/auth/account-type", { schema: { tags: ["User Auth"] }, preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
  //   const parsed = accountTypeSchema.safeParse(req.body);
  //   if (!parsed.success) {
  //     return sendError(reply, 422, "VALIDATION_ERROR", "Validation failed",
  //       zodFieldErrors((parsed.error as ZodError).issues));
  //   }
  //   const userId = (req as FastifyRequest & { userId: string }).userId;
  //   const { userType, businessName, country } = parsed.data;
  //   const isProvider = userType === "provider";
  //   const updated = await prisma.user.update({
  //     where: { id: userId },
  //     data: {
  //       userType: userType as "guest" | "provider",
  //       businessName: businessName ?? null,
  //       country: country ?? null,
  //       status: isProvider ? "pending_verification" : undefined,
  //     },
  //   });

  //   if (isProvider) {
  //     await prisma.session.updateMany({
  //       where: { userId },
  //       data: { revoked: true },
  //     });
  //     reply.clearCookie("refreshToken", { path: "/" });
  //   }

  //   return sendSuccess(reply, 200, { user: publicUser(updated) });
  // });


  app.post(
    "/auth/account-type",
    {
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
      const { userType, businessName, country } = parsed.data;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          userType,
          businessName: businessName ?? null,
          country: country ?? null,
        },
      });

      return sendSuccess(reply, 200, {
        message: "Account type updated successfully.",
        user: publicUser(updated),
      });
    }
  );


  // ── GET /auth/oauth/google/redirect (Web OAuth Start) ──────────────────────
  app.get("/auth/oauth/google/redirect", { schema: { tags: ["User Auth"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
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
      const tokens = await issueTokens(reply, user.id, user.userType, user.status);

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
    <div class="logo">ZikaBooking</div>
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
