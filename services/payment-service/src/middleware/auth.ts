import type { FastifyRequest, FastifyReply } from "fastify";
import { jwtVerify } from "jose";
import { sendError } from "../lib/errors.js";
import {
  AdminPermission,
  AdminRole,
  AdminScope,
  AuthorizationErrorCode,
  isCountryInScope,
  roleHasPermission,
  roleScopePolicy,
  type AdminAuthContext,
  type AdminSessionIntrospectResponse,
} from "@zika/types";

const JWT_SECRET = new TextEncoder().encode(process.env["JWT_SECRET"] ?? "");
const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env["ADMIN_JWT_SECRET"] ?? "");
const AUTH_SERVICE_URL = process.env["AUTH_SERVICE_URL"] ?? "http://localhost:3001";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";
const DEV_BYPASS_AUTH = process.env["DEV_BYPASS_AUTH"] === "true";
const DEV_ADMIN_ID = process.env["DEV_ADMIN_ID"] ?? "dev-admin-id";

export interface GuestRequest extends FastifyRequest {
  userId: string;
  userType: "user" | "anonymous";
}

/**
 * requireUser — verifies the JWT from the Authorization header.
 * Sets req.userId (from payload.sub) and req.userType on the request.
 * Accepts both real-user and anonymous tokens (anonymous checkout must be
 * able to pay). Guard user-data features (merchant, payouts) on
 * userType !== "anonymous" where required.
 */
export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.headers.authorization?.slice(7);
  if (!token) {
    sendError(reply, 401, "NO_TOKEN", "Authentication required.");
    return;
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("Missing sub");
    (req as GuestRequest).userId = payload.sub;
    // JWT tokens use "type" as the claim name; fall back to "userType" for compatibility
    const p = payload as { type?: string; userType?: string };
    (req as GuestRequest).userType = p.type === "anonymous" ? "anonymous" : "user";
  } catch {
    sendError(reply, 401, "INVALID_TOKEN", "Token invalid or expired.");
  }
}

/**
 * requireAccount — a real registered account is required; anonymous tokens
 * are rejected. Use for merchant, payout and other account-scoped endpoints.
 */
export async function requireAccount(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(req, reply);
  if (reply.sent) return;
  if ((req as GuestRequest).userType === "anonymous") {
    sendError(reply, 403, "ACCOUNT_REQUIRED", "An account is required to access this feature.");
  }
}

// ── Admin authorization ───────────────────────────────────────────────────────
// Backend enforcement is DB-backed: the admin session JWT is introspected by
// the auth-service, which verifies signature + session revocation + inactivity
// and returns the CURRENT role and country scope. JWT claims alone are never
// trusted for authorization.

export interface AdminRequest extends FastifyRequest {
  admin: AdminAuthContext;
}

/**
 * Verify the admin session JWT signature locally (fast fail) and then
 * introspect the session at the auth-service for canonical, DB-backed role
 * and country scope. Fails closed: if introspection is unavailable the request
 * is rejected rather than allowed.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (DEV_BYPASS_AUTH) {
    (req as AdminRequest).admin = {
      adminId: DEV_ADMIN_ID,
      sessionId: "dev-session",
      role: AdminRole.SuperAdmin,
      countryScope: [],
      scope: roleScopePolicy(AdminRole.SuperAdmin),
    };
    return;
  }

  const token = req.headers.authorization?.slice(7);
  if (!token) {
    sendError(reply, 401, "NO_TOKEN", "Admin authentication required.");
    return;
  }

  // Local signature check first — cheap rejection of garbage tokens.
  try {
    await jwtVerify(token, ADMIN_JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    sendError(reply, 401, "INVALID_TOKEN", "Admin token invalid or expired.");
    return;
  }

  // Canonical, DB-backed introspection via the auth-service.
  let response: Response;
  try {
    response = await fetch(`${AUTH_SERVICE_URL}/internal/admin/introspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    req.log?.error?.({ err }, "[admin-auth] Introspection network failure");
    sendError(reply, 503, AuthorizationErrorCode.IntrospectionUnavailable, "Authorization service unavailable.");
    return;
  }

  if (!response.ok) {
    if (response.status === 401) {
      const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      sendError(reply, 401, body?.error?.code ?? "INVALID_SESSION", body?.error?.message ?? "Invalid admin session.");
    } else {
      sendError(reply, 503, AuthorizationErrorCode.IntrospectionUnavailable, "Authorization service unavailable.");
    }
    return;
  }

  const json = (await response.json()) as { data?: AdminSessionIntrospectResponse };
  const data = json.data;
  if (!data?.adminId || !data?.role) {
    sendError(reply, 401, "INVALID_SESSION", "Invalid admin session.");
    return;
  }

  (req as AdminRequest).admin = {
    adminId: data.adminId,
    sessionId: data.sessionId,
    role: data.role,
    countryScope: data.countryScope ?? [],
    scope: roleScopePolicy(data.role),
  };
}

/**
 * requireAdminPermission — returns a Fastify preHandler that requires a valid
 * admin session AND the given permission for the admin's canonical role.
 */
export function requireAdminPermission(permission: AdminPermission) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAdmin(req, reply);
    if (reply.sent) return;
    const { role } = (req as AdminRequest).admin;
    if (!roleHasPermission(role, permission)) {
      sendError(reply, 403, AuthorizationErrorCode.PermissionDenied, "You do not have permission to perform this action.");
    }
  };
}

/**
 * Assert that an admin may access a resource in the given country. Returns
 * true when allowed; sends a 403 and returns false when denied.
 */
export function assertResourceCountryScope(
  req: FastifyRequest,
  reply: FastifyReply,
  countryCode: string | null | undefined,
): boolean {
  const { role, countryScope } = (req as AdminRequest).admin;
  if (!isCountryInScope(role, countryScope, countryCode)) {
    sendError(reply, 403, AuthorizationErrorCode.ScopeDenied, "This resource is outside your assigned country scope.");
    return false;
  }
  return true;
}

/**
 * Returns a Prisma `where` fragment restricting a collection query to the
 * admin's country scope when the admin is country-scoped. Returns undefined
 * for globally-scoped roles (super_admin, admin, support, finance).
 */
export function countryScopeFilter(
  req: FastifyRequest,
): { countryCode: { in: string[] } } | undefined {
  const { role, countryScope } = (req as AdminRequest).admin;
  if (roleScopePolicy(role) === AdminScope.Global) return undefined;
  return countryScope.length > 0
    ? { countryCode: { in: [...countryScope] } }
    : { countryCode: { in: [] } };
}

const INTERNAL_SERVICE_KEY_VALUE = process.env["INTERNAL_SERVICE_KEY"] ?? "";

export async function requireInternalService(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.headers["x-service-key"];
  if (!INTERNAL_SERVICE_KEY_VALUE) {
    sendError(reply, 503, "SERVICE_UNAVAILABLE", "Internal service key not configured.");
    return;
  }
  if (!token || token !== INTERNAL_SERVICE_KEY_VALUE) {
    sendError(reply, 401, "UNAUTHORIZED", "Invalid or missing service token.");
  }
}
