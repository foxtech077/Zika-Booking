import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { adminLoginSchema, totpCodeSchema, recoveryCodeSchema } from "@zika/validators";
import { prisma } from "../lib/prisma";
import type { AdminRole as PrismaAdminRole } from "../generated/index.js";
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

async function requireIntermediate(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const body = (req.body ?? {}) as {
    intermediateToken?: string;
  };

  let token = body.intermediateToken;

  if (!token) {
    token = req.headers["x-intermediate-token"] as string | undefined;
  }

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7);
  }

  if (!token) {
    return sendError(
      reply,
      401,
      "NO_TOKEN",
      "Intermediate token required."
    );
  }

  try {
    const payload = await verifyIntermediateToken(token);

    (req as FastifyRequest & {
      adminIntermediate: typeof payload;
    }).adminIntermediate = payload;
  } catch {
    return sendError(
      reply,
      401,
      "INVALID_TOKEN",
      "Intermediate token invalid or expired."
    );
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

  // Fetch adminUser's countryScope
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { countryScope: true },
  });
  const countryScope = admin?.countryScope ?? [];

  // Create a placeholder session to get a sessionId, then sign the JWT with it
  const tempSession = await prisma.adminSession.create({
    data: {
      adminUserId: adminId,
      tokenHash: "pending",
      expiresAt,
    },
  });

  // Sign the JWT — this IS the session token returned to the client
  const jwt = await signAdminSessionToken({
    sub: adminId,
    role,
    sessionId: tempSession.id,
    countryScope,
  });

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

    try {
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
        return sendSuccess(reply, 200, {
          totpRequired: true,
          setupRequired: false,
          intermediateToken,
        });
      } else {
        return sendSuccess(reply, 200, {
          totpRequired: true,
          setupRequired: true,
          intermediateToken,
        });
      }
    } catch {
      return sendError(reply, 400, "LOGIN_FAILED", "Admin login could not be completed. Please try again.");
    }
  });

  // ── POST /admin/auth/totp/setup  (UC-1.10 — first login) ─────────────────
  app.post("/admin/auth/totp/setup", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["intermediateToken"], properties: { intermediateToken: { type: "string" } } } }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub: adminId } = (req as FastifyRequest & { adminIntermediate: { sub: string } }).adminIntermediate;
    try {
      const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });

      const secret = generateTotpSecret();
      const otpauthUri = buildOtpAuthUri(admin.email, secret);
      const qrCode = await generateQrCode(otpauthUri);

      // Store temp secret in Redis until confirmed
      const { getRedis } = await import("../lib/redis");
      await getRedis().set(`totp:pending:${adminId}`, secret, "EX", 600);

      return sendSuccess(reply, 200, { qrCodeDataUrl: qrCode, secret, otpauthUri });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "TOTP_SETUP_FAILED", "TOTP setup could not be initiated. Please try again.");
    }
  });

  // ── POST /admin/auth/totp/confirm  (UC-1.10 step 7 onward) ───────────────
  app.post("/admin/auth/totp/confirm", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["code"], properties: { code: { type: "string", description: "6-digit TOTP code from authenticator app" } } } }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = totpCodeSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 422, "VALIDATION_ERROR", "Invalid code format.");
    const { code } = parsed.data;
    const { sub: adminId, role } = (req as FastifyRequest & { adminIntermediate: { sub: string; role: string } }).adminIntermediate;

    try {
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
    } catch {
      return sendError(reply, 400, "TOTP_CONFIRM_FAILED", "TOTP setup could not be completed. Please try again.");
    }
  });

  // ── POST /admin/auth/totp/verify  (UC-1.11 step 5) ───────────────────────
  app.post("/admin/auth/totp/verify", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["intermediateToken"], properties: {  intermediateToken: {
        type: "string",
        description: "Intermediate token returned from admin login"
      }, code: { type: "string", description: "6-digit TOTP code from authenticator app" } } } }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub: adminId, role } = (req as FastifyRequest & { adminIntermediate: { sub: string; role: string } }).adminIntermediate;

    // Check for recovery code usage
    try {
      const body = req.body as { code?: string; recoveryCode?: string; intermediateToken: string };
      if (body.recoveryCode) {
        return await handleRecoveryCode(req, reply, adminId, role, body.recoveryCode);
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
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "TOTP_VERIFY_FAILED", "TOTP verification could not be completed. Please try again.");
    }
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
    try {
      const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });


