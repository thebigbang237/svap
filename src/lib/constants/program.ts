/**
 * Single source of truth for the shape of the Édition 2026 programme.
 *
 * Everything that describes *what the programme is* — packs, fees, places,
 * eligible countries, sectors — lives here and nowhere else. Forms, Zod
 * schemas, pack cards, email templates, the admin filters and the SQL check
 * constraints all derive from these values.
 *
 * Display labels do NOT live here: they're in messages/{fr,en,ar}.json under
 * `candidature.options.*`, keyed by the slugs below. The one exception is
 * lib/resend/labels.ts, which needs labels outside the next-intl context.
 *
 * Source: "Silicon Valley Africa Program — Édition 2026", First Of All LLC,
 * plus the client decisions recorded in docs/plan-edition-2026.md §1.
 */

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

/**
 * Exactly six countries this edition. The client's stated rationale is that
 * these are the markets still broadly eligible for US B1/B2 visas — so this
 * list is a business decision, not a geography one, and will change between
 * editions. ISO 3166-1 alpha-3, lowercased.
 */
export const COUNTRIES = ["zaf", "mar", "cmr", "ken", "gha", "egy"] as const;
export type Country = (typeof COUNTRIES)[number];

/**
 * Per-country payment context. Fees are quoted in USD but collected on local
 * rails, so the checkout needs to know which rails exist before it can offer
 * a method — see docs/plan-edition-2026.md §4.
 *
 * `mobileMoney` reflects pawaPay's actual coverage: it supports only Cameroun,
 * Kenya and Ghana of our six. Morocco, Egypt and South Africa are card-only,
 * which is why a card processor is mandatory rather than optional.
 */
export interface CountryPaymentContext {
  /** ISO 4217 currency the local rails settle in. */
  currency: string;
  /** pawaPay mobile-money support. False ⇒ card is the only option. */
  mobileMoney: boolean;
}

export const COUNTRY_PAYMENT: Record<Country, CountryPaymentContext> = {
  zaf: { currency: "ZAR", mobileMoney: false },
  mar: { currency: "MAD", mobileMoney: false },
  cmr: { currency: "XAF", mobileMoney: true },
  ken: { currency: "KES", mobileMoney: true },
  gha: { currency: "GHS", mobileMoney: true },
  egy: { currency: "EGP", mobileMoney: false },
};

// ---------------------------------------------------------------------------
// Sectors
// ---------------------------------------------------------------------------

export const SECTEURS = [
  "banque_finance",
  "tech_digital",
  "telecoms",
  "commerce",
  "industrie",
  "agriculture",
  "energie",
  "sante",
  "immobilier_btp",
  "conseil",
  "administration",
  "autre",
] as const;
export type Secteur = (typeof SECTEURS)[number];

// ---------------------------------------------------------------------------
// Packs
// ---------------------------------------------------------------------------

export const PACKS = [
  "laureat",
  "boursier",
  "delegue",
  "business_visitor",
  "vip_visitor",
] as const;
export type Pack = (typeof PACKS)[number];

export interface PackSpec {
  /** Seats available this edition. */
  places: number;
  /**
   * Phase-2 verification fee in USD. Phase 1 is free for every pack — that is
   * the programme's stated founding principle, so there is deliberately no
   * "application fee" field here to accidentally render.
   */
  verificationFeeUsd: number;
  /**
   * Bonus paid if the US visa is refused, subject to documentary proof and
   * internal audit. `null` = no prime defined for this pack.
   *
   * NOTE: Business Visitor is null because the spec simply omits it — see
   * open decision #4 in docs/plan-edition-2026.md. Confirm before publishing
   * the refund/prime table.
   */
  visaRefusalPrimeUsd: number | null;
  /**
   * `scholarship` — funded seats awarded on dossier review.
   * `self_funded`  — candidate pays; auto-selected if eligibility criteria met.
   * `role`         — the paid delegate position, not a trip to California.
   */
  kind: "scholarship" | "self_funded" | "role";
  /**
   * How the seat is awarded once Phase-2 verification passes.
   *
   * `automatic`   — verification passes ⇒ seat. Every paid candidate who clears
   *                 the checks consumes one of the places.
   * `competitive` — a human reviews the dossier against the three critères de
   *                 sélection (motivation, impact du voyage, retour au pays)
   *                 and awards the limited seats.
   *
   * This is what makes the cap below necessary: pre-selection is automatic and
   * would otherwise be unbounded, while seats never are.
   */
  decision: "automatic" | "competitive";
  /**
   * Pre-selection stops for this pack once `places × this` candidatures have
   * been pre-selected. Beyond the cap a dossier is recorded eligible-but-full
   * and carried to the next edition rather than charged a verification fee.
   *
   * A business lever, not a technical constant — see
   * docs/flow-edition-2026.md §7. Automatic packs sit just above 1 because
   * every pre-selection converts into a seat; competitive packs need a real
   * pool to choose from, but every multiple above 1 is a candidate who pays
   * and loses, so 2 is the smallest ratio that still permits selection.
   */
  preselectionCapMultiplier: number;
}

