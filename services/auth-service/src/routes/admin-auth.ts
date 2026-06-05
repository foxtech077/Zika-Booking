import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { adminLoginSchema, totpCodeSchema, recoveryCodeSchema } from "@zika/validators";
import { prisma } from "../lib/prisma";
import type { AdminRole as PrismaAdminRole } from "../../node_modules/.prisma/client/index.js";
import { verifyPassword, hashPassword } from "../lib/password";
import { hashToken } from "../lib/crypto";
import {
  signIntermediateToken,
  verifyIntermediateToken,
  signAdminSessionToken,
  verifyAdminSessionToken,
} from "../lib/jwt";
import {
  generateTotpSecret,
  verifyTotpCode,
  encryptTotpSecret,
  decryptTotpSecret,
  buildOtpAuthUri,
  generateQrCode,
  generateRecoveryCodes,
} from "../lib/totp";
import {
  startRegistration as waStartRegistration,
  finishRegistration as waFinishRegistration,
  startAuthentication as waStartAuthentication,
  finishAuthentication as waFinishAuthentication,
} from "../lib/webauthn";
import { sendError, sendSuccess, zodFieldErrors } from "../lib/errors";
import { incrementCounter } from "../lib/redis";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

const SESSION_INACTIVITY = Number(process.env["ADMIN_SESSION_INACTIVITY_SECONDS"] ?? 28800);
const SESSION_TTL_DAYS = 30;

// ── Middleware: verify intermediate token ─────────────────────────────────────

async function requireIntermediate(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers["x-intermediate-token"] as string | undefined;
  if (!token) return sendError(reply, 401, "NO_TOKEN", "Intermediate token required.");
  try {
    const payload = await verifyIntermediateToken(token);
    (req as FastifyRequest & { adminIntermediate: typeof payload }).adminIntermediate = payload;
  } catch (err) {
    req.log.error(err, "Intermediate token verification failed");
    return sendError(reply, 401, "INVALID_TOKEN", "Intermediate token invalid or expired.");
  }
}

// ── Middleware: verify admin session ──────────────────────────────────────────

export async function requireAdminSession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.slice(7);
  if (!token) return sendError(reply, 401, "NO_TOKEN", "Admin session required.");
  try {
    const payload = await verifyAdminSessionToken(token);
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!session || session.revoked) return sendError(reply, 401, "INVALID_SESSION", "Session invalid.");
    // Inactivity check (BR-1.11)
    const idleMs = Date.now() - session.lastActiveAt.getTime();
    if (idleMs > SESSION_INACTIVITY * 1000) {
      await prisma.adminSession.update({ where: { id: session.id }, data: { revoked: true } });
      return sendError(reply, 401, "SESSION_EXPIRED", "Your session has expired due to inactivity. Please sign in again.");
    }
    // Refresh lastActiveAt
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } });
    (req as FastifyRequest & { adminId: string; adminRole: string }).adminId = payload.sub;
    (req as FastifyRequest & { adminId: string; adminRole: string }).adminRole = payload.role;
  } catch {
    return sendError(reply, 401, "INVALID_TOKEN", "Admin token invalid or expired.");
  }
}

// ── Helper: issue admin session ───────────────────────────────────────────────

async function issueAdminSession(adminId: string, role: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Create a placeholder session to get a sessionId, then sign the JWT with it
  const tempSession = await prisma.adminSession.create({
    data: {
      adminUserId: adminId,
      tokenHash: "pending",
      expiresAt,
    },
  });

  // Sign the JWT — this IS the session token returned to the client
  const jwt = await signAdminSessionToken({ sub: adminId, role, sessionId: tempSession.id });

  // Hash the JWT for DB revocation lookups (client sends JWT, we hash it to find the session)
  const tokenHash = hashToken(jwt);
  await prisma.adminSession.update({
    where: { id: tempSession.id },
    data: { tokenHash },
  });

  return jwt;
}

// ── Helper: log audit event ───────────────────────────────────────────────────

