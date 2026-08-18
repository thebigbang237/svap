import "server-only";
import { randomUUID } from "node:crypto";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
import { verifyPawapaySignature } from "./pawapay-signature";
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

/**
 * Country calling codes, for normalising what a candidate types.
 *
 * pawaPay wants an MSISDN — country code included, no '+'. Candidates
 * overwhelmingly type their number the way they'd dial it locally ("6 70 00 00
 * 00"), which is not that. `predict-provider` sanitises the rest, but it needs
 * the country code to be there first.
 */
const CALLING_CODES: Partial<Record<Country, string>> = {
  cmr: "237",
  ken: "254",
  gha: "233",
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

/** Raised when pawaPay refuses the deposit outright, with its own wording. */
export class PawapayRejection extends Error {
  // Assigned explicitly rather than as a constructor parameter property: those
  // need a full TypeScript compile, and this module is loaded directly by the
  // diagnostic scripts under node's strip-only type handling.
  readonly failureCode: string;

  constructor(failureCode: string, message: string) {
    super(message);
    this.failureCode = failureCode;
  }
}

/**
 * Raised when we genuinely cannot tell whether the deposit was accepted — an
 * HTTP 500, a socket timeout, an `UNKNOWN_ERROR`.
 *
 * Distinct from PawapayRejection because the handling is opposite: a rejection
 * is safe to report as failed and retry, whereas this must NOT be, since the
 * deposit may be live. The caller leaves the payment pending for the
 * reconciliation cycle to resolve.
 */
export class PawapayIndeterminate extends Error {}

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
  /** e.g. "MTN" — the operator, as the payer knows it. */
  displayName: string;
  /**
   * The merchant name that appears on the PIN prompt, e.g. "PAWAPAY".
   *
   * NOT a label for the operator picker — an earlier version used it as one,
   * which showed every operator as "PAWAPAY" instead of MTN/Orange. Its actual
   * job is the waiting screen: telling the payer which name to expect on the
   * prompt is what stops a genuine request looking like a scam.
   */
  nameDisplayedToCustomer?: string;
  /** Operator logo served by pawaPay, so a newly-enabled operator needs no asset work. */
  logo?: string;
  currency: string;
  minAmount?: string;
  maxAmount?: string;
  /** NONE | TWO_PLACES — some rails reject fractional amounts outright. */
  decimalsInAmount?: string;
  /** OPERATIONAL | DELAYED | CLOSED */
  status?: string;
  /** PROVIDER_AUTH (PIN prompt) | PREAUTH | REDIRECT_AUTH */
  authType?: string;
  /** AUTOMATIC — prompt arrives by itself; MANUAL — the payer must dial in. */
  pinPrompt?: string;
  pinPromptRevivable?: boolean;
  /** Localised, step-by-step instructions for raising the PIN prompt. */
  pinPromptInstructions?: PinPromptInstructions;
}

export interface PinPromptInstructions {
  channels?: {
    type?: string;
    displayName?: Record<string, string>;
    quickLink?: string;
    instructions?: Record<string, { text?: string }[]>;
  }[];
}

