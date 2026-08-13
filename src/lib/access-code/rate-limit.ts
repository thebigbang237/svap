import "server-only";
import type { AdminClient } from "@/lib/supabase/admin";

/**
 * Attempt logging and rate limiting for the Phase-2 portal
 * (§5 "Les tentatives invalides sont limitées et journalisées",
 *  §8 "Journaux d'audit complets sur chaque accès").
 *
 * Two independent limits, because they catch different attacks:
 *
 *  - per code — someone who knows one candidate's code exists and is grinding
 *    the name field, or grinding a code they half-remember;
 *  - per IP — someone enumerating the code space across many candidatures.
 *
 * A single combined limit would let either attack hide inside the other's
 * headroom.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_FAILURES_PER_CODE = 5;
const MAX_FAILURES_PER_IP = 20;

export interface AttemptContext {
  /** HMAC of the submitted code — never the code itself. */
  codeHash: string | null;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Extracts the client IP from the proxy headers. Returns null rather than a
 * placeholder when it can't be determined, so a missing IP never collapses
 * every visitor into one shared rate-limit bucket.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Left-most entry is the original client; the rest are proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export async function logAttempt(
  supabase: AdminClient,
  ctx: AttemptContext,
  success: boolean,
): Promise<void> {
  const { error } = await supabase.from("access_code_attempts").insert({
    code_hash: ctx.codeHash,
    ip: ctx.ip,
    user_agent: ctx.userAgent?.slice(0, 500) ?? null,
    success,
  });

  // Logging failures must not break the flow for a legitimate candidate, but
  // they do mean the audit trail has a hole — surface them loudly in logs.
  if (error) console.error("Failed to log access-code attempt:", error);
}

export interface RateLimitVerdict {
  blocked: boolean;
  /** Which limit tripped, for logs. Never shown to the client. */
  scope?: "code" | "ip";
}

/**
 * Counts recent *failures* only. Successful redemptions don't count against
 * anyone: a candidate who gets it right first time, then returns from a new
 * device, should not be creeping towards a lockout.
 */
export async function checkRateLimit(
  supabase: AdminClient,
  ctx: AttemptContext,
): Promise<RateLimitVerdict> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  // `.limit(1)` rather than `head: true` — a HEAD request has no body, so
  // supabase-js cannot report why it failed, and the log ends up as an
  // empty message. The exact count still arrives in the Content-Range header.
  const [byCode, byIp] = await Promise.all([
    ctx.codeHash
      ? supabase
          .from("access_code_attempts")
          .select("id", { count: "exact" })
          .eq("code_hash", ctx.codeHash)
          .eq("success", false)
          .gte("created_at", since)
          .limit(1)
      : Promise.resolve({ count: 0, error: null }),
    ctx.ip
      ? supabase
          .from("access_code_attempts")
          .select("id", { count: "exact" })
          .eq("ip", ctx.ip)
          .eq("success", false)
          .gte("created_at", since)
          .limit(1)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  // Fail *open* on a counting error, and say so in the logs. The alternative
  // — locking every candidate out of a paid process because a count query
  // failed — is the worse outcome, and the attempt log still records what
  // happened for after-the-fact review.
  if (byCode.error || byIp.error) {
    console.error("Rate-limit check failed:", byCode.error ?? byIp.error);
    return { blocked: false };
  }

  if ((byCode.count ?? 0) >= MAX_FAILURES_PER_CODE) {
    return { blocked: true, scope: "code" };
  }
  if ((byIp.count ?? 0) >= MAX_FAILURES_PER_IP) {
    return { blocked: true, scope: "ip" };
  }
  return { blocked: false };
}
