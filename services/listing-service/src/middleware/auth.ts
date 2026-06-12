import type { FastifyRequest, FastifyReply } from "fastify";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { sendError } from "../lib/errors.js";

const JWT_SECRET = new TextEncoder().encode(process.env["JWT_SECRET"] ?? "");
const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env["ADMIN_JWT_SECRET"] ?? "");

export interface ProviderRequest extends FastifyRequest {
  providerId: string;
  providerType: string;
}

export interface AdminRequest extends FastifyRequest {
  adminId: string;
  adminRole: string;
  /** ISO-3166-1 alpha-2 country codes for country_manager scope */
  countryScope: string[];
}

// Verify provider access token (issued by auth-service, HS256, JWT_SECRET)
export async function requireProvider(req: FastifyRequest, reply: FastifyReply) {
  if (process.env["DEV_BYPASS_AUTH"] === "true") {
    (req as ProviderRequest).providerId = process.env["DEV_PROVIDER_ID"] ?? "cmos7y8zp0009j9kc5o4ed3c0";
    (req as ProviderRequest).providerType = "provider";
    return;
  }
  const token = req.headers.authorization?.slice(7);
  if (!token) return sendError(reply, 401, "NO_TOKEN", "Authentication required.");
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("Missing sub");
    (req as ProviderRequest).providerId = payload.sub;
    (req as ProviderRequest).providerType = (payload as { type?: string }).type ?? "traveller";
  } catch {
    return sendError(reply, 401, "INVALID_TOKEN", "Token invalid or expired.");
  }
}

// Require the user to be a provider (not a traveller)
export async function requireProviderRole(req: FastifyRequest, reply: FastifyReply) {
  await requireProvider(req, reply);
  if (reply.sent) return;
  const pReq = req as ProviderRequest;
  if (pReq.providerType !== "provider") {
    return sendError(reply, 403, "FORBIDDEN", "Only provider accounts can manage listings.");
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

// Optional guest auth — sets userId if token is valid, otherwise leaves as null
export interface GuestRequest extends FastifyRequest {
  guestId: string | null;
}

export async function optionalGuest(req: FastifyRequest, _reply: FastifyReply) {
  const token = req.headers.authorization?.slice(7);
  (req as GuestRequest).guestId = null;
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.sub) (req as GuestRequest).guestId = payload.sub;
  } catch {
    // invalid token — treat as anonymous
  }
}

// Country-scoped access for Country Manager role
export function canReviewCountry(adminRole: string, countryScope: string[], country: string | null): boolean {
  if (adminRole === "super_admin" || adminRole === "admin") return true;
  if (adminRole === "country_manager") return !country || countryScope.includes(country);
  return false;
}
