// Stable value slugs for candidature form selects. Display labels live in
// messages/*.json under candidature.options.* — keep these two in sync.

export const PAYS_OPTIONS = [
  "civ",
  "sen",
  "cod",
  "nga",
  "ken",
  "other_west",
  "other_east",
  "other_central",
  "other",
] as const;

export const SECTEUR_OPTIONS = [
  "tech_fintech",
  "agriculture",
  "energy_infrastructure",
  "finance_investment",
  "public_administration",
  "education",
  "health",
] as const;

// Must match the svap.candidatures "pack" check constraint exactly.
export const PACK_OPTIONS = [
  "laureat",
  "boursier",
  "invite",
  "ambassadeur",
  "delegue",
] as const;

export const VISA_HISTORIQUE_OPTIONS = [
  "valid",
  "expired_lt5",
  "expired_gt5",
  "never",
  "denied",
] as const;
