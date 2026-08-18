import "server-only";
import type { AdminClient } from "@/lib/supabase/admin";
import type { CandidatureRow } from "@/lib/supabase/types";
import { financialRequirement } from "@/lib/constants/program";

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
 *
 * `capacite` (2026-08-17) is the one pack-dependent step: what a candidate
 * must evidence there is a function of the engagement their pack carries, and
 * Délégué — a role served at home — carries none. Hence the step list is
 * derived per dossier rather than being a constant.
 */

export const PHASE2_STEPS = [
  "informations",
  "evaluation",
  "paiement",
  "pieces",
  "capacite",
  "consentements",
] as const;

export type Phase2Step = (typeof PHASE2_STEPS)[number];

export const PHASE2_PATHS: Record<Phase2Step, string> = {
  informations: "/documents/informations",
  evaluation: "/documents/evaluation",
  paiement: "/documents/paiement",
  pieces: "/documents/pieces",
  capacite: "/documents/capacite",
  consentements: "/documents/consentements",
};

/**
 * The steps this pack actually walks through, in order.
 *
 * Everything downstream — the progress bar's denominator, the "can I open
 * this step" check, the resume point — reads this rather than PHASE2_STEPS,
 * so a Délégué is never told they're on "step 5 of 6" and never redirected to
 * a page asking them for a bank attestation.
 */
export function phase2StepsForPack(pack: string): Phase2Step[] {
  return PHASE2_STEPS.filter(
    (step) => step !== "capacite" || financialRequirement(pack) !== null,
  );
}

/**
 * Statuses at which Phase 2 is finished and closed for editing.
 *
 * Once verifications have started, the dossier is what the reviewers — and
 * potentially a consulate — are working from. A candidate re-opening the
 * email link weeks later must not be able to silently overwrite the personal
 * information or risk answers that decision is based on, or re-upload a
 * different passport scan after the fact.
 */
export const PHASE2_LOCKED_STATUSES = ["verification", "valide", "rejete"];

export function isPhase2Locked(status: string): boolean {
  return PHASE2_LOCKED_STATUSES.includes(status);
}

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
  /** The pack-specific dossier at Étape 5 has been submitted. */
  hasFinancialDossier: boolean;
  /** The steps this candidate's pack goes through, in order. */
  steps: Phase2Step[];
  /** Dossier submitted — every step is now read-only. */
  locked: boolean;
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

  const [personalInfo, risk, documents, financial] = await Promise.all([
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
    supabase
      .from("phase2_financial")
      .select("candidature_id")
      .eq("candidature_id", candidatureId)
      .maybeSingle(),
  ]);

  const hasPersonalInfo = !!personalInfo.data;
  const hasRiskAssessment = !!risk.data;
  const hasFinancialDossier = !!financial.data;

  // A read error here is indistinguishable from "not submitted yet", which
  // would silently park every Business/VIP candidate on the capacity step
  // forever. The overwhelmingly likely cause is migration 0015 not having been
  // applied, so say so rather than leaving a support ticket to diagnose it.
  if (financial.error) {
    console.error("Failed to read phase2_financial (is migration 0015 applied?):", {
      message: financial.error.message,
      code: financial.error.code,
      details: financial.error.details,
      hint: financial.error.hint,
    });
  }

  // Payment is read off the candidature's own lifecycle rather than a
  // payments table, so this stays correct once W6 lands: those statuses are
  // only ever set by a verified provider webhook.
  const hasPaid = ["phase2_paye", "verification", "valide"].includes(
    candidature.status,
  );

  const documentKinds = (documents.data ?? []).map((d) => d.kind as string);
  const steps = phase2StepsForPack(candidature.pack);

  return {
    candidature,
    hasPersonalInfo,
    hasRiskAssessment,
    hasPaid,
    documentKinds,
    hasFinancialDossier,
    steps,
    locked: isPhase2Locked(candidature.status),
    nextStep: resolveNextStep(steps, {
      hasPersonalInfo,
      hasRiskAssessment,
      hasPaid,
      documentKinds,
      hasFinancialDossier,
    }),
  };
}

/** Identity pieces that gate the step. The ID verso is only mandatory for
 *  national identity cards, so it is deliberately not among them. */
const REQUIRED_IDENTITY_KINDS = [
  "id_recto",
  "selfie_liveness",
  "casier_judiciaire",
];

function resolveNextStep(
  steps: Phase2Step[],
  state: {
    hasPersonalInfo: boolean;
    hasRiskAssessment: boolean;
    hasPaid: boolean;
    documentKinds: string[];
    hasFinancialDossier: boolean;
  },
): Phase2Step {
  if (!state.hasPersonalInfo) return "informations";
  if (!state.hasRiskAssessment) return "evaluation";
  if (!state.hasPaid) return "paiement";
  if (!REQUIRED_IDENTITY_KINDS.every((k) => state.documentKinds.includes(k))) {
    return "pieces";
  }
  if (steps.includes("capacite") && !state.hasFinancialDossier) {
    return "capacite";
  }
  return "consentements";
}

/**
 * May the candidate open this step yet?
 *
 * Steps already completed stay open — going back to correct a typo is normal
 * and should not require support. What's blocked is jumping *ahead* of the
 * work: it would leave half-populated rows and, at the documents step, would
 * let someone upload before paying.
 *
 * A step this pack doesn't have is not "ahead", it's absent: `indexOf` returns
 * -1 for it, which would read as reachable, so it's rejected outright.
 */
export function canAccessStep(
  step: Phase2Step,
  progress: Phase2Progress,
): boolean {
  const requested = progress.steps.indexOf(step);
  if (requested === -1) return false;
  return requested <= progress.steps.indexOf(progress.nextStep);
}