console.log("admin.fido2Credential =", admin.fido2Credential);


      if (!admin.fido2Credential) {
        return sendError(reply, 400, "NO_FIDO2", "No hardware key registered for this account.");
      }
      const cred = admin.fido2Credential as { id: string; publicKey: string; counter: number };
      const options = await waStartAuthentication(adminId, cred.id, cred.publicKey);
      return sendSuccess(reply, 200, { options });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "CHALLENGE_FAILED", "WebAuthn challenge could not be generated. Please try again.");
    }
  });

  // ── POST /admin/auth/webauthn/verify  (UC-1.12 step 6) ───────────────────
  app.post("/admin/auth/webauthn/verify", { schema: { tags: ["Admin Auth"], body: { type: "object", required: ["id", "rawId", "response", "type"], properties: { id: { type: "string" }, rawId: { type: "string" }, response: { type: "object" }, type: { type: "string", enum: ["public-key"] } } } }, preHandler: [requireIntermediate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub: adminId, role } = (req as FastifyRequest & { adminIntermediate: { sub: string; role: string } }).adminIntermediate;
    try {
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
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "WEBAUTHN_VERIFY_FAILED", "WebAuthn verification could not be completed. Please try again.");
    }
  });

  // ── POST /admin/auth/webauthn/register  (UC-1.12 A3) ─────────────────────
  app.post("/admin/auth/webauthn/register", { schema: { tags: ["Admin Auth"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    try {
      const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
      const options = await waStartRegistration(adminId, admin.email);
      return sendSuccess(reply, 200, { options });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "WEBAUTHN_REGISTER_FAILED", "WebAuthn registration could not be initiated. Please try again.");
    }
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
    try {
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
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "WEBAUTHN_SAVE_FAILED", "Security key could not be saved. Please try registering again.");
    }
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
    try {
      const token = req.headers.authorization?.slice(7) ?? "";
      await prisma.adminSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revoked: true } });
      return sendSuccess(reply, 200, { message: "Signed out." });
    } catch {
      return sendError(reply, 400, "LOGOUT_FAILED", "Sign-out could not be completed. Please try again.");
    }
  });

  // ── GET /admin/auth/me — return current admin profile ────────────────────
  app.get("/admin/auth/me", { schema: { tags: ["Admin Auth"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
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
    } catch {
      return sendError(reply, 400, "FETCH_FAILED", "Admin profile could not be retrieved. Please try again.");
    }
  });
}


// ── Admin user management routes (UC-1.13) ────────────────────────────────────

