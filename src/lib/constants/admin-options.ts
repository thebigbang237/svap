// Admin UI is French-only (internal tool), so unlike
// lib/constants/candidature-options.ts these pair a value with its display
// label directly rather than deferring to messages/*.json.

export const STATUS_OPTIONS = [
  "en_attente",
  "preselection",
  "accepte",
  "refuse",
  "liste_attente",
] as const;

export const STATUS_LABELS_FR: Record<string, string> = {
  en_attente: "En attente",
  preselection: "Présélectionné",
  accepte: "Accepté",
  refuse: "Refusé",
  liste_attente: "Liste d'attente",
};

// Tailwind classes for the StatusBadge component, keyed by status value.
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  en_attente: "bg-sky-mid text-ink-mid",
  preselection: "bg-blue/10 text-blue",
  accepte: "bg-terracotta/10 text-terracotta",
  refuse: "bg-ink-dim/10 text-ink-dim",
  liste_attente: "bg-blue/10 text-blue-dark",
};
