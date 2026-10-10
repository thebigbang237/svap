"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "Renvoyer le code", from the dossier.
 *
 * The candidate-facing form needs a name and email that match the dossier,
 * which is exactly what the person writing to support cannot produce — a
 * married name, a typo at Phase 1, a mailbox that bounced. This is the way
 * out of that conversation.
 *
 * Confirmed before firing, because it invalidates the code the candidate may
 * still be holding: someone who finds the original email ten minutes later
 * would otherwise be told it is invalid, with no idea why.
 */
export function AccessCodeResend({
  candidatureId,
  email,
}: {
  candidatureId: string;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    if (
      !window.confirm(
        `Envoyer un nouveau code d'accès à ${email} ?\n\n` +
          `Le code précédent sera immédiatement invalidé : si le candidat ` +
          `retrouve l'ancien e-mail, il ne fonctionnera plus.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/candidatures/${candidatureId}/resend-code`,
        { method: "POST" },
      );
      const body = (await res.json()) as { error?: string; expiresAt?: string };

      if (!res.ok) {
        setError(body.error ?? "L'envoi a échoué.");
        return;
      }

      setDone(
        body.expiresAt
          ? `Nouveau code envoyé à ${email}, valable jusqu'au ${new Date(
              body.expiresAt,
            ).toLocaleDateString("fr-FR")}.`
          : `Nouveau code envoyé à ${email}.`,
      );
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="mt-4 text-xs text-terracotta">{done}</p>;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy}
        onClick={resend}
        className="text-xs font-semibold uppercase tracking-[0.2em] text-blue transition-colors hover:text-terracotta disabled:opacity-50"
      >
        {busy ? "Envoi…" : "Renvoyer le code"}
      </button>
      {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
    </div>
  );
}
