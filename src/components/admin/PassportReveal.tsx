"use client";

import { useState } from "react";

/**
 * Reveals a decrypted passport number on explicit request.
 *
 * The number is sealed at rest so that reading it is a decision, not a side
 * effect of opening a dossier. This button is that decision — it is
 * super_admin-only server-side and writes a `passport.reveal` entry to the
 * audit log before returning anything.
 *
 * The suffix shown by default is enough to confirm a document over the phone
 * without revealing anything useful to an identity thief.
 */
export function PassportReveal({
  candidatureId,
  suffix,
  canReveal,
}: {
  candidatureId: string;
  suffix: string | null;
  canReveal: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/passport/${candidatureId}`, {
        method: "POST",
      });
      const body = (await res.json()) as {
        passportNumber?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Affichage impossible.");
        return;
      }
      setValue(body.passportNumber ?? null);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
        N° de passeport
      </p>

      {value ? (
        <p className="font-mono text-sm text-ink">{value}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-sm text-ink">
            ••••••{suffix ?? "??"}
          </p>
          {canReveal && (
            <button
              type="button"
              onClick={reveal}
              disabled={busy}
              className="text-xs font-semibold uppercase tracking-wide text-blue hover:underline disabled:opacity-40"
            >
              {busy ? "..." : "Afficher"}
            </button>
          )}
        </div>
      )}

      {!canReveal && !value && (
        <p className="mt-1 text-xs text-ink-dim">
          Réservé aux super-administrateurs.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-terracotta">{error}</p>}
      {value && (
        <p className="mt-1 text-xs text-ink-dim">Cet affichage a été journalisé.</p>
      )}
    </div>
  );
}