async function writeAudit(
  adminId: string,
  role: string,
  action: string,
  req: FastifyRequest,
  opts?: { targetType?: string; targetId?: string; oldValue?: string; newValue?: string; reason?: string },
) {
  await prisma.auditLog.create({
    data: {
      adminId,
      role,
      action,
      targetType: opts?.targetType ?? null,
      targetId: opts?.targetId ?? null,
      oldValue: opts?.oldValue ?? null,
      newValue: opts?.newValue ?? null,
      ipAddress: req.ip,
    },
  });
}

// ── Helper: log failed TOTP attempt and lock if needed ───────────────────────

async function checkTotpAttempts(adminId: string): Promise<boolean> {
  const count = await incrementCounter(`totp:fail:${adminId}`, 15 * 60);
  return count >= 5; // locked after 5 consecutive failures
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function adminAuthRoutes(app: FastifyInstance) {

  // ── POST /admin/auth/login  (UC-1.11 step 1, UC-1.12 step 1) ─────────────
  app.post("/admin/auth/login", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } } } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid credentials.");
    const { email, password } = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    const GENERIC = "Incorrect email or password.";

    const dummyHash = "$2b$12$invalidhashfortimingprotection000000000000000000000000000";
    const ok = admin ? await verifyPassword(password, admin.passwordHash) : await verifyPassword(password, dummyHash).then(() => false);
    if (!admin || !ok) return sendError(reply, 401, "INVALID_CREDENTIALS", GENERIC);

    // Enforce TOTP 2FA (PRD UC-1.10 and UC-1.11)
    const intermediateToken = await signIntermediateToken({
      sub: admin.id,
      role: admin.role,
      step: "awaiting_totp",
    });

    if (admin.totpEnabled) {
      await writeAudit(admin.id, admin.role, "admin_login_attempt", req);
      return sendSuccess(reply, 200, {
        totpRequired: true,
        setupRequired: false,
        intermediateToken,
      });
    } else {
      await writeAudit(admin.id, admin.role, "admin_login_attempt_setup_required", req);
      return sendSuccess(reply, 200, {
        totpRequired: true,
        setupRequired: true,
        intermediateToken,
      });
    }
  });

  // ── POST /admin/auth/totp/setup  (UC-1.10 — first login) ─────────────────
  app.post("/admin/auth/totp/setup", { schema: { tags: ["Admin Auth"] }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub: adminId } = (req as FastifyRequest & { adminIntermediate: { sub: string } }).adminIntermediate;
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });

    const secret = generateTotpSecret();
    const otpauthUri = buildOtpAuthUri(admin.email, secret);
    const qrCode = await generateQrCode(otpauthUri);

    // Store temp secret in Redis until confirmed
    const { getRedis } = await import("../lib/redis");
    await getRedis().set(`totp:pending:${adminId}`, secret, "EX", 600);

    return sendSuccess(reply, 200, { qrCodeDataUrl: qrCode, secret, otpauthUri });
  });

  // ── POST /admin/auth/totp/confirm  (UC-1.10 step 7 onward) ───────────────
  app.post("/admin/auth/totp/confirm", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["code"], properties: { code: { type: "string", description: "6-digit TOTP code from authenticator app" } } } }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = totpCodeSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid code format.");
    const { code } = parsed.data;
    const { sub: adminId, role } = (req as FastifyRequest & { adminIntermediate: { sub: string; role: string } }).adminIntermediate;

    const { getRedis } = await import("../lib/redis");
    const pendingSecret = await getRedis().get(`totp:pending:${adminId}`);
    if (!pendingSecret) return sendError(reply, 400, "SETUP_EXPIRED", "Setup session expired. Please start again.");

    if (!verifyTotpCode(pendingSecret, code)) {
      return sendError(reply, 400, "INVALID_CODE", "Invalid code. Please check your authenticator app and try again.");
    }

    const { plain: recoveryCodes, hashes } = generateRecoveryCodes();
    const encryptedSecret = encryptTotpSecret(pendingSecret);

    await prisma.$transaction([
      prisma.adminUser.update({ where: { id: adminId }, data: { totpEnabled: true, totpSecretEncrypted: encryptedSecret } }),
      prisma.adminRecoveryCode.createMany({ data: hashes.map((h) => ({ adminUserId: adminId, codeHash: h })) }),
    ]);
    await getRedis().del(`totp:pending:${adminId}`);

    const sessionToken = await issueAdminSession(adminId, role);
    await writeAudit(adminId, role, "totp_setup_completed", req);

    return sendSuccess(reply, 200, { message: "Two-factor authentication has been set up.", recoveryCodes, sessionToken });
  });

  // ── POST /admin/auth/totp/verify  (UC-1.11 step 5) ───────────────────────
  app.post("/admin/auth/totp/verify", { schema: { tags: ["Admin Auth"], body: { type: "object", properties: { code: { type: "string", description: "6-digit TOTP code from authenticator app" }, recoveryCode: { type: "string", description: "Recovery code as alternative to TOTP" } } } }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub: adminId, role } = (req as FastifyRequest & { adminIntermediate: { sub: string; role: string } }).adminIntermediate;

    // Check for recovery code usage
    const body = req.body as { code?: string; recoveryCode?: string };
    if (body.recoveryCode) {
      return handleRecoveryCode(req, reply, adminId, role, body.recoveryCode);
    }

    const parsed = totpCodeSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid code format.");
    const { code } = parsed.data;

    // Lockout check
    const locked = await checkTotpAttempts(adminId);
    if (locked) {
      await writeAudit(adminId, role, "totp_locked", req);
      return sendError(reply, 429, "TOTP_LOCKED", "Too many failed attempts. Please wait 15 minutes.");
    }

    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.totpSecretEncrypted) return sendError(reply, 400, "TOTP_NOT_SETUP", "TOTP not configured.");

    const secret = decryptTotpSecret(admin.totpSecretEncrypted);
    if (!verifyTotpCode(secret, code)) {
      return sendError(reply, 400, "INVALID_CODE", "Invalid verification code. Please try again.");
    }

    // Clear failed-attempt counter
    const { getRedis } = await import("../lib/redis");
    await getRedis().del(`totp:fail:${adminId}`);

    const sessionToken = await issueAdminSession(adminId, role);
    await writeAudit(adminId, role, "admin_login", req);

    return sendSuccess(reply, 200, { sessionToken });
  });

  // ── Recovery code handler ─────────────────────────────────────────────────
  async function handleRecoveryCode(
    req: FastifyRequest, reply: FastifyReply,
    adminId: string, role: string, code: string,
  ) {
    const codeHash = hashToken(code);
    const recovery = await prisma.adminRecoveryCode.findFirst({
      where: { adminUserId: adminId, codeHash, usedAt: null },
    });
    if (!recovery) return sendError(reply, 400, "INVALID_RECOVERY", "Invalid or already used recovery code.");

    await prisma.adminRecoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } });
    const sessionToken = await issueAdminSession(adminId, role);
    await writeAudit(adminId, role, "recovery_code_used", req);

    return sendSuccess(reply, 200, {
      sessionToken,
      warning: "Your recovery code has been used. Please set up a new authenticator app to maintain access.",
    });
  }

  // ── POST /admin/auth/webauthn/challenge  (UC-1.12 step 2) ────────────────
  app.post("/admin/auth/webauthn/challenge", { schema: { tags: ["Admin Auth"] }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub: adminId } = (req as FastifyRequest & { adminIntermediate: { sub: string } }).adminIntermediate;
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });


