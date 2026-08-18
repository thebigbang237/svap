"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PAYMENT_STATUS_LABELS_FR, label } from "@/lib/constants/admin-labels";
import type { PaymentView } from "@/lib/admin/dossier";

/**
 * Payments for a dossier, with the exceptional refund action.
 *
 * Verification fees are non-refundable (client decision, 2026-08-17) and no
 * public copy promises otherwise. This button exists for the cases that have
 * nothing to do with policy — a duplicate charge, a wrong amount, a provider
 * error, a chargeback to settle — where the money simply should not have been
 * taken. It goes back through the provider that took it, is super_admin only,
 * is confirmed before firing, and is audited.
 */
export function PaymentsPanel({
  payments,
  canRefund,
}: {
  payments: PaymentView[];
  canRefund: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refund(payment: PaymentView) {
    const reason = window.prompt(
      `Remboursement exceptionnel de ${payment.amount_usd} USD ?\n\nLes frais de vérification ne sont pas remboursables : réservez cette action aux erreurs de facturation (double débit, montant erroné, incident prestataire).\n\nMotif (visible dans le journal d'audit) :`,
    );
    // Cancelled dialog — not an empty reason.
    if (reason === null) return;

    setBusy(payment.id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(body.error ?? "Le remboursement a échoué.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(null);
    }
  }

  if (payments.length === 0) {
    return <p className="text-sm text-ink-dim">Aucun paiement enregistré.</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {payments.map((p) => (
          <li key={p.id} className="border border-ink-dim/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">
                  {p.currency === "USD"
                    ? `$${p.amount_usd}`
                    : `${p.amount_local} ${p.currency} ($${p.amount_usd})`}
                </p>
                <p className="text-xs text-ink-dim">
                  {p.provider} · {p.method === "card" ? "Carte" : "Mobile Money"}
                  {p.completed_at &&
                    ` · réglé le ${new Date(p.completed_at).toLocaleString("fr-FR")}`}
                </p>
                <p className="mt-1 font-mono text-[10px] text-ink-dim/70">
                  {p.provider_ref}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span
                  className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    p.status === "paye"
                      ? "bg-terracotta/10 text-terracotta"
                      : p.status === "rembourse"
                        ? "bg-blue/10 text-blue-dark"
                        : "bg-sky-mid text-ink-mid"
                  }`}
                >
                  {label(PAYMENT_STATUS_LABELS_FR, p.status)}
                </span>

                {canRefund && p.status === "paye" && (
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => refund(p)}
                    className="text-xs font-semibold uppercase tracking-wide text-blue hover:underline disabled:opacity-40"
                  >
                    {busy === p.id
                      ? "Remboursement..."
                      : "Rembourser (exceptionnel)"}
                  </button>
                )}
              </div>
            </div>

            {p.refunded_at && (
              <p className="mt-3 border-t border-ink-dim/10 pt-3 text-xs text-ink-dim">
                Remboursé le {new Date(p.refunded_at).toLocaleString("fr-FR")}
                {p.refund_amount_usd ? ` — $${p.refund_amount_usd}` : ""}
              </p>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-terracotta">{error}</p>}
    </div>
  );
}
