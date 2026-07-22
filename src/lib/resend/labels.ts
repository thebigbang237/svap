// Display labels for form field values, duplicated here (rather than sourced
// from messages/*.json) because these templates render server-side via
// Resend, outside the next-intl client context. Keep in sync by hand with
// messages/fr.json and messages/en.json under candidature.options.*.
import type { Locale } from "./types";

export const PAYS_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    civ: "Côte d'Ivoire",
    sen: "Sénégal",
    cod: "Congo (RDC)",
    nga: "Nigéria",
    ken: "Kenya",
    other_west: "Autre Afrique de l'Ouest",
    other_east: "Autre Afrique de l'Est",
    other_central: "Autre Afrique Centrale",
    other: "Autre",
  },
  en: {
    civ: "Côte d'Ivoire",
    sen: "Senegal",
    cod: "Congo (DRC)",
    nga: "Nigeria",
    ken: "Kenya",
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
