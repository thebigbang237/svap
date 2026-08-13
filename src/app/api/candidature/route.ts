import { NextResponse } from "next/server";
import { candidatureSchema } from "@/lib/validations/candidature";
import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/i18n/routing";
import { evaluatePreselection } from "@/lib/candidature/preselection";
import {
  sendCandidatureReceivedEmail,
  sendAdminNotificationEmail,
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

  const { count, error: countError } = await supabase
    .from("candidatures")
    .select("id", { count: "exact", head: true })
    .eq("pack", data.pack)
    .in("status", OCCUPYING_STATUSES);

  if (countError) {
    console.error("Failed to count pre-selections:", countError);
    return NextResponse.json(
      { success: false, errors: { root: ["form.submitError"] } },
      { status: 500 },
    );
  }

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
    count ?? 0,
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

    console.error("Failed to insert candidature:", error);
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

  // Only pre-selected candidates get the "we received it, your code is
  // coming" email — telling someone their code is on the way when it never
  // will be is the worst possible message. Non-eligible and at-capacity
  // outcomes are communicated on the result page, and get their own emails
  // once those templates exist (W3 follow-up).
  //
  // The admin notification always fires: the team needs to see volume and
  // rejection reasons, not only the successes.
  const emails: Promise<unknown>[] = [sendAdminNotificationEmail(emailData)];
  if (verdict.status === "preselectionne") {
    emails.push(sendCandidatureReceivedEmail(emailData));
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
