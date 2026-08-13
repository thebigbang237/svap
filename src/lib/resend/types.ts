// Sourced from the routing config so a new locale can never be added to the
// site without the email layer knowing about it.
import type { Locale } from "@/i18n/routing";

export type { Locale };

export interface CandidatureData {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  pays: string;
  secteur: string;
  pack: string;
  visaHistorique?: string;
  casierJudiciaire: string;
  motivation: string;
}

/** What the API route has on hand right after inserting a candidature. */
export interface CandidatureEmailData extends CandidatureData {
  locale: Locale;
}

export type CandidatureStatus =
  | "preselection"
  | "accepte"
  | "refuse"
  | "liste_attente";