export const PACK_SPECS: Record<Pack, PackSpec> = {
  laureat: {
    places: 12,
    verificationFeeUsd: 20,
    visaRefusalPrimeUsd: 1000,
    kind: "scholarship",
    decision: "competitive",
    preselectionCapMultiplier: 2,
  },
  boursier: {
    places: 63,
    verificationFeeUsd: 30,
    visaRefusalPrimeUsd: 500,
    kind: "scholarship",
    decision: "competitive",
    preselectionCapMultiplier: 2,
  },
  delegue: {
    places: 60,
    verificationFeeUsd: 30,
    visaRefusalPrimeUsd: null,
    kind: "role",
    // Modelled as competitive pending client confirmation — see
    // docs/flow-edition-2026.md §7 "Still open".
    decision: "competitive",
    preselectionCapMultiplier: 2,
  },
  business_visitor: {
    places: 104,
    verificationFeeUsd: 330,
    visaRefusalPrimeUsd: null,
    kind: "self_funded",
    decision: "automatic",
    preselectionCapMultiplier: 1.25,
  },
  vip_visitor: {
    places: 21,
    verificationFeeUsd: 330,
    visaRefusalPrimeUsd: 4500,
    kind: "self_funded",
    decision: "automatic",
    preselectionCapMultiplier: 1.25,
  },
};

/** Hard ceiling on pre-selections for a pack. See `preselectionCapMultiplier`. */
export function preselectionCap(pack: Pack): number {
  const spec = PACK_SPECS[pack];
  return Math.floor(spec.places * spec.preselectionCapMultiplier);
}

/**
 * The VIP sponsoring contribution, disclosed in the pack description but
 * arranged directly by the administration after a dossier is validated. The
 * site never charges it and has no payment path for it — deliberately, per
 * the client decision. Kept here only so the copy can't drift from the number.
 */
export const VIP_SPONSORING_USD = 7000;

/** Délégué compensation: 200 USD/month over October–December. */
export const DELEGUE_STIPEND = {
  monthlyUsd: 200,
  months: 3,
  get totalUsd() {
    return this.monthlyUsd * this.months;
  },
} as const;

// ---------------------------------------------------------------------------
// Derived totals
// ---------------------------------------------------------------------------
// Public headline figures. Derived rather than written down so the marketing
// copy can never contradict the pack table.

const packsOfKind = (kind: PackSpec["kind"]) =>
  PACKS.filter((p) => PACK_SPECS[p].kind === kind);

const sumPlaces = (packs: readonly Pack[]) =>
  packs.reduce((total, p) => total + PACK_SPECS[p].places, 0);

/** Seats that actually travel to California (excludes delegates). 200. */
export const TOTAL_PARTICIPANT_PLACES = sumPlaces([
  ...packsOfKind("scholarship"),
  ...packsOfKind("self_funded"),
]);

/** Funded seats — Lauréat + Boursier. 75. */
export const TOTAL_SCHOLARSHIPS = sumPlaces(packsOfKind("scholarship"));

/** Paid delegate positions. 60. */
export const TOTAL_DELEGATE_PLACES = sumPlaces(packsOfKind("role"));

export const TOTAL_COUNTRIES = COUNTRIES.length;

/** Duration of the immersion in California. */
export const PROGRAMME_DAYS = 6;

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * 18 for every pack without exception, including Délégué — the spec's "17 à
 * 65" was overridden by the client. This keeps minors out of the Phase-2
 * document upload entirely, which is a legal simplification as much as a
 * code one.
 */
export const MIN_AGE = 18;
export const DELEGUE_MAX_AGE = 65;

export const CASIER_JUDICIAIRE_OPTIONS = ["non", "oui"] as const;
export type CasierJudiciaire = (typeof CASIER_JUDICIAIRE_OPTIONS)[number];

/** Phase-1 self-declared US visa refusal history. */
export const VISA_HISTORIQUE_OPTIONS = [
  "aucun_jamais",
  "aucun_obtenu",
  "refus_1_3",
  "refus_4_plus",
] as const;
export type VisaHistorique = (typeof VISA_HISTORIQUE_OPTIONS)[number];

/** How the candidate heard about the programme. */
export const SOURCE_OPTIONS = [
  "delegue",
  "connaissance",
  "reseaux_sociaux",
  "autre",
] as const;
export type Source = (typeof SOURCE_OPTIONS)[number];

/** Hard cap on the Phase-1 motivation field. */
export const MOTIVATION_MAX_WORDS = 150;

