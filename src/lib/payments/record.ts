import "server-only";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/i18n/routing";
import { sendPaymentReceiptEmail } from "@/lib/resend/client";
import type { PaymentMethod, PaymentProviderId, WebhookEvent, Money } from "./types";

/**
 * Persistence for payments and the webhook idempotency ledger.
 */

export interface PaymentRow {
  id: string;
  candidature_id: string;
  provider: string;
  provider_ref: string;
  method: string;
  amount_usd: number;
  amount_local: number;
  currency: string;
  status: string;
  completed_at: string | null;
  receipt_sent_at: string | null;
}

/**
 * Writes the payment row, in `en_cours`, before anything is initiated.
 *
 * The ordering is the point, not an implementation detail. pawaPay requires the
 * `depositId` to exist on our side first, precisely so that a timeout or a
 * crash mid-initiation still leaves a reference to reconcile against: without
 * it, a deposit can be collected from a candidate with no record of it here.
 */
export async function createPaymentRecord(
  supabase: AdminClient,
  input: {
    candidatureId: string;
    provider: PaymentProviderId;
    providerRef: string;
    method: PaymentMethod;
    money: Money;
    operator?: string;
  },
): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      candidature_id: input.candidatureId,
      provider: input.provider,
      provider_ref: input.providerRef,
      method: input.method,
      mmo_operator: input.operator ?? null,
      amount_usd: input.money.amountUsd,
      amount_local: input.money.amountLocal,
      currency: input.money.currency,
      fx_rate: input.money.fxRate,
      // Locked now, not at settlement: the candidate agreed to this local
      // amount on screen, and a rate that moves mid-payment must not change
      // what they owe.
      fx_locked_at: new Date().toISOString(),
      fx_source: input.money.fxSource,
      status: "en_cours",
    })
    .select("*")
    .single<PaymentRow>();

  if (error) {
    console.error("Failed to create payment record:", error.message);
    return null;
  }
  return data;
}

/**
 * Marks a payment failed, with the provider's reason.
 *
 * Only ever called where the failure is unambiguous — a REJECTED initiation, or
 * a status check that came back NOT_FOUND. Anything indeterminate is left
 * pending for the reconciliation cycle instead.
 */
export async function markPaymentFailed(
  supabase: AdminClient,
  paymentId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ status: "echoue", failure_reason: reason.slice(0, 500) })
    .eq("id", paymentId)
    // Never overwrite a terminal state: a rejection racing a settled callback
    // must not un-pay someone.
    .in("status", ["en_attente", "en_cours"]);

  if (error) {
    console.error("Failed to mark payment failed:", error.message);
  }
}

export type ApplyResult =
  | { applied: true; payment: PaymentRow; becamePaid: boolean }
  | { applied: false; reason: "duplicate" | "unknown_payment" | "error" };

/**
 * Records a webhook event and applies it — exactly once.
 *
 * The idempotency guard is the unique index on
 * (provider, provider_event_id): providers retry aggressively, and a
 * duplicate delivery must be acknowledged without being applied a second
 * time. Inserting the event FIRST and treating a 23505 as "already handled"
 * makes that a database guarantee rather than an application-level race.
 */
