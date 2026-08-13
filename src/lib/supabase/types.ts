// Row shapes for the svap schema tables, hand-written to match
// supabase/migrations/*.sql (no generated Database type exists yet in this
// project).
//
// The enum-ish columns are typed as plain `string` rather than as the unions
// from lib/constants/program: several CHECK constraints were added NOT VALID,
// so rows predating the Édition 2026 model can legitimately hold values
// outside the current sets. Claiming otherwise would be lying to the type
// system — use the tolerant lookups in lib/resend/labels to render them.

import type { CandidatureStatus } from "@/lib/constants/program";
import type { Locale } from "@/i18n/routing";

export type { CandidatureStatus };

export type PaymentStatus = "non_requis" | "en_attente" | "paye" | "echoue";

export interface CandidatureRow {
  id: string;
  created_at: string;
  updated_at: string;

  // Identity & contact
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  age: number | null;

  // Profile
  pays: string;
  ville: string | null;
  secteur: string;
  pack: string;

  // Declarations
  casier_judiciaire: string;
  visa_historique: string | null;
  marie: boolean | null;
  enfants: boolean | null;

  // Attribution
  source: string | null;
  delegue_nom: string | null;

  // Motivation
  motivation: string;
  lien_pays: string | null;

  // Consents
  consent_exactitude: boolean;
  consent_communications: boolean;

  // Lifecycle
  locale: Locale;
  status: CandidatureStatus;
  /** Why automatic pre-selection did not advance this dossier. */
  preselection_reason: string | null;
  preselection_at: string | null;

  // Review
  notes_admin: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;

  // Payment (Phase 2)
  payment_status: PaymentStatus | null;
  payment_amount: number | null;
  payment_reference: string | null;
}

export interface AdminProfileRow {
  id: string;
  full_name: string | null;
  role: "super_admin" | "reviewer";
  created_at: string;
}