console.log("admin.fido2Credential =", admin.fido2Credential);


    if (!admin.fido2Credential) {
      return sendError(reply, 400, "NO_FIDO2", "No hardware key registered for this account.");
    }
    const cred = admin.fido2Credential as { id: string; publicKey: string; counter: number };
    const options = await waStartAuthentication(adminId, cred.id, cred.publicKey);
    return sendSuccess(reply, 200, { options });
  });

  // ── POST /admin/auth/webauthn/verify  (UC-1.12 step 6) ───────────────────
  app.post("/admin/auth/webauthn/verify", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["id", "rawId", "response", "type"], properties: { id: { type: "string" }, rawId: { type: "string" }, response: { type: "object" }, type: { type: "string", enum: ["public-key"] } } } }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub: adminId, role } = (req as FastifyRequest & { adminIntermediate: { sub: string; role: string } }).adminIntermediate;
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });

    if (!admin.fido2Credential) return sendError(reply, 400, "NO_FIDO2", "No hardware key registered.");
    const storedCred = admin.fido2Credential as { id: string; publicKey: string; counter: number };

    let verified: Awaited<ReturnType<typeof waFinishAuthentication>>;
    try {
      verified = await waFinishAuthentication(adminId, req.body, storedCred);
    } catch (err) {
      await writeAudit(adminId, role, "webauthn_failed", req);
      return sendError(reply, 401, "WEBAUTHN_FAILED", "Authentication failed. Please use your registered security key.");
    }

    if (!verified.verified) return sendError(reply, 401, "WEBAUTHN_FAILED", "Authentication failed.");

    // Update counter
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { fido2Credential: { ...storedCred, counter: verified.authenticationInfo.newCounter } },
    });

    const sessionToken = await issueAdminSession(adminId, role);
    await writeAudit(adminId, role, "admin_login", req);
    return sendSuccess(reply, 200, { sessionToken });
  });

  // ── POST /admin/auth/webauthn/register  (UC-1.12 A3) ─────────────────────
  app.post("/admin/auth/webauthn/register", { schema: { tags: ["Admin Auth"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    const options = await waStartRegistration(adminId, admin.email);
    return sendSuccess(reply, 200, { options });
  });

  // ── POST /admin/auth/webauthn/register/complete  (UC-1.12 A3) ─────────────────────
  app.post("/admin/auth/webauthn/register/complete", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["id", "rawId", "response", "type"], properties: { id: { type: "string" }, rawId: { type: "string" }, response: { type: "object" }, type: { type: "string", enum: ["public-key"] } } } }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;



    let result: Awaited<ReturnType<typeof waFinishRegistration>>;
    try {
      result = await waFinishRegistration(adminId, req.body);
    } catch {
      return sendError(reply, 400, "WEBAUTHN_FAILED", "Key registration failed.");
    }
    if (!result.verified || !result.registrationInfo) return sendError(reply, 400, "WEBAUTHN_FAILED", "Verification failed.");

    const { credential } = result.registrationInfo;
    await prisma.adminUser.update({
      where: { id: adminId },
      data: {
        fido2Credential: {
          id: credential.id,
          publicKey: isoBase64URL.fromBuffer(credential.publicKey),
          counter: credential.counter,
        },
      },
    });
    return sendSuccess(reply, 200, { message: "Security key registered successfully." });
  });


