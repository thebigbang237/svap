import "server-only";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
import { pawapayProvider } from "./pawapay";
import { stripeProvider } from "./stripe";
import { paiementproProvider } from "./paiementpro";
import { convertUsdTo, usdOnly } from "./fx";
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
 * What a card or PayPal payment is charged in, by the provider that takes it.
 *
 * Shared by the checkout and the payment page, so the figure the candidate is
 * shown is the figure that gets charged. Stripe takes USD; Paiement Pro reads
 * every amount as CFA francs, so the fee has to be converted first.
 */
export function hostedMoney(
  method: "card" | "paypal",
  amountUsd: number,
): Money {
  const provider = method === "paypal" ? paiementproProvider : cardProvider();
  const currency = provider.chargeCurrency;
  return currency ? convertUsdTo(amountUsd, currency) : usdOnly(amountUsd);
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
