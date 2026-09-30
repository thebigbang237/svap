import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * SasPay callback signatures.
 *
 * Their scheme, from the dashboard at webhook creation:
 *
 *     X-Webhook-Signature = HMAC-SHA256( secret, `${X-Webhook-Timestamp}.${raw body}` )
 *
 * and reject timestamps older than five minutes, which is what stops a
 * captured delivery being replayed later.
 *
 * Kept free of imports, and of `server-only`, so
 * `scripts/check-saspay-signature.mjs` can assert it directly. The failure
 * mode here is silent in both directions — a verifier that rejects everything
 * looks exactly like a quiet integration, because payments still settle
 * through the poll and the cron, while every callback is dropped. That is
 * precisely what happened on the pawaPay rail.
 */

/** Their stated tolerance. Also bounds how long a captured delivery is useful. */
const MAX_AGE_MS = 5 * 60 * 1000;

export interface SignatureHeaders {
  signature: string | null;
  timestamp: string | null;
}

/**
 * Milliseconds since the epoch, from whichever form the header carries.
 *
 * Accepts unix seconds, unix milliseconds and an ISO date, because the
 * dashboard names the header without pinning its format, and guessing wrong
 * would reject every genuine callback.
 */
export function parseTimestamp(raw: string): number | null {
  const trimmed = raw.trim();

  if (/^\d+$/.test(trimmed)) {
    const value = Number(trimmed);
    // 10 digits is seconds, 13 is milliseconds. Anything shorter is not a
    // plausible recent timestamp.
    return trimmed.length <= 10 ? value * 1000 : value;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function verifySaspaySignature(
  rawBody: string,
  headers: SignatureHeaders,
  secret: string,
  now: number = Date.now(),
): boolean {
  const { signature, timestamp } = headers;

  // No signature is not a soft failure: an unauthenticated callback that can
  // settle a fee is the thing this exists to prevent.
  if (!signature || !timestamp || !secret) return false;

  const sentAt = parseTimestamp(timestamp);
  if (sentAt === null || Math.abs(now - sentAt) > MAX_AGE_MS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  // Tolerate a `sha256=` prefix and either case: neither is documented as
  // absent, and both are common in the wild.
  const provided = signature.trim().replace(/^sha256=/i, "").toLowerCase();

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
