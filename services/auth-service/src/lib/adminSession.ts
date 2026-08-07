import { prisma } from "./prisma";
import { hashToken } from "./crypto";
import { verifyAdminSessionToken } from "./jwt";
import {
  AdminRole,
  AdminScope,
  roleScopePolicy,
  type AdminAuthContext,
  type AdminSessionIntrospectResponse,
} from "@zika/types";

const SESSION_INACTIVITY = Number(process.env["ADMIN_SESSION_INACTIVITY_SECONDS"] ?? 28800);

export interface AdminSessionVerificationError extends Error {
  code: string;
}

function fail(code: string, message: string): never {
  const err = new Error(message) as AdminSessionVerificationError;
  err.code = code;
  throw err;
}

/**
 * Verify an admin session JWT and resolve the canonical, DB-backed auth context.
 * Enforces signature validity, session revocation and the 8-hour inactivity
 * timeout, and reads the CURRENT role + countryScope from AdminUser (so role or
 * scope changes take effect immediately, not when a long-lived JWT expires).
 *
 * Used by the internal introspection endpoint so other services (payment,
 * listing) can authorize admin actions without trusting stale JWT claims.
 */
export async function verifyAdminSession(token: string): Promise<AdminAuthContext> {
  let payload: { sub: string; sessionId?: string };
  try {
    payload = await verifyAdminSessionToken(token);
  } catch {
    return fail("INVALID_TOKEN", "Admin token invalid or expired.");
  }

  if (!payload?.sub) return fail("INVALID_TOKEN", "Admin token invalid or expired.");

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.revoked) return fail("INVALID_SESSION", "Session invalid.");

  // 8-hour inactivity check — same rule as the admin-panel middleware.
  const idleMs = Date.now() - session.lastActiveAt.getTime();
  if (idleMs > SESSION_INACTIVITY * 1000) {
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { revoked: true },
    });
    return fail("SESSION_EXPIRED", "Your session has expired due to inactivity.");
  }

  // Touch lastActiveAt so ongoing admin activity keeps the session alive.
  await prisma.adminSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, countryScope: true },
  });
  if (!admin) return fail("INVALID_SESSION", "Admin account no longer exists.");

  const role = admin.role as AdminRole;

  return {
    adminId: admin.id,
    sessionId: session.id,
    role,
    countryScope: admin.countryScope ?? [],
    scope: roleScopePolicy(role),
  };
}

export function toIntrospectResponse(ctx: AdminAuthContext): AdminSessionIntrospectResponse {
  return {
    adminId: ctx.adminId,
    sessionId: ctx.sessionId,
    role: ctx.role,
    countryScope: ctx.countryScope,
    scope: ctx.scope,
  };
}
