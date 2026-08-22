import "server-only";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
import { pawapayProvider } from "./pawapay";
import { stripeProvider } from "./stripe";
import { paiementproProvider } from "./paiementpro";
import type { PaymentMethod, PaymentProvider, PaymentProviderId } from "./types";

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
 * Which rail handles a given country and method.
 *
 * Order matters: the first provider that claims support wins. pawaPay takes
 * mobile money where it operates; whichever card processor is configured takes
 * everything else.
 */
export function providerFor(
  country: Country,
  method: PaymentMethod,
): PaymentProvider | null {
  const providers: PaymentProvider[] = [pawapayProvider, cardProvider()];
  return providers.find((p) => p.supports(country, method)) ?? null;
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
 * non-negotiable rather than a later addition.
 */
export function availableMethods(country: Country): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (COUNTRY_PAYMENT[country].mobileMoney) methods.push("mobile_money");
  methods.push("card");
  return methods;
}
