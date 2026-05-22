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
      body: {
        type: "object",
        required: ["firstName", "lastName", "email", "password", "confirmPassword", "userType"],
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string" },
          confirmPassword: { type: "string" },
          userType: { type: "string", enum: ["guest", "provider"] },
          businessName: { type: "string" },
          country: { type: "string", minLength: 2, maxLength: 2, description: "2-letter ISO country code (e.g. 'IN', 'US')" },
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Validation failed",
        zodFieldErrors((parsed.error as ZodError).issues));
    }
    const { firstName, lastName, email, password, userType, businessName, country } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendError(reply, 409, "EMAIL_EXISTS", "An account with this email already exists.", {
        email: "An account with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(password);
    const isDev = process.env["NODE_ENV"] !== "production";
    const user = await prisma.user.create({
      data: {
        firstName, lastName, email, passwordHash,
        userType: userType as "guest" | "provider",
        businessName: businessName ?? null,
        country: country ?? null,
        ...(isDev ? { status: "active", emailVerified: true, emailVerifiedAt: new Date() } : {}),
      },
    });

    if (isDev) {
      const tokens = await issueTokens(reply, user.id, user.userType, "active");
      return sendSuccess(reply, 201, { user: publicUser(user), tokens });
    }

    const plainToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.verificationToken.create({
      data: { userId: user.id, tokenHash: hashToken(plainToken), tokenType: "email_verification", expiresAt },
    });

    await sendVerificationEmail(email, plainToken).catch(() => null);
    await prisma.emailLog.create({
      data: { userId: user.id, type: "verification", recipient: email, status: "sent", sentAt: new Date() },
    });

    return sendSuccess(reply, 201, { message: "Registration successful. Please check your email to verify your account." });
  });

  // ── GET /auth/verify  (UC-1.3) ─────────────────────────────────────────────
  app.get("/auth/verify", async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.query as { token?: string };
    if (!token || token.length !== 64) {
      return sendError(reply, 400, "INVALID_TOKEN", "This verification link is invalid. Please request a new one.");
    }

    // Rate limit: 10 req/min per IP (BR-1.7)
    const ip = req.ip;
    const rlCount = await incrementCounter(`rl:verify:${ip}`, 60);
    if (rlCount > 10) {
      return sendError(reply, 429, "RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
    }

    const tokenHash = hashToken(token);
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.tokenType !== "email_verification") {
      return sendError(reply, 400, "INVALID_TOKEN", "This verification link is invalid. Please request a new one.");
    }
    if (record.used) {
      return sendError(reply, 400, "TOKEN_USED", "This verification link has already been used. If you need to verify your email, please request a new link.");
    }
    if (record.expiresAt < new Date()) {
      return sendError(reply, 410, "TOKEN_EXPIRED", "Your verification link has expired.");
    }

    // Already active (A3)
    if (record.user.status === "active") {
      const tokens = await issueTokens(reply, record.user.id, record.user.userType, "active");
      return sendSuccess(reply, 200, { message: "You're already verified. Welcome back!", user: publicUser(record.user), tokens });
    }

    // Atomic update
    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: record.id }, data: { used: true, usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { status: "active", emailVerified: true, emailVerifiedAt: new Date() } }),
    ]);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
    const tokens = await issueTokens(reply, updatedUser.id, updatedUser.userType, "active");

    return sendSuccess(reply, 200, { message: "Email verified — welcome to ZikaBooking!", user: publicUser(updatedUser), tokens });
  });

  // ── POST /auth/resend-verification  (UC-1.4) ───────────────────────────────
  app.post("/auth/resend-verification", {
    schema: {
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
    if (!user || user.status !== "pending_verification") {
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
    await sendVerificationEmail(email, plainToken).catch(() => null);
    await prisma.emailLog.create({
      data: { userId: user.id, type: "verification_resend", recipient: email, status: "sent", sentAt: new Date() },
    });

    return sendSuccess(reply, 200, { message: "Verification email resent. Please check your inbox." });
  });

  // ── POST /auth/login  (UC-1.5) ─────────────────────────────────────────────
  app.post("/auth/login", {
    schema: {
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
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid credentials.");
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const GENERIC = "Incorrect email or password.";

    // Timing-safe: always run bcrypt even if user not found (prevents timing attacks)
    const dummyHash = "$2b$12$invalidhashfortimingprotection000000000000000000000000000";
    const passwordOk = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, dummyHash).then(() => false);

    if (!user || !passwordOk) return sendError(reply, 401, "INVALID_CREDENTIALS", GENERIC);

    if (user.status === "pending_verification") {
      return sendError(reply, 403, "EMAIL_NOT_VERIFIED", "Please verify your email address to sign in.");
    }
    if (user.status === "suspended") {
      return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended. Please contact support for assistance.");
    }
    if (user.status === "banned") {
      return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from ZikaBooking.");
    }

    const tokens = await issueTokens(reply, user.id, user.userType, user.status);
    return sendSuccess(reply, 200, { user: publicUser(user), tokens });
  });

  // ── POST /auth/logout  (UC-1.9) ────────────────────────────────────────────
  app.post("/auth/logout", async (req: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = req.cookies["refreshToken"];
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.session.updateMany({ where: { tokenHash }, data: { revoked: true } });
    }
    reply.clearCookie("refreshToken", { path: "/" });
    return sendSuccess(reply, 200, { message: "Signed out successfully." });
  });

  // ── POST /auth/logout-all  (UC-1.9 A2) ────────────────────────────────────
  app.post("/auth/logout-all", { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as FastifyRequest & { userId: string }).userId;
    await prisma.session.updateMany({ where: { userId }, data: { revoked: true } });
    reply.clearCookie("refreshToken", { path: "/" });
    return sendSuccess(reply, 200, { message: "Signed out from all devices." });
  });

  // ── POST /auth/refresh  (UC-1.5) ───────────────────────────────────────────
  app.post("/auth/refresh", async (req: FastifyRequest, reply: FastifyReply) => {
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
    if (user && user.status === "active" && user.passwordHash) {
      const plainToken = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.verificationToken.create({
        data: { userId: user.id, tokenHash: hashToken(plainToken), tokenType: "password_reset", expiresAt },
      });
      await sendPasswordResetEmail(email, plainToken).catch(() => null);
    }

    return sendSuccess(reply, 200, { message: "If an account with that email exists, we've sent a password reset link." });
  });

  // ── POST /auth/reset-password  (UC-1.8) ────────────────────────────────────
  app.post("/auth/reset-password", {
    schema: {
      body: {
        type: "object",
        required: ["token", "password"],
        properties: {
          token: { type: "string" },
          password: { type: "string" },
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Validation failed",
        zodFieldErrors((parsed.error as ZodError).issues));
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
  app.post("/auth/oauth/google", async (req: FastifyRequest, reply: FastifyReply) => {
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
    if (user.status === "suspended") return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
    if (user.status === "banned") return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from ZikaBooking.");

    const tokens = await issueTokens(reply, user.id, user.userType, user.status);
    return sendSuccess(reply, 200, { user: publicUser(user), tokens, needsAccountType: false });
  });

  // ── POST /auth/oauth/apple  (UC-1.7) ───────────────────────────────────────
  app.post("/auth/oauth/apple", async (req: FastifyRequest, reply: FastifyReply) => {
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

    if (user.status === "suspended") return sendError(reply, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
    if (user.status === "banned") return sendError(reply, 403, "ACCOUNT_BANNED", "Your account has been permanently removed from ZikaBooking.");

    const tokens = await issueTokens(reply, user.id, user.userType, user.status);
    return sendSuccess(reply, 200, { user: publicUser(user), tokens, needsAccountType: false });
  });

  // ── POST /auth/account-type  (post-OAuth account type selection) ───────────
  app.post("/auth/account-type", { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = accountTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Validation failed",
        zodFieldErrors((parsed.error as ZodError).issues));
    }
    const userId = (req as FastifyRequest & { userId: string }).userId;
    const { userType, businessName, country } = parsed.data;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { userType: userType as "guest" | "provider", businessName: businessName ?? null, country: country ?? null },
    });
    return sendSuccess(reply, 200, { user: publicUser(updated) });
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
