"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The queue of settlements nobody has proven yet.
 *
 * Each row is a dossier that was let through on a Paiement Pro notification
 * alone. The job is mechanical: find the reference in the Paiement Pro back
 * office, and say whether it is there. Confirming is the common case;
 * rejecting is what the queue exists for, and it puts the candidate back on
 * the payment step, so it asks for a note and a confirmation first.
 */

export interface PendingSettlement {
  id: string;
  candidature_id: string;
  provider_ref: string;
  method: string;
  amount_local: number;
  amount_usd: number;
  currency: string;
  completed_at: string | null;
  candidate: { prenom: string; nom: string; email: string } | null;
}

export function ReconciliationTable({ rows }: { rows: PendingSettlement[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(row: PendingSettlement, decision: "confirm" | "reject") {
    let note: string | undefined;

    if (decision === "reject") {
      const answer = window.prompt(
        `Rejeter le règlement de ${row.amount_local} ${row.currency} (réf. ${row.provider_ref}) ?\n\n` +
          `À n'utiliser que si la transaction est INTROUVABLE dans le back-office Paiement Pro. ` +
          `Le paiement repasse en échec et le candidat retourne à l'étape de paiement.\n\n` +
          `Note (visible dans le journal d'audit) :`,
      );
      if (answer === null) return;
      note = answer;
    } else if (
      !window.confirm(
        `Confirmer que la transaction ${row.provider_ref} figure bien dans le back-office Paiement Pro ?`,
      )
    ) {
      return;
    }

    setBusy(row.id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/payments/${row.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const body = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(body.error ?? "L'opération a échoué.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="border border-ink-dim/20 bg-white p-8 text-center text-sm text-ink-dim">
        Aucun règlement en attente de vérification.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="border-s-2 border-terracotta bg-terracotta/5 p-3 text-sm text-terracotta">
          {error}
        </p>
      )}

      <div className="overflow-x-auto border border-ink-dim/20 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-dim/20 bg-sky-mid text-xs font-semibold uppercase tracking-wide text-ink-mid">
            <tr>
              <th className="px-4 py-3">Candidat</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Réglé le</th>
              <th className="px-4 py-3">Vérification</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-ink-dim/10 last:border-0 hover:bg-sky/40"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/candidatures/${row.candidature_id}`}
                    className="font-medium text-blue hover:underline"
                  >
                    {row.candidate
                      ? `${row.candidate.prenom} ${row.candidate.nom}`
                      : "Dossier supprimé"}
                  </Link>
                  <p className="text-xs text-ink-dim">{row.candidate?.email}</p>
                </td>
                <td className="px-4 py-3">
                  {row.amount_local} {row.currency}
                  <span className="block text-xs text-ink-dim">
                    ${row.amount_usd} · {row.method === "paypal" ? "PayPal" : "Carte"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px]">
                  {row.provider_ref}
                </td>
                <td className="px-4 py-3 text-xs text-ink-dim">
                  {row.completed_at
                    ? new Date(row.completed_at).toLocaleString("fr-FR")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => decide(row, "confirm")}
                      className="text-xs font-semibold uppercase tracking-[0.15em] text-blue transition-colors hover:text-terracotta disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => decide(row, "reject")}
                      className="text-xs font-semibold uppercase tracking-[0.15em] text-terracotta transition-colors hover:underline disabled:opacity-50"
                    >
                      Introuvable
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
