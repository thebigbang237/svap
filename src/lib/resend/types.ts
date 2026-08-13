// Sourced from the routing config so a new locale can never be added to the
// site without the email layer knowing about it.
import type { Locale } from "@/i18n/routing";
import type { CandidatureStatus as ProgramCandidatureStatus } from "@/lib/constants/program";

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

/**
 * Statuses that trigger an email to the candidate.
 *
 * Derived from the real lifecycle in constants/program.ts rather than
 * re-declared — the previous hand-written union still used the pre-0006 names
 * (`preselection`, `accepte`, `refuse`), which silently meant no decision
 * email was ever sent: the admin route's membership check never matched.
 */
export type NotifiableStatus = Extract<
  ProgramCandidatureStatus,
  "preselectionne" | "non_eligible" | "complet" | "valide" | "rejete"
>;

export const NOTIFIABLE_STATUSES = [
  "preselectionne",
  "non_eligible",
  "complet",
  "valide",
  "rejete",
] as const satisfies readonly NotifiableStatus[];
