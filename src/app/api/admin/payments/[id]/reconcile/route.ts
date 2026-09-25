import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import type { PaymentRow } from "@/lib/payments/record";

/**
 * Confirms — or reverses — a payment that settled on an unverifiable callback.
 *
 * Paiement Pro cannot prove a payment happened: their status API does not
 * report our transactions and their `hashcode` is not a merchant signature
 * (their support, in writing). So a card settlement is taken on the
 * notification's word, the candidate proceeds immediately, and the claim lands
 * here to be checked against the Paiement Pro back office.
 *
 * `confirm` records that a human saw the transaction there. `reject` is for
 * the case this whole queue exists for: a settlement with no matching
 * transaction — a replayed callback — which puts the payment back to `echoue`
 * and the dossier back to where it was before the money was believed.
 *
 * super_admin only, and audited both ways: confirming lets a dossier proceed
 * on money that may not exist, and rejecting takes a paid candidate's access
 * away. Both need a name against them.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (admin.profile.role !== "super_admin") {
    return NextResponse.json(
      { error: "Réservé aux super-administrateurs." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    decision?: "confirm" | "reject";
    note?: string;
  };

  if (body.decision !== "confirm" && body.decision !== "reject") {
    return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .maybeSingle<PaymentRow>();

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.reconciled_at) {
    return NextResponse.json(
      { error: "Ce paiement a déjà été vérifié." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();

  if (body.decision === "confirm") {
    await supabase
      .from("payments")
      .update({
        reconciled_at: now,
        reconciled_by: admin.userId,
        // The claim now rests on a person having seen it at the provider.
        settlement_source: "manual",
      })
      .eq("id", payment.id)
      .is("reconciled_at", null);
  } else {
    // No matching transaction at the provider. Undo the settlement: the
    // payment failed, and the dossier goes back to awaiting payment so the
    // candidate is asked again rather than quietly kept in verification.
    await supabase
      .from("payments")
      .update({
        status: "echoue",
        failure_reason: `reconciliation: introuvable chez le prestataire${
          body.note ? ` — ${body.note}` : ""
        }`.slice(0, 500),
        reconciled_at: now,
        reconciled_by: admin.userId,
      })
      .eq("id", payment.id)
      .is("reconciled_at", null);

    // Scoped to the one status it may move back from: a dossier that has
    // since advanced under review is not rewound by this.
    await supabase
      .from("candidatures")
      .update({ status: "phase2_en_cours" })
      .eq("id", payment.candidature_id)
      .eq("status", "phase2_paye");
  }

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: body.decision === "confirm" ? "payment.reconcile" : "payment.reject",
    entityType: "payment",
    entityId: payment.id,
    request,
    metadata: {
      candidatureId: payment.candidature_id,
      provider: payment.provider,
      providerRef: payment.provider_ref,
      amountLocal: payment.amount_local,
      currency: payment.currency,
      note: body.note,
    },
  });

  return NextResponse.json({ success: true });
}
