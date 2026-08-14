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
 * Written against the **v2** API. v1 named the mobile money operator
 * `correspondent` at the top level of `payer`; v2 renames it to `provider` and
 * moves it inside `accountDetails`, alongside `phoneNumber`. Sending the v1
 * shape fails with `Missing required creator property 'correspondent'`.
 *
 * Deposits are ASYNCHRONOUS by nature: pawaPay pushes a prompt to the payer's
 * handset, they approve it with their PIN, and settlement lands seconds to
 * minutes later via callback. Nothing here can be resolved from the browser,
 * which is why `asynchronous` is true and the UI polls `getStatus`.
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
    baseUrl: process.env.PAWAPAY_ENV === "live" ? LIVE_BASE : SANDBOX_BASE,
  };
}

/**
 * v2 deposit states → our lifecycle.
 *
 * ACCEPTED / PROCESSING mean the prompt is with the payer.
 * IN_RECONCILIATION means pawaPay is still resolving it with the operator —
 * deliberately NOT treated as failed, because those frequently settle.
 */
function mapStatus(raw: string | undefined): PaymentStatus {
  switch (raw?.toUpperCase()) {
    case "COMPLETED":
      return "paye";
    case "FAILED":
    case "REJECTED":
      return "echoue";
    case "CANCELLED":
      return "annule";
    default:
      return "en_cours";
  }
}