export async function adminUserRoutes(app: FastifyInstance) {

  // ── GET /admin/audit-logs ──────────────────────────────────────────────────
  // Accessible by: super_admin, admin (enforced below in RBAC check).
  // Supports filtering by action, targetType, targetId, adminId, and date range.
  app.get("/admin/audit-logs", {
    schema: {
      tags: ["Admin Users"],
      summary: "List audit log entries with pagination and search filters",
      querystring: {
        type: "object",
        properties: {
          page:       { type: "string", default: "1" },
          limit:      { type: "string", default: "20" },
          action:     { type: "string", description: "Filter by action name (e.g. listing_approved)" },
          targetType: { type: "string", description: "Filter by target type (e.g. listing, booking, user)" },
          targetId:   { type: "string", description: "Filter by target entity ID" },
          adminId:    { type: "string", description: "Filter by admin user ID" },
          from:       { type: "string", format: "date-time", description: "Filter entries from this timestamp (ISO 8601)" },
          to:         { type: "string", format: "date-time", description: "Filter entries up to this timestamp (ISO 8601)" },
          q:          { type: "string", description: "General search query across action, targetType, targetId, ipAddress, and admin name" },
          role:       { type: "string", description: "Filter by admin user role" },
        },
      },
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const callerRole = (req as FastifyRequest & { adminRole: string }).adminRole;

    if (!["admin", "super_admin"].includes(callerRole)) {
      return sendError(reply, 403, "FORBIDDEN", "Only Admin and Super Admin can access audit logs.");
    }

    const {
      page = "1", limit = "20",
      action, targetType, targetId, adminId, from, to,
      q, role,
    } = req.query as Record<string, string>;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    // Build dynamic where clause from search filters
    const where: any = {};
    const and: any[] = [];
    if (action)     and.push({ action:     { contains: action,     mode: "insensitive" } });
    if (targetType) and.push({ targetType: { equals:   targetType, mode: "insensitive" } });
    if (targetId)   and.push({ targetId });
    if (adminId)    and.push({ adminId });
    if (role)       and.push({ role:       { equals:   role.toLowerCase() } });
    if (from || to) {
      const tsFilter: any = {};
      if (from) tsFilter.gte = new Date(from);
      if (to)   tsFilter.lte = new Date(to);
      and.push({ timestamp: tsFilter });
    }
    if (q) {
      const rolesList = ["super_admin", "admin", "country_manager", "sales", "support", "finance"];
      const matchingRoles = rolesList.filter((r) => r.includes(q.toLowerCase()));

      const orConditions: any[] = [
        { action: { contains: q, mode: "insensitive" } },
        { targetType: { contains: q, mode: "insensitive" } },
        { targetId: { contains: q, mode: "insensitive" } },
        { ipAddress: { contains: q, mode: "insensitive" } },
        { admin: { name: { contains: q, mode: "insensitive" } } },
      ];

      if (matchingRoles.length > 0) {
        orConditions.push({ role: { in: matchingRoles } });
      }

      and.push({ OR: orConditions });
    }
    if (and.length > 0) where.AND = and;

    try {
      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          skip,
          take,
          orderBy: { timestamp: "desc" },
          include: {
            admin: { select: { name: true, email: true } },
          },
        }),
      ]);

      // Flatten admin name into response
      const enriched = logs.map(({ admin, ...l }) => ({
        ...l,
        adminName:  admin.name,
        adminEmail: admin.email,
      }));

      return sendSuccess(reply, 200, { logs: enriched, total, page: parseInt(page, 10), limit: take });
    } catch {
      return sendError(reply, 400, "FETCH_FAILED", "Audit logs could not be retrieved. Please try again.");
    }
  });

  // ── GET /admin/audit-logs/export — CSV export (Super Admin only) ───────────
  // PRD §8.4: "Export to CSV for Super Admin only."
  app.get("/admin/audit-logs/export", {
    schema: {
      tags: ["Admin Users"],
      summary: "Export all audit log entries as CSV (Super Admin only)",
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    // Only super_admin may export
    const callerRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    if (callerRole !== "super_admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can export audit logs.");
    }

    try {
      // Fetch all rows — full export, no filters, no pagination
      const logs = await prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        include: {
          admin: { select: { name: true, email: true } },
        },
      });

      // Build CSV
      const CSV_HEADERS = [
        "id",
        "timestamp",
        "admin_id",
        "admin_name",
        "admin_email",
        "role",
        "action",
        "target_type",
        "target_id",
        "old_value",
        "new_value",
        "ip_address",
      ];

      function escapeCsv(val: string | null | undefined): string {
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Wrap in quotes if the value contains a comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }

      const rows = logs.map(({ admin, ...l }) =>
        [
          l.id,
          l.timestamp.toISOString(),
          l.adminId,
          admin.name,
          admin.email,
          l.role,
          l.action,
          l.targetType ?? "",
          l.targetId   ?? "",
          l.oldValue   ?? "",
          l.newValue   ?? "",
          l.ipAddress,
        ]
          .map(escapeCsv)
          .join(",")
      );

      const csv = [CSV_HEADERS.join(","), ...rows].join("\n");

      const filename = `audit-log-export-${new Date().toISOString().slice(0, 10)}.csv`;

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("Cache-Control", "no-store")
        .send(csv);
    } catch {
      return sendError(reply, 400, "EXPORT_FAILED", "Audit log export could not be completed. Please try again.");
    }
  });

  // ── GET /admin/users ──────────────────────────────────────────────────────
  app.get("/admin/users", { schema: { tags: ["Admin Users"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", status, hostStatus, page = "1", limit = "20" } = req.query as Record<string, string>;
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

    if (hostStatus && ["pending", "approved", "rejected"].includes(hostStatus)) {
      and.push({ accreditation: { status: hostStatus as "pending" | "approved" | "rejected" } });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    try {
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
            accreditation: { select: { status: true, submittedAt: true, reviewedAt: true, rejectionReason: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return sendSuccess(reply, 200, { users, total, page: parseInt(page, 10), limit: take });
    } catch {
      return sendError(reply, 400, "FETCH_FAILED", "Users could not be retrieved. Please try again.");
    }
  });

  // ── PATCH /admin/users/:id/suspend ───────────────────────────────────────
  app.patch("/admin/users/:id/suspend", { schema: { tags: ["Admin Users"], body: { type: "object", required: ["reason"], properties: { reason: { type: "string", description: "Reason for suspending the account" } } } }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Suspension reason is required.");

    try {
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
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "SUSPEND_FAILED", "Account could not be suspended. Please try again.");
    }
  });

  // ── PATCH /admin/users/:id/reinstate ─────────────────────────────────────
  app.patch("/admin/users/:id/reinstate", { schema: { tags: ["Admin Users"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };

    try {
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
    } catch {
      return sendError(reply, 400, "REINSTATE_FAILED", "Account could not be reinstated. Please try again.");
    }
  });

  // ── PATCH /admin/users/:id/approve ───────────────────────────────────────
  // app.patch("/admin/users/:id/approve", { schema: { tags: ["Admin Users"], security: [{ bearerAuth: [] }] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
  //   const adminId = (req as FastifyRequest & { adminId: string }).adminId;
  //   const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
  //   const { id: targetId } = req.params as { id: string };

  //   const target = await prisma.user.findUnique({ where: { id: targetId } });
  //   if (!target) return sendError(reply, 404, "NOT_FOUND", "User not found.");

  //   if (target.status !== "pending_verification") {
  //     return sendError(reply, 409, "INVALID_STATUS", "User is not in pending verification status.");
  //   }
  //   if (!target.emailVerified) {
  //     return sendError(reply, 409, "EMAIL_NOT_VERIFIED", "User email must be verified before approval.");
  //   }
  //   if (target.userType !== "provider") {
  //     return sendError(reply, 409, "INVALID_USER_TYPE", "Only provider accounts require approval.");
  //   }

  //   await prisma.user.update({ where: { id: targetId }, data: { status: "active" } });

  //   await writeAudit(adminId, adminRole, "account_approved", req, {
  //     targetType: "user", targetId, oldValue: "pending_verification", newValue: "active",
  //   });

  //   const { sendWelcomeEmail } = await import("../lib/email");
  //   await sendWelcomeEmail(target.email, target.firstName).catch(() => null);




  //   return sendSuccess(reply, 200, { message: "Provider account approved successfully." });
  // });

  // ── PATCH /admin/users/:id/ban ────────────────────────────────────────────
  app.patch("/admin/users/:id/ban", { schema: { tags: ["Admin Users"], body: { type: "object", required: ["reason"], properties: { reason: { type: "string", description: "Reason for banning the account" } } } }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Ban reason is required.");

    try {
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
    } catch {
      return sendError(reply, 400, "BAN_FAILED", "Account could not be banned. Please try again.");
    }
  });

  // ── GET /admin/accreditations  (host profile review queue) ────────────────
  app.get("/admin/accreditations", { schema: { tags: ["Admin Users"], querystring: { type: "object", properties: { status: { type: "string", enum: ["pending", "approved", "rejected"] }, page: { type: "string", pattern: "^[0-9]+$" }, limit: { type: "string", pattern: "^[0-9]+$" } } } }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string>;
    const status = q["status"];
    const page = parseInt(q["page"] ?? "1", 10);
    const limit = Math.min(parseInt(q["limit"] ?? "20", 10), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status as "pending" | "approved" | "rejected";

    try {
      const [total, accreditations] = await Promise.all([
        prisma.accreditation.count({ where }),
        prisma.accreditation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { submittedAt: "desc" },
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, email: true,
                country: true, phone: true, status: true, createdAt: true,
              },
            },
          },
        }),
      ]);

      return sendSuccess(reply, 200, { accreditations, total, page, limit });
    } catch {
      return sendError(reply, 400, "FETCH_FAILED", "Accreditations could not be retrieved. Please try again.");
    }
  });

  // ── PATCH /admin/accreditations/:id/approve ───────────────────────────────
  app.patch("/admin/accreditations/:id/approve", { schema: { tags: ["Admin Users"] }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };

    try {
      const acc = await prisma.accreditation.findUnique({ where: { id: targetId }, include: { user: { select: { email: true, firstName: true } } } });
      if (!acc) return sendError(reply, 404, "NOT_FOUND", "Host profile not found.");
      if (acc.status === "approved") return sendError(reply, 409, "INVALID_STATUS", "Host profile is already approved.");

      const updated = await prisma.accreditation.update({
        where: { id: targetId },
        data: { status: "approved", reviewedAt: new Date(), reviewedBy: adminId, rejectionReason: null },
      });

      await writeAudit(adminId, adminRole, "host_approved", req, {
        targetType: "accreditation", targetId, oldValue: acc.status, newValue: "approved",
      });

      return sendSuccess(reply, 200, { message: "Host profile approved.", hostProfile: updated });
    } catch {
      return sendError(reply, 400, "APPROVE_FAILED", "Host profile could not be approved. Please try again.");
    }
  });

  // ── PATCH /admin/accreditations/:id/reject ────────────────────────────────
  app.patch("/admin/accreditations/:id/reject", { schema: { tags: ["Admin Users"], body: { type: "object", properties: { reason: { type: "string" } } } }, preHandler: [requireAdminSession] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };
    const { reason } = (req.body ?? {}) as { reason?: string };

    try {
      const acc = await prisma.accreditation.findUnique({ where: { id: targetId } });
      if (!acc) return sendError(reply, 404, "NOT_FOUND", "Host profile not found.");
      if (acc.status === "rejected") return sendError(reply, 409, "INVALID_STATUS", "Host profile is already rejected.");

      const updated = await prisma.accreditation.update({
        where: { id: targetId },
        data: { status: "rejected", reviewedAt: new Date(), reviewedBy: adminId, rejectionReason: reason ?? null },
      });

      await writeAudit(adminId, adminRole, "host_rejected", req, {
        targetType: "accreditation", targetId, oldValue: acc.status, newValue: "rejected", reason,
      });

      return sendSuccess(reply, 200, { message: "Host profile rejected.", hostProfile: updated });
    } catch {
      return sendError(reply, 400, "REJECT_FAILED", "Host profile could not be rejected. Please try again.");
    }
  });
}

