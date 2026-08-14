import type { Country } from "@/lib/constants/program";

/**
 * Provider-agnostic payment contract.
 *
 * Two rails ship: pawaPay for mobile money (Cameroun, Kenya, Ghana) and
 * Stripe for cards (all six countries — mandatory for Morocco, Egypt and
 * South Africa, which pawaPay does not cover). Flutterwave is pre-declared as
 * a third `PaymentProviderId` so adding it later, if the account is granted,
 * is a registry entry rather than a refactor.
 */

export type PaymentProviderId = "pawapay" | "stripe" | "flutterwave";
export type PaymentMethod = "mobile_money" | "card";

export type PaymentStatus =
  | "en_attente"
  | "en_cours"
  | "paye"
  | "echoue"
  | "annule"
  | "rembourse";

export interface Money {
  amountUsd: number;
  amountLocal: number;
  currency: string;
  fxRate: number;
  fxSource: string;
}

export interface CheckoutInput {
  candidatureId: string;
  country: Country;
  money: Money;
  /** Applicant's phone in E.164 — required by mobile money, ignored by card. */
  phone?: string;
  /**
   * Mobile money operator id, e.g. "MTN_MOMO_CMR". Required by pawaPay v2,
   * which carries the provider inside the deposit payload rather than
   * inferring it from the phone number. Ignored by card providers.
   */
  operator?: string;
  email: string;
  locale: string;
  /** Where the provider returns the payer after a hosted flow. */
  returnUrl: string;
  description: string;
}

export interface CheckoutResult {
  providerRef: string;
  /**
   * Hosted page to send the payer to. Absent for mobile money, where the
   * prompt is pushed to the handset and there is nowhere to navigate — the
   * UI polls instead.
   */
  redirectUrl?: string;
  /** True when settlement happens out of band and must be polled/awaited. */
  asynchronous: boolean;
}

export interface WebhookEvent {
  /** Provider's event id. The idempotency key — must be stable across retries. */
  eventId: string;
  eventType: string;
  providerRef: string;
  status: PaymentStatus;
  failureReason?: string;
  raw: unknown;
}

export interface RefundResult {
  refunded: boolean;
  providerRefundRef?: string;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;

  /** Can this provider take this method in this country? */
  supports(country: Country, method: PaymentMethod): boolean;

  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;

  /**
   * Verify and parse an inbound webhook.
   *
   * Takes the RAW body string, never a parsed object: every provider signs
   * the exact bytes it sent, and `JSON.parse` followed by `JSON.stringify`
   * will not reproduce them. Returns null when the signature fails — the
   * route must then reject without touching any payment.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;

  /**
   * Authoritative status straight from the provider.
   *
   * The fallback whenever a webhook is late or lost, and the only way an
   * asynchronous mobile-money collection resolves in the UI. Never trust the
   * browser's return from a hosted page for this.
   */
  getStatus(providerRef: string): Promise<{
    status: PaymentStatus;
    failureReason?: string;
  }>;

  refund(providerRef: string, amountUsd: number): Promise<RefundResult>;
}

/** Thrown when a provider is misconfigured — surfaces as a 500, never a silent skip. */
export class PaymentConfigError extends Error {}