export interface OperatorListing {
  /** Country calling code, shown in front of the phone input. */
  prefix?: string;
  operators: MobileMoneyOperator[];
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
interface ActiveConfResponse {
  companyName?: string;
  signatureConfiguration?: {
    signedRequestsOnly?: boolean;
    signedCallbacks?: boolean;
  };
  countries?: {
    country?: string;
    prefix?: string;
    providers?: {
      provider?: string;
      /** The operator: "MTN", "Orange". This is the picker's label. */
      displayName?: string;
      /** The MERCHANT, as shown on the PIN prompt — not an operator name. */
      nameDisplayedToCustomer?: string;
      logo?: string;
      currencies?: {
        currency?: string;
        operationTypes?: {
          DEPOSIT?: {
            minAmount?: string;
            maxAmount?: string;
            // The API reference documents the limits under these names while
            // the live API returns the pair above. Both are read, so a rename
            // in either direction doesn't silently disable the limit checks.
            minTransactionLimit?: string;
            maxTransactionLimit?: string;
            decimalsInAmount?: string;
            status?: string;
            authType?: string;
            pinPrompt?: string;
            pinPromptRevivable?: boolean;
            pinPromptInstructions?: PinPromptInstructions;
          };
        };
      }[];
    }[];
  }[];
}

/** Logged once per process, not per request — this is a config problem. */
let warnedAboutUnsignedCallbacks = false;

export async function listOperators(
  country: Country,
): Promise<OperatorListing> {
  if (!COUNTRY_PAYMENT[country].mobileMoney) return { operators: [] };

  const response = await pawapayFetch(
    `/v2/active-conf?country=${COUNTRY_CODES[country]}&operationType=DEPOSIT`,
  );

  if (!response.ok) {
    throw new Error(`pawaPay active-conf failed (${response.status})`);
  }

  const data = (await response.json()) as ActiveConfResponse;

  // pawaPay reports its own signing configuration here, which makes a
  // misconfigured account self-diagnosing: our callback endpoint refuses
  // unsigned callbacks, so with this off every callback is dropped and
  // settlement falls entirely to the poll and the reconciliation cron.
  if (
    data.signatureConfiguration &&
    data.signatureConfiguration.signedCallbacks === false &&
    !warnedAboutUnsignedCallbacks
  ) {
    warnedAboutUnsignedCallbacks = true;
    console.warn(
      "pawaPay account has signed callbacks DISABLED. Enable them in the " +
        "pawaPay dashboard (Settings → Signatures). Until then every callback " +
        "is refused and payments settle only via /api/payments/status and " +
        "/api/cron/payments.",
    );
  }

  const operators: MobileMoneyOperator[] = [];
  let prefix = CALLING_CODES[country];

  for (const entry of data.countries ?? []) {
    if (entry.prefix) prefix = entry.prefix;

    for (const provider of entry.providers ?? []) {
      for (const currency of provider.currencies ?? []) {
        const deposit = currency.operationTypes?.DEPOSIT;
        if (!deposit || !provider.provider) continue;

        // CLOSED means the operator isn't taking deposits at all. Offering it
        // would guarantee a failed payment. DELAYED is still offered — those
        // do settle, just slowly, and withholding the only operator a
        // candidate has is worse than a slow payment.
        if (deposit.status?.toUpperCase() === "CLOSED") continue;

        // Only PIN-prompt operators are offered. PREAUTH needs an OTP the
        // payer generates first, and REDIRECT_AUTH needs a hand-off to the
        // provider's own page — neither flow is built, and offering an
        // operator we cannot complete is worse than not listing it. None of
        // Cameroun, Kenya or Ghana uses them today; this is the guard for the
        // day pawaPay enables one on the account.
        if (deposit.authType && deposit.authType.toUpperCase() !== "PROVIDER_AUTH") {
          continue;
        }

        operators.push({
          provider: provider.provider,
          displayName: provider.displayName ?? provider.provider,
          nameDisplayedToCustomer: provider.nameDisplayedToCustomer,
          logo: provider.logo,
          currency: currency.currency ?? COUNTRY_PAYMENT[country].currency,
          minAmount: deposit.minAmount ?? deposit.minTransactionLimit,
          maxAmount: deposit.maxAmount ?? deposit.maxTransactionLimit,
          decimalsInAmount: deposit.decimalsInAmount,
          status: deposit.status,
          authType: deposit.authType,
          pinPrompt: deposit.pinPrompt,
          pinPromptRevivable: deposit.pinPromptRevivable,
          pinPromptInstructions: deposit.pinPromptInstructions,
        });
      }
    }
  }

  return { prefix, operators };
}

// ---------------------------------------------------------------------------
// Phone number validation
// ---------------------------------------------------------------------------

export interface PredictedProvider {
  /** MSISDN, sanitised by pawaPay — the form to send to /v2/deposits. */
  phoneNumber: string;
  /** pawaPay's guess at the operator for this number. */
  provider?: string;
  country?: string;
}

/**
 * Sanitises and validates a phone number, and predicts its operator.
 *
 * Worth the round trip for two reasons the docs are explicit about: several of
 * these countries don't strictly follow ITU E.164, so local heuristics get
 * leading zeros and digit counts wrong; and the returned MSISDN is the exact
 * form `/v2/deposits` expects, which removes a whole class of
 * INVALID_PHONE_NUMBER rejections after the candidate has already committed.
 *
 * Returns null when pawaPay says the number isn't valid.
 */
export async function predictProvider(
  phone: string,
  country?: Country,
): Promise<PredictedProvider | null> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Prepend the country code when the candidate typed a local number. Cheap
  // to get wrong in the other direction, so only when it's clearly missing.
  const callingCode = country ? CALLING_CODES[country] : undefined;
  const candidate =
    callingCode && !digits.startsWith(callingCode)
      ? `${callingCode}${digits.replace(/^0+/, "")}`
      : digits;

