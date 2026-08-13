import "server-only";
import type { AdminClient } from "@/lib/supabase/admin";
import type { CandidatureRow } from "@/lib/supabase/types";

/**
 * Phase-2 step order and resume logic.
 *
 * The order differs from §14 of the specification, which puts payment first.
 * Approved change (2026-08-12): personal information and the risk
 * questionnaire come *before* payment, and documents come after it.
 *
 * That keeps the constraint the specification actually cares about —
 * "paiement requis AVANT le lancement des vérifications" — while fixing two
 * problems the original order creates: asking for $330 before any effort
 * maximises abandonment, and collecting passport scans before payment means
 * storing the most sensitive data in the dossier for people who never paid.
 * See docs/flow-edition-2026.md §4.
 */

export const PHASE2_STEPS = [
  "informations",
  "evaluation",
  "paiement",
  "pieces",
  "consentements",
] as const;

export type Phase2Step = (typeof PHASE2_STEPS)[number];

export const PHASE2_PATHS: Record<Phase2Step, string> = {
  informations: "/documents/informations",
  evaluation: "/documents/evaluation",
  paiement: "/documents/paiement",
  pieces: "/documents/pieces",
  consentements: "/documents/consentements",
};

export interface Phase2Progress {
  candidature: Pick<
    CandidatureRow,
    | "id"
    | "prenom"
    | "nom"
    | "email"
    | "telephone"
    | "pays"
    | "pack"
    | "locale"
    | "status"
    | "visa_historique"
  >;
  hasPersonalInfo: boolean;
  hasRiskAssessment: boolean;
  hasPaid: boolean;
  documentKinds: string[];
  /** First step the candidate still has work to do on. */
  nextStep: Phase2Step;
}

/**
 * Reads what the candidate has actually completed, rather than trusting a
 * step number in the URL.
 *
 * This is what makes the flow resumable across devices — a candidate who
 * fills the form on a laptop and returns on a phone to photograph their ID
 * lands exactly where they left off, with no client state involved.
 */
export async function loadPhase2Progress(
  supabase: AdminClient,
  candidatureId: string,
): Promise<Phase2Progress | null> {
  const { data: candidature } = await supabase
    .from("candidatures")
    .select(
      "id, prenom, nom, email, telephone, pays, pack, locale, status, visa_historique",
    )
    .eq("id", candidatureId)
    .maybeSingle<Phase2Progress["candidature"]>();

  if (!candidature) return null;

  const [personalInfo, risk, documents] = await Promise.all([
    supabase
      .from("phase2_applications")
      .select("candidature_id")
      .eq("candidature_id", candidatureId)
      .maybeSingle(),
    supabase
      .from("risk_assessments")
      .select("candidature_id")
      .eq("candidature_id", candidatureId)
      .maybeSingle(),
    supabase
      .from("phase2_documents")
      .select("kind")
      .eq("candidature_id", candidatureId),
  ]);

  const hasPersonalInfo = !!personalInfo.data;
  const hasRiskAssessment = !!risk.data;

  // Payment is read off the candidature's own lifecycle rather than a
  // payments table, so this stays correct once W6 lands: those statuses are
  // only ever set by a verified provider webhook.
  const hasPaid = ["phase2_paye", "verification", "valide"].includes(
    candidature.status,
  );

  const documentKinds = (documents.data ?? []).map((d) => d.kind as string);

  return {
    candidature,
    hasPersonalInfo,
    hasRiskAssessment,
    hasPaid,
    documentKinds,
    nextStep: resolveNextStep({
      hasPersonalInfo,
      hasRiskAssessment,
      hasPaid,
      documentKinds,
    }),
  };
}

function resolveNextStep(state: {
  hasPersonalInfo: boolean;
  hasRiskAssessment: boolean;
  hasPaid: boolean;
  documentKinds: string[];
}): Phase2Step {
  if (!state.hasPersonalInfo) return "informations";
  if (!state.hasRiskAssessment) return "evaluation";
  if (!state.hasPaid) return "paiement";
  // Three of the four documents are always required; the ID verso is only
  // mandatory for national identity cards, so it isn't gating here.
  const required = ["id_recto", "selfie_liveness", "casier_judiciaire"];
  if (!required.every((k) => state.documentKinds.includes(k))) return "pieces";
  return "consentements";
}

/**
 * May the candidate open this step yet?
 *
 * Steps already completed stay open — going back to correct a typo is normal
 * and should not require support. What's blocked is jumping *ahead* of the
 * work: it would leave half-populated rows and, at the documents step, would
 * let someone upload before paying.
 */
export function canAccessStep(
  step: Phase2Step,
  progress: Phase2Progress,
): boolean {
  const requested = PHASE2_STEPS.indexOf(step);
  const furthest = PHASE2_STEPS.indexOf(progress.nextStep);
  return requested <= furthest;
}
