// Display labels for form field values, duplicated here (rather than sourced
// from messages/*.json) because these templates render server-side via
// Resend, outside the next-intl client context. Keep in sync by hand with
// messages/{fr,en,ar}.json under candidature.options.*.
//
// The Record<Locale, Record<X, string>> typing is deliberate: adding a locale
// to routing.ts or a value to program.ts turns a missing translation into a
// compile error rather than an `undefined` in someone's confirmation email.
//
// ⚠️  The Arabic strings for pack names are a first pass and are flagged for
// professional review — see docs/plan-edition-2026.md §3. Country and sector
// names are standard vocabulary and safe; the programme's tier names are
// brand terms and need the client's translator to sign off.
import type { Locale } from "@/i18n/routing";
import type {
  Country,
  Pack,
  Secteur,
  VisaHistorique,
} from "@/lib/constants/program";

export const PAYS_LABELS: Record<Locale, Record<Country, string>> = {
  fr: {
    zaf: "Afrique du Sud",
    mar: "Maroc",
    cmr: "Cameroun",
    ken: "Kenya",
    gha: "Ghana",
    egy: "Égypte",
  },
  en: {
    zaf: "South Africa",
    mar: "Morocco",
    cmr: "Cameroon",
    ken: "Kenya",
    gha: "Ghana",
    egy: "Egypt",
  },
  ar: {
    zaf: "جنوب أفريقيا",
    mar: "المغرب",
    cmr: "الكاميرون",
    ken: "كينيا",
    gha: "غانا",
    egy: "مصر",
  },
};

export const SECTEUR_LABELS: Record<Locale, Record<Secteur, string>> = {
  fr: {
    banque_finance: "Banque & Finance",
    tech_digital: "Tech & Digital",
    telecoms: "Télécoms",
    commerce: "Commerce",
    industrie: "Industrie",
    agriculture: "Agriculture",
    energie: "Énergie",
    sante: "Santé",
    immobilier_btp: "Immobilier & BTP",
    conseil: "Conseil",
    administration: "Administration",
    autre: "Autre",
  },
  en: {
    banque_finance: "Banking & Finance",
    tech_digital: "Tech & Digital",
    telecoms: "Telecoms",
    commerce: "Trade & Retail",
    industrie: "Industry",
    agriculture: "Agriculture",
    energie: "Energy",
    sante: "Health",
    immobilier_btp: "Real Estate & Construction",
    conseil: "Consulting",
    administration: "Public Administration",
    autre: "Other",
  },
  ar: {
    banque_finance: "البنوك والتمويل",
    tech_digital: "التقنية والرقمنة",
    telecoms: "الاتصالات",
    commerce: "التجارة",
    industrie: "الصناعة",
    agriculture: "الزراعة",
    energie: "الطاقة",
    sante: "الصحة",
    immobilier_btp: "العقارات والبناء",
    conseil: "الاستشارات",
    administration: "الإدارة العمومية",
    autre: "أخرى",
  },
};

/**
 * "Business Visitor" and "VIP Visitor" stay in English across all three
 * locales: they're already English in the French source document, i.e. brand
 * names rather than descriptions. Lauréat / Boursier / Délégué describe what
 * the holder *is*, so they do get translated.
 */
export const PACK_LABELS: Record<Locale, Record<Pack, string>> = {
  fr: {
    laureat: "Lauréat",
    boursier: "Boursier",
    delegue: "Délégué",
    business_visitor: "Business Visitor",
    vip_visitor: "VIP Visitor",
  },
  en: {
    laureat: "Laureate",
    boursier: "Scholar",
    delegue: "Delegate",
    business_visitor: "Business Visitor",
    vip_visitor: "VIP Visitor",
  },
  ar: {
    laureat: "الفائز",
    boursier: "صاحب المنحة",
    delegue: "المندوب",
    business_visitor: "Business Visitor",
    vip_visitor: "VIP Visitor",
  },
};

/**
 * Tolerant lookups.
 *
 * The records above are exhaustively typed so a missing translation is a
 * compile error. But the values reaching these emails come off DB rows, and
 * the `pays` / `secteur` CHECK constraints were added NOT VALID — legacy rows
 * from before the Édition 2026 model can still hold dropped slugs like `nga`
 * or `tech_fintech`. Rendering the raw slug is the right failure mode there:
 * it's honest, and it beats an `undefined` in someone's confirmation email.
 */
const lookup =
  <T extends string>(table: Record<Locale, Record<T, string>>) =>
  (locale: Locale, value: string): string =>
    table[locale][value as T] ?? value;

export const paysLabel = lookup(PAYS_LABELS);
export const secteurLabel = lookup(SECTEUR_LABELS);
export const packLabel = lookup(PACK_LABELS);

export const VISA_HISTORIQUE_LABELS: Record<
  Locale,
  Record<VisaHistorique, string>
> = {
  fr: {
    aucun_jamais: "Aucun (jamais demandé)",
    aucun_obtenu: "Aucun (visa obtenu)",
    refus_1_3: "1 à 3 refus",
    refus_4_plus: "4 refus ou plus",
  },
  en: {
    aucun_jamais: "None (never applied)",
    aucun_obtenu: "None (visa granted)",
    refus_1_3: "1 to 3 refusals",
    refus_4_plus: "4 or more refusals",
  },
  ar: {
    aucun_jamais: "لا يوجد (لم أتقدّم قط)",
    aucun_obtenu: "لا يوجد (تم الحصول على التأشيرة)",
    refus_1_3: "من 1 إلى 3 حالات رفض",
    refus_4_plus: "4 حالات رفض أو أكثر",
  },
};

export const visaHistoriqueLabel = lookup(VISA_HISTORIQUE_LABELS);
