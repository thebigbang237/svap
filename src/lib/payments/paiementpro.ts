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

/**
 * Paiement Pro — Visa/Mastercard acquiring, as a stand-in for Stripe until the
 * Stripe account is approved.
 *
 * Two things about this integration are unusual and drive its whole shape.
 *
 * 1. THE PUBLISHED INTEGRATION IS CLIENT-SIDE. Their SDK runs in the browser
 *    and sets `paiementPro.amount` there, which would let a candidate open
 *    devtools and pay $1 for a $330 pack. We do not use the SDK. It POSTs to
 *    `initialize.php` with a plain JSON body, so the same call is made from
 *    the server with the amount taken from PACK_SPECS — the browser never sees
 *    a figure it could change.
 *
 * 2. THE CALLBACK CANNOT BE VERIFIED. Their notification carries a `hashcode`
 *    described only as "chaîne cryptée pour garantir la sécurité des données",
 *    with no documented algorithm, so there is nothing to check it against. An
 *    unauthenticated callback that could mark a dossier paid is not acceptable,
 *    so the callback is treated as a *hint that something happened* and never
 *    as evidence: every notification triggers a lookup against their status
 *    API, and only that lookup — with the amount cross-checked against what we
 *    recorded — can settle a payment. A forged callback therefore achieves
 *    nothing beyond making us re-read the true status.
 *
 * Docs supplied by the client, 2026-08-20, plus the SDK source at
 * https://www.paiementpro.net/webservice/onlinepayment/js/paiementpro.v1.0.2.js
 */

const INIT_URL =
  "https://paiementpro.net/webservice/onlinepayment/js/initialize/initialize.php";
const STATUS_URL = "https://api.paiementpro.net/status";

/**
 * Observed behaviour of `initialize.php`, probed 2026-08-22 — none of it is
 * documented, and it cost an afternoon to establish, so it is written down.
 *
 *   • A JSON body IS parsed correctly. An incomplete payload returns HTTP 200
 *     with `{"error":"Veuillez renseigner les champs obligatoire",
 *     "success":false}`, which proves the request reached their validator.
 *   • A COMPLETE payload returns HTTP 500 with an EMPTY body. Bisecting the
 *     fields shows the flip happens on `customerPhoneNumber` — i.e. on the
 *     first payload that passes validation. Their code validates, then crashes.
 *   • Reproducible with an unknown merchant id, on both `paiementpro.net` and
 *     `www.paiementpro.net`, with and without browser Origin/Referer/UA
 *     headers, and for currency codes 840, 952 and 950. It is therefore their
 *     endpoint, not our payload, our account, or our currency.
 *   • `api.paiementpro.net/status/{ref}` was up and correct throughout, so the
 *     outage is scoped to initiation.
 *
 * Until they fix it, card payments through this provider cannot be initiated at
 * all. `createCheckout` surfaces that as a 502 with their response logged,
 * rather than anything that looks like the candidate's fault.
 */

/** Their `channel` for international cards. The rest of their codes are
 *  mobile money in markets pawaPay already covers better. */
const CARD_CHANNEL = "CARD";

/**
 * ISO 4217 numeric codes, which is what `countryCurrencyCode` expects. Their
 * SDK defaults to 952 (XOF) — wrong for us, since the card path quotes USD.
 *
 * ⚠️ Whether USD is enabled on the account is a question for Paiement Pro. If
 * it is not, an initiation fails immediately and visibly with their own error
 * rather than charging the wrong amount, which is the failure mode to want.
 */
const CURRENCY_CODES: Record<string, string> = {
  USD: "840",
  XOF: "952",
  XAF: "950",
  GHS: "936",
  KES: "404",
  MAD: "504",
  EGP: "818",
  ZAR: "710",
};

function config() {
  const merchantId = process.env.PAIEMENTPRO_MERCHANT_ID;
  if (!merchantId) {
    throw new PaymentConfigError("PAIEMENTPRO_MERCHANT_ID is not configured.");
  }
  return { merchantId };
}

interface StatusResponse {
  marchant_id?: string;
  pay_id?: string;
  reference?: string;
  amount?: number | string;
  channel?: string;
  token?: string;
  date?: string;
  success?: boolean;
  error?: string;
}

/**
 * The authoritative read. Unauthenticated, which is safe here only because our
 * references are random UUIDs — an enumerable reference would expose every
 * merchant's transactions to anyone who could count.
 */
