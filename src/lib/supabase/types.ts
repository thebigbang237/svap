// Row shapes for the svap schema tables, hand-written to match
// supabase/migrations/0001_svap_schema.sql (no generated Database type
// exists yet in this project).

export type CandidatureStatus =
  | "en_attente"
  | "preselection"
  | "accepte"
  | "refuse"
  | "liste_attente";

export type PaymentStatus = "non_requis" | "en_attente" | "paye" | "echoue";

export interface CandidatureRow {
  id: string;
  created_at: string;
  updated_at: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  pays: string;
  secteur: string;
  pack: string;
  visa_historique: string | null;
  casier_judiciaire: string;
  motivation: string;
  locale: "fr" | "en";
  status: CandidatureStatus;
  notes_admin: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
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
