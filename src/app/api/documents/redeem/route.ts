import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashAccessCode } from "@/lib/access-code/code";
import { fullNameMatches } from "@/lib/access-code/name";
import { setSessionCookie } from "@/lib/access-code/session";
import {
  checkRateLimit,
  clientIp,
  logAttempt,
} from "@/lib/access-code/rate-limit";
import type { CandidatureRow } from "@/lib/supabase/types";

const redeemSchema = z.object({
  fullName: z.string().trim().min(1, { error: "portal.errors.required" }),
  code: z.string().trim().min(1, { error: "portal.errors.required" }),
});

/**
 * Every failure path returns this one message.
 *
 * Not laziness — the portal must never reveal *which* half was wrong. A
 * distinct "unknown code" versus "name doesn't match" turns the endpoint into
 * an oracle: an attacker with a stolen code could confirm it is real, then
 * brute-force the name separately. One message means both halves must be
 * known together.
 *
 * The genuinely different states — expired and already-redeemed — do get
 * their own messages, because by then the caller has already proven they know
 * the code, so there is nothing left to leak, and "your code expired" is
 * information the candidate urgently needs.
 */
const INVALID = { error: "portal.errors.invalid" } as const;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = redeemSchema.safeParse(json);

  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!parsed.success) {
    return NextResponse.json(INVALID, { status: 400 });
  }

  const codeHash = hashAccessCode(parsed.data.code);
  const ctx = { codeHash, ip, userAgent };
  const supabase = createAdminClient();

  const limit = await checkRateLimit(supabase, ctx);
  if (limit.blocked) {
    await logAttempt(supabase, ctx, false);
    console.warn(`Access-code rate limit tripped (${limit.scope})`, { ip });
    return NextResponse.json(
      { error: "portal.errors.rateLimited" },
      { status: 429 },
    );
  }

  const { data: accessCode, error } = await supabase
    .from("access_codes")
    .select("id, candidature_id, expires_at, redeemed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (error) {
    console.error("Access-code lookup failed:", error);
    return NextResponse.json({ error: "portal.errors.server" }, { status: 500 });
  }

  if (!accessCode) {
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(INVALID, { status: 401 });
  }

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("id, prenom, nom, status")
    .eq("id", accessCode.candidature_id)
    .maybeSingle<Pick<CandidatureRow, "id" | "prenom" | "nom" | "status">>();

  if (!candidature) {
    // An access code whose candidature vanished. Shouldn't happen (the FK
    // cascades), so it's worth a loud log rather than a silent 401.
    console.error("Access code has no candidature:", accessCode.id);
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(INVALID, { status: 401 });
  }

  // The second factor. Normalised comparison — see lib/access-code/name.ts
  // for why an exact match is the wrong requirement here.
  if (!fullNameMatches(parsed.data.fullName, candidature)) {
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(INVALID, { status: 401 });
  }

  if (new Date(accessCode.expires_at) < new Date()) {
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(
      { error: "portal.errors.expired", canResend: true },
      { status: 410 },
    );
  }

  // Already redeemed is NOT an error for the person who redeemed it: the code
  // was exchanged for a session, and this is what a returning candidate whose
  // session cookie expired looks like. Re-issue the session for the same
  // candidature rather than locking them out — they have just proven they
  // hold both the code and the matching name, which is exactly the check that
  // granted access the first time.
  //
  // The code still cannot be *shared*, because the name must match the
  // candidature it belongs to.
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = accessCode.redeemed_at
    ? {}
    : { redeemed_at: now };

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase
      .from("access_codes")
      .update(patch)
      .eq("id", accessCode.id);

    if (updateError) {
      console.error("Failed to mark access code redeemed:", updateError);
      return NextResponse.json(
        { error: "portal.errors.server" },
        { status: 500 },
      );
    }
  }

  // First redemption moves the dossier into Phase 2. Later re-entries leave
  // the status alone so a candidate returning mid-payment isn't rewound.
  if (candidature.status === "code_envoye") {
    await supabase
      .from("candidatures")
      .update({ status: "phase2_en_cours" })
      .eq("id", candidature.id);
  }

  await logAttempt(supabase, ctx, true);
  await setSessionCookie(candidature.id);

  return NextResponse.json({ success: true });
}
