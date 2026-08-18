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
  /**
   * Seats this edition — a **ceiling on admissions, not on applications**.
   *
   * Client decision (2026-08-17): candidatures are never turned away because a
   * pack is "full". Everyone who meets the mechanical criteria is pre-selected
   * and may complete Phase 2; the number below is applied at the end, when the
   * verified dossiers are ranked and the seats are awarded. There is therefore
   * deliberately no pre-selection cap anywhere in this file.
   */
  places: number;
  /**
   * Phase-2 verification fee in USD. Phase 1 is free for every pack — that is
   * the programme's stated founding principle, so there is deliberately no
   * "application fee" field here to accidentally render.
   *
   * Non-refundable. It pays for work performed (identity checks, criminal
   * record, risk assessment, administrative processing), so it is consumed
   * whether or not the dossier ends up holding a seat. What the programme
   * commits to instead is `visaRefusalPrimeUsd` below.
   */
  verificationFeeUsd: number;
  /**
   * Prime paid if the US visa is refused *after* the dossier passed
   * verification, subject to documentary proof of the consular refusal and an
   * internal audit. `null` = this pack carries no prime.
   *
   * Business Visitor is null by client confirmation (2026-08-17), not by
   * omission: the three packs with a prime are Lauréat, Boursier and VIP
   * Visitor.
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
   * `automatic`   — verification passes ⇒ seat, up to `places`.
   * `competitive` — a human reviews the dossier against the three critères de
   *                 sélection (motivation, impact du voyage, retour au pays)
   *                 and awards the limited seats.
   *
   * Either way `places` is the ceiling, applied at award time.
   */
  decision: "automatic" | "competitive";
}

export const PACK_SPECS: Record<Pack, PackSpec> = {
  laureat: {
    places: 12,
    verificationFeeUsd: 20,
    visaRefusalPrimeUsd: 1000,
    kind: "scholarship",
    decision: "competitive",
  },
  boursier: {
    places: 63,
    verificationFeeUsd: 30,
    visaRefusalPrimeUsd: 500,
    kind: "scholarship",
    decision: "competitive",
  },
  delegue: {
    places: 60,
    verificationFeeUsd: 30,
    visaRefusalPrimeUsd: null,
    kind: "role",
    // Modelled as competitive pending client confirmation — see
    // docs/flow-edition-2026.md §7 "Still open".
    decision: "competitive",
  },
  business_visitor: {
    places: 104,
    verificationFeeUsd: 330,
    visaRefusalPrimeUsd: null,
    kind: "self_funded",
    decision: "automatic",
  },
  vip_visitor: {
    places: 21,
    verificationFeeUsd: 330,
    visaRefusalPrimeUsd: 4500,
    kind: "self_funded",
    decision: "automatic",
  },
};

/**
 * Packs carrying a visa-refusal prime, in display order. Used by the copy and
 * the legal pages so the list can never drift from PACK_SPECS.
 */
export const PACKS_WITH_PRIME = PACKS.filter(
  (p) => PACK_SPECS[p].visaRefusalPrimeUsd !== null,
);

/**
 * Days from receipt of the consular refusal document to payment of the prime.
 * A public commitment (§9), which is why svap.visa_refusal_claims stores a
 * `due_at` derived from it rather than leaving it to someone's memory.
 */
export const PRIME_PAYOUT_DAYS = 60;

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
// Calendar
// ---------------------------------------------------------------------------
/**
 * The two dates the whole funnel is paced by (client, 2026-08-17):
 * applications close 18 January, the immersion runs 18–23 March.
 *
 * ⚠️ THE YEAR WAS NOT STATED and is inferred as 2027. It cannot be 2026: both
 * dates are already past, and the delegates recruited for this edition serve
 * October–December 2026 — which only makes sense if the event follows them.
 * Confirm with the client; if it is wrong, this constant is the only edit.
 *
 * Stored as UTC instants rather than plain dates because a countdown has to
 * subtract them from `Date.now()`. The deadline is the END of 18 January, so a
 * candidate applying that evening is inside it. The six participating markets
 * span UTC+0 to UTC+3, so UTC midnight closes applications between 00:00 and
 * 03:00 local — deliberately generous rather than cutting anyone off early.
 */
export const APPLICATION_DEADLINE = new Date("2027-01-18T23:59:59Z");
export const EVENT_START = new Date("2027-03-18T00:00:00Z");
export const EVENT_END = new Date("2027-03-23T23:59:59Z");

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
  /**
   * Eligible, but not carried forward because the pack was full.
   *
   * No longer produced automatically: pre-selection caps were removed on
   * 2026-08-17 (see `PackSpec.places`). Retained because rows written before
   * that change still hold it, and because an administrator may still close a
   * pack by hand once its seats are awarded.
   */
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
  /** Legacy — see the `complet` status. Kept for rows written before the caps
   *  were removed, and for a manual close. Never produced by Phase 1 now. */
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

/** Identity pieces every candidate uploads, whatever their pack (Étape 4). */
export const IDENTITY_DOCUMENT_KINDS = [
  "id_recto",
  "id_verso",
  "selfie_liveness",
  "casier_judiciaire",
] as const;

/**
 * Pack-specific pieces collected at Étape 5 — see PACK_FINANCIAL_REQUIREMENTS.
 * Same table, same private bucket and same upload route as the identity
 * pieces: the sensitivity tier and the retention rule are identical, and a
 * second storage path would be a second thing to secure.
 */
export const FINANCIAL_DOCUMENT_KINDS = [
  "attestation_bancaire",
  "releve_bancaire",
  "origine_fonds",
  "assurance_voyage",
  "preuve_billet",
  "resume_projet",
  "preuves_avancement",
] as const;
export type FinancialDocumentKind = (typeof FINANCIAL_DOCUMENT_KINDS)[number];

