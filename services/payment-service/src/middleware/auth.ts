import type { FastifyRequest, FastifyReply } from "fastify";
import { jwtVerify } from "jose";
import { sendError } from "../lib/errors.js";

const JWT_SECRET = new TextEncoder().encode(process.env["JWT_SECRET"] ?? "");

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

const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env["ADMIN_JWT_SECRET"] ?? "");

export interface AdminRequest extends FastifyRequest {
  adminId: string;
  adminRole: string;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.headers.authorization?.slice(7);
  if (!token) {
    sendError(reply, 401, "NO_TOKEN", "Admin authentication required.");
    return;
  }
  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("Missing sub");
    (req as AdminRequest).adminId = payload.sub;
    (req as AdminRequest).adminRole = (payload as { role?: string }).role ?? "";
  } catch {
    sendError(reply, 401, "INVALID_TOKEN", "Admin token invalid or expired.");
  }
}

const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

export async function requireInternalService(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.headers["x-service-key"];
  if (!INTERNAL_SERVICE_KEY) {
    sendError(reply, 503, "SERVICE_UNAVAILABLE", "Internal service key not configured.");
    return;
  }
  if (!token || token !== INTERNAL_SERVICE_KEY) {
    sendError(reply, 401, "UNAUTHORIZED", "Invalid or missing service token.");
    return;
  }
}

