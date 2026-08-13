import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerById } from "@/lib/payments/registry";
import {
  applyWebhookEvent,
  markCandidaturePaid,
} from "@/lib/payments/record";
import { sendPaymentReceiptEmail } from "@/lib/resend/client";
import type { PaymentProviderId } from "@/lib/payments/types";
import type { CandidatureRow } from "@/lib/supabase/types";

const KNOWN: PaymentProviderId[] = ["pawapay", "stripe", "flutterwave"];

/**
 * Payment webhooks — the ONLY thing that may mark a fee as settled.
 *
 * Three rules this route exists to enforce:
 *
 *  1. Read the RAW body. Every provider signs the exact bytes it sent, and a
 *     JSON round-trip does not reproduce them — `await request.text()` before
 *     anything else, always.
 *  2. Verify the signature before touching a payment. An unsigned endpoint
 *     lets anyone mark any dossier as paid.
 *  3. Apply exactly once. Providers retry, so idempotency is enforced by a
 *     unique index rather than by hoping deliveries don't repeat.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await params;

  if (!(KNOWN as readonly string[]).includes(providerParam)) {
    return new NextResponse(null, { status: 404 });
  }

  const provider = providerById(providerParam as PaymentProviderId);
  if (!provider) return new NextResponse(null, { status: 404 });

  // Rule 1 — raw bytes, before any parsing.
  const rawBody = await request.text();

  // Rule 2 — signature first.
  //
  // Any failure in here is a 400, never a 5xx: providers treat 5xx as
  // "retry later" and would hammer the endpoint over a malformed body that
  // will never become valid. It also avoids handing an attacker a different
  // response for "crashed" than for "rejected".
  let event;
  try {
    event = await provider.verifyWebhook(rawBody, request.headers);
  } catch (error) {
    console.error(
      `Error verifying ${providerParam} webhook:`,
      (error as Error).message,
    );
    return new NextResponse("invalid payload", { status: 400 });
  }

  if (!event) {
    console.warn(`Rejected ${providerParam} webhook: invalid signature`);
    return new NextResponse("invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();

  // Rule 3 — exactly once.
  const result = await applyWebhookEvent(supabase, provider.id, event);

  if (!result.applied) {
    // A duplicate or an event we don't act on. Both are 200: anything else
    // makes the provider retry a delivery that was handled correctly.
    return NextResponse.json({ received: true, applied: false });
  }

  if (result.becamePaid) {
    await markCandidaturePaid(supabase, result.payment.candidature_id);

    const { data: candidature } = await supabase
      .from("candidatures")
      .select("prenom, email, locale, pack")
      .eq("id", result.payment.candidature_id)
      .maybeSingle<
        Pick<CandidatureRow, "prenom" | "email" | "locale" | "pack">
      >();

    if (candidature) {
      try {
        await sendPaymentReceiptEmail({
          prenom: candidature.prenom,
          email: candidature.email,
          locale: candidature.locale,
          amountUsd: result.payment.amount_usd,
          amountLocal: result.payment.amount_local,
          currency: result.payment.currency,
          reference: result.payment.provider_ref,
          paidAt: new Date(),
        });

        await supabase
          .from("payments")
          .update({ receipt_sent_at: new Date().toISOString() })
          .eq("id", result.payment.id);
      } catch (error) {
        // The payment is recorded and the dossier has advanced. A missing
        // receipt is a support ticket; returning non-200 here would make the
        // provider retry an event already applied.
        console.error("Receipt email failed:", (error as Error).message);
      }
    }
  }

  return NextResponse.json({ received: true, applied: true });
}
