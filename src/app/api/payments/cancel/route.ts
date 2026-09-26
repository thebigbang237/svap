import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { providerById } from "@/lib/payments/registry";
import { settlePayment, type PaymentRow } from "@/lib/payments/record";
import type { PaymentProviderId } from "@/lib/payments/types";

/**
 * Gives up on a payment in flight, so the candidate can choose again.
 *
 * What it is for: someone who opened the card page, changed their mind, and
 * came back. Their dossier holds a payment in `en_cours`, the payment step
 * resumes waiting on it, and without this they are stuck on a spinner for a
 * payment they never made until the 30-minute window lapses.
 *
 * The provider is asked FIRST, every time. Abandoning a payment that actually
 * succeeded is the one outcome worse than the spinner: the money is gone and
 * the dossier says it never arrived. So a live `paye` settles here instead of
 * cancelling — same path as the poll and the webhook, receipt included.
 *
 * Cancelling is not final either. Nothing here is terminal in
 * `applyWebhookEvent`'s sense, so a late callback for a deposit that did
 * complete still settles the row and advances the dossier, and
 * `/api/cron/payments` keeps re-checking cancelled rows for the same reason.
 */
const schema = z.object({ paymentId: z.string().uuid() });

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.invalidRequest" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    // Scoped to the session's own dossier: a payment id must never be enough
    // to cancel someone else's payment.
    .eq("id", parsed.data.paymentId)
    .eq("candidature_id", session.cid)
    .maybeSingle<PaymentRow & { amount_usd: number; amount_local: number }>();

  if (!payment) {
    return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  }

  // Already resolved — say so rather than touching it.
  if (!["en_attente", "en_cours"].includes(payment.status)) {
    return NextResponse.json({ status: payment.status });
  }

  const provider = providerById(payment.provider as PaymentProviderId);

  if (provider) {
    try {
      const live = await provider.getStatus(payment.provider_ref, {
        amountLocal: payment.amount_local,
        amountUsd: payment.amount_usd,
      });

      if (live.status === "paye") {
        await supabase
          .from("payments")
          .update({
            status: "paye",
            completed_at: new Date().toISOString(),
            settlement_source: "gateway_status",
          })
          .eq("id", payment.id)
          .in("status", ["en_attente", "en_cours"]);

        await settlePayment(supabase, { ...payment, status: "paye" });
        return NextResponse.json({ status: "paye" });
      }
    } catch (error) {
      // A provider outage must not block someone from starting again. The
      // row stays recoverable either way — see the note above.
      console.error(
        `Status check before cancelling ${payment.provider}/${payment.provider_ref}:`,
        (error as Error).message,
      );
    }
  }

  await supabase
    .from("payments")
    .update({ status: "annule" })
    .eq("id", payment.id)
    .in("status", ["en_attente", "en_cours"]);

  return NextResponse.json({ status: "annule" });
}
