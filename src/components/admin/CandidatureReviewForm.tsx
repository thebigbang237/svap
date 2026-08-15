"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_OPTIONS, STATUS_LABELS_FR } from "@/lib/constants/admin-options";

export interface CandidatureReviewFormProps {
  candidatureId: string;
  initialStatus: string;
  initialNotes: string | null;
  /** Decrypting the passport and exporting every document is super_admin-only. */
  canDownload: boolean;
  candidateName: string;
}

/**
 * Decision panel.
 *
 * The two outcomes that matter — validate and reject — are one click each,
 * with a confirmation, because both send an irreversible email to the
 * candidate. The full status dropdown stays underneath for the corrections
 * and edge cases a reviewer occasionally needs, rather than being the primary
 * way to reach a decision.
 */
export function CandidatureReviewForm({
  candidatureId,
  initialStatus,
  initialNotes,
  canDownload,
  candidateName,
}: CandidatureReviewFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const save = async (nextStatus: string, busyKey: string) => {
    setSaving(busyKey);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/candidatures/${candidatureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, notesAdmin: notes }),
      });

      if (!res.ok) throw new Error();

      setStatus(nextStatus);
      setMessage("Enregistré. Le candidat a été notifié par email.");
      setMessageIsError(false);
      router.refresh();
    } catch {
      setMessage("Erreur lors de l'enregistrement. Veuillez réessayer.");
      setMessageIsError(true);
    } finally {
      setSaving(null);
    }
  };

  const decide = (nextStatus: "valide" | "rejete") => {
    const wording =
      nextStatus === "valide"
        ? `Valider le dossier de ${candidateName} ?\n\nUn email de validation lui sera envoyé immédiatement.`
        : `Rejeter le dossier de ${candidateName} ?\n\nUn email de rejet lui sera envoyé immédiatement. S'il s'agit d'un motif administratif ou d'éligibilité, pensez à procéder au remboursement.`;

    // A browser confirm rather than a custom modal: this is the one place in
    // the admin where a mis-click sends an irreversible email to a real
    // person, and the native dialog cannot be dismissed by accident.
    if (window.confirm(wording)) save(nextStatus, nextStatus);
  };

  const decided = status === "valide" || status === "rejete";

  return (
    <div className="space-y-6 border border-ink-dim/20 bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-blue">
        Décision
      </h2>

      {canDownload && (
        <div>
          {/* A plain link, not fetch(): the browser handles the download
              stream and the filename from Content-Disposition directly. */}
          <a
            href={`/api/admin/candidatures/${candidatureId}/dossier`}
            className="block w-full border border-blue-dark px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-blue-dark transition-colors hover:bg-blue-dark hover:text-white"
          >
            Télécharger le dossier complet
          </a>
          <p className="mt-2 text-xs text-ink-dim">
            Archive ZIP : toutes les pièces, un récapitulatif imprimable et un
            fichier Excel. Téléchargement journalisé.
          </p>
        </div>
      )}

      <div className="space-y-3 border-t border-ink-dim/20 pt-6">
        <button
          type="button"
          onClick={() => decide("valide")}
          disabled={saving !== null}
          className="w-full bg-terracotta px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-90 disabled:opacity-50"
        >
          {saving === "valide" ? "Validation..." : "Valider le dossier"}
        </button>

        <button
          type="button"
          onClick={() => decide("rejete")}
          disabled={saving !== null}
          className="w-full border border-ink-dim/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-mid transition hover:border-ink hover:text-ink disabled:opacity-50"
        >
          {saving === "rejete" ? "Rejet..." : "Rejeter le dossier"}
        </button>

        {decided && (
          <p className="text-xs text-ink-dim">
            Décision déjà enregistrée ({STATUS_LABELS_FR[status] ?? status}).
            La modifier renverra un email au candidat.
          </p>
        )}
      </div>

      <div className="border-t border-ink-dim/20 pt-6">
        <label
          htmlFor="notes"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-mid"
        >
          Notes internes
        </label>
        <textarea
          id="notes"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Non visibles par le candidat."
          className="w-full resize-none border border-ink-dim/30 p-3 text-sm text-ink placeholder:text-ink-dim/50 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
      </div>

      <details className="border-t border-ink-dim/20 pt-6">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Modifier le statut manuellement
        </summary>
        <div className="mt-4 space-y-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-ink-dim/30 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS_FR[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => save(status, "manual")}
            disabled={saving !== null}
            className="w-full border border-blue px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-blue transition hover:bg-blue hover:text-white disabled:opacity-50"
          >
            {saving === "manual" ? "Enregistrement..." : "Enregistrer le statut et les notes"}
          </button>
          <p className="text-xs text-ink-dim">
            Seuls les statuts pré-sélectionné, non éligible, pack complet,
            validé et rejeté déclenchent un email.
          </p>
        </div>
      </details>

      {message && (
        <p
          className={`text-sm ${messageIsError ? "text-terracotta" : "text-ink-dim"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