export async function applyWebhookEvent(
  supabase: AdminClient,
  provider: PaymentProviderId,
  event: WebhookEvent,
): Promise<ApplyResult> {
  const { error: insertError } = await supabase.from("payment_events").insert({
    provider,
    provider_event_id: event.eventId,
    event_type: event.eventType,
    payload: event.raw as Record<string, unknown>,
  });

  if (insertError) {
    if (insertError.code === "23505") return { applied: false, reason: "duplicate" };
    console.error("Failed to record payment event:", insertError.message);
    return { applied: false, reason: "error" };
  }

  if (!event.providerRef) {
    // An event type we acknowledge but don't act on. Logged above; nothing
    // to apply.
    await markEventProcessed(supabase, provider, event.eventId, null);
    return { applied: false, reason: "unknown_payment" };
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("provider", provider)
    .eq("provider_ref", event.providerRef)
    .maybeSingle<PaymentRow>();

  if (!payment) {
    console.warn(`Webhook for unknown payment ${provider}/${event.providerRef}`);
    return { applied: false, reason: "unknown_payment" };
  }

  // Never walk a settled payment backwards. Providers deliver out of order,
  // and a late "processing" arriving after "completed" must not un-pay
  // someone who has already been let through to the document step.
  const terminal = ["paye", "rembourse"];
  if (terminal.includes(payment.status)) {
    await markEventProcessed(supabase, provider, event.eventId, payment.id);
    return { applied: true, payment, becamePaid: false };
  }

  const becamePaid = event.status === "paye" && payment.status !== "paye";

  const { data: updated, error } = await supabase
    .from("payments")
    .update({
      status: event.status,
      failure_reason: event.failureReason ?? null,
      completed_at: becamePaid ? new Date().toISOString() : payment.completed_at,
    })
    .eq("id", payment.id)
    .select("*")
    .single<PaymentRow>();

  if (error || !updated) {
    console.error("Failed to update payment:", error?.message);
    return { applied: false, reason: "error" };
  }

  await markEventProcessed(supabase, provider, event.eventId, payment.id);

  return { applied: true, payment: updated, becamePaid };
}

async function markEventProcessed(
  supabase: AdminClient,
  provider: PaymentProviderId,
  eventId: string,
  paymentId: string | null,
) {
  await supabase
    .from("payment_events")
    .update({ processed_at: new Date().toISOString(), payment_id: paymentId })
    .eq("provider", provider)
    .eq("provider_event_id", eventId);
}

/**
 * Advances the dossier once a fee actually settles.
 *
 * Scoped with `.eq("status", "phase2_en_cours")` so it can only ever move a
 * dossier forward from the step that precedes payment — a replayed or
 * out-of-order event can't rewind someone already in verification.
 */
export async function markCandidaturePaid(
  supabase: AdminClient,
  candidatureId: string,
): Promise<void> {
  const { error } = await supabase
    .from("candidatures")
    .update({ status: "phase2_paye" })
    .eq("id", candidatureId)
    .eq("status", "phase2_en_cours");

  if (error) {
    console.error("Failed to mark candidature paid:", error.message);
  }
}

/**
 * Everything that must happen exactly once when a fee settles: advance the
 * dossier, and send the receipt.
 *
 * Shared by BOTH settlement paths — the provider webhook and the status poll.
 * Previously the receipt lived only in the webhook, which meant a lost or
 * delayed callback left a candidate who had genuinely paid with no proof of
 * it. Whichever path observes the settlement first now does the whole job.
 *
 * `receipt_sent_at` is the idempotency guard: the update is scoped to rows
 * where it is still null, and the email only goes out if that update actually
 * claimed the row. Two concurrent settlements therefore send one receipt.
 */
export async function settlePayment(
  supabase: AdminClient,
  payment: PaymentRow,
): Promise<void> {
  await markCandidaturePaid(supabase, payment.candidature_id);

  if (payment.receipt_sent_at) return;

  // Claim the right to send before sending. Doing it the other way round
  // would double-send whenever a webhook and a poll land together.
  const { data: claimed } = await supabase
    .from("payments")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", payment.id)
    .is("receipt_sent_at", null)
    .select("id");

  if (!claimed || claimed.length === 0) return;

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("prenom, email, locale")
    .eq("id", payment.candidature_id)
    .maybeSingle<{ prenom: string; email: string; locale: Locale }>();

  if (!candidature) return;

  try {
    await sendPaymentReceiptEmail({
      prenom: candidature.prenom,
      email: candidature.email,
      locale: candidature.locale,
      amountUsd: payment.amount_usd,
      amountLocal: payment.amount_local,
      currency: payment.currency,
      reference: payment.provider_ref,
      paidAt: new Date(),
    });
  } catch (error) {
    // Release the claim so a later poll or webhook retries the receipt. The
    // payment itself is settled and the dossier has advanced either way.
    await supabase
      .from("payments")
      .update({ receipt_sent_at: null })
      .eq("id", payment.id);
    console.error("Receipt email failed:", (error as Error).message);
  }
}
