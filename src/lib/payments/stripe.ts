import "server-only";
import Stripe from "stripe";
import type { Country } from "@/lib/constants/program";
import {
  PaymentConfigError,
  type CheckoutInput,
  type CheckoutResult,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentStatus,
  type RefundResult,
  type WebhookEvent,
} from "./types";

/**
 * Stripe — card payments in all six countries.
 *
 * Hosted Checkout rather than an embedded card form, deliberately: no card
 * data ever reaches our origin, which keeps the merchant in PCI SAQ-A and is
 * what makes §14's "Aucune donnée de carte bancaire stockée" literally true
 * rather than a claim about our own discipline.
 *
 * Settles in USD against the US entity (First Of All LLC, Santa Fe), so
 * there is no FX to lock — the payer's issuer converts at its own rate.
 */

let client: Stripe | undefined;

function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new PaymentConfigError("STRIPE_SECRET_KEY is not configured.");
    // Pinned so a Stripe-side API release can't change response shapes under
    // a running deployment. Must match the version the installed SDK's types
    // are generated against — bump both together.
    client = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  }
  return client;
}

function mapStatus(session: Stripe.Checkout.Session): PaymentStatus {
  if (session.payment_status === "paid") return "paye";
  if (session.status === "expired") return "annule";
  if (session.status === "complete") return "paye";
  return "en_cours";
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  // Cards work everywhere. Whether a given African-issued card is *enabled*
  // for cross-border use is another matter entirely — that's the decline risk
  // Flutterwave is scoped as a fallback for.
  supports(_country: Country, method: PaymentMethod) {
    return method === "card";
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.email,
        // Stripe takes minor units; USD has cents.
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(input.money.amountUsd * 100),
              product_data: { name: input.description },
            },
          },
        ],
        success_url: `${input.returnUrl}?status=success`,
        cancel_url: `${input.returnUrl}?status=cancelled`,
        locale: input.locale === "ar" ? "auto" : (input.locale as "fr" | "en"),
        // Echoed back on the webhook, so a settled session can be matched to
        // a dossier without trusting anything in the redirect.
        metadata: { candidatureId: input.candidatureId },
      },
      {
        // Stripe-side idempotency: a retried initiation returns the same
        // session instead of creating a second one the candidate could also
        // pay.
        idempotencyKey: `checkout:${input.candidatureId}:${input.money.amountUsd}`,
      },
    );

    if (!session.url) {
      throw new Error("Stripe returned a Checkout Session with no URL.");
    }

    return {
      providerRef: session.id,
      redirectUrl: session.url,
      // The hosted page redirects back, but settlement is still confirmed by
      // webhook — never by the browser's return.
      asynchronous: false,
    };
  },

  async verifyWebhook(rawBody, request) {
    const { headers } = request;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error(
        "STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook.",
      );
      return null;
    }

    const signature = headers.get("stripe-signature");
    if (!signature) return null;

    let event: Stripe.Event;
    try {
      // Verifies the HMAC over the exact bytes AND the timestamp tolerance,
      // which is what stops a captured webhook being replayed indefinitely.
      event = stripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      console.warn("Stripe webhook signature rejected:", (error as Error).message);
      return null;
    }

    const relevant = [
      "checkout.session.completed",
      "checkout.session.expired",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ];
    if (!relevant.includes(event.type)) {
      // Acknowledged and ignored — Stripe sends far more than we subscribe
      // to, and 4xx-ing the rest would trigger endless retries.
      return {
        eventId: event.id,
        eventType: event.type,
        providerRef: "",
        status: "en_cours",
        raw: event,
      } satisfies WebhookEvent;
    }

    const session = event.data.object as Stripe.Checkout.Session;

    return {
      eventId: event.id,
      eventType: event.type,
      providerRef: session.id,
      status:
        event.type === "checkout.session.async_payment_failed"
          ? "echoue"
          : mapStatus(session),
      raw: event,
    } satisfies WebhookEvent;
  },

  async getStatus(providerRef: string) {
    const session = await stripe().checkout.sessions.retrieve(providerRef);
    return { status: mapStatus(session) };
  },

  async refund(providerRef: string, amountUsd: number): Promise<RefundResult> {
    const session = await stripe().checkout.sessions.retrieve(providerRef);
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntent) {
      return { refunded: false, reason: "No payment intent on this session." };
    }

    const refund = await stripe().refunds.create({
      payment_intent: paymentIntent,
      amount: Math.round(amountUsd * 100),
    });

    return { refunded: refund.status === "succeeded", providerRefundRef: refund.id };
  },
};
