import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { providerById } from "@/lib/payments/registry";
import { markCandidaturePaid, type PaymentRow } from "@/lib/payments/record";
import type { PaymentProviderId } from "@/lib/payments/types";

/**
 * Authoritative payment status, for the mobile-money waiting state.
 *
 * A pawaPay deposit resolves when the payer approves a prompt on their
 * handset — seconds to minutes later, with nothing happening in the browser.
 * The UI polls this while it waits.
 *
 * Deliberately asks the *provider*, not just our own row: the callback may be
 * late, lost, or blocked by a network the candidate is sitting behind. This
 * is the safety net that stops someone who has genuinely paid from being
 * stuck on a spinner.
 */
export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const paymentId = new URL(request.url).searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json({ error: "errors.invalidRequest" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    // Scoped to the session's own candidature: a payment id alone must never
    // be enough to read someone else's payment state.
    .eq("id", paymentId)
    .eq("candidature_id", session.cid)
    .maybeSingle<PaymentRow>();

  if (!payment) {
    return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  }

  if (payment.status === "paye") {
    return NextResponse.json({ status: "paye" });
  }

  const provider = providerById(payment.provider as PaymentProviderId);
  if (!provider) {
    return NextResponse.json({ status: payment.status });
  }

  try {
    const live = await provider.getStatus(payment.provider_ref);

    if (live.status !== payment.status) {
      const becamePaid = live.status === "paye";

      await supabase
        .from("payments")
        .update({
          status: live.status,
          failure_reason: live.failureReason ?? null,
          completed_at: becamePaid
            ? new Date().toISOString()
            : payment.completed_at,
        })
        .eq("id", payment.id);

      if (becamePaid) {
        await markCandidaturePaid(supabase, session.cid);
      }
    }

    return NextResponse.json({
      status: live.status,
      failureReason: live.failureReason,
    });
  } catch (error) {
    // A provider outage shouldn't look like a failed payment — report what
    // we last knew and let the poll try again.
    console.error("Payment status lookup failed:", (error as Error).message);
    return NextResponse.json({ status: payment.status });
  }
}
