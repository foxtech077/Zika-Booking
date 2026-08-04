import type { FastifyRequest, FastifyReply } from "fastify";
import { jwtVerify } from "jose";
import { sendError } from "../lib/errors.js";

const JWT_SECRET = new TextEncoder().encode(process.env["JWT_SECRET"] ?? "");
const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env["ADMIN_JWT_SECRET"] ?? "");

// Request augmentation shared by the auth guards. `id` is always payload.sub
// (a real user id for `type: "user"` tokens, an `anon_*` id for anonymous ones).
export interface AuthRequest extends FastifyRequest {
  authId: string;
  authType: "user" | "anonymous";
  hostStatus: "approved" | "pending" | "rejected" | null;
}

export interface AdminRequest extends FastifyRequest {
  adminId: string;
  adminRole: string;
  /** ISO-3166-1 alpha-2 country codes for country_manager scope */
  countryScope: string[];
}

async function readJwt(req: FastifyRequest): Promise<{ payload: any } | null> {
  const token = req.headers.authorization?.slice(7);
  if (!token) return null;
  try {
    return await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

/**
 * optionalAuth — best-effort. Parses the token when one is present and fills
 * in req.authId / req.authType / req.hostStatus, but never rejects a request
 * without a token. Used on public search/detail endpoints so identity is
 * available for enrichment (e.g. recently-viewed) while guests stay
 * unauthenticated. Only populated for real users so anonymous ids are never
 * used as lookup keys for user-data features.
 */
export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  const base = req as Partial<AuthRequest>;
  base.authType = "anonymous";
  base.authId = "";
  base.hostStatus = null;
  const decoded = await readJwt(req);
  if (!decoded?.payload?.sub) return;
  const p = decoded.payload;
  if (p.type !== "user") return; // anonymous tokens never enrich user data
  base.authId = p.sub;
  base.authType = "user";
  base.hostStatus = p.hostStatus ?? null;
}

/**
 * requireAuth — any valid token (user OR anonymous). Booking, payment and the
 * adopt-by-email claim use this; anonymous checkout must remain possible.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (process.env["DEV_BYPASS_AUTH"] === "true") {
    (req as AuthRequest).authId = process.env["DEV_USER_ID"] ?? "cmos7y8zp0009j9kc5o4ed3c0";
    (req as AuthRequest).authType = "user";
    (req as AuthRequest).hostStatus = "approved";
    return;
  }
  const decoded = await readJwt(req);
  if (!decoded?.payload?.sub) return sendError(reply, 401, "NO_TOKEN", "Authentication required.");
  const p = decoded.payload;
  (req as AuthRequest).authId = p.sub;
  (req as AuthRequest).authType = p.type === "anonymous" ? "anonymous" : "user";
  (req as AuthRequest).hostStatus = p.hostStatus ?? null;
}

/**
 * requireUser — a real registered account is required. Anonymous tokens are
 * rejected with 403. Use for favourites, recently-viewed, my reservations,
 * loyalty, messaging, notifications, reviews, profile settings, merchant.
 */
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if ((req as AuthRequest).authType !== "user") {
    return sendError(reply, 403, "ACCOUNT_REQUIRED", "An account is required to access this feature.");
  }
}

/**
 * requireHost — a real user with an approved host profile (Accreditation).
 * Gates listing management. hostStatus comes from the JWT claim (minted at
 * login/refresh) so this is stateless; a newly-approved host picks it up on
 * their next token refresh.
 */
export async function requireHost(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if ((req as AuthRequest).hostStatus !== "approved") {
    return sendError(reply, 403, "HOST_REQUIRED", "An approved host profile is required to manage listings.");
  }
}

// Verify admin session token (HS256, ADMIN_JWT_SECRET)
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (process.env["DEV_BYPASS_AUTH"] === "true") {
    (req as AdminRequest).adminId = process.env["DEV_ADMIN_ID"] ?? "dev-admin-id";
    (req as AdminRequest).adminRole = "super_admin";
    (req as AdminRequest).countryScope = [];
    return;
  }
  const token = req.headers.authorization?.slice(7);
  if (!token) return sendError(reply, 401, "NO_TOKEN", "Admin authentication required.");
  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("Missing sub");
    (req as AdminRequest).adminId = payload.sub;
    (req as AdminRequest).adminRole = (payload as { role?: string }).role ?? "";
    (req as AdminRequest).countryScope = (payload as { countryScope?: string[] }).countryScope ?? [];
  } catch {
    return sendError(reply, 401, "INVALID_TOKEN", "Admin token invalid or expired.");
  }
}

// Country-scoped access for Country Manager role
export function canReviewCountry(adminRole: string, countryScope: string[], country: string | null): boolean {
  if (adminRole === "super_admin" || adminRole === "admin") return true;
  if (adminRole === "country_manager") return !country || countryScope.includes(country);
  return false;
}

// Back-compat aliases — the old guest/provider names are gone; keep the dev
// bypass env var name stable for deployments.
export const requireProvider = requireAuth;
