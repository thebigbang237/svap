"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_OPTIONS, STATUS_LABELS_FR } from "@/lib/constants/admin-options";

export interface CandidatureReviewFormProps {
  candidatureId: string;
  initialStatus: string;
  initialNotes: string | null;
}

export function CandidatureReviewForm({
  candidatureId,
  initialStatus,
  initialNotes,
}: CandidatureReviewFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/candidatures/${candidatureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notesAdmin: notes }),
      });

      if (!res.ok) {
        throw new Error();
      }

      setMessage("Enregistré.");
      setMessageIsError(false);
      router.refresh();
    } catch {
      setMessage("Erreur lors de l'enregistrement. Veuillez réessayer.");
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border border-ink-dim/20 bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-blue">
        Décision
      </h2>

      <div>
        <label
          htmlFor="status"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-mid"
        >
          Statut
        </label>
        <select
          id="status"
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
      </div>

      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-mid"
        >
          Notes internes
        </label>
        <textarea
          id="notes"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Non visibles par le candidat."
          className="w-full resize-none border border-ink-dim/30 p-3 text-sm text-ink placeholder:text-ink-dim/50 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-90 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {message && (
          <span
            className={`text-sm ${messageIsError ? "text-terracotta" : "text-ink-dim"}`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
