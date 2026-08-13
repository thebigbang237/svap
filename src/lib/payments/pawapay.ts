import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
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
 * pawaPay — mobile money across Cameroun, Kenya and Ghana.
 *
 * Deposits are ASYNCHRONOUS by nature: pawaPay pushes a prompt to the payer's
 * handset, they approve it with their PIN, and settlement lands seconds to
 * minutes later via callback. Nothing here can be resolved from the browser,
 * which is why `asynchronous` is true and the UI polls `getStatus`.
 *
 * Plain REST — no SDK exists worth the dependency.
 */

const SANDBOX_BASE = "https://api.sandbox.pawapay.io";
const LIVE_BASE = "https://api.pawapay.io";

/** ISO-3166 alpha-3, as pawaPay expects it. */
const COUNTRY_CODES: Record<Country, string> = {
  cmr: "CMR",
  ken: "KEN",
  gha: "GHA",
  // Not supported by pawaPay — present so the map stays exhaustive and a new
  // country can't be added to the programme without this being reconsidered.
  zaf: "ZAF",
  mar: "MAR",
  egy: "EGY",
};

function config() {
  const token = process.env.PAWAPAY_API_TOKEN;
  if (!token) {
    throw new PaymentConfigError("PAWAPAY_API_TOKEN is not configured.");
  }
  return {
    token,
    baseUrl:
      process.env.PAWAPAY_ENV === "live" ? LIVE_BASE : SANDBOX_BASE,
    webhookSecret: process.env.PAWAPAY_WEBHOOK_SECRET,
  };
}

/** pawaPay deposit states → our lifecycle. */
function mapStatus(raw: string): PaymentStatus {
  switch (raw?.toUpperCase()) {
    case "COMPLETED":
      return "paye";
    case "FAILED":
      return "echoue";
    case "REJECTED":
      return "echoue";
    case "CANCELLED":
      return "annule";
    // ACCEPTED / SUBMITTED / PROCESSING — the prompt is with the payer.
    default:
      return "en_cours";
  }
}

export const pawapayProvider: PaymentProvider = {
  id: "pawapay",

  supports(country: Country, method: PaymentMethod) {
    return method === "mobile_money" && COUNTRY_PAYMENT[country].mobileMoney;
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const { token, baseUrl } = config();

    if (!input.phone) {
      throw new PaymentConfigError(
        "A phone number is required for a mobile money deposit.",
      );
    }

    // We generate the id rather than letting pawaPay assign one, so the row
    // exists under a known reference before the network call — a timeout
    // then leaves a payment we can poll, not an orphaned charge.
    const depositId = randomUUID();

    const response = await fetch(`${baseUrl}/deposits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        depositId,
        amount: String(input.money.amountLocal),
        currency: input.money.currency,
        country: COUNTRY_CODES[input.country],
        // Digits only, no '+' — pawaPay rejects the E.164 prefix here.
        payer: {
          type: "MSISDN",
          address: { value: input.phone.replace(/\D/g, "") },
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription: input.description.slice(0, 22),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `pawaPay deposit failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as { status?: string };

    if (data.status && mapStatus(data.status) === "echoue") {
      throw new Error(`pawaPay rejected the deposit: ${data.status}`);
    }

    return { providerRef: depositId, asynchronous: true };
  },

  async verifyWebhook(rawBody, headers) {
    // Reads the secret directly rather than going through config(): callback
    // verification needs only the signing secret, and requiring the API token
    // here would turn a forged webhook into a 500 (which providers retry)
    // instead of a clean rejection.
    const webhookSecret = process.env.PAWAPAY_WEBHOOK_SECRET;

    // Fail closed. An unsigned callback endpoint would let anyone mark any
    // payment as settled by POSTing a deposit id.
    if (!webhookSecret) {
      console.error(
        "PAWAPAY_WEBHOOK_SECRET is not configured — rejecting callback.",
      );
      return null;
    }

    const signature = headers.get("x-pawapay-signature") ?? "";
    const expected = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(rawBody) as {
      depositId?: string;
      refundId?: string;
      payoutId?: string;
      status?: string;
      failureReason?: { failureMessage?: string };
    };

    const state = payload.status ?? "unknown";

    // Refund callbacks. A completed refund is a distinct terminal state, not
    // a deposit transition — mapping it through mapStatus would mark the
    // payment "paye" all over again.
    if (payload.refundId) {
      return {
        eventId: `refund:${payload.refundId}:${state}`,
        eventType: `refund.${state.toLowerCase()}`,
        // Refund callbacks reference the deposit they reverse, which is how
        // the payment row is found.
        providerRef: payload.depositId ?? "",
        status: mapStatus(state) === "paye" ? "rembourse" : mapStatus(state),
        failureReason: payload.failureReason?.failureMessage,
        raw: payload,
      } satisfies WebhookEvent;
    }

    if (payload.depositId) {
      return {
        // pawaPay callbacks carry no separate event id, so the idempotency
        // key is composed from the deposit and the state it reports. A retry
        // of the same transition collides; a genuine later transition does
        // not.
        eventId: `${payload.depositId}:${state}`,
        eventType: `deposit.${state.toLowerCase()}`,
        providerRef: payload.depositId,
        status: mapStatus(state),
        failureReason: payload.failureReason?.failureMessage,
        raw: payload,
      } satisfies WebhookEvent;
    }

    // Payouts and hosted Checkouts: the signature verified, so this is
    // genuinely from pawaPay, but we never initiate either. Acknowledged with
    // an empty providerRef so the route records it and returns 200 rather
    // than 400 — a rejection would put pawaPay into an endless retry loop
    // over a callback that will never become relevant.
    return {
      eventId: `unhandled:${payload.payoutId ?? rawBody.slice(0, 64)}:${state}`,
      eventType: "unhandled",
      providerRef: "",
      status: "en_cours",
      raw: payload,
    } satisfies WebhookEvent;
  },

  async getStatus(providerRef: string) {
    const { token, baseUrl } = config();

    const response = await fetch(`${baseUrl}/deposits/${providerRef}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`pawaPay status lookup failed (${response.status})`);
    }

    // The endpoint answers with an array holding the single deposit.
    const data = (await response.json()) as
      | { status?: string; failureReason?: { failureMessage?: string } }[]
      | { status?: string; failureReason?: { failureMessage?: string } };

    const deposit = Array.isArray(data) ? data[0] : data;

    return {
      status: mapStatus(deposit?.status ?? ""),
      failureReason: deposit?.failureReason?.failureMessage,
    };
  },

  async refund(providerRef: string): Promise<RefundResult> {
    const { token, baseUrl } = config();

    const response = await fetch(`${baseUrl}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refundId: randomUUID(), depositId: providerRef }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { refunded: false, reason: `${response.status}: ${body.slice(0, 200)}` };
    }

    const data = (await response.json()) as { refundId?: string };
    // Refunds are asynchronous too: accepted here means queued, and the
    // callback confirms. The admin UI shows "refund requested" accordingly.
    return { refunded: true, providerRefundRef: data.refundId };
  },
};
