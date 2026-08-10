import { authenticator } from "otplib";
import { encryptAes256, decryptAes256, hashToken, generateCode } from "./crypto";
import QRCode from "qrcode";

/**
 * Parse the TOTP acceptance window from TOTP_WINDOW.
 *
 * Accepts a number ("2" = symmetric ±2 steps) or an array ("[4,2]" = 4 steps
 * in the past, 2 steps in the future). Returns a safe default of [4, 2] when
 * the variable is unset, empty, or malformed — an empty/non-numeric value must
 * never silently reduce the window to a single time step, which would make
 * valid codes fail at every 30s boundary.
 */
function parseTotpWindow(): number | [number, number] {
  const raw = process.env["TOTP_WINDOW"];
  if (raw === undefined || raw === "") {
    return [4, 2];
  }
  const num = Number(raw);
  if (Number.isFinite(num) && num >= 0) {
    return Math.floor(num);
  }
  const match = raw.match(/^\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*$/);
  if (match) {
    return [Number(match[1]), Number(match[2])];
  }
  console.warn(
    `[totp] Invalid TOTP_WINDOW value "${raw}" — falling back to safe default [4, 2]. ` +
      `Expected a step count (e.g. "2") or a past/future pair (e.g. "[4,2]").`,
  );
  return [4, 2];
}

authenticator.options = {
  // Safe default [4,2]: generous for past codes (users read the code, then submit it),
  // tight for future codes. Covers minor clock drift and 30s-boundary races.
  window: parseTotpWindow(),
};

/** Generate a new TOTP secret, returning the base32 string. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret(20); // 160-bit base32 secret (RFC 6238)
}

/** Verify a 6-digit TOTP code against a plain (not encrypted) secret. */
export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

/** Encrypt a TOTP secret before storing. */
export function encryptTotpSecret(secret: string): string {
  return encryptAes256(secret);
}

/** Decrypt a stored TOTP secret for verification. */
export function decryptTotpSecret(encrypted: string): string {
  return decryptAes256(encrypted);
}

/** Generate the otpauth URI for QR code rendering. */
export function buildOtpAuthUri(email: string, secret: string): string {
  return authenticator.keyuri(email, "Kainook", secret);
}

/** Render the otpauth URI as a base64-encoded PNG QR code. */
export async function generateQrCode(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

// ── Recovery codes ─────────────────────────────────────────────────────────────

const RECOVERY_CODE_COUNT = 8;

/** Generate 8 one-time recovery codes. Returns plain codes and their SHA-256 hashes. */
export function generateRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = `${generateCode(4)}-${generateCode(4)}`; // e.g. "a3f2b1c4-d5e6f7a8"
    plain.push(code);
    hashes.push(hashToken(code));
  }
  return { plain, hashes };
}