// app.post(
//   "/admin/auth/webauthn/register/complete",
//   {
//     schema: {
//       tags: ["Admin Auth"],
//       body: {
//         type: "object",
//         required: ["id", "rawId", "response", "type"],
//         properties: {
//           id: { type: "string" },
//           rawId: { type: "string" },
//           response: { type: "object" },
//           type: { type: "string", enum: ["public-key"] },
//         },
//       },
//     },
//     preHandler: [requireAdminSession],
//   },
//   async (req: FastifyRequest, reply: FastifyReply) => {
//     const adminId = (req as FastifyRequest & { adminId: string }).adminId;

//     // DEV ONLY
//     if (process.env.NODE_ENV === "development") {
//       await prisma.adminUser.update({
//         where: { id: adminId },
//         data: {
//           fido2Credential: {
//             id: "test",
//             publicKey: "test",
//             counter: 0,
//           },
//         },
//       });

//       const updated = await prisma.adminUser.findUnique({
//         where: { id: adminId },
//       });

//       console.log("DEV BYPASS EXECUTED");
//       console.log("Saved credential:", updated?.fido2Credential);

//       return sendSuccess(reply, 200, {
//         message: "Mock registration complete",
//       });
//     }

//     let result: Awaited<ReturnType<typeof waFinishRegistration>>;

