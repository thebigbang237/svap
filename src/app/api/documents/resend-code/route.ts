import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fullNameMatches } from "@/lib/access-code/name";
import { reissueAccessCode } from "@/lib/access-code/issue";
import { sendAccessCodeEmail } from "@/lib/resend/client";
import {
  checkRateLimit,
  clientIp,
  logAttempt,
} from "@/lib/access-code/rate-limit";
import type { CandidatureRow } from "@/lib/supabase/types";

const resendSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
});

/**
 * "Renvoyer le code" (§12).
 *
 * §12 says a resend may require "des vérifications d'identité supplémentaires".
 * Implemented as name + email having to agree with the stored candidature —
 * the email alone would let anyone who knows a candidate's address trigger
 * mail to them, and worse, silently invalidate the code that candidate is
 * currently holding, since a reissue supersedes the previous one.
 *
 * ALWAYS returns the same success response, whether or not the candidature
 * exists. Otherwise this becomes a free oracle for "is this person an
 * applicant?" — which, for a programme handling visa dossiers and criminal
 * records, is not a question a stranger should be able to answer.
 */
const ACCEPTED = { success: true } as const;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = resendSchema.safeParse(json);

  const ip = clientIp(request);
  const ctx = {
    // No code is submitted here, so rate limiting runs on IP alone.
    codeHash: null,
    ip,
    userAgent: request.headers.get("user-agent"),
  };

  if (!parsed.success) return NextResponse.json(ACCEPTED);

  const supabase = createAdminClient();

  const limit = await checkRateLimit(supabase, ctx);
  if (limit.blocked) {
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(
      { error: "portal.errors.rateLimited" },
      { status: 429 },
    );
  }

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("id, prenom, nom, email, locale, status")
    .eq("email", parsed.data.email.toLowerCase())
    .maybeSingle<
      Pick<
        CandidatureRow,
        "id" | "prenom" | "nom" | "email" | "locale" | "status"
      >
    >();

  // Every early return below is deliberately indistinguishable from success
  // to the caller; the attempt log is where the difference is recorded.
  if (!candidature) {
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(ACCEPTED);
  }

  if (!fullNameMatches(parsed.data.fullName, candidature)) {
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(ACCEPTED);
  }

  // Only dossiers that legitimately hold a code. A candidate who was never
  // pre-selected must not be able to conjure one, and one already past the
  // gate doesn't need another.
  const RESENDABLE = ["code_envoye", "expire"];
  if (!RESENDABLE.includes(candidature.status)) {
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(ACCEPTED);
  }

  const { data: existing } = await supabase
    .from("access_codes")
    .select("resend_count")
    .eq("candidature_id", candidature.id)
    .maybeSingle<{ resend_count: number }>();

  try {
    const { code, expiresAt } = await reissueAccessCode(
      supabase,
      candidature.id,
      existing?.resend_count ?? 0,
    );

    await sendAccessCodeEmail({
      prenom: candidature.prenom,
      email: candidature.email,
      code,
      expiresAt,
      locale: candidature.locale,
    });

    // A reissue after expiry puts the dossier back in play.
    if (candidature.status === "expire") {
      await supabase
        .from("candidatures")
        .update({ status: "code_envoye" })
        .eq("id", candidature.id);
    }

    await logAttempt(supabase, ctx, true);
  } catch (error) {
    console.error("Failed to resend access code:", error);
    await logAttempt(supabase, ctx, false);
  }

  return NextResponse.json(ACCEPTED);
}
