import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { ACCESS_CODE } from "@/lib/constants/program";

/**
 * Access code generation, formatting and hashing.
 *
 * Format is SVAP-XXXX-XXXX, fixed by §14 of the specification.
 */

/**
 * Crockford-style base32: the full alphabet minus the characters people
 * misread or mistype when copying a code off a phone screen — 0/O, 1/I/L, and
 * U (which also avoids accidental profanity). 30 symbols over 8 positions is
 * ~6.5 × 10¹¹ combinations.
 *
 * That is deliberately not a lot of entropy by cryptographic standards; the
 * code is not a password. What makes it safe is the combination of a
 * server-side pepper (no offline attack on a leaked table), a required
 * matching full name, and rate-limited attempts (no online attack).
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function pepper(): string {
  const value = process.env.ACCESS_CODE_PEPPER;
  if (!value) {
    // Failing loudly beats silently hashing with an empty pepper — that would
    // produce codes that validate correctly while offering none of the
    // protection the schema comment promises.
    throw new Error(
      "ACCESS_CODE_PEPPER is not configured. Access codes cannot be issued or verified without it.",
    );
  }
  return value;
}

/** A fresh code in display form, e.g. "SVAP-4F2A-9C11". */
export function generateAccessCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < ACCESS_CODE.groups; g++) {
    let group = "";
    for (let i = 0; i < ACCESS_CODE.groupLength; i++) {
      // randomInt is rejection-sampled, so this carries no modulo bias the
      // way randomBytes(1) % ALPHABET.length would.
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return [ACCESS_CODE.prefix, ...groups].join("-");
}

/**
 * Canonical form for hashing and comparison.
 *
 * Candidates retype codes from an email: they lower-case them, drop or move
 * the hyphens, and paste surrounding whitespace. Folding all of that away
 * means "svap 4f2a 9c11" and "SVAP-4F2A-9C11" hash identically, so a
 * formatting slip never costs someone an attempt against their rate limit.
 *
 * No lookalike substitution (O→0, I→1) on purpose: ALPHABET already excludes
 * every ambiguous character, so a submitted O or I cannot be a valid code
 * whatever the candidate meant. Guessing at intent here would map distinct
 * inputs onto one hash and widen the search space for no benefit.
 */
export function normalizeAccessCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * HMAC-SHA256 of the normalised code under the server pepper.
 *
 * Deterministic on purpose — see the schema comment in
 * 0007_svap_access_codes.sql for why a salted hash cannot work here.
 */
export function hashAccessCode(raw: string): string {
  return createHmac("sha256", pepper())
    .update(normalizeAccessCode(raw))
    .digest("hex");
}

/** When a code issued now should stop working. */
export function accessCodeExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + ACCESS_CODE.validityDays * 86_400_000);
}