//     try {
//       result = await waFinishRegistration(adminId, req.body);
//     } catch {
//       return sendError(
//         reply,
//         400,
//         "WEBAUTHN_FAILED",
//         "Key registration failed."
//       );
//     }

//     if (!result.verified || !result.registrationInfo) {
//       return sendError(
//         reply,
//         400,
//         "WEBAUTHN_FAILED",
//         "Verification failed."
//       );
//     }

//     const { credential } = result.registrationInfo;

//     await prisma.adminUser.update({
//       where: { id: adminId },
//       data: {
//         fido2Credential: {
//           id: credential.id,
//           publicKey: isoBase64URL.fromBuffer(credential.publicKey),
//           counter: credential.counter,
//         },
//       },
//     });

//     return sendSuccess(reply, 200, {
//       message: "Security key registered successfully.",
//     });
//   }
// );
  // ── POST /admin/auth/logout ───────────────────────────────────────────────
  app.post("/admin/auth/logout", { schema: { tags: ["Admin Auth"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.headers.authorization?.slice(7) ?? "";
    await prisma.adminSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revoked: true } });
    return sendSuccess(reply, 200, { message: "Signed out." });
  });

  // ── GET /admin/auth/me — return current admin profile ────────────────────
  app.get("/admin/auth/me", { schema: { tags: ["Admin Auth"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        countryScope: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!admin) return sendError(reply, 404, "NOT_FOUND", "Admin user not found.");
    return sendSuccess(reply, 200, { user: admin });
  });
}


// ── Admin user management routes (UC-1.13) ────────────────────────────────────

