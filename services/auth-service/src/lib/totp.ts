import { authenticator } from "otplib";
import { encryptAes256, decryptAes256, hashToken, generateCode } from "./crypto";
import QRCode from "qrcode";

authenticator.options = {
  window: 1, // allow ±1 time step for clock drift (BR-1.10 / UC-1.10 E1)
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
  return authenticator.keyuri(email, "ZikaBooking", secret);
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
