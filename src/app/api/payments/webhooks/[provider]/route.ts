import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerById } from "@/lib/payments/registry";
import { applyWebhookEvent, settlePayment } from "@/lib/payments/record";
import type { PaymentProviderId } from "@/lib/payments/types";
import { routing } from "@/i18n/routing";

const KNOWN: PaymentProviderId[] = [
  "pawapay",
  "stripe",
  "paiementpro",
  "flutterwave",
];

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
  context: { params: Promise<{ provider: string }> },
) {
  return handle(request, context);
}

/**
 * Some gateways notify over GET.
 *
 * Paiement Pro is one: it appends `referenceNumber` and `responsecode` to the
 * notification URL as query parameters rather than POSTing a body — visible in
 * a working third-party integration, and in nothing they document. A POST-only
 * route answers 405 and the notification is lost silently.
 *
 * Providers that sign their callbacks are unaffected: a GET carries no
 * signature, so `verifyWebhook` rejects it exactly as it would any other
 * unsigned request.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const response = await handle(request, context);

  // If a *browser* followed this URL — the gateway redirecting the payer
  // rather than calling us server-to-server — send them somewhere that makes
  // sense instead of a page of JSON. The payment step picks up the in-flight
  // payment and polls it to a conclusion.
  if (request.headers.get("accept")?.includes("text/html")) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return NextResponse.redirect(
      `${siteUrl}/${routing.defaultLocale}/documents/paiement`,
      303,
    );
  }

  return response;
}

async function handle(
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
    // The whole request, not just its headers: pawaPay's RFC-9421 signature
    // covers the method and path as well as the body digest.
    event = await provider.verifyWebhook(rawBody, request);
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

  // Rule 2b — for providers whose callbacks cannot be authenticated, the
  // callback is only a nudge. The status is re-derived from the provider's own
  // API with the amount we recorded cross-checked against what the gateway
  // reports, so a forged notification achieves nothing but a redundant lookup.
  if (provider.confirmsViaStatus && event.providerRef) {
    const { data: payment } = await supabase
      .from("payments")
      .select("amount_local")
      .eq("provider", provider.id)
      .eq("provider_ref", event.providerRef)
      .maybeSingle<{ amount_local: number }>();

    if (!payment) {
      // Nothing to confirm against. Acknowledged so the provider stops
      // retrying a reference we have never issued.
      console.warn(
        `Unverifiable callback for unknown ${provider.id} reference ${event.providerRef}`,
      );
      return NextResponse.json({ received: true, applied: false });
    }

    const live = await provider.getStatus(event.providerRef, payment.amount_local);
    event = {
      ...event,
      status: live.status,
      failureReason: live.failureReason,
      eventId: `${event.providerRef}:${live.status}`,
    };
  }

  // Rule 3 — exactly once.
  const result = await applyWebhookEvent(supabase, provider.id, event);

  if (!result.applied) {
    // A duplicate or an event we don't act on. Both are 200: anything else
    // makes the provider retry a delivery that was handled correctly.
    return NextResponse.json({ received: true, applied: false });
  }

  if (result.becamePaid) {
    // Shared with the status-poll path, so whichever observes settlement
    // first advances the dossier and sends the receipt — exactly once.
    // Never throws: a failure here must not make the provider retry an event
    // that was already applied.
    await settlePayment(supabase, result.payment);
  }

  return NextResponse.json({ received: true, applied: true });
}