async function pawapayFetch(path: string, init?: RequestInit) {
  const { token, baseUrl } = config();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

// ---------------------------------------------------------------------------
// Operator discovery
// ---------------------------------------------------------------------------

export interface MobileMoneyOperator {
  /** e.g. "MTN_MOMO_CMR" — goes into the deposit payload verbatim. */
  provider: string;
  /** e.g. "MTN MoMo" — what the payer actually recognises. */
  displayName: string;
  currency: string;
  minAmount?: string;
  maxAmount?: string;
  /** OPERATIONAL | DELAYED | CLOSED */
  status?: string;
}

/**
 * Which operators can actually take a deposit in this country, right now.
 *
 * v2 requires the operator id in the deposit payload, so it can't be guessed —
 * and hard-coding a list would go stale silently the moment pawaPay enables a
 * new one or takes another offline for maintenance. `/v2/active-conf` reports
 * exactly what *this account* is configured for, including per-operator
 * availability, so a CLOSED operator is never offered to a candidate.
 */
export async function listOperators(
  country: Country,
): Promise<MobileMoneyOperator[]> {
  if (!COUNTRY_PAYMENT[country].mobileMoney) return [];

  const response = await pawapayFetch(
    `/v2/active-conf?country=${COUNTRY_CODES[country]}&operationType=DEPOSIT`,
  );

  if (!response.ok) {
    throw new Error(`pawaPay active-conf failed (${response.status})`);
  }

  const data = (await response.json()) as {
    countries?: {
      country?: string;
      providers?: {
        provider?: string;
        displayName?: string;
        nameDisplayedToCustomer?: string;
        currencies?: {
          currency?: string;
          operationTypes?: {
            DEPOSIT?: {
              minAmount?: string;
              maxAmount?: string;
              status?: string;
            };
          };
        }[];
      }[];
    }[];
  };

  const operators: MobileMoneyOperator[] = [];

  for (const entry of data.countries ?? []) {
    for (const provider of entry.providers ?? []) {
      for (const currency of provider.currencies ?? []) {
        const deposit = currency.operationTypes?.DEPOSIT;
        if (!deposit || !provider.provider) continue;
        // CLOSED means the operator isn't taking deposits at all. Offering it
        // would guarantee a failed payment.
        if (deposit.status && deposit.status.toUpperCase() === "CLOSED") continue;

        operators.push({
          provider: provider.provider,
          displayName:
            provider.nameDisplayedToCustomer ??
            provider.displayName ??
            provider.provider,
          currency: currency.currency ?? COUNTRY_PAYMENT[country].currency,
          minAmount: deposit.minAmount,
          maxAmount: deposit.maxAmount,
          status: deposit.status,
        });
      }
    }
  }

  return operators;
}

export const pawapayProvider: PaymentProvider = {
  id: "pawapay",

  supports(country: Country, method: PaymentMethod) {
    return method === "mobile_money" && COUNTRY_PAYMENT[country].mobileMoney;
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!input.phone) {
      throw new PaymentConfigError(
        "A phone number is required for a mobile money deposit.",
      );
    }
    if (!input.operator) {
      throw new PaymentConfigError(
        "A mobile money operator is required — v2 deposits carry the provider in the payload.",
      );
    }

    // We generate the id rather than letting pawaPay assign one, so the row
    // exists under a known reference before the network call — a timeout
    // then leaves a payment we can poll, not an orphaned charge.
    const depositId = randomUUID();

    const response = await pawapayFetch("/v2/deposits", {
      method: "POST",
      body: JSON.stringify({
        depositId,
        payer: {
          type: "MMO",
          accountDetails: {
            // Digits only, no '+' — pawaPay rejects the E.164 prefix here.
            phoneNumber: input.phone.replace(/\D/g, ""),
            provider: input.operator,
          },
        },
        amount: String(input.money.amountLocal),
        currency: input.money.currency,
        clientReferenceId: input.candidatureId,
        // 4–22 characters, and it appears on the payer's own statement.
        customerMessage: "SVAP 2026",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `pawaPay deposit failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    // v2 initiation returns ACCEPTED | REJECTED | DUPLICATE_IGNORED.
    const data = (await response.json()) as {
      status?: string;
      failureReason?: { failureMessage?: string };
    };

    if (data.status && data.status.toUpperCase() === "REJECTED") {
      throw new Error(
        `pawaPay rejected the deposit: ${data.failureReason?.failureMessage ?? "unknown reason"}`,
      );
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

    // v2 consolidated rejectionReason/failureReason/error into one
    // `failureReason: { failureCode, failureMessage }`.
    const payload = JSON.parse(rawBody) as {
      depositId?: string;
      refundId?: string;
      payoutId?: string;
      status?: string;
      failureReason?: { failureCode?: string; failureMessage?: string };
    };

    const state = payload.status ?? "unknown";
    const failureReason = payload.failureReason?.failureMessage;

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
        failureReason,
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
        failureReason,
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
    const response = await pawapayFetch(`/v2/deposits/${providerRef}`);

    if (!response.ok) {
      throw new Error(`pawaPay status lookup failed (${response.status})`);
    }

    // v2 wraps the result: { status: FOUND | NOT_FOUND, data: { ... } }.
    const body = (await response.json()) as {
      status?: string;
      data?: {
        status?: string;
        failureReason?: { failureMessage?: string };
      };
    };

    if (body.status === "NOT_FOUND") {
      // The deposit we created isn't known to pawaPay. Reporting "still
      // pending" would poll forever, so surface it as failed and let the
      // candidate retry.
      return { status: "echoue" as PaymentStatus, failureReason: "NOT_FOUND" };
    }

    return {
      status: mapStatus(body.data?.status),
      failureReason: body.data?.failureReason?.failureMessage,
    };
  },

  async refund(providerRef: string): Promise<RefundResult> {
    const response = await pawapayFetch("/v2/refunds", {
      method: "POST",
      body: JSON.stringify({ refundId: randomUUID(), depositId: providerRef }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        refunded: false,
        reason: `${response.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      refundId?: string;
      status?: string;
      failureReason?: { failureMessage?: string };
    };

    if (data.status && data.status.toUpperCase() === "REJECTED") {
      return {
        refunded: false,
        reason: data.failureReason?.failureMessage ?? "rejected",
      };
    }

    // Refunds are asynchronous too: accepted here means queued, and the
    // callback confirms. The admin UI shows "refund requested" accordingly.
    return { refunded: true, providerRefundRef: data.refundId };
  },
};
