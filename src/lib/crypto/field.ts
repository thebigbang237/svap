import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Application-layer encryption for individual high-sensitivity fields.
 *
 * Supabase already encrypts at rest, but that only protects the disk. It does
 * nothing against a leaked service-role key, an over-broad admin query, a
 * database export, or a passport number landing in a log line. Sealing the
 * field itself means the plaintext exists only where the code deliberately
 * asks for it.
 *
 * AES-256-GCM, so the ciphertext is authenticated: a tampered value fails to
 * decrypt rather than returning attacker-chosen plaintext.
 *
 * Format: `v1.<iv>.<authTag>.<ciphertext>`, all base64url. The version prefix
 * is what makes a future key rotation or algorithm change possible without
 * guessing at how existing rows were written.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the GCM standard
const KEY_BYTES = 32;

function key(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not configured. Sensitive fields cannot be encrypted or decrypted without it.",
    );
  }

  const buf = Buffer.from(raw, "hex");
  if (buf.length !== KEY_BYTES) {
    // A short key silently truncating into AES would produce ciphertext that
    // looks fine and is trivially weaker than intended.
    throw new Error(
      `FIELD_ENCRYPTION_KEY must be ${KEY_BYTES} bytes as hex (${KEY_BYTES * 2} characters). Generate one with: openssl rand -hex ${KEY_BYTES}`,
    );
  }
  return buf;
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptField(sealed: string): string {
  const [version, ivPart, tagPart, dataPart] = sealed.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed encrypted field.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  // Throws on a bad auth tag — which is the point. Tampered or
  // wrong-key ciphertext must fail rather than degrade.
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Last `count` characters, for admin display and phone support.
 *
 * Deliberately a suffix and deliberately short: enough to confirm "the
 * passport ending 4K" over a call, not enough to reconstruct the number or
 * to identify someone from a leaked column.
 */
export function fieldSuffix(plaintext: string, count = 2): string {
  return plaintext.slice(-count);
}

/**
 * Constant-time equality for comparing a submitted value against a decrypted
 * one, e.g. re-verifying a passport number without leaking position of first
 * difference through timing.
 */
export function secureEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
