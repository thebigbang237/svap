import {
  MIN_AGE,
  DELEGUE_MAX_AGE,
  type CandidatureStatus,
  type IneligibilityReason,
  type Pack,
} from "@/lib/constants/program";

/**
 * Automatic Phase-1 pre-selection.
 *
 * Of the eligibility criteria in §2 of the specification, only three can be
 * decided mechanically from the form. The other three — "motivation sincère",
 * "volonté confirmée de retour", "cherchant uniquement un visa … sans
 * engagement réel" — are qualitative, and belong to the post-verification
 * dossier review, not here. That split is consistent with the document itself,
 * which says scholarship allocation is "non automatique … après étude
 * approfondie". See docs/flow-edition-2026.md §2.
 *
 * Capacity is deliberately NOT a gate. A pack's `places` is the number of
 * seats awarded at the end, not a quota on who may apply: client decision of
 * 2026-08-17, replacing the pre-selection caps this function used to enforce.
 * Everyone who clears the gates below is pre-selected, and the ranking against
 * `places` happens once the verified dossiers are in.
 *
 * Country is not checked: the form only offers the six participating
 * countries, so it is satisfied by construction and re-checking it here would
 * imply a failure mode that cannot occur.
 *
 * Deliberately pure — no DB, no I/O — so the rules can be unit-tested and read
 * in one place.
 */

export interface PreselectionInput {
  age: number;
  pack: Pack;
  casierJudiciaire: "non" | "oui";
  visaHistorique: "aucun_jamais" | "aucun_obtenu" | "refus_1_3" | "refus_4_plus";
}

export type PreselectionResult =
  | { status: Extract<CandidatureStatus, "preselectionne">; reason: null }
  | {
      status: Extract<CandidatureStatus, "non_eligible">;
      reason: IneligibilityReason;
    };

/**
 * The three mechanical gates, evaluated in the order the specification lists
 * them. Returns the first failure so the candidate gets one specific reason
 * rather than a list — telling someone every way they failed at once is worse
 * copy and leaks more of the rule set than it needs to.
 */
export function evaluatePreselection(
  input: PreselectionInput,
): PreselectionResult {
  if (input.age < MIN_AGE) {
    return { status: "non_eligible", reason: "age" };
  }

  // The delegate role carries an upper age limit; the trip packs do not.
  // Modelled as the same "age" reason — the candidate is out of range either
  // way, and the copy reads from the pack.
  if (input.pack === "delegue" && input.age > DELEGUE_MAX_AGE) {
    return { status: "non_eligible", reason: "age" };
  }

  if (input.casierJudiciaire !== "non") {
    return { status: "non_eligible", reason: "casier_judiciaire" };
  }

  if (input.visaHistorique === "refus_4_plus") {
    return { status: "non_eligible", reason: "visa_refusals" };
  }

  return { status: "preselectionne", reason: null };
}

/** Did this candidature clear Phase 1 and earn an access code? */
export function isPreselected(result: PreselectionResult): boolean {
  return result.status === "preselectionne";
}
