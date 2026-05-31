import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

const CURRENT_SALT = "settlor-salt-v1";
const LEGACY_SALT = "ipayx-salt";

function deriveKey(salt: string): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (min 16 chars)");
  }
  return scryptSync(secret, salt, 32);
}

function decryptWithKey(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(CURRENT_SALT);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt session payloads (supports pre-Settlor rebrand salt). */
export function decrypt(payload: string): string {
  try {
    return decryptWithKey(payload, deriveKey(CURRENT_SALT));
  } catch {
    return decryptWithKey(payload, deriveKey(LEGACY_SALT));
  }
}