// ---------------------------------------------------------------------------
// Candidature lifecycle
// ---------------------------------------------------------------------------

/**
 * The full funnel, in order. Phase 1 assigns one of the first four; the rest
 * are reached in Phase 2 (W4–W6).
 */
export const CANDIDATURE_STATUSES = [
  /** Submitted, evaluation not yet run. Transient — auto-pre-selection runs
   *  synchronously on submit, so a row should never rest here for long. */
  "en_attente",
  /** Cleared the four mechanical gates. Code generated, awaiting send. */
  "preselectionne",
  /** Failed a mechanical gate. No fee was ever charged. */
  "non_eligible",
  /** Eligible, but the pack had already reached its pre-selection cap.
   *  Explicitly NOT a rejection — carried to the next edition. */
  "complet",
  /** Access code emailed. */
  "code_envoye",
  /** Code redeemed, Phase-2 forms in progress. */
  "phase2_en_cours",
  /** Verification fee settled. */
  "phase2_paye",
  /** Third-party checks running. */
  "verification",
  /** Dossier validated — invitation and embassy letters issued. */
  "valide",
  /** Rejected after verification (fraud, or not selected in a competitive pack). */
  "rejete",
  /** 14-day code validity elapsed without Phase 2 being completed. */
  "expire",
] as const;
export type CandidatureStatus = (typeof CANDIDATURE_STATUSES)[number];

/**
 * Why a Phase-1 candidature did not reach pre-selection. Stored alongside the
 * status so the admin can see the reason without re-deriving it, and so the
 * rejection page can be specific rather than generic.
 */
export const INELIGIBILITY_REASONS = [
  "age",
  "casier_judiciaire",
  "visa_refusals",
  "pack_full",
] as const;
export type IneligibilityReason = (typeof INELIGIBILITY_REASONS)[number];

// ---------------------------------------------------------------------------
// Phase 2 — option sets (§14)
// ---------------------------------------------------------------------------

export const PROFESSION_OPTIONS = [
  "dirigeant_3ans",
  "salarie_cdi",
  "cadre",
  "independant",
  "cdd",
  "etudiant_ecole_fonction_publique",
  "sans_emploi",
  "etudiant_fin_cycle_sans_contrat",
] as const;
export type Profession = (typeof PROFESSION_OPTIONS)[number];

/** Phase-2 refusal count. Note the different granularity to Phase 1's
 *  banded answer — the two are cross-checked, see lib/phase2/risk-score. */
export const REFUS_USA_COUNT_OPTIONS = ["aucun", "1", "2", "3"] as const;
export type RefusUsaCount = (typeof REFUS_USA_COUNT_OPTIONS)[number];

export const ATTACHES_FAMILIALES_OPTIONS = [
  "conjoint_enfants",
  "famille_proche",
  "non",
] as const;
export type AttachesFamiliales =
  (typeof ATTACHES_FAMILIALES_OPTIONS)[number];

export const ACTIVITE_PAYS_OPTIONS = [
  "entreprise_declaree",
  "biens_immobiliers",
  "emploi_cdi",
  "non",
] as const;
export type ActivitePays = (typeof ACTIVITE_PAYS_OPTIONS)[number];

export const VOYAGES_OPTIONS = [
  "europe",
  "amerique_nord",
  "asie_moyen_orient",
  "jamais",
] as const;
export type Voyages = (typeof VOYAGES_OPTIONS)[number];

export const PATRIMOINE_OPTIONS = [
  "proprietaire",
  "locataire_revenus_stables",
  "heberge",
  "aucun_actif",
] as const;
export type Patrimoine = (typeof PATRIMOINE_OPTIONS)[number];

export const FAMILLE_USA_OPTIONS = ["aucune", "eloignee", "immediate"] as const;
export type FamilleUsa = (typeof FAMILLE_USA_OPTIONS)[number];

export const DOCUMENT_KINDS = [
  "id_recto",
  "id_verso",
  "selfie_liveness",
  "casier_judiciaire",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const CONSENT_KINDS = [
  "verification_tiers",
  "certification_honneur",
  "conditions_generales",
  "fraude_signalement",
  "traitement_donnees",
] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** Criminal record extracts must be recent (§14 Étape 3). */
export const CASIER_MAX_AGE_MONTHS = 3;

// ---------------------------------------------------------------------------
// Access codes (Phase 2 gate)
// ---------------------------------------------------------------------------

export const ACCESS_CODE = {
  /** Rendered as SVAP-XXXX-XXXX. */
  prefix: "SVAP",
  groups: 2,
  groupLength: 4,
  /** Expires this many days after issue if Phase 2 isn't completed. */
  validityDays: 14,
  /** Delay between Phase-1 submission and the code email. */
  sendDelayHours: 72,
} as const;
