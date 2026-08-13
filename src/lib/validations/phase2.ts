import { z } from "zod";
import {
  PROFESSION_OPTIONS,
  REFUS_USA_COUNT_OPTIONS,
  ATTACHES_FAMILIALES_OPTIONS,
  ACTIVITE_PAYS_OPTIONS,
  VOYAGES_OPTIONS,
  PATRIMOINE_OPTIONS,
  FAMILLE_USA_OPTIONS,
  MIN_AGE,
  CASIER_MAX_AGE_MONTHS,
} from "@/lib/constants/program";

// As in the Phase-1 schema, every message is a next-intl key relative to the
// "phase2" namespace rather than display text.

const requiredText = (max = 200) =>
  z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(max, { error: "validation.tooLong" });

/** `YYYY-MM-DD` from a native date input. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "validation.dateInvalid" });

// ---------------------------------------------------------------------------
// Étape 1 — personal information
// ---------------------------------------------------------------------------

export const personalInfoSchema = z.object({
  // "Tel que sur la pièce d'identité" — this can legitimately differ from the
  // Phase-1 names (married name, transliteration, middle names), which is why
  // it's asked again rather than carried over.
  prenoms: requiredText(120),
  nomFamille: requiredText(120),

  dateNaissance: isoDate.refine(
    (v) => {
      const age =
        (Date.now() - new Date(v).getTime()) / (365.2425 * 86_400_000);
      return age >= MIN_AGE && age < 120;
    },
    { error: "validation.dateNaissanceInvalid" },
  ),
  lieuNaissance: requiredText(160),
  nationalite: requiredText(80),

  // Deliberately permissive: passport formats vary by issuing country and an
  // over-tight pattern would reject valid documents. Length and character
  // class only; the real check is a human comparing this to the scan.
  passeportNumero: z
    .string()
    .trim()
    .min(5, { error: "validation.passeportInvalid" })
    .max(20, { error: "validation.passeportInvalid" })
    .regex(/^[A-Za-z0-9]+$/, { error: "validation.passeportInvalid" }),

  passeportExpiration: isoDate.refine(
    (v) => new Date(v).getTime() > Date.now(),
    { error: "validation.passeportExpired" },
  ),

  telephone: z.string().trim().regex(/^[0-9+\s().-]{6,20}$/, {
    error: "validation.phone",
  }),
  adresse: requiredText(400),

  profession: z.enum(PROFESSION_OPTIONS, { error: "validation.required" }),
  employeur: requiredText(160),

  contactUrgenceNom: requiredText(120),
  contactUrgenceLien: requiredText(80),
  contactUrgenceTelephone: z.string().trim().regex(/^[0-9+\s().-]{6,20}$/, {
    error: "validation.phone",
  }),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

// ---------------------------------------------------------------------------
// Étape 2 — risk assessment
// ---------------------------------------------------------------------------

export const riskAssessmentSchema = z.object({
  refusEntreePaysEtranger: z.boolean({ error: "validation.required" }),
  depassementVisa: z.boolean({ error: "validation.required" }),
  refusUsaCount: z.enum(REFUS_USA_COUNT_OPTIONS, {
    error: "validation.required",
  }),
  attachesFamiliales: z.enum(ATTACHES_FAMILIALES_OPTIONS, {
    error: "validation.required",
  }),
  activitePays: z.enum(ACTIVITE_PAYS_OPTIONS, { error: "validation.required" }),
  voyagesHorsAfrique: z.enum(VOYAGES_OPTIONS, { error: "validation.required" }),
  patrimoine: z.enum(PATRIMOINE_OPTIONS, { error: "validation.required" }),
  familleUsa: z.enum(FAMILLE_USA_OPTIONS, { error: "validation.required" }),

  // Free text, and the two most decision-relevant answers in the dossier — a
  // floor is set so "oui" doesn't pass as an answer to "what guarantees your
  // return".
  engagementsRetour: z
    .string()
    .trim()
    .min(80, { error: "validation.tooShort" })
    .max(4000, { error: "validation.tooLong" }),
  motivationRetour: z
    .string()
    .trim()
    .min(80, { error: "validation.tooShort" })
    .max(4000, { error: "validation.tooLong" }),

  certificationHonneur: z.literal(true, {
    error: "validation.consentRequired",
  }),
});

export type RiskAssessmentInput = z.infer<typeof riskAssessmentSchema>;

// ---------------------------------------------------------------------------
// Étape 4 — criminal record extract metadata
// ---------------------------------------------------------------------------

export const casierMetadataSchema = z.object({
  casierDate: isoDate.refine(
    (v) => {
      const issued = new Date(v).getTime();
      const now = Date.now();
      const monthsOld = (now - issued) / (30.44 * 86_400_000);
      // §14 requires an extract "moins de trois mois". A future date is
      // rejected too — that's a typo or a forgery, and either way the
      // document can't be verified as issued.
      return issued <= now && monthsOld <= CASIER_MAX_AGE_MONTHS;
    },
    { error: "validation.casierTooOld" },
  ),
  casierNumero: requiredText(80),
  casierLieu: requiredText(160),
  casierStructure: requiredText(200),
});

export type CasierMetadataInput = z.infer<typeof casierMetadataSchema>;

// ---------------------------------------------------------------------------
// Étape 5 — consents
// ---------------------------------------------------------------------------

/**
 * All five are `literal(true)`: each is a distinct permission the programme
 * relies on, and §14 marks every one as obligatoire. A plain boolean would
 * happily accept `false` and record a consent that was never given.
 */
export const consentsSchema = z.object({
  verificationTiers: z.literal(true, { error: "validation.consentRequired" }),
  certificationHonneur: z.literal(true, { error: "validation.consentRequired" }),
  conditionsGenerales: z.literal(true, { error: "validation.consentRequired" }),
  fraudeSignalement: z.literal(true, { error: "validation.consentRequired" }),
  traitementDonnees: z.literal(true, { error: "validation.consentRequired" }),
});

export type ConsentsInput = z.infer<typeof consentsSchema>;
