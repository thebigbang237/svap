import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CandidatureReviewForm } from "@/components/admin/CandidatureReviewForm";
import {
  PAYS_LABELS,
  SECTEUR_LABELS,
  PACK_LABELS,
  VISA_HISTORIQUE_LABELS,
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

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("*")
    .eq("id", id)
    .maybeSingle<CandidatureRow>();

  if (!candidature) {
    notFound();
  }

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
              value={PAYS_LABELS.fr[candidature.pays] ?? candidature.pays}
            />
            <Field
              label="Secteur d'activité"
              value={SECTEUR_LABELS.fr[candidature.secteur] ?? candidature.secteur}
            />
          </Section>

          <Section title="Candidature">
            <Field
              label="Pack souhaité"
              value={PACK_LABELS.fr[candidature.pack] ?? candidature.pack}
            />
            <Field
              label="Historique visa USA"
              value={
                candidature.visa_historique
                  ? (VISA_HISTORIQUE_LABELS.fr[candidature.visa_historique] ??
                    candidature.visa_historique)
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

        <div>
          <CandidatureReviewForm
            candidatureId={candidature.id}
            initialStatus={candidature.status}
            initialNotes={candidature.notes_admin}
          />
        </div>
      </div>
    </div>
  );
}