export const DOCUMENT_KINDS = [
  ...IDENTITY_DOCUMENT_KINDS,
  ...FINANCIAL_DOCUMENT_KINDS,
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// ---------------------------------------------------------------------------
// Phase 2 — financial capacity (Étape 5)
// ---------------------------------------------------------------------------
/**
 * The client's "Cadre de vérification financière" (2026-08-17), encoded.
 *
 * The point of this step is narrow and must stay narrow in the copy as well as
 * in the code: it *confirms the candidate can fund their own trip*. The
 * programme never receives, holds or manages these amounts — the candidate
 * books and pays their own flight, hotel and transport directly. The only
 * money that reaches the programme is the verification fee and, for VIP, the
 * sponsoring contribution arranged offline after validation.
 */

/** Round-trip flight, as budgeted by the framework. */
export const FLIGHT_ESTIMATE = { fcfa: 3_000_000, usd: 4940 } as const;

/** Hotel + local transport + meals, per day on site. */
export const ON_SITE_DAILY_USD = 1500;

/** 1 500 $ × 6 jours = 9 000 $. */
export const ON_SITE_TOTAL_USD = ON_SITE_DAILY_USD * PROGRAMME_DAYS;

/** Minimum financial surface a Boursier must evidence. */
export const BOURSIER_SURFACE_USD = 5000;

/** A line of the "montant total à justifier" table. Labels live in i18n. */
export interface FinancialLine {
  key: "sponsoring" | "billet" | "sejour";
  usd: number;
}

export interface PackFinancialRequirement {
  /** Minimum balance to attest, when the pack states one rather than a total. */
  surfaceUsd: number | null;
  /** Breakdown of the total to evidence. Empty when only a surface applies. */
  lines: readonly FinancialLine[];
  /** Sum of `lines`, or null when the pack has no total to justify. */
  totalUsd: number | null;
  /** Which pieces this pack must upload, and whether each is mandatory. */
  documents: readonly { kind: FinancialDocumentKind; required: boolean }[];
  /** Issuing bank of the attestation ("banque de premier ordre"). */
  requiresBankName: boolean;
  /** Written declaration of where the funds come from. */
  requiresFundsOrigin: boolean;
}

const sum = (lines: readonly FinancialLine[]) =>
  lines.reduce((total, line) => total + line.usd, 0);

const VISITOR_LINES: readonly FinancialLine[] = [
  { key: "billet", usd: FLIGHT_ESTIMATE.usd },
  { key: "sejour", usd: ON_SITE_TOTAL_USD },
];

const VIP_LINES: readonly FinancialLine[] = [
  { key: "sponsoring", usd: VIP_SPONSORING_USD },
  ...VISITOR_LINES,
];

const VISITOR_DOCUMENTS = [
  { kind: "attestation_bancaire", required: true },
  { kind: "origine_fonds", required: true },
  { kind: "releve_bancaire", required: true },
  { kind: "assurance_voyage", required: true },
] as const;

/**
 * `null` = nothing extra is asked of this pack at Étape 5, and the step is
 * skipped entirely (Délégué: a three-month role at home, not a trip).
 */
export const PACK_FINANCIAL_REQUIREMENTS: Record<
  Pack,
  PackFinancialRequirement | null
> = {
  // Fully funded and selected on the project alone — so the "financial"
  // dossier here is in fact the project dossier.
  laureat: {
    surfaceUsd: null,
    lines: [],
    totalUsd: null,
    documents: [
      { kind: "resume_projet", required: true },
      { kind: "preuves_avancement", required: false },
    ],
    requiresBankName: false,
    requiresFundsOrigin: false,
  },
  // Social-purpose track: the check is on the credibility of the project and a
  // minimum financial surface, not on the candidate's wealth.
  boursier: {
    surfaceUsd: BOURSIER_SURFACE_USD,
    lines: [],
    totalUsd: null,
    documents: [
      { kind: "attestation_bancaire", required: true },
      { kind: "preuve_billet", required: true },
      { kind: "assurance_voyage", required: true },
      { kind: "resume_projet", required: true },
    ],
    requiresBankName: true,
    requiresFundsOrigin: false,
  },
  delegue: null,
  business_visitor: {
    surfaceUsd: null,
    lines: VISITOR_LINES,
    totalUsd: sum(VISITOR_LINES),
    documents: VISITOR_DOCUMENTS,
    requiresBankName: true,
    requiresFundsOrigin: true,
  },
  // Same pieces as Business Visitor, on a larger total: the 7 000 $ sponsoring
  // sits on top of a trip the candidate still funds themselves.
  vip_visitor: {
    surfaceUsd: null,
    lines: VIP_LINES,
    totalUsd: sum(VIP_LINES),
    documents: VISITOR_DOCUMENTS,
    requiresBankName: true,
    requiresFundsOrigin: true,
  },
};

export function financialRequirement(
  pack: Pack | string,
): PackFinancialRequirement | null {
  return PACK_FINANCIAL_REQUIREMENTS[pack as Pack] ?? null;
}

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
  /**
   * How long a pre-selected dossier may sit un-emailed before the cron
   * retries it.
   *
   * NOT a deliberate waiting period. Codes are issued and emailed
   * synchronously inside the Phase-1 submission, so a pre-selected candidate
   * has theirs within seconds. This window only exists to catch the case
   * where that send failed — a Resend outage, a transient network error —
   * leaving a dossier stuck at `preselectionne`.
   *
   * (The original specification described a fixed 72-hour delay. It was
   * dropped: it added three days of friction to a funnel whose whole
   * advantage is that Phase 1 is free and instant, with nothing gained.)
   */
  retryAfterMinutes: 30,
} as const;
