import "server-only";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
import { PaymentConfigError } from "./types";
import type { Money } from "./types";

/**
 * USD → local currency conversion.
 *
 * ⚠️  OPERATIONAL DEBT, DELIBERATE AND FLAGGED.
 *
 * Rates come from the FX_RATES_USD environment variable as JSON, e.g.
 *   {"XAF":610.5,"KES":129.2,"GHS":15.1,"ZAR":18.2,"MAD":9.9,"EGP":48.5}
 *
 * That is fine for sandbox work and wrong for production. XAF is pegged to
 * EUR so it drifts with EUR/USD; KES, GHS, ZAR and EGP float freely and EGP
 * in particular has moved violently in recent years. A stale table means
 * either under-charging (absorbed as loss) or over-charging (a refund and a
 * complaint on a site whose whole premise is not being a scam).
 *
 * The follow-up is a rate feed with a short TTL cache and last-known
 * fallback. What matters is that the *shape* here is already right: the rate
 * actually used is locked at checkout creation and written onto the payment
 * row, so a receipt always reflects what the candidate was shown, whatever
 * the source becomes.
 */

const MANUAL_SOURCE = "manual:FX_RATES_USD";

function rateTable(): Record<string, number> {
  const raw = process.env.FX_RATES_USD;
  if (!raw) {
    throw new PaymentConfigError(
      "FX_RATES_USD is not configured. Local-currency amounts cannot be computed without it.",
    );
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const table: Record<string, number> = {};
    for (const [code, value] of Object.entries(parsed)) {
      const rate = Number(value);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`invalid rate for ${code}`);
      }
      table[code.toUpperCase()] = rate;
    }
    return table;
  } catch (error) {
    throw new PaymentConfigError(
      `FX_RATES_USD is not valid JSON of currency→rate: ${(error as Error).message}`,
    );
  }
}

/**
 * Converts the USD fee into what the candidate will actually be charged.
 *
 * Rounding is per-currency: XAF has no minor unit (fractional francs don't
 * exist), so charging 12 345.67 XAF would be rejected by the rail. Currencies
 * with cents keep two decimals.
 */
const ZERO_DECIMAL = new Set(["XAF", "XOF", "JPY", "KRW"]);

export function convertUsd(amountUsd: number, country: Country): Money {
  const currency = COUNTRY_PAYMENT[country].currency;
  const table = rateTable();
  const fxRate = table[currency];

  if (!fxRate) {
    // Loud rather than falling back to 1:1, which would charge someone 330
    // Kenyan shillings for a $330 pack.
    throw new PaymentConfigError(
      `No FX rate configured for ${currency} (country ${country}). Add it to FX_RATES_USD.`,
    );
  }

  const raw = amountUsd * fxRate;
  const amountLocal = ZERO_DECIMAL.has(currency)
    ? Math.round(raw)
    : Math.round(raw * 100) / 100;

  return {
    amountUsd,
    amountLocal,
    currency,
    fxRate,
    fxSource: MANUAL_SOURCE,
  };
}

/**
 * Card payments settle in USD against the US entity, so there is no
 * conversion to lock — the candidate's issuer does it, at its own rate.
 */
export function usdOnly(amountUsd: number): Money {
  return {
    amountUsd,
    amountLocal: amountUsd,
    currency: "USD",
    fxRate: 1,
    fxSource: "none:usd",
  };
}