  const response = await pawapayFetch("/v2/predict-provider", {
    method: "POST",
    body: JSON.stringify({ phoneNumber: candidate }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    phoneNumber?: string;
    provider?: string;
    country?: string;
  };

  if (!data.phoneNumber) return null;

  return {
    phoneNumber: data.phoneNumber,
    provider: data.provider,
    country: data.country,
  };
}

/**
 * Formats the amount the way this operator will accept it.
 *
 * Two rails' worth of rejections avoided here: `decimalsInAmount: "NONE"`
 * means a fractional amount is refused outright (INVALID_AMOUNT), and every
 * operator has wallet limits (AMOUNT_OUT_OF_BOUNDS). Both are known before
 * initiation, so neither should ever reach the candidate as a failed payment.
 */
export function formatAmountForOperator(
  amountLocal: number,
  operator: Pick<MobileMoneyOperator, "decimalsInAmount" | "minAmount" | "maxAmount">,
): { amount: string } | { error: "too_small" | "too_large"; limit: string } {
  const rounded =
    operator.decimalsInAmount?.toUpperCase() === "TWO_PLACES"
      ? Math.round(amountLocal * 100) / 100
      : Math.round(amountLocal);

  if (operator.minAmount && rounded < Number(operator.minAmount)) {
    return { error: "too_small", limit: operator.minAmount };
  }
  if (operator.maxAmount && rounded > Number(operator.maxAmount)) {
    return { error: "too_large", limit: operator.maxAmount };
  }

  return {
    amount:
      operator.decimalsInAmount?.toUpperCase() === "TWO_PLACES"
        ? rounded.toFixed(2)
        : String(rounded),
  };
}

export const pawapayProvider: PaymentProvider = {
  id: "pawapay",

  supports(country: Country, method: PaymentMethod) {
    return method === "mobile_money" && COUNTRY_PAYMENT[country].mobileMoney;
  },

  // The depositId. Generated here and persisted by the caller BEFORE the
  // deposit is initiated — see PaymentProvider.newReference.
  newReference() {
    return randomUUID();
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
    if (!input.reference) {
      throw new PaymentConfigError(
        "A depositId must be generated and stored before initiating a pawaPay deposit.",
      );
    }

    const depositId = input.reference;

    let response: Response;
    try {
      response = await pawapayFetch("/v2/deposits", {
        method: "POST",
        body: JSON.stringify({
          depositId,
          payer: {
            type: "MMO",
            accountDetails: {
              // Already an MSISDN: the checkout route runs it through
              // predict-provider, which is what pawaPay asks for.
              phoneNumber: input.phone.replace(/\D/g, ""),
              provider: input.operator,
            },
          },
          amount: input.amountOverride ?? String(input.money.amountLocal),
          currency: input.money.currency,
          clientReferenceId: input.candidatureId,
          // 4–22 characters, and it appears on the payer's own statement.
          customerMessage: "SVAP 2026",
        }),
      });
    } catch (error) {
      // Socket timeout, DNS, TLS — the request may or may not have landed.
      // Never report this as a failure: the deposit could be live and a retry
      // would charge the candidate twice.
      throw new PawapayIndeterminate(
        `pawaPay deposit initiation did not complete: ${(error as Error).message}`,
      );
    }

    const raw = await response.text().catch(() => "");
    let data: {
      status?: string;
      failureReason?: { failureCode?: string; failureMessage?: string };
    } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      /* handled below by the !response.ok branch */
    }

    const failureCode = data.failureReason?.failureCode?.toUpperCase();

    if (!response.ok) {
      // Documented explicitly: on a 5xx or UNKNOWN_ERROR the outcome is
      // unknown and must be resolved with a status check, never assumed
      // failed.
      if (response.status >= 500 || failureCode === "UNKNOWN_ERROR") {
        throw new PawapayIndeterminate(
          `pawaPay deposit returned ${response.status} (${failureCode ?? "no code"}) — status unknown.`,
        );
      }
      throw new PawapayRejection(
        failureCode ?? "HTTP_ERROR",
        data.failureReason?.failureMessage ??
          `pawaPay deposit failed (${response.status}): ${raw.slice(0, 200)}`,
      );
    }

    const status = data.status?.toUpperCase();

    if (status === "REJECTED") {
      throw new PawapayRejection(
        failureCode ?? "REJECTED",
        data.failureReason?.failureMessage ?? "pawaPay rejected the deposit.",
      );
    }

    // Should be unreachable — every depositId is a fresh UUID — but if it
    // happens, the deposit already exists and its real state has to be read
    // rather than guessed.
    if (status === "DUPLICATE_IGNORED") {
      throw new PawapayIndeterminate(
        `pawaPay reports depositId ${depositId} as a duplicate — reconcile against the existing deposit.`,
      );
    }

    return { providerRef: depositId, asynchronous: true };
  },

  async verifyWebhook(rawBody, request) {
    // RFC-9421, verified against pawaPay's published public key — see
    // pawapay-signature.ts. Fails closed: an unverifiable callback is
    // indistinguishable from a forged one, and this endpoint is the only thing
    // that can mark a dossier paid without the candidate present.
    const { token, baseUrl } = config();

    const verified = await verifyPawapaySignature({
      rawBody,
      headers: request.headers,
      method: request.method,
      path: new URL(request.url).pathname,
      baseUrl,
      token,
    });

    if (!verified) return null;

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
