import "server-only";
import type { AdminClient } from "@/lib/supabase/admin";

/**
 * Loads a candidate's full Phase-2 dossier for review.
 *
 * `passeport_numero_encrypted` is pointedly NOT selected. The sealed value has
 * no business travelling to a page that only needs to show the last two
 * characters — reading the real number is a separate, audited action (see
 * /api/admin/passport/[candidatureId]).
 */

export interface Phase2ApplicationView {
  prenoms: string;
  nom_famille: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  passeport_numero_suffix: string | null;
  passeport_expiration: string;
  telephone: string;
  adresse: string;
  profession: string;
  employeur: string;
  contact_urgence_nom: string;
  contact_urgence_lien: string;
  contact_urgence_telephone: string;
  submitted_at: string;
}

export interface RiskAssessmentView {
  refus_entree_pays_etranger: boolean;
  depassement_visa: boolean;
  refus_usa_count: string;
  attaches_familiales: string;
  activite_pays: string;
  voyages_hors_afrique: string;
  patrimoine: string;
  famille_usa: string;
  engagements_retour: string;
  motivation_retour: string;
  score: number | null;
  score_breakdown: {
    band?: string;
    bandReason?: string;
    factors?: { key: string; points: number; max: number }[];
  } | null;
  consistency_flags: string[];
  submitted_at: string;
}

export interface DocumentView {
  id: string;
  kind: string;
  /** Needed by the dossier export, which reads the file server-side. */
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  sha256: string | null;
  casier_date: string | null;
  casier_numero: string | null;
  casier_lieu: string | null;
  casier_structure: string | null;
}

export interface PaymentView {
  id: string;
  provider: string;
  provider_ref: string;
  method: string;
  amount_usd: number;
  amount_local: number;
  currency: string;
  status: string;
  completed_at: string | null;
  refunded_at: string | null;
  refund_amount_usd: number | null;
}

export interface ConsentView {
  kind: string;
  accepted_at: string;
  ip: string | null;
}

export interface AccessCodeView {
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  resend_count: number;
  last_sent_at: string | null;
}

export interface Dossier {
  application: Phase2ApplicationView | null;
  risk: RiskAssessmentView | null;
  documents: DocumentView[];
  payments: PaymentView[];
  consents: ConsentView[];
  accessCode: AccessCodeView | null;
}

export async function loadDossier(
  supabase: AdminClient,
  candidatureId: string,
): Promise<Dossier> {
  const [application, risk, documents, payments, consents, accessCode] =
    await Promise.all([
      supabase
        .from("phase2_applications")
        .select(
          "prenoms, nom_famille, date_naissance, lieu_naissance, nationalite, passeport_numero_suffix, passeport_expiration, telephone, adresse, profession, employeur, contact_urgence_nom, contact_urgence_lien, contact_urgence_telephone, submitted_at",
        )
        .eq("candidature_id", candidatureId)
        .maybeSingle<Phase2ApplicationView>(),
      supabase
        .from("risk_assessments")
        .select("*")
        .eq("candidature_id", candidatureId)
        .maybeSingle<RiskAssessmentView>(),
      supabase
        .from("phase2_documents")
        .select(
          "id, kind, storage_path, mime_type, size_bytes, uploaded_at, sha256, casier_date, casier_numero, casier_lieu, casier_structure",
        )
        .eq("candidature_id", candidatureId)
        .returns<DocumentView[]>(),
      supabase
        .from("payments")
        .select(
          "id, provider, provider_ref, method, amount_usd, amount_local, currency, status, completed_at, refunded_at, refund_amount_usd",
        )
        .eq("candidature_id", candidatureId)
        .order("created_at", { ascending: false })
        .returns<PaymentView[]>(),
      supabase
        .from("phase2_consents")
        .select("kind, accepted_at, ip")
        .eq("candidature_id", candidatureId)
        .returns<ConsentView[]>(),
      // Metadata only — never the hash, and there is no plaintext to select.
      supabase
        .from("access_codes")
        .select("issued_at, expires_at, redeemed_at, resend_count, last_sent_at")
        .eq("candidature_id", candidatureId)
        .maybeSingle<AccessCodeView>(),
    ]);

  return {
    application: application.data ?? null,
    risk: risk.data ?? null,
    documents: documents.data ?? [],
    payments: payments.data ?? [],
    consents: consents.data ?? [],
    accessCode: accessCode.data ?? null,
  };
}