async function fetchStatus(reference: string): Promise<StatusResponse | null> {
  const response = await fetch(
    `${STATUS_URL}/${encodeURIComponent(reference)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );

  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as StatusResponse | null;
}

/**
 * Their status response conflates "this transaction failed" with "no such
 * transaction": both come back as `success: false`, the latter carrying
 * `error: "Aucune transaction"`.
 *
 * That distinction decides whether a candidate is told their payment failed,
 * so it is resolved conservatively. A reference they have never heard of means
 * the payer has not finished at the gateway yet — that is pending, not failed.
 * The 48-hour ceiling in the reconciliation job is what eventually closes those
 * out, rather than a guess made seconds after the redirect.
 */
function interpret(
  body: StatusResponse | null,
  expectedAmount: number,
): { status: PaymentStatus; failureReason?: string } {
  if (!body) return { status: "en_cours" };

  if (body.success === true) {
    // The amount check is what stands in for a signature. Their gateway is the
    // only party that can make this endpoint report a completed payment, so a
    // match here means the money genuinely moved — and a mismatch means
    // something is wrong enough to stop rather than settle.
    const paid = Number(body.amount);
    if (Number.isFinite(paid) && Math.abs(paid - expectedAmount) > 0.01) {
      console.error(
        `Paiement Pro amount mismatch on ${body.reference}: gateway reports ${paid}, we recorded ${expectedAmount}.`,
      );
      return {
        status: "en_cours",
        failureReason: `amount_mismatch: gateway=${paid} expected=${expectedAmount}`,
      };
    }
    return { status: "paye" };
  }

  // Not yet known to them — the payer is still on the gateway, or never
  // arrived. Deliberately not a failure.
  if (!body.pay_id) return { status: "en_cours" };

  return { status: "echoue", failureReason: body.error ?? "refused" };
}

export const paiementproProvider: PaymentProvider = {
  id: "paiementpro",

  // Their callback has no verifiable signature, so it settles nothing on its
  // own — see the note at the top of this file.
  confirmsViaStatus: true,

  supports(_country: Country, method: PaymentMethod) {
    // Cards only. Their mobile-money channels cover West Africa plus Cameroun;
    // of our six countries that overlaps only Cameroun, where pawaPay already
    // gives us both operators, live availability and PIN-prompt instructions.
    return method === "card";
  },

  /**
   * 32 hex characters, no dashes. Their own example reference is a short
   * numeric string, so the field's real limit is unknown — a UUID stripped of
   * dashes is the shortest form that is still unguessable, which matters
   * because the status endpoint needs no authentication.
   */
  newReference() {
    return randomUUID().replace(/-/g, "");
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const { merchantId } = config();

    if (!input.reference) {
      throw new PaymentConfigError(
        "A reference must be generated and stored before initiating a Paiement Pro payment.",
      );
    }
    if (!input.customer) {
      throw new PaymentConfigError(
        "Paiement Pro requires the payer's name and phone in the initiation payload.",
      );
    }

    const currencyCode = CURRENCY_CODES[input.money.currency];
    if (!currencyCode) {
      throw new PaymentConfigError(
        `No Paiement Pro currency code for ${input.money.currency}.`,
      );
    }

    const response = await fetch(INIT_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        merchantId,
        amount: input.money.amountLocal,
        description: input.description,
        channel: CARD_CHANNEL,
        countryCurrencyCode: currencyCode,
        referenceNumber: input.reference,
        customerEmail: input.email,
        // Their field names are the wrong way round in their own docs
        // ("customerFirstName: Nom", "customerLastname: Prénoms"). Filled by
        // meaning, not by their labels.
        customerFirstName: input.customer.firstName,
        customerLastname: input.customer.lastName,
        customerPhoneNumber: input.customer.phone,
        notificationURL: input.notificationUrl ?? "",
        returnURL: input.returnUrl,
        returnContext: "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Paiement Pro initiation failed (${response.status}).`);
    }

    const data = (await response.json().catch(() => null)) as {
      url?: string;
      success?: boolean;
      error?: string;
    } | null;

    if (!data?.success || !data.url) {
      throw new Error(
        `Paiement Pro refused the initiation: ${data?.error ?? "no url returned"}`,
      );
    }

    return {
      providerRef: input.reference,
      redirectUrl: data.url,
      asynchronous: true,
    };
  },

  /**
   * Turns a notification into a *verified* event.
   *
   * Note what is ignored: `responsecode`, `amount` and `hashcode` from the
   * callback body. The only thing taken from it is the reference, because that
   * is the only field whose forgery gains an attacker nothing. Everything else
   * comes from their status API.
   */
  async verifyWebhook(rawBody, request) {
    const reference = await extractReference(rawBody, request);
    if (!reference) return null;

    const body = await fetchStatus(reference);

    // The amount cross-check needs the figure we recorded, which the caller
    // holds; `applyWebhookEvent` looks the payment up by providerRef. Passing
    // NaN here means `interpret` skips the comparison, so the route re-checks
    // through getStatus() before anything is settled — see the webhook route.
    const { status, failureReason } = interpret(body, Number.NaN);

    return {
      // Their callbacks carry no event id, so the key is the reference plus
      // the state we resolved: a retry of the same transition collides, a
      // genuine later one does not.
      eventId: `${reference}:${status}`,
      eventType: `payment.${status}`,
      providerRef: reference,
      status,
      failureReason,
      raw: { reference, status: body },
    } satisfies WebhookEvent;
  },

  async getStatus(providerRef: string, expectedAmount?: number) {
    const body = await fetchStatus(providerRef);
    return interpret(body, expectedAmount ?? Number.NaN);
  },

  async refund(): Promise<RefundResult> {
    // Their documentation exposes initiation and status only. Rather than
    // pretend, this fails loudly so an administrator goes to the Paiement Pro
    // back office instead of believing money has moved.
    return {
      refunded: false,
      reason:
        "Paiement Pro n'expose pas d'API de remboursement. Effectuez le remboursement depuis leur back-office, puis notez-le dans le journal.",
    };
  },
};

/**
 * Their notification format is not documented — it may be JSON, form-encoded,
 * or query parameters on the return URL. All three are accepted rather than
 * guessing: the reference is the only field read, and reading it from the
 * wrong place would mean silently dropping real settlements.
 */
async function extractReference(
  rawBody: string,
  request: Request,
): Promise<string | null> {
  const fromQuery = new URL(request.url).searchParams.get("referenceNumber");
  if (fromQuery) return fromQuery;

  if (rawBody) {
    try {
      const json = JSON.parse(rawBody) as {
        referenceNumber?: string;
        reference?: string;
      };
      if (json.referenceNumber) return json.referenceNumber;
      if (json.reference) return json.reference;
    } catch {
      const form = new URLSearchParams(rawBody);
      const value = form.get("referenceNumber") ?? form.get("reference");
      if (value) return value;
    }
  }

  return null;
}
