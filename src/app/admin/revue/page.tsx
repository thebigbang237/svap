import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { packLabel, paysLabel } from "@/lib/resend/labels";
import {
  RISK_BAND_CLASSES,
  RISK_BAND_LABELS_FR,
  label,
} from "@/lib/constants/admin-labels";
import type { CandidatureRow } from "@/lib/supabase/types";

/**
 * Review queue — dossiers whose verification is complete and awaiting a
 * human decision.
 *
 * Ordered by risk score descending, not by date. The whole point of scoring
 * is that a reviewer's attention is the scarce resource: the dossiers that
 * need judgement should be at the top, and the clean ones can be worked
 * through quickly underneath. Dossiers with a Phase-1 contradiction are
 * marked regardless of where their score put them.
 */

interface QueueRow {
  candidature_id: string;
  score: number | null;
  score_breakdown: { band?: string } | null;
  consistency_flags: string[];
  submitted_at: string;
}

export default async function ReviewQueuePage() {
  const supabase = createAdminClient();

  const { data: assessments } = await supabase
    .from("risk_assessments")
    .select("candidature_id, score, score_breakdown, consistency_flags, submitted_at")
    .order("score", { ascending: false, nullsFirst: false })
    .limit(200)
    .returns<QueueRow[]>();

  const rows = assessments ?? [];

  // Second query rather than a join: PostgREST embedding across schemas is
  // fiddly here, and 200 ids is a single cheap `in` lookup.
  const { data: candidatures } = await supabase
    .from("candidatures")
    .select("id, prenom, nom, email, pays, pack, status")
    .in(
      "id",
      rows.map((r) => r.candidature_id),
    )
    .returns<
      Pick<
        CandidatureRow,
        "id" | "prenom" | "nom" | "email" | "pays" | "pack" | "status"
      >[]
    >();

  const byId = new Map((candidatures ?? []).map((c) => [c.id, c]));

  // Only dossiers actually awaiting a decision. Someone still mid-Phase-2, or
  // already decided, is not review work.
  const queue = rows
    .map((r) => ({ ...r, candidature: byId.get(r.candidature_id) }))
    .filter((r) => r.candidature && ["verification"].includes(r.candidature.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-blue-dark">
          File de revue
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Dossiers vérifiés en attente de décision, classés par score de risque
          décroissant. {queue.length} dossier{queue.length > 1 ? "s" : ""}.
        </p>
      </div>

      <div className="overflow-x-auto border border-ink-dim/20 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-dim/20 bg-sky-mid text-xs font-semibold uppercase tracking-wide text-ink-mid">
            <tr>
              <th className="px-4 py-3">Candidat</th>
              <th className="px-4 py-3">Pack</th>
              <th className="px-4 py-3">Pays</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Signaux</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr
                key={row.candidature_id}
                className="border-b border-ink-dim/10 last:border-0 hover:bg-sky/40"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/candidatures/${row.candidature_id}`}
                    className="font-medium text-blue hover:underline"
                  >
                    {row.candidature!.prenom} {row.candidature!.nom}
                  </Link>
                  <p className="text-xs text-ink-dim">{row.candidature!.email}</p>
                </td>
                <td className="px-4 py-3">
                  {packLabel("fr", row.candidature!.pack)}
                </td>
                <td className="px-4 py-3">
                  {paysLabel("fr", row.candidature!.pays)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      RISK_BAND_CLASSES[row.score_breakdown?.band ?? ""] ??
                      "bg-sky-mid text-ink-mid"
                    }`}
                  >
                    {row.score ?? "—"} ·{" "}
                    {label(
                      RISK_BAND_LABELS_FR,
                      row.score_breakdown?.band ?? null,
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.consistency_flags.length > 0 ? (
                    <span className="text-xs font-semibold text-terracotta">
                      {row.consistency_flags.length} incohérence
                      {row.consistency_flags.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-dim">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.candidature!.status} />
                </td>
              </tr>
            ))}

            {queue.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-dim">
                  Aucun dossier en attente de revue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