export async function adminOperatorRoutes(app: FastifyInstance) {

  // Helper: guard super_admin only
  async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
    await requireAdminSession(req, reply);
    const role = (req as FastifyRequest & { adminRole: string }).adminRole;
    if (role !== "super_admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can manage admin operators.");
    }
  }

  // Helper: guard super_admin or admin
  async function requireSuperAdminOrAdmin(req: FastifyRequest, reply: FastifyReply) {
    await requireAdminSession(req, reply);
    const role = (req as FastifyRequest & { adminRole: string }).adminRole;
    if (role !== "super_admin" && role !== "admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Admins and Super Admins can manage operator accounts.");
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

    try {
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
    } catch {
      return sendError(reply, 400, "FETCH_FAILED", "Operators could not be retrieved. Please try again.");
    }
  });

  // ── POST /admin/operators — Create a new admin user ─────────────────────────
  app.post("/admin/operators", { schema: { tags: ["Admin Operators"], body: { type: "object", required: ["name", "email", "password", "role"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 }, role: { type: "string", enum: ["admin", "country_manager", "sales", "support", "finance"] }, countryScope: { type: "array", items: { type: "string" } } } } }, preHandler: [requireSuperAdminOrAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    // Role-specific creation limits for Admins
    if (adminRole === "admin") {
      if (role !== "country_manager" && role !== "sales") {
        return sendError(reply, 403, "FORBIDDEN", "Admins can only create Country Manager and Sales Agent accounts.");
      }
    }

    // Country manager scoping checks
    if (role === "country_manager") {
      if (!countryScope || !Array.isArray(countryScope) || countryScope.length === 0) {
        return sendError(reply, 422, "VALIDATION_ERROR", "Country scope is required for Country Managers.");
      }
    }

    try {
      // Creator scope visibility checks
      if (adminRole === "admin") {
        const creator = await prisma.adminUser.findUnique({
          where: { id: adminId },
          select: { countryScope: true },
        });
        const creatorScope = creator?.countryScope ?? [];

        if (creatorScope.length > 0) {
          if (!countryScope || countryScope.length === 0) {
            return sendError(reply, 422, "VALIDATION_ERROR", "You must assign a country scope within your visibility scope.");
          }
          const outOfScopeCountries = countryScope.filter((c) => !creatorScope.includes(c));
          if (outOfScopeCountries.length > 0) {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              `You cannot assign country scope outside your own visibility scope: ${outOfScopeCountries.join(", ")}`
            );
          }
        }
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
        newValue: JSON.stringify({
          roleAssigned: role,
          countryScope: countryScope ?? [],
        }),
      });

      return sendSuccess(reply, 201, { operator: newAdmin, message: `Admin account created for ${email}.` });
    } catch {
      return sendError(reply, 400, "CREATE_FAILED", "Admin account could not be created. Please try again.");
    }
  });

  // ── DELETE /admin/operators/:id — Delete an admin user ──────────────────────
  app.delete("/admin/operators/:id", { schema: { tags: ["Admin Operators"] }, preHandler: [requireSuperAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as FastifyRequest & { adminId: string }).adminId;
    const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
    const { id: targetId } = req.params as { id: string };

    if (targetId === adminId) {
      return sendError(reply, 403, "FORBIDDEN", "You cannot delete your own account.");
    }

    try {
      const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
      if (!target) return sendError(reply, 404, "NOT_FOUND", "Admin user not found.");
      if (target.role === "super_admin") {
        return sendError(reply, 403, "FORBIDDEN", "Cannot delete a Super Admin account.");
      }

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
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "DELETE_FAILED", "Admin account could not be deleted. Please try again.");
    }
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

    try {
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
    } catch (err: any) {
      if (err?.code === "P2025") {
        return sendError(reply, 404, "ADMIN_NOT_FOUND", "Admin account not found.");
      }
      return sendError(reply, 400, "UPDATE_FAILED", "Admin role could not be updated. Please try again.");
    }
  });
}

