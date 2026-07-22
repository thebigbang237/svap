import { z } from "zod";
import {
  PAYS_OPTIONS,
  SECTEUR_OPTIONS,
  PACK_OPTIONS,
  VISA_HISTORIQUE_OPTIONS,
} from "@/lib/constants/candidature-options";

// Every message below is a next-intl translation key relative to the
// "candidature" namespace (i.e. resolved as t("validation.required") by a
// useTranslations("candidature") call) — not display text. The form
// translates it before rendering, and the API route's 400 response returns
// the raw keys for the same reason.
export const candidatureSchema = z.object({
  prenom: z.string().min(1, { error: "validation.required" }),
  nom: z.string().min(1, { error: "validation.required" }),
  email: z
    .string()
    .min(1, { error: "validation.required" })
    .email({ error: "validation.email" }),
  telephone: z
    .string()
    .regex(/^[0-9+\s().-]{6,20}$/, {
      error: "validation.phone",
    }),
  pays: z.enum(PAYS_OPTIONS, { error: "validation.pays" }),
  secteur: z.enum(SECTEUR_OPTIONS, {
    error: "validation.secteur",
  }),
  pack: z.enum(PACK_OPTIONS, { error: "validation.pack" }),
  // The form's <select> converts an empty "" selection to undefined before
  // this ever reaches validation — see setValueAs in CandidatureForm.
  visaHistorique: z
    .enum(VISA_HISTORIQUE_OPTIONS, { error: "validation.invalidOption" })
    .optional(),
  casierJudiciaire: z.string().min(1, { error: "validation.required" }),
  motivation: z.string().min(50, { error: "validation.motivationMin" }),
});

export type CandidatureInput = z.infer<typeof candidatureSchema>;
