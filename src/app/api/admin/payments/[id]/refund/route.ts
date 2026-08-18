import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import { providerById } from "@/lib/payments/registry";
import type { PaymentProviderId } from "@/lib/payments/types";
import type { PaymentRow } from "@/lib/payments/record";

/**
 * Issues an exceptional refund against the original payment method.
 *
 * Verification fees are not refundable as a matter of policy (client decision,
 * 2026-08-17): they pay for work performed on the dossier, and no public copy
 * promises them back. What this route is for is billing error — a double
 * charge, a wrong amount, a provider incident, a chargeback — where the money
 * should never have been taken in the first place.
 *
 * It goes back through the provider that took it rather than being settled
 * off-platform: a mobile-money collection refunds to the wallet, a card
 * refunds to the card, and the reversal is traceable on both sides.
 *
 * super_admin only, and audited: this moves money out.
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
  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .maybeSingle<PaymentRow & { refunded_at: string | null }>();

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only a settled payment can be refunded, and only once. Without this a
  // double-click on the button is a double refund.
  if (payment.status !== "paye") {
    return NextResponse.json(
      { error: "Seul un paiement réglé peut être remboursé." },
      { status: 409 },
    );
  }

  const provider = providerById(payment.provider as PaymentProviderId);
  if (!provider) {
    return NextResponse.json(
      { error: "Prestataire de paiement inconnu." },
      { status: 500 },
    );
  }

  const result = await provider.refund(payment.provider_ref, payment.amount_usd);

  if (!result.refunded) {
    return NextResponse.json(
      { error: result.reason ?? "Le remboursement a été refusé." },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();

  await supabase
    .from("payments")
    .update({
      status: "rembourse",
      refunded_at: now,
      refund_amount_usd: payment.amount_usd,
      refund_reason: body.reason ?? null,
    })
    .eq("id", payment.id)
    // Guards against a concurrent refund racing this one to the same row.
    .eq("status", "paye");

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "payment.refund",
    entityType: "payment",
    entityId: payment.id,
    request,
    metadata: {
      candidatureId: payment.candidature_id,
      amountUsd: payment.amount_usd,
      provider: payment.provider,
      providerRefundRef: result.providerRefundRef,
      reason: body.reason,
    },
  });

  return NextResponse.json({ success: true, reference: result.providerRefundRef });
}
