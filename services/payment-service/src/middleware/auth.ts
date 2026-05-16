import type { FastifyRequest, FastifyReply } from "fastify";
import { jwtVerify } from "jose";
import { sendError } from "../lib/errors.js";

const JWT_SECRET = new TextEncoder().encode(process.env["JWT_SECRET"] ?? "");

export interface GuestRequest extends FastifyRequest {
  userId: string;
  userType: string;
}

/**
 * requireUser — verifies the JWT from the Authorization header.
 * Sets req.userId (from payload.sub) and req.userType on the request.
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
    (req as GuestRequest).userType = (payload as { userType?: string }).userType ?? "guest";
  } catch {
    sendError(reply, 401, "INVALID_TOKEN", "Token invalid or expired.");
  }
}
