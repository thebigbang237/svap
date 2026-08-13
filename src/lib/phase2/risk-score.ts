import type { RiskAssessmentInput } from "@/lib/validations/phase2";
import type { VisaHistorique } from "@/lib/constants/program";

/**
 * Non-return risk scoring (§8 "Score de risque attribué à chaque dossier").
 *
 * The specification asks for a score but does not define one, so this is a
 * deliberately **transparent rubric** rather than a model: every point is
 * attributable to one named factor, and the breakdown is stored alongside the
 * total. §8 also requires "revue humaine pour les cas limites", and a human
 * cannot review a bare number.
 *
 * Two things this is NOT:
 *
 *  - an automatic reject. Nothing here rejects anyone. It orders a queue and
 *    tells a reviewer where to look. Consular officers make visa decisions;
 *    this only decides who gets read first.
 *  - a prediction. The weights encode which factors a US consular officer is
 *    documented to weigh under INA §214(b) — ties to the home country,
 *    prior immigration history, family in the US. They are a starting point
 *    for the review team to tune against real outcomes, not a truth claim.
 *
 * Higher score = higher assessed risk of non-return. Range 0–100.
 */

export interface ScoreFactor {
  key: string;
  points: number;
  /** Worst case for this factor, so a reviewer can read the weighting. */
  max: number;
}

export interface RiskScore {
  score: number;
  breakdown: ScoreFactor[];
  band: "faible" | "modere" | "eleve";
  /** Set when a single severe factor floored the band. */
  bandReason?: string;
}

const factor = (key: string, points: number, max: number): ScoreFactor => ({
  key,
  points,
  max,
});

/**
 * The factor maxima sum to exactly 100, which is what makes the score
 * readable as a percentage and the band thresholds meaningful. Asserted in
 * the checks rather than left as a comment nobody re-verifies after editing
 * a weight.
 */
const BAND_MODERE_FROM = 21;
const BAND_ELEVE_FROM = 46;

/**
 * Factors severe enough to warrant a closer look on their own, whatever the
 * total says.
 *
 * Pure addition dilutes a single serious signal: a candidate whose only mark
 * is a previous visa overstay scores 18 and would land in "faible" alongside
 * someone with nothing at all. An overstay is a documented breach of exactly
 * the undertaking this programme is asking them to make again, so it floors
 * the band at "modéré" regardless of how strong the rest of the dossier is.
 */
function severeFloor(input: RiskAssessmentInput): string | null {
  if (input.depassementVisa) return "depassement_visa";
  if (input.refusEntreePaysEtranger) return "refus_entree";
  if (input.refusUsaCount === "3") return "refus_usa_3";
  return null;
}

export function computeRiskScore(input: RiskAssessmentInput): RiskScore {
  const breakdown: ScoreFactor[] = [];

  // --- Prior immigration history ------------------------------------------
  // The heaviest signals: past behaviour at a border is the most direct
  // evidence available about future behaviour at one.
  breakdown.push(
    factor("refus_entree", input.refusEntreePaysEtranger ? 13 : 0, 13),
  );
  breakdown.push(
    // Overstaying is weighted above a refusal: a refusal is someone else's
    // judgement, an overstay is a documented act.
    factor("depassement_visa", input.depassementVisa ? 18 : 0, 18),
  );
  breakdown.push(
    factor(
      "refus_usa",
      { aucun: 0, "1": 5, "2": 9, "3": 14 }[input.refusUsaCount],
      14,
    ),
  );

  // --- Ties to the home country -------------------------------------------
  // Scored as risk *reduction* expressed as points not taken: strong ties
  // score 0, no ties score the maximum.
  breakdown.push(
    factor(
      "attaches_familiales",
      { conjoint_enfants: 0, famille_proche: 5, non: 11 }[
        input.attachesFamiliales
      ],
      11,
    ),
  );
  breakdown.push(
    factor(
      "activite_pays",
      {
        entreprise_declaree: 0,
        biens_immobiliers: 2,
        emploi_cdi: 3,
        non: 14,
      }[input.activitePays],
      14,
    ),
  );
  breakdown.push(
    factor(
      "patrimoine",
      {
        proprietaire: 0,
        locataire_revenus_stables: 4,
        heberge: 8,
        aucun_actif: 12,
      }[input.patrimoine],
      12,
    ),
  );

  // --- Pull factors --------------------------------------------------------
  breakdown.push(
    factor(
      "famille_usa",
      { aucune: 0, eloignee: 4, immediate: 9 }[input.familleUsa],
      9,
    ),
  );

  // --- Travel record -------------------------------------------------------
  // Prior travel that ended in a return is the strongest available evidence
  // of intent to return. "Jamais" is not held heavily against anyone — most
  // of the target audience simply has not had the opportunity, and treating
  // that as suspicion would penalise exactly the candidates the scholarships
  // exist for.
  breakdown.push(
    factor(
      "voyages",
      {
        amerique_nord: 0,
        europe: 2,
        asie_moyen_orient: 3,
        jamais: 5,
      }[input.voyagesHorsAfrique],
      5,
    ),
  );

  // --- Quality of the written commitments ---------------------------------
  // Length is a weak proxy for effort, weighted low on purpose. It exists to
  // surface one-line answers to the two questions that matter most, not to
  // reward verbosity.
  const written =
    input.engagementsRetour.trim().length +
    input.motivationRetour.trim().length;
  breakdown.push(factor("engagement_ecrit", written < 300 ? 4 : 0, 4));

  const score = breakdown.reduce((total, f) => total + f.points, 0);

  let band: RiskScore["band"] =
    score < BAND_MODERE_FROM
      ? "faible"
      : score < BAND_ELEVE_FROM
        ? "modere"
        : "eleve";

  const floor = severeFloor(input);
  const bandReason = floor && band === "faible" ? floor : undefined;
  if (bandReason) band = "modere";

  return { score, breakdown, band, bandReason };
}

/**
 * Cross-checks Phase-2 answers against what the same person declared in
 * Phase 1. Contradictions are not rejections — a candidate may simply have
 * misread the earlier banded question — but they are exactly what a reviewer
 * should see first, and §8 asks for anomaly detection.
 */
export function findConsistencyFlags(
  phase2: RiskAssessmentInput,
  phase1: { visaHistorique: string | null },
): string[] {
  const flags: string[] = [];

  const declaredNoRefusals =
    phase1.visaHistorique === "aucun_jamais" ||
    phase1.visaHistorique === "aucun_obtenu";

  if (declaredNoRefusals && phase2.refusUsaCount !== "aucun") {
    flags.push("refus_usa_contradiction");
  }

  if (
    (phase1.visaHistorique as VisaHistorique) === "refus_1_3" &&
    phase2.refusUsaCount === "aucun"
  ) {
    flags.push("refus_usa_understated");
  }

  // Phase 1 excludes 4+ refusals outright, so reaching Phase 2 while
  // declaring the maximum here is worth a look: the two questions have
  // different granularity and "3" is the ceiling this form offers.
  if (
    phase1.visaHistorique === "aucun_jamais" &&
    phase2.voyagesHorsAfrique === "amerique_nord"
  ) {
    // Travelled to North America but never applied for a US visa. Possible
    // (Canada, Mexico), so a flag rather than a contradiction.
    flags.push("voyage_amerique_sans_visa_usa");
  }

  return flags;
}
