import "server-only";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
import { pawapayProvider } from "./pawapay";
import { stripeProvider } from "./stripe";
import type { PaymentMethod, PaymentProvider, PaymentProviderId } from "./types";

/**
 * Which rail handles a given country and method.
 *
 * Order matters: the first provider that claims support wins. Adding
 * Flutterwave later — for local card acquiring in Morocco, Egypt and South
 * Africa if Stripe's decline rates on African-issued cards prove too high —
 * means inserting it ahead of Stripe here and nothing else.
 */
const PROVIDERS: PaymentProvider[] = [pawapayProvider, stripeProvider];

export function providerFor(
  country: Country,
  method: PaymentMethod,
): PaymentProvider | null {
  return PROVIDERS.find((p) => p.supports(country, method)) ?? null;
}

export function providerById(id: PaymentProviderId): PaymentProvider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
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
