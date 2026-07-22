export type Locale = "fr" | "en";

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