export async function adminUserRoutes(app: FastifyInstance) {

  // ── GET /admin/audit-logs ──────────────────────────────────────────────────
  app.get("/admin/audit-logs", { schema: { tags: ["Admin Users"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        skip,
        take,
        orderBy: { timestamp: "desc" },
      }),
    ]);

    return sendSuccess(reply, 200, { logs, total, page: parseInt(page, 10), limit: take });
  });

  // ── GET /admin/users ──────────────────────────────────────────────────────
  app.get("/admin/users", { schema: { tags: ["Admin Users"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", status, userType, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {};
    const and: any[] = [];

    if (q) {
      and.push({
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
        ],
      });
    }

    if (status) {
      and.push({ status: status as "pending_verification" | "active" | "suspended" | "banned" });
    }

    if (userType) {
      and.push({ userType: userType as "guest" | "provider" });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          userType: true,
          emailVerified: true,
          oauthProvider: true,
          currentTier: true,
          loyaltyPoints: true,
          businessName: true,
          country: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return sendSuccess(reply, 200, { users, total, page: parseInt(page, 10), limit: take });
  });

  // ── PATCH /admin/users/:id/suspend ───────────────────────────────────────
  app.patch("/admin/users/:id/suspend", { schema: { tags: ["Admin Users"], body: { type: "object", required: ["reason"], properties: { reason: { type: "string", description: "Reason for suspending the account" } } } }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Suspension reason is required.");

    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return sendError(reply, 404, "NOT_FOUND", "User not found.");

    // Cannot suspend a super_admin
    const targetAdmin = await prisma.adminUser.findUnique({ where: { email: target.email } });
    if (targetAdmin?.role === "super_admin") return sendError(reply, 403, "FORBIDDEN", "You cannot suspend or ban a Super Admin account.");

    const oldStatus = target.status;
    await prisma.$transaction([
      prisma.user.update({ where: { id: targetId }, data: { status: "suspended" } }),
      prisma.session.updateMany({ where: { userId: targetId }, data: { revoked: true } }),
    ]);

    await writeAudit(adminId, adminRole, "account_suspended", req, {
      targetType: "user", targetId, oldValue: oldStatus, newValue: "suspended", reason,
    });

    const { sendAccountSuspendedEmail } = await import("../lib/email");
    await sendAccountSuspendedEmail(target.email).catch(() => null);

    return sendSuccess(reply, 200, { message: "Account suspended." });
  });

  // ── PATCH /admin/users/:id/reinstate ─────────────────────────────────────
  app.patch("/admin/users/:id/reinstate", { schema: { tags: ["Admin Users"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return sendError(reply, 404, "NOT_FOUND", "User not found.");
    if (target.status !== "suspended") return sendError(reply, 409, "INVALID_STATUS", "User is not suspended.");

    await prisma.user.update({ where: { id: targetId }, data: { status: "active" } });

    await writeAudit(adminId, adminRole, "account_reinstated", req, {
      targetType: "user", targetId, oldValue: "suspended", newValue: "active",
    });

    const { sendAccountReinstatedEmail } = await import("../lib/email");
    await sendAccountReinstatedEmail(target.email).catch(() => null);

    return sendSuccess(reply, 200, { message: "Account reinstated." });
  });

  // ── PATCH /admin/users/:id/ban ────────────────────────────────────────────
  app.patch("/admin/users/:id/ban", { schema: { tags: ["Admin Users"], body: { type: "object", required: ["reason"], properties: { reason: { type: "string", description: "Reason for banning the account" } } } }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Ban reason is required.");

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return sendError(reply, 404, "NOT_FOUND", "User not found.");

    const targetAdmin = await prisma.adminUser.findUnique({ where: { email: target.email } });
    if (targetAdmin?.role === "super_admin") return sendError(reply, 403, "FORBIDDEN", "You cannot ban a Super Admin account.");

    const oldStatus = target.status;
    await prisma.$transaction([
      prisma.user.update({ where: { id: targetId }, data: { status: "banned" } }),
      prisma.session.updateMany({ where: { userId: targetId }, data: { revoked: true } }),
    ]);

    await writeAudit(adminId, adminRole, "account_banned", req, {
      targetType: "user", targetId, oldValue: oldStatus, newValue: "banned", reason,
    });

    return sendSuccess(reply, 200, { message: "Account permanently banned." });
  });
}

// ── Admin operator management routes (create/list/delete admin users) ─────────

export async function adminOperatorRoutes(app: FastifyInstance) {

  // Helper: guard super_admin only
  async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
    await requireAdminSession(req, reply);
    const role = (req as FastifyRequest & { adminRole: string }).adminRole;
    if (role !== "super_admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can manage admin operators.");
    }
  }

  // ── GET /admin/operators — List all admin users ─────────────────────────────
  app.get("/admin/operators", { schema: { tags: ["Admin Operators"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", role, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        q ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        } : {},
        role ? { role } : {},
      ],
    };

    const [total, operators] = await Promise.all([
      prisma.adminUser.count({ where }),
      prisma.adminUser.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          countryScope: true,
          totpEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return sendSuccess(reply, 200, { operators, total, page: parseInt(page, 10), limit: take });
  });

  // ── POST /admin/operators — Create a new admin user ─────────────────────────
  app.post("/admin/operators", { schema: { tags: ["Admin Operators"], body: { type: "object", required: ["name", "email", "password", "role"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 }, role: { type: "string", enum: ["admin", "country_manager", "sales", "support", "finance"] }, countryScope: { type: "array", items: { type: "string" } } } } }, preHandler: [requireSuperAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { name, email, password, role, countryScope } = req.body as {
      name: string;
      email: string;
      password: string;
      role: string;
      countryScope?: string[];
    };

    if (!name?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Name is required.");
    if (!email?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Email is required.");
    if (!password || password.length < 8) return sendError(reply, 422, "VALIDATION_ERROR", "Password must be at least 8 characters.");

    const VALID_ROLES = ["admin", "country_manager", "sales", "support", "finance"];
    if (!VALID_ROLES.includes(role)) {
      return sendError(reply, 422, "VALIDATION_ERROR", `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}.`);
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) return sendError(reply, 409, "EMAIL_TAKEN", "An admin with this email already exists.");

    const passwordHash = await hashPassword(password);

    const newAdmin = await prisma.adminUser.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as PrismaAdminRole,
        countryScope: countryScope ?? [],
        totpEnabled: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        countryScope: true,
        totpEnabled: true,
        createdAt: true,
      },
    });

    await writeAudit(adminId, adminRole, "admin_operator_created", req, {
      targetType: "admin_user",
      targetId: newAdmin.id,
      newValue: JSON.stringify({ email, role }),
    });

    return sendSuccess(reply, 201, { operator: newAdmin, message: `Admin account created for ${email}.` });
  });

  // ── DELETE /admin/operators/:id — Delete an admin user ──────────────────────
  app.delete("/admin/operators/:id", { schema: { tags: ["Admin Operators"] }, preHandler: [requireSuperAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };

    if (targetId === adminId) {
      return sendError(reply, 403, "FORBIDDEN", "You cannot delete your own account.");
    }

    const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
    if (!target) return sendError(reply, 404, "NOT_FOUND", "Admin user not found.");
    if (target.role === "super_admin") {
      return sendError(reply, 403, "FORBIDDEN", "Cannot delete a Super Admin account.");
    }

    // Revoke all sessions
    // await prisma.adminSession.updateMany({ where: { adminUserId: targetId }, data: { revoked: true } });
    // await prisma.adminUser.delete({ where: { id: targetId } });
    await prisma.$transaction([
  prisma.adminSession.updateMany({
    where: { adminUserId: targetId },
    data: { revoked: true }
  }),

  prisma.auditLog.deleteMany({
    where: { adminId: targetId }
  }),

  prisma.adminUser.delete({
    where: { id: targetId }
  })
]);

    await writeAudit(adminId, adminRole, "admin_operator_deleted", req, {
      targetType: "admin_user",
      targetId,
      oldValue: JSON.stringify({ email: target.email, role: target.role }),
    });

    return sendSuccess(reply, 200, { message: `Admin account ${target.email} deleted.` });
  });

  // ── PATCH /admin/operators/:id/role — Change an admin's role ────────────────
  app.patch("/admin/operators/:id/role", { schema: { tags: ["Admin Operators"], body: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["admin", "country_manager", "sales", "support", "finance"] }, countryScope: { type: "array", items: { type: "string" } } } } }, preHandler: [requireSuperAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };
    const { role, countryScope } = req.body as { role: string; countryScope?: string[] };

    if (targetId === adminId) return sendError(reply, 403, "FORBIDDEN", "You cannot change your own role.");

    const VALID_ROLES = ["admin", "country_manager", "sales", "support", "finance"];
    if (!VALID_ROLES.includes(role)) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid role.");
    }

    const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
    if (!target) return sendError(reply, 404, "NOT_FOUND", "Admin user not found.");
    if (target.role === "super_admin") return sendError(reply, 403, "FORBIDDEN", "Cannot change Super Admin role.");

    const updated = await prisma.adminUser.update({
      where: { id: targetId },
      data: { role: role as PrismaAdminRole, countryScope: countryScope ?? target.countryScope },
      select: { id: true, name: true, email: true, role: true, countryScope: true },
    });

    // Revoke existing sessions so they must re-login with new role
    await prisma.adminSession.updateMany({ where: { adminUserId: targetId }, data: { revoked: true } });

    await writeAudit(adminId, adminRole, "admin_role_changed", req, {
      targetType: "admin_user",
      targetId,
      oldValue: JSON.stringify({ role: target.role }),
      newValue: JSON.stringify({ role }),
    });

    return sendSuccess(reply, 200, { operator: updated, message: "Role updated. Their session has been revoked." });
  });
}

