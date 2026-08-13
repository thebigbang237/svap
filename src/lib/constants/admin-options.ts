// Admin UI is French-only (internal tool), so unlike lib/constants/program.ts
// these pair a value with its display label directly rather than deferring to
// messages/*.json.

import {
  CANDIDATURE_STATUSES,
  INELIGIBILITY_REASONS,
  type CandidatureStatus,
  type IneligibilityReason,
} from "./program";

export const STATUS_OPTIONS = CANDIDATURE_STATUSES;

export const STATUS_LABELS_FR: Record<CandidatureStatus, string> = {
  en_attente: "En attente",
  preselectionne: "Présélectionné",
  non_eligible: "Non éligible",
  complet: "Pack complet",
  code_envoye: "Code envoyé",
  phase2_en_cours: "Phase 2 en cours",
  phase2_paye: "Phase 2 payée",
  verification: "Vérification",
  valide: "Validé",
  rejete: "Rejeté",
  expire: "Code expiré",
};

export const INELIGIBILITY_REASON_LABELS_FR: Record<
  IneligibilityReason,
  string
> = {
  age: "Âge hors critères",
  casier_judiciaire: "Casier judiciaire déclaré",
  visa_refusals: "4 refus de visa ou plus",
  pack_full: "Quota du pack atteint",
};

/**
 * Tailwind classes for the StatusBadge, keyed by status.
 *
 * Three visual families, so the funnel reads at a glance in a long table:
 * neutral for not-yet-advancing, blue for in-flight, terracotta for the
 * terminal outcomes.
 */
export const STATUS_BADGE_CLASSES: Record<CandidatureStatus, string> = {
  en_attente: "bg-sky-mid text-ink-mid",
  preselectionne: "bg-blue/10 text-blue",
  non_eligible: "bg-ink-dim/10 text-ink-dim",
  complet: "bg-ink-dim/10 text-ink-dim",
  code_envoye: "bg-blue/10 text-blue",
  phase2_en_cours: "bg-blue/10 text-blue-dark",
  phase2_paye: "bg-blue/10 text-blue-dark",
  verification: "bg-blue/10 text-blue-dark",
  valide: "bg-terracotta/10 text-terracotta",
  rejete: "bg-ink-dim/10 text-ink-dim",
  expire: "bg-ink-dim/10 text-ink-dim",
};

export { INELIGIBILITY_REASONS };

/**
 * Tolerant lookups for values read off DB rows. Rows written before the
 * Édition 2026 lifecycle can hold statuses outside the current set, so
 * rendering the raw value beats crashing the admin table.
 */
export function statusLabel(status: string): string {
  return STATUS_LABELS_FR[status as CandidatureStatus] ?? status;
}

export function statusBadgeClasses(status: string): string {
  return (
    STATUS_BADGE_CLASSES[status as CandidatureStatus] ??
    "bg-sky-mid text-ink-mid"
  );
}

export function ineligibilityReasonLabel(reason: string): string {
  return (
    INELIGIBILITY_REASON_LABELS_FR[reason as IneligibilityReason] ?? reason
  );
}
