import "server-only";
import { randomUUID } from "node:crypto";
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
import { verifySaspaySignature } from "./saspay-signature";
import type { MobileMoneyOperator, OperatorListing } from "./pawapay";

/**
 * SasPay — mobile money in Ghana.
 *
 * Why a second mobile-money rail at all: pawaPay provisions wallets per
 * country, and enabling Ghana on that account requires documents the
 * programme cannot produce. Ghanaian candidates were left with no working
 * method — mobile money unavailable, and cards refused by PayPal, which is
 * what Paiement Pro settles them through. This closes that.
 *
 * Scoped to Ghana deliberately. Cameroun and Kenya already settle through
 * pawaPay, which gives us signed callbacks and PIN-prompt instructions per
 * operator; moving them here would trade something proven for something new.
 *
 * Two things shape this adapter:
 *
 * 1. BOTH HALVES OF TRUST ARE AVAILABLE HERE, unlike on the Paiement Pro rail.
 *    Callbacks are signed (HMAC-SHA256, see `saspay-signature.ts`), so a
 *    forgery is refused outright; and `GET /payments/{id}/verify/` re-checks
 *    with the gateway rather than replaying a remembered status, so what
 *    settles a dossier is their API's answer, not the callback's claim. The
 *    signature says who sent it, the verify call says what happened — nothing
 *    here ever needs a human to confirm it.
 *
 * 2. SOFTPAY IS NOT ALWAYS A PUSH. Their own warning: when `checkout_url`
 *    comes back non-empty the payer gets NO prompt on their phone and must be
 *    redirected, and a network can switch between the two modes without
 *    notice. Both are handled below; treating it as a push only would strand
 *    payers on a waiting screen for a prompt that was never sent.
 *
 * Docs: https://docs.saspay.me/api-reference — read 2026-09-30.
 */

const BASE_URL = "https://api.saspay.me/api/v1";

/** Their ISO-2 country code, for the countries we route here. */
const COUNTRY_CODES: Partial<Record<Country, string>> = { gha: "GH" };

/**
 * A network whose `payin.otp_required` is true needs a code the payer fetches
 * by USSD *before* paying, passed as `otp` on initiation. That is a second
 * input on the payment form and a flow we have not built, so such a network is
 * not offered — the same rule the pawaPay adapter applies to non-PIN-prompt
 * operators. Today it is Orange Money CI and BF only; none in Ghana.
 */
const OTP_NETWORKS_UNSUPPORTED = true;

function config() {
  const apiKey = process.env.SASPAY_API_KEY;
  if (!apiKey) {
    throw new PaymentConfigError("SASPAY_API_KEY is not configured.");
  }
  return { apiKey };
}

/** Which countries this adapter is allowed to take. Ghana unless told otherwise. */
function countries(): Country[] {
  const raw = process.env.SASPAY_COUNTRIES ?? "gha";
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is Country => c in COUNTRY_CODES);
}

/**
 * Their responses are wrapped: `{ "success": true, "data": … }`, where `data`
 * is an array, an object, or `{ count, next, previous, results }` when paged.
 *
 * ⚠️ The documented examples show the inner object ALONE, with no envelope —
 * so code written from the docs reads `body.id` and finds nothing. That cost
 * an evening: the rate card came back as an envelope, was read as an empty
 * array, and reported "this account has no networks" for an account that had
 * fifty-one. Unwrapping here, rather than at each call site, means one place
 * to be wrong.
 */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Their error text, from wherever this particular endpoint put it. */
function errorText(body: unknown): string {
  const outer = (body ?? {}) as { message?: string; code?: string };
  const inner = (unwrap<{ message?: string; code?: string }>(body) ?? {}) as {
    message?: string;
    code?: string;
  };
  const code = outer.code ?? inner.code;
  const message = outer.message ?? inner.message;
  return [code, message].filter(Boolean).join(": ") || "no detail";
}

async function saspayFetch(
  path: string,
  init?: RequestInit & { revalidate?: number },
) {
  const { apiKey } = config();
  const { revalidate, ...rest } = init ?? {};

  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    // Anything about a specific payment is read fresh; only the rate card,
    // which is merchant configuration, is worth caching.
    ...(revalidate === undefined
      ? { cache: "no-store" as const }
      : { next: { revalidate } }),
  });
}

/**
 * Their five transaction states, mapped onto ours.
 *
 * `EXPIRED` is a payer who never approved the prompt — a failure the candidate
 * can act on by trying again, not an error to hide, so it lands as `echoue`
 * rather than being left pending forever.
 */
