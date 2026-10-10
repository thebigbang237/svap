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

/** Escapes the LIKE wildcards so an address is matched literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** "di…@gmail.com" — enough to recognise an address, not to harvest one. */
function mask(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "…";
  return `${local.slice(0, 2)}…@${domain}`;
}

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
    // ⚠️ Case-insensitive, and it has to be: Phase 1 stores the address
    // exactly as typed — which is why the uniqueness index is on
    // `lower(email)` — so an exact match missed every candidate who
    // capitalised anything. They got the same "a code has been sent"
    // confirmation as everyone else, and no email, with nothing in the logs.
    // `_` and `%` are legal in a local part, so they are escaped rather than
    // left to act as wildcards.
    .ilike("email", escapeLikePattern(parsed.data.email))
    .maybeSingle<
      Pick<
        CandidatureRow,
        "id" | "prenom" | "nom" | "email" | "locale" | "status"
      >
    >();

  // Every early return below is deliberately indistinguishable from success
  // to the caller; the attempt log is where the difference is recorded.
  if (!candidature) {
    // The response stays identical either way; the reason belongs in the log,
    // or a resend that quietly does nothing is undiagnosable. The address is
    // masked — this line is about which branch was taken, not who asked.
    console.warn(`Resend refused: no candidature for ${mask(parsed.data.email)}`);
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(ACCEPTED);
  }

  if (!fullNameMatches(parsed.data.fullName, candidature)) {
    console.warn(`Resend refused: name mismatch on candidature ${candidature.id}`);
    await logAttempt(supabase, ctx, false);
    return NextResponse.json(ACCEPTED);
  }

  // Only dossiers that legitimately hold a code: someone never pre-selected
  // must not be able to conjure one.
  //
  // Phase-2 statuses are in here deliberately. They were not, and the result
  // was the worst kind of dead end: a candidate halfway through their dossier
  // who had lost the email got the same cheerful "a code has been sent"
  // confirmation and no email, because this list stopped at the gate they had
  // already walked through. They are the people most likely to be asking.
  // Verifying name and email again reveals nothing a resend to the address on
  // file could expose.
  //
  // `rejete` is left out: a decided dossier is read-only and the decision
  // reaches them by email, so a fresh code offers nothing to do.
  const RESENDABLE = [
    "code_envoye",
    "expire",
    "phase2_en_cours",
    "phase2_paye",
    "verification",
    "valide",
  ];
  if (!RESENDABLE.includes(candidature.status)) {
    console.warn(
      `Resend refused: candidature ${candidature.id} is ${candidature.status}`,
    );
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
