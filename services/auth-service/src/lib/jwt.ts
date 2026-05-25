import { SignJWT, jwtVerify } from "jose";
import { generateCode } from "./crypto";
import type { JwtPayload, AdminIntermediatePayload, AdminSessionPayload } from "@zika/types";

const encoder = new TextEncoder();

function getSecret(key: string): Uint8Array {
  return encoder.encode(process.env[key] ?? "");
}

// ── Guest / Provider tokens ───────────────────────────────────────────────────

export async function signAccessToken(
  payload: Omit<JwtPayload, "iat" | "exp" | "jti">,
): Promise<string> {
  const ttl = Number(process.env["JWT_ACCESS_TTL_SECONDS"] ?? 900);
  return new SignJWT({ ...payload, jti: generateCode(8) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret("JWT_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret("JWT_SECRET"));
  return payload as unknown as JwtPayload;
}

/** Refresh tokens are opaque — only the hash is stored in DB.
 *  The raw random token is returned to the client. */
export function generateRefreshToken(): string {
  return generateCode(32); // 64-char hex = 256-bit entropy
}

// ── Admin intermediate token (between password and TOTP/FIDO2 steps) ─────────

export async function signIntermediateToken(
  payload: Omit<AdminIntermediatePayload, "iat" | "exp">,
): Promise<string> {
  const ttl = Number(process.env["ADMIN_INTERMEDIATE_TTL_SECONDS"] ?? 3600);
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret("ADMIN_JWT_SECRET"));
}

export async function verifyIntermediateToken(
  token: string,
): Promise<AdminIntermediatePayload> {
  const { payload } = await jwtVerify(token, getSecret("ADMIN_JWT_SECRET"));
  return payload as unknown as AdminIntermediatePayload;
}

// ── Admin session token ───────────────────────────────────────────────────────

export async function signAdminSessionToken(
  payload: Omit<AdminSessionPayload, "iat" | "exp">,
): Promise<string> {
  // Long TTL — actual inactivity check is done via DB lastActiveAt (BR-1.11)
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret("ADMIN_JWT_SECRET"));
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionPayload> {
  const { payload } = await jwtVerify(token, getSecret("ADMIN_JWT_SECRET"));
  return payload as unknown as AdminSessionPayload;
}
