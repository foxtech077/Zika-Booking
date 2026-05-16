import crypto from "crypto";

/** Generate a 64-char hex token (256-bit entropy) — BR-1.4 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** SHA-256 hash of a plain token — only the hash is stored — BR-1.4 */
export function hashToken(plainToken: string): string {
  return crypto.createHash("sha256").update(plainToken).digest("hex");
}

/** Generate a CSPRNG code of a given byte length, returned as hex */
export function generateCode(bytes = 8): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** AES-256-CBC encrypt a string (for TOTP secret storage) */
export function encryptAes256(plaintext: string): string {
  const key = Buffer.from(process.env["TOTP_ENCRYPTION_KEY"] ?? "", "hex");
  if (key.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/** AES-256-CBC decrypt a string */
export function decryptAes256(ciphertext: string): string {
  const key = Buffer.from(process.env["TOTP_ENCRYPTION_KEY"] ?? "", "hex");
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) throw new Error("Invalid ciphertext format");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
