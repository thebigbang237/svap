import { NextResponse } from "next/server";
import { candidatureSchema } from "@/lib/validations/candidature";
import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/i18n/routing";
import { evaluatePreselection } from "@/lib/candidature/preselection";
import {
  sendCandidatureReceivedEmail,
  sendAdminNotificationEmail,
  sendStatusUpdateEmail,
} from "@/lib/resend/client";
import type { CandidatureEmailData } from "@/lib/resend/types";

/**
 * Statuses that occupy one of a pack's capped pre-selection slots. A dossier
 * that failed a gate or expired never consumed a place, so it must not count
 * against the cap.
 */
const OCCUPYING_STATUSES = [
  "preselectionne",
  "code_envoye",
  "phase2_en_cours",
  "phase2_paye",
  "verification",
  "valide",
];

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);

  if (!json || typeof json !== "object") {
    return NextResponse.json(
      { success: false, errors: { root: ["form.submitError"] } },
      { status: 400 },
    );
  }

  const { locale: rawLocale, ...formData } = json as Record<string, unknown>;
  const locale = (routing.locales as readonly string[]).includes(
    rawLocale as string,
  )
    ? (rawLocale as (typeof routing.locales)[number])
    : routing.defaultLocale;

  const parsed = candidatureSchema.safeParse(formData);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Service-role client: the capacity check below has to COUNT rows, and the
  // anonymous "Anyone can submit a candidature" policy grants INSERT only.
  // Nothing user-supplied reaches a query filter here beyond the pack enum,
  // which Zod has already constrained to a known value.
  const supabase = createAdminClient();

  // `head: true` would issue a HEAD request, whose empty body leaves
  // supabase-js unable to surface any error detail at all — the symptom being
  // a useless `{ message: '' }` in the logs. `.limit(1)` gets the exact count
  // from the Content-Range header just the same, over a normal GET that can
  // actually report what went wrong.
  const { count, error: countError } = await supabase
    .from("candidatures")
    .select("id", { count: "exact" })
    .eq("pack", data.pack)
    .in("status", OCCUPYING_STATUSES)
    .limit(1);

  if (countError) {
    // Log every field Postgres/PostgREST provides. `message` alone is often
    // empty; `code`, `details` and `hint` are what identify a missing schema
    // grant versus a missing table versus a bad key.
    console.error("Failed to count pre-selections:", {
      message: countError.message,
      code: countError.code,
      details: countError.details,
      hint: countError.hint,
    });
  }

  // Fail OPEN, deliberately.
  //
  // The capacity cap is a business lever, not a safety control — exceeding it
  // slightly costs the programme a few extra pre-selections it can absorb.
  // Refusing every application because a COUNT query failed takes the entire
  // free Phase-1 funnel offline, which is far worse. The error above is what
  // gets it noticed.
  const occupiedForPack = countError ? 0 : (count ?? 0);

  // The four mechanical gates plus capacity. Everything qualitative — the
  // three critères de sélection — is deliberately not decided here; it belongs
  // to the post-verification dossier review. See lib/candidature/preselection.
  const verdict = evaluatePreselection(
    {
      age: data.age,
      pack: data.pack,
      casierJudiciaire: data.casierJudiciaire,
      visaHistorique: data.visaHistorique,
    },
    occupiedForPack,
  );

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("candidatures").insert({
    id,
    prenom: data.prenom,
    nom: data.nom,
    email: data.email,
    telephone: data.telephone,
    age: data.age,
    pays: data.pays,
    ville: data.ville,
    secteur: data.secteur,
    pack: data.pack,
    casier_judiciaire: data.casierJudiciaire,
    visa_historique: data.visaHistorique,
    marie: data.marie,
    enfants: data.enfants,
    source: data.source,
    delegue_nom: data.source === "delegue" ? (data.delegueNom ?? null) : null,
    motivation: data.motivation,
    lien_pays: data.lienPays,
    consent_exactitude: data.consentExactitude,
    consent_communications: data.consentCommunications,
    locale,
    status: verdict.status,
    preselection_reason: verdict.reason,
    preselection_at: now,
  });

  if (error) {
    // Postgres unique_violation on idx_svap_candidatures_email_unique —
    // this email has already submitted a candidature.
    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, errors: { email: ["validation.duplicateEmail"] } },
        { status: 409 },
      );
    }

    // Same reasoning as the count above: the individual fields are what make
    // a schema/permission problem distinguishable from a constraint violation.
    console.error("Failed to insert candidature:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { success: false, errors: { root: ["form.submitError"] } },
      { status: 500 },
    );
  }

  const emailData: CandidatureEmailData = {
    id,
    prenom: data.prenom,
    nom: data.nom,
    email: data.email,
    telephone: data.telephone,
    pays: data.pays,
    secteur: data.secteur,
    pack: data.pack,
    visaHistorique: data.visaHistorique,
    casierJudiciaire: data.casierJudiciaire,
    motivation: data.motivation,
    locale,
  };

  // Every applicant hears back, but not with the same message. Telling
  // someone their access code is on the way when it never will be is the
  // worst possible email, so the non-advancing outcomes get their own —
  // each one stating that no fee was charged and the dossier stays eligible
  // for future editions.
  //
  // The admin notification always fires: the team needs to see volume and
  // rejection reasons, not only the successes.
  const emails: Promise<unknown>[] = [sendAdminNotificationEmail(emailData)];

  if (verdict.status === "preselectionne") {
    emails.push(sendCandidatureReceivedEmail(emailData));
  } else {
    emails.push(sendStatusUpdateEmail(emailData, verdict.status));
  }

  // Never let a Resend failure block the response — the row is already
  // committed, so the submission is safe regardless of whether mail goes out.
  const results = await Promise.allSettled(emails);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Candidature email failed:", result.reason);
    }
  }

  return NextResponse.json({
    success: true,
    id,
    status: verdict.status,
    reason: verdict.reason,
  });
}
