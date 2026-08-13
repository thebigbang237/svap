import { z } from "zod";
import {
  COUNTRIES,
  SECTEURS,
  PACKS,
  VISA_HISTORIQUE_OPTIONS,
  CASIER_JUDICIAIRE_OPTIONS,
  SOURCE_OPTIONS,
  MIN_AGE,
  MOTIVATION_MAX_WORDS,
} from "@/lib/constants/program";

// Every message below is a next-intl translation key relative to the
// "candidature" namespace (i.e. resolved as t("validation.required") by a
// useTranslations("candidature") call) — not display text. The form
// translates it before rendering, and the API route's 400 response returns
// the raw keys for the same reason.

/**
 * Word count for the motivation cap. Splitting on whitespace rather than on
 * spaces so newlines and tabs count as separators, and filtering empties so
 * trailing whitespace doesn't inflate the total.
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const requiredText = (max = 200) =>
  z.string().trim().min(1, { error: "validation.required" }).max(max, {
    error: "validation.tooLong",
  });

export const candidatureSchema = z
  .object({
    // --- Identity & contact -------------------------------------------------
    prenom: requiredText(80),
    nom: requiredText(80),
    email: z
      .string()
      .trim()
      .min(1, { error: "validation.required" })
      .email({ error: "validation.email" }),
    telephone: z.string().trim().regex(/^[0-9+\s().-]{6,20}$/, {
      error: "validation.phone",
    }),

    // --- Profile ------------------------------------------------------------
    // A plain number, not z.coerce: coercion widens the schema's *input* type
    // to unknown, which then no longer matches react-hook-form's value type.
    // The form registers this field with `valueAsNumber`, so the conversion
    // happens at the input and an empty field arrives as NaN — which
    // z.number() rejects as invalid_type, i.e. "validation.required".
    //
    // The lower bound is the eligibility rule itself, so an under-18
    // candidate is stopped at the form rather than reaching pre-selection —
    // the one gate it's fair to surface inline, since it states a fact rather
    // than judging the person.
    age: z
      .number({ error: "validation.required" })
      .int({ error: "validation.ageInvalid" })
      .min(MIN_AGE, { error: "validation.ageMin" })
      .max(120, { error: "validation.ageInvalid" }),
    pays: z.enum(COUNTRIES, { error: "validation.pays" }),
    ville: requiredText(120),
    secteur: z.enum(SECTEURS, { error: "validation.secteur" }),
    pack: z.enum(PACKS, { error: "validation.pack" }),

    // --- Declarations -------------------------------------------------------
    casierJudiciaire: z.enum(CASIER_JUDICIAIRE_OPTIONS, {
      error: "validation.required",
    }),
    visaHistorique: z.enum(VISA_HISTORIQUE_OPTIONS, {
      error: "validation.required",
    }),
    marie: z.boolean({ error: "validation.required" }),
    enfants: z.boolean({ error: "validation.required" }),

    // --- Attribution --------------------------------------------------------
    source: z.enum(SOURCE_OPTIONS, { error: "validation.required" }),
    delegueNom: z.string().trim().max(120).optional(),

    // --- Motivation ---------------------------------------------------------
    motivation: requiredText(4000).refine(
      (v) => countWords(v) <= MOTIVATION_MAX_WORDS,
      { error: "validation.motivationMaxWords" },
    ),
    lienPays: requiredText(2000),

    // --- Consents -----------------------------------------------------------
    // literal(true) rather than boolean: an unchecked box must fail, and
    // "false" is a value a plain boolean would happily accept.
    consentExactitude: z.literal(true, { error: "validation.consentRequired" }),
    consentCommunications: z.literal(true, {
      error: "validation.consentRequired",
    }),
  })
  .refine((data) => data.source !== "delegue" || !!data.delegueNom, {
    error: "validation.required",
    path: ["delegueNom"],
  });

export type CandidatureInput = z.infer<typeof candidatureSchema>;
