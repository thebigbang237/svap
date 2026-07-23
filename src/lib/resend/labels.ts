// Display labels for form field values, duplicated here (rather than sourced
// from messages/*.json) because these templates render server-side via
// Resend, outside the next-intl client context. Keep in sync by hand with
// messages/fr.json and messages/en.json under candidature.options.*.
import type { Locale } from "./types";

export const PAYS_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    nga: "Nigéria",
    ken: "Kenya",
    zaf: "Afrique du Sud",
    sen: "Sénégal",
    civ: "Côte d'Ivoire",
    mar: "Maroc",
    gha: "Ghana",
    egy: "Égypte",
    rwa: "Rwanda",
    eth: "Éthiopie",
    cod: "Congo (RDC)",
    other_west: "Autre Afrique de l'Ouest",
    other_east: "Autre Afrique de l'Est",
    other_central: "Autre Afrique Centrale",
    other: "Autre",
  },
  en: {
    nga: "Nigeria",
    ken: "Kenya",
    zaf: "South Africa",
    sen: "Senegal",
    civ: "Côte d'Ivoire",
    mar: "Morocco",
    gha: "Ghana",
    egy: "Egypt",
    rwa: "Rwanda",
    eth: "Ethiopia",
    cod: "Congo (DRC)",
    other_west: "Other West Africa",
    other_east: "Other East Africa",
    other_central: "Other Central Africa",
    other: "Other",
  },
};

export const SECTEUR_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    tech_fintech: "Tech & Fintech",
    agriculture: "Agriculture / Agrotech",
    energy_infrastructure: "Énergie & Infrastructures",
    finance_investment: "Finance & Investissement",
    public_administration: "Administration Publique",
    education: "Éducation",
    health: "Santé",
  },
  en: {
    tech_fintech: "Tech & Fintech",
    agriculture: "Agriculture / Agrotech",
    energy_infrastructure: "Energy & Infrastructure",
    finance_investment: "Finance & Investment",
    public_administration: "Public Administration",
    education: "Education",
    health: "Healthcare",
  },
};

export const PACK_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    laureat: "Lauréat",
    boursier: "Boursier",
    invite: "Invité",
    ambassadeur: "Ambassadeur",
    delegue: "Délégué",
  },
  en: {
    laureat: "Fellow",
    boursier: "Scholar",
    invite: "Guest",
    ambassadeur: "Ambassador",
    delegue: "Delegate",
  },
};

export const VISA_HISTORIQUE_LABELS: Record<Locale, Record<string, string>> =
  {
    fr: {
      valid: "Oui, visa en cours de validité",
      expired_lt5: "Oui, expiré il y a moins de 5 ans",
      expired_gt5: "Oui, expiré il y a plus de 5 ans",
      never: "Non, jamais",
      denied: "Refus précédent",
    },
    en: {
      valid: "Yes, currently valid visa",
      expired_lt5: "Yes, expired less than 5 years ago",
      expired_gt5: "Yes, expired more than 5 years ago",
      never: "No, never",
      denied: "Previously denied",
    },
  };
