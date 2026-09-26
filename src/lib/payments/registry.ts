import "server-only";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
import { pawapayProvider } from "./pawapay";
import { stripeProvider } from "./stripe";
import { paiementproProvider } from "./paiementpro";
import { convertUsd, moneyIn, roundLocal, usdOnly } from "./fx";
import { localForFee, feeForLocal, type Surcharge } from "./paiementpro-amount";
import type {
  Money,
  PaymentMethod,
  PaymentProvider,
  PaymentProviderId,
} from "./types";

/**
 * Which processor takes card payments.
 *
 * `CARD_PROVIDER=paiementpro` while the Stripe account is pending; unset or
 * `stripe` once it clears. A variable rather than an edit here because the
 * switch happens under time pressure, possibly by someone who isn't going to
 * redeploy — and because it lets the two be compared in staging without a
 * branch.
 *
 * Only the *choice* is dynamic. Both adapters stay registered so that
 * `providerById` can still resolve a payment taken by the other one: after a
 * switch there are live rows referencing the old processor, and their webhooks,
 * status polls and reconciliation must keep working.
 */
function cardProvider(): PaymentProvider {
  return process.env.CARD_PROVIDER === "paiementpro"
    ? paiementproProvider
    : stripeProvider;
}

/**
 * PayPal, through Paiement Pro's hosted page.
 *
 * Off unless `PAIEMENTPRO_PAYPAL=true`, independently of CARD_PROVIDER: the
 * PAYPAL channel has to be enabled on the merchant account first, and a
 * button the gateway then refuses is worse than no button.
 */
function paypalProvider(): PaymentProvider | null {
  return process.env.PAIEMENTPRO_PAYPAL === "true" ? paiementproProvider : null;
}

/**
 * Which rail handles a given country and method.
 *
 * Order matters: the first provider that claims support wins. pawaPay takes
 * mobile money where it operates; whichever card processor is configured takes
 * cards. PayPal is routed on its own, since Paiement Pro would otherwise claim
 * it whenever it is the card processor, switched on or not.
 */
export function providerFor(
  country: Country,
  method: PaymentMethod,
): PaymentProvider | null {
  if (method === "paypal") return paypalProvider();
  const providers: PaymentProvider[] = [pawapayProvider, cardProvider()];
  return providers.find((p) => p.supports(country, method)) ?? null;
}

/**
 * Paiement Pro's own charges, which the programme absorbs rather than passing
 * on. Overridable without a deploy, because they are *their* numbers and can
 * change with no notice — `scripts/paiementpro-calibrate.mjs` measures them.
 */
function surcharge(): Surcharge {
  return {
    xofPerUsd: Number(process.env.PAIEMENTPRO_XOF_PER_USD ?? 540),
    fixedUsd: Number(process.env.PAIEMENTPRO_SURCHARGE_FIXED_USD ?? 1),
    bufferPct: Number(process.env.PAIEMENTPRO_RATE_BUFFER_PCT ?? 0),
  };
}

/**
 * What a payment will cost, on every rail: the amount we ask the rail for, and
 * the amount the candidate's account is actually debited.
 *
 * The two differ only for Paiement Pro, and that difference is the whole
 * reason this function exists. They take CFA francs, convert them back to USD
 * at their own rate, and add a margin plus a flat dollar — so a fee converted
 * straight across arrives at the payer as something larger. A candidate quoted
 * $30 was asked for $34.92, which is how this was found.
 *
 * So the francs are computed *backwards from the fee*: enough that their
 * arithmetic lands on $30, and the programme absorbs what they take. Every
 * caller — the payment page, the checkout, the receipt — asks this one
 * function, so the figure shown, charged and receipted cannot drift apart.
 */
export interface Quote {
  /** What the rail is asked for. Goes on the payment row. */
  money: Money;
  /** What the candidate's account is debited, in the currency they'll see. */
  charged: { amount: number; currency: string };
}

export async function quoteFor(
  method: PaymentMethod,
  country: Country,
  amountUsd: number,
): Promise<Quote> {
  if (method === "mobile_money") {
    // pawaPay debits exactly what we ask for, in the candidate's own currency.
    const money = await convertUsd(amountUsd, country);
    return {
      money,
      charged: { amount: money.amountLocal, currency: money.currency },
    };
  }

  const provider = method === "paypal" ? paiementproProvider : cardProvider();
  const currency = provider.chargeCurrency;

  // Stripe: billed in USD, nothing added.
  if (!currency) {
    return {
      money: usdOnly(amountUsd),
      charged: { amount: amountUsd, currency: "USD" },
    };
  }

  const s = surcharge();
  const amountLocal = roundLocal(localForFee(amountUsd, s), currency);

  return {
    // The rate recorded is THEIRS, not the market's: it is the rate this
    // amount was actually computed with, and a receipt has to be able to
    // explain the figure it shows.
    money: moneyIn(
      amountUsd,
      amountLocal,
      currency,
      s.xofPerUsd,
      "paiementpro:fixed-rate",
    ),
    // What their page will show — the advertised fee, by construction, and
    // never above it.
    charged: {
      amount: Math.round(feeForLocal(amountLocal, s) * 100) / 100,
      currency: "USD",
    },
  };
}

/** Every adapter, configured or not — see `cardProvider`. */
const ALL_PROVIDERS: PaymentProvider[] = [
  pawapayProvider,
  stripeProvider,
  paiementproProvider,
];

export function providerById(id: PaymentProviderId): PaymentProvider | null {
  return ALL_PROVIDERS.find((p) => p.id === id) ?? null;
}

/**
 * Methods a candidate in this country can actually choose.
 *
 * Card is always available; mobile money only where pawaPay operates, which
 * is three of the six participating countries. Morocco, Egypt and South
 * Africa are card-only — which is precisely why a card processor was
 * non-negotiable rather than a later addition. PayPal, once switched on, is
 * offered everywhere as the fallback for a card its issuer won't let pay
 * abroad.
 */
export function availableMethods(country: Country): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (COUNTRY_PAYMENT[country].mobileMoney) methods.push("mobile_money");
  methods.push("card");
  if (paypalProvider()) methods.push("paypal");
  return methods;
}
