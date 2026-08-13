import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { CandidatureReviewForm } from "@/components/admin/CandidatureReviewForm";
import { RiskScorePanel } from "@/components/admin/RiskScorePanel";
import { DocumentViewer } from "@/components/admin/DocumentViewer";
import { PassportReveal } from "@/components/admin/PassportReveal";
import { PaymentsPanel } from "@/components/admin/PaymentsPanel";
import { loadDossier } from "@/lib/admin/dossier";
import {
  CONSENT_KIND_LABELS_FR,
  PROFESSION_LABELS_FR,
  label as pick,
} from "@/lib/constants/admin-labels";
import {
  paysLabel,
  secteurLabel,
  packLabel,
  visaHistoriqueLabel,
} from "@/lib/resend/labels";
import type { CandidatureRow, AdminProfileRow } from "@/lib/supabase/types";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-ink-dim/20 bg-white p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-dim">{label}</dt>
      <dd className="text-end text-ink">{value}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
        {label}
      </p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

export default async function CandidatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  // The proxy already gates /admin/*, but the role decides what this page is
  // allowed to *offer* — revealing a passport number and issuing a refund are
  // super_admin actions, and the buttons shouldn't appear for a reviewer.
  const admin = await requireAdmin();
  const isSuperAdmin = admin?.profile.role === "super_admin";

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("*")
    .eq("id", id)
    .maybeSingle<CandidatureRow>();

  if (!candidature) {
    notFound();
  }

  const dossier = await loadDossier(supabase, candidature.id);

  let reviewerName: string | null = null;
  if (candidature.reviewed_by) {
    const { data: reviewer } = await supabase
      .from("admin_profiles")
      .select("full_name")
      .eq("id", candidature.reviewed_by)
      .maybeSingle<Pick<AdminProfileRow, "full_name">>();
    reviewerName = reviewer?.full_name ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/candidatures"
          className="text-xs font-semibold uppercase tracking-wide text-blue hover:underline"
        >
          ← Retour aux candidatures
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-normal text-blue-dark">
          {candidature.prenom} {candidature.nom}
        </h1>
        <p className="text-sm text-ink-dim">
          Candidature #{candidature.id.slice(0, 8)} · Soumise le{" "}
          {new Date(candidature.created_at).toLocaleString("fr-FR")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Informations personnelles">
            <Field label="Prénom" value={candidature.prenom} />
            <Field label="Nom" value={candidature.nom} />
            <Field label="Email" value={candidature.email} />
            <Field label="Téléphone" value={candidature.telephone} />
            <Field
              label="Pays de résidence"
              value={paysLabel("fr", candidature.pays)}
            />
            <Field
              label="Secteur d'activité"
              value={secteurLabel("fr", candidature.secteur)}
            />
          </Section>

          <Section title="Candidature">
            <Field
              label="Pack souhaité"
              value={packLabel("fr", candidature.pack)}
            />
            <Field
              label="Historique visa USA"
              value={
                candidature.visa_historique
                  ? visaHistoriqueLabel("fr", candidature.visa_historique)
                  : "Non renseigné"
              }
            />
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
                Antécédents judiciaires
              </p>
              <p className="text-sm text-ink">{candidature.casier_judiciaire}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
                Motivation
              </p>
              <p className="whitespace-pre-wrap text-sm text-ink">
                {candidature.motivation}
              </p>
            </div>
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Phase 2 — only rendered once the candidate has reached it   */}
          {/* ---------------------------------------------------------- */}

          {dossier.application && (
            <Section title="Phase 2 — Informations complètes">
              <Field
                label="Prénom(s) (pièce d'identité)"
                value={dossier.application.prenoms}
              />
              <Field
                label="Nom de famille (pièce d'identité)"
                value={dossier.application.nom_famille}
              />
              <Field
                label="Date de naissance"
                value={new Date(
                  dossier.application.date_naissance,
                ).toLocaleDateString("fr-FR")}
              />
              <Field
                label="Lieu de naissance"
                value={dossier.application.lieu_naissance}
              />
              <Field label="Nationalité" value={dossier.application.nationalite} />
              <PassportReveal
                candidatureId={candidature.id}
                suffix={dossier.application.passeport_numero_suffix}
                canReveal={isSuperAdmin}
              />
              <Field
                label="Expiration du passeport"
                value={new Date(
                  dossier.application.passeport_expiration,
                ).toLocaleDateString("fr-FR")}
              />
              <Field
                label="Profession"
                value={pick(
                  PROFESSION_LABELS_FR,
                  dossier.application.profession,
                )}
              />
              <Field label="Employeur" value={dossier.application.employeur} />
              <Field
                label="Contact d'urgence"
                value={`${dossier.application.contact_urgence_nom} (${dossier.application.contact_urgence_lien}) — ${dossier.application.contact_urgence_telephone}`}
              />
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
                  Adresse de résidence
                </p>
                <p className="whitespace-pre-wrap text-sm text-ink">
                  {dossier.application.adresse}
                </p>
              </div>
            </Section>
          )}

          {dossier.risk && <RiskScorePanel risk={dossier.risk} />}

          {dossier.documents.length > 0 && (
            <div className="border border-ink-dim/20 bg-white p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue">
                Pièces justificatives
              </h2>
              <DocumentViewer documents={dossier.documents} />
            </div>
          )}

          {dossier.payments.length > 0 && (
            <div className="border border-ink-dim/20 bg-white p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue">
                Paiements
              </h2>
              <PaymentsPanel
                payments={dossier.payments}
                canRefund={isSuperAdmin}
              />
            </div>
          )}

          {dossier.consents.length > 0 && (
            <div className="border border-ink-dim/20 bg-white p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue">
                Consentements
              </h2>
              <ul className="space-y-2">
                {dossier.consents.map((c) => (
                  <li
                    key={c.kind}
                    className="flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <span className="text-ink">
                      {pick(CONSENT_KIND_LABELS_FR, c.kind)}
                    </span>
                    <span className="text-xs text-ink-dim">
                      {new Date(c.accepted_at).toLocaleString("fr-FR")}
                      {c.ip ? ` · ${c.ip}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidature.reviewed_at && (
            <Section title="Historique de revue">
              <Field label="Revu par" value={reviewerName ?? "—"} />
              <Field
                label="Revu le"
                value={new Date(candidature.reviewed_at).toLocaleString("fr-FR")}
              />
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <CandidatureReviewForm
            candidatureId={candidature.id}
            initialStatus={candidature.status}
            initialNotes={candidature.notes_admin}
          />

          {dossier.accessCode && (
            <div className="border border-ink-dim/20 bg-white p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue">
                Code d&apos;accès
              </h2>
              {/* Metadata only. The code itself is stored hashed and has no
                  plaintext anywhere — §5 requires it never be displayed, and
                  here that's a property of the schema, not a UI choice. */}
              <dl className="space-y-2 text-sm">
                <Meta
                  label="Émis le"
                  value={new Date(
                    dossier.accessCode.issued_at,
                  ).toLocaleString("fr-FR")}
                />
                <Meta
                  label="Expire le"
                  value={new Date(
                    dossier.accessCode.expires_at,
                  ).toLocaleString("fr-FR")}
                />
                <Meta
                  label="Utilisé"
                  value={
                    dossier.accessCode.redeemed_at
                      ? new Date(
                          dossier.accessCode.redeemed_at,
                        ).toLocaleString("fr-FR")
                      : "Pas encore"
                  }
                />
                <Meta
                  label="Renvois"
                  value={String(dossier.accessCode.resend_count)}
                />
              </dl>
              <p className="mt-4 text-xs text-ink-dim">
                Le code est stocké haché et n&apos;est affichable nulle part.
                Un renvoi génère un nouveau code et annule le précédent.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