function mapStatus(raw: string | undefined): PaymentStatus {
  switch (raw?.toUpperCase()) {
    case "SUCCESS":
      return "paye";
    case "FAILED":
    case "EXPIRED":
      return "echoue";
    case "CANCELLED":
      return "annule";
    default:
      return "en_cours";
  }
}

interface VerifyResponse {
  id?: string;
  reference?: string;
  status?: string;
  requested_amount?: string;
  debited_amount?: string;
  net_amount?: string;
  currency?: string;
  external_reference?: string;
  message?: string;
  code?: string;
}

/**
 * What the payer was actually asked for, against what we recorded.
 *
 * `requested_amount` is the figure we sent. `debited_amount` is what left
 * their account, which differs when fees are added on — we ask for them to be
 * DEDUCTED instead, so the two match and the payer sees the sum we quoted.
 * Either is accepted here: a fee mode changed in their dashboard should not
 * strand a payment that genuinely happened.
 */
function amountMatches(body: VerifyResponse, expectedLocal: number): boolean {
  const candidates = [body.requested_amount, body.debited_amount]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return candidates.some((value) => Math.abs(value - expectedLocal) <= 0.01);
}

export const saspayProvider: PaymentProvider = {
  id: "saspay",

  supports(country: Country, method: PaymentMethod) {
    // Unconfigured means unsupported, rather than claiming the country and
    // failing at checkout: `providerFor` then falls through to pawaPay.
    if (!process.env.SASPAY_API_KEY) return false;
    return method === "mobile_money" && countries().includes(country);
  },

  /**
   * The operators this merchant can actually collect through, from the rate
   * card rather than a hard-coded list: it reports availability per network
   * for *this* account, so a network not yet enabled is never offered.
   */
  async listOperators(country: Country): Promise<OperatorListing> {
    const code = COUNTRY_CODES[country];
    if (!code) return { operators: [] };

    // Merchant configuration, not payment state: worth five minutes of cache
    // on a page every candidate loads.
    const response = await saspayFetch("/pricing/my-rates/", { revalidate: 300 });

    if (!response.ok) {
      throw new Error(`SasPay my-rates failed (${response.status}).`);
    }

    const rates = unwrap<
      {
        country_code?: string;
        currency?: string;
        network_code?: string;
        network_name?: string;
        payin?: {
          available?: boolean;
          otp_required?: boolean;
          tiers?: { min_amount?: string; max_amount?: string }[];
        };
      }[]
    >(await response.json());

    const operators: MobileMoneyOperator[] = [];

    for (const rate of Array.isArray(rates) ? rates : []) {
      if (rate.country_code !== code) continue;
      if (!rate.payin?.available || !rate.network_code) continue;
      if (OTP_NETWORKS_UNSUPPORTED && rate.payin.otp_required) {
        console.warn(
          `SasPay ${rate.network_code} requires a pre-payment OTP — not offered, that flow is not built.`,
        );
        continue;
      }

      const tier = rate.payin.tiers?.[0];

      operators.push({
        provider: rate.network_code,
        displayName: rate.network_name ?? rate.network_code,
        currency: rate.currency ?? "GHS",
        minAmount: tier?.min_amount,
        maxAmount: tier?.max_amount,
        status: "OPERATIONAL",
      });
    }

    if (operators.length === 0) {
      console.warn(
        `SasPay returned no available payin network for ${country}. Check the account is enabled for that market.`,
      );
    }

    return { prefix: "233", operators };
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const code = COUNTRY_CODES[input.country];
    if (!code) {
      throw new PaymentConfigError(`SasPay does not cover ${input.country}.`);
    }
    if (!input.operator) {
      throw new PaymentConfigError("SasPay needs the network code to charge.");
    }
    if (!input.phone) {
      throw new PaymentConfigError("SasPay needs the payer's phone number.");
    }
    if (!input.customer) {
      throw new PaymentConfigError("SasPay requires the payer's name.");
    }

    const response = await saspayFetch("/payments/softpay/", {
      method: "POST",
      headers: {
        // Without it a retried request pushes a SECOND prompt to the payer's
        // handset; with it, the original response comes back instead. A
        // timeout is never proof that the request failed.
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        amount: (input.amountOverride ?? input.money.amountLocal).toString(),
        currency: input.money.currency,
        country: code,
        description: input.description,
        network: input.operator,
        customer: {
          email: input.email,
          first_name: input.customer.firstName,
          last_name: input.customer.lastName,
          // Local, international with or without '+' are all accepted and
          // normalised their side.
          phone: input.phone,
        },
        // The programme absorbs the fee, as it does on the card rail: the
        // candidate is debited exactly the amount the payment page quoted.
        fee_charge_mode: "DEDUCTED",
        // Only for the hosted-page case; harmless on a push.
        return_url: input.returnUrl,
        metadata: { candidature_id: input.candidatureId },
      }),
    });

    const body = await response.json().catch(() => null);
    const data = unwrap<{
      id?: string;
      status?: string;
      checkout_url?: string;
    } | null>(body);

    if (!response.ok || !data?.id) {
      // Their 422 codes name the cause precisely — invalid_method,
      // no_route_available, prepayment_otp_missing — so log it rather than
      // flattening it into "payment failed".
      throw new Error(
        `SasPay refused the payment (${response.status}) — ${errorText(body)}`,
      );
    }

    return {
      providerRef: data.id,
      // ⚠️ Non-empty means NO prompt was sent and the payer must be
      // redirected. Their docs are explicit that a network can switch between
      // the two modes without notice, so this is read every time rather than
      // assumed per operator.
      redirectUrl: data.checkout_url || undefined,
      asynchronous: true,
    };
  },

  /**
   * Verifies a callback, then parses it.
   *
   * Their signature is real and documented at webhook creation — HMAC-SHA256
   * over `<timestamp>.<raw body>` — so a forged delivery is rejected here
   * rather than merely being second-guessed later. `confirmEvent` still
   * re-reads the payment from their API before anything settles: the
   * signature proves who sent it, the verify call proves what happened.
   */
  async verifyWebhook(rawBody, request) {
    const secret = process.env.SASPAY_WEBHOOK_SECRET;

    if (!secret) {
      // Fail closed, and say why: with no secret every callback is refused,
      // and payments then settle only through the poll and the cron — quietly
      // slower, with nothing obviously broken.
      console.error(
        "SASPAY_WEBHOOK_SECRET is not set — every SasPay callback is refused.",
      );
      return null;
    }

    if (
      !verifySaspaySignature(
        rawBody,
        {
          signature: request.headers.get("x-webhook-signature"),
          timestamp: request.headers.get("x-webhook-timestamp"),
        },
        secret,
      )
    ) {
      console.warn("SasPay callback refused: bad signature or stale timestamp.");
      return null;
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      data?: { id?: string; status?: string };
    };

    const id = event?.data?.id;
    if (!id) return null;

    return {
      eventId: `${id}:${event.event ?? "unknown"}`,
      eventType: event.event ?? "transaction.unknown",
      providerRef: id,
      // Provisional. confirmEvent replaces it with what their API says.
      status: "en_cours",
      raw: event,
    } satisfies WebhookEvent;
  },

  /**
   * The callback said something happened; this establishes what.
   *
   * `verify` re-checks with the gateway whenever the stored status is still
   * pending, so its answer is evidence rather than a repeated claim — which is
   * why a SasPay settlement is `gateway_status` and never needs a human to
   * confirm it.
   */
  async confirmEvent(event, expected) {
    const live = await this.getStatus!(event.providerRef, expected);
    return { ...live, settlementSource: "gateway_status" };
  },

  async getStatus(
    providerRef: string,
    expected?: { amountLocal: number; amountUsd: number },
  ) {
    const response = await saspayFetch(
      `/payments/${encodeURIComponent(providerRef)}/verify/`,
    );

    if (response.status === 404) {
      // Not a payment they know. Deliberately not a failure: the reconciliation
      // cycle closes it out rather than telling a candidate their money is gone.
      return { status: "en_cours" as PaymentStatus };
    }

    if (!response.ok) {
      throw new Error(`SasPay verify failed (${response.status}).`);
    }

    const body = unwrap<VerifyResponse>(await response.json());
    const status = mapStatus(body.status);

    // The amount check is what stops a payment settling a dossier it doesn't
    // cover — a part-payment, or a reference crossed with another charge.
    if (status === "paye" && expected && !amountMatches(body, expected.amountLocal)) {
      console.error(
        `SasPay amount mismatch on ${providerRef}: requested=${body.requested_amount} debited=${body.debited_amount}, we recorded ${expected.amountLocal}.`,
      );
      return {
        status: "en_cours" as PaymentStatus,
        failureReason: `amount_mismatch: requested=${body.requested_amount} expected=${expected.amountLocal}`,
      };
    }

    return { status };
  },

  async refund(): Promise<RefundResult> {
    // They expose payouts, not refunds: sending money back is a separate
    // transfer from the merchant balance, with its own fees and no link to the
    // original payment. Rather than dress that up as a refund, this fails
    // loudly so an administrator does it deliberately from their dashboard.
    return {
      refunded: false,
      reason:
        "SasPay n'expose pas de remboursement lié au paiement d'origine. Effectuez un payout depuis leur tableau de bord, puis notez-le dans le journal.",
    };
  },
};
