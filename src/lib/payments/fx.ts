import "server-only";
import { COUNTRY_PAYMENT, type Country } from "@/lib/constants/program";
import { PaymentConfigError } from "./types";
import type { Money } from "./types";

/**
 * USD → local currency conversion.
 *
 * Rates come from a live feed, with the FX_RATES_USD environment variable as
 * the fallback when the feed is unreachable.
 *
 * The feed is not a refinement — a hand-maintained table is what let a Ghanaian
 * candidate be quoted 31% over the fee (GHS at 15.1 against a market 11.56),
 * and a Cameroonian 7%. Nobody notices a stale rate: the page is confident, the
 * payment succeeds, and the candidate is simply overcharged. On a site whose
 * whole premise is not being a scam, that is the expensive kind of quiet.
 *
 * The rate actually used is still locked at checkout creation and written onto
 * the payment row, so a receipt always reflects what the candidate was shown,
 * whatever the source was that day.
 */

const MANUAL_SOURCE = "manual:FX_RATES_USD";
const FEED_URL =
  process.env.FX_FEED_URL ?? "https://open.er-api.com/v6/latest/USD";

/** Long enough that a burst of checkouts is one call, short enough to track
 *  a currency having a bad week. */
const FEED_TTL_SECONDS = 6 * 3600;

interface RateTable {
  table: Record<string, number>;
  source: string;
}

function manualTable(): Record<string, number> {
  const raw = process.env.FX_RATES_USD;
  if (!raw) {
    throw new PaymentConfigError(
      "FX_RATES_USD is not configured, and the rate feed is unreachable. Local-currency amounts cannot be computed.",
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
 * Today's rates, or the configured table if the feed fails.
 *
 * A feed outage must never take checkout down — it falls back, loudly, to a
 * table that is at least deliberate. Both paths name themselves in
 * `fxSource`, so any payment row says where its rate came from.
 */
async function rateTable(): Promise<RateTable> {
  try {
    const response = await fetch(FEED_URL, {
      // Next's data cache, so concurrent checkouts share one upstream call.
      next: { revalidate: FEED_TTL_SECONDS },
    });
    if (!response.ok) throw new Error(`feed returned ${response.status}`);

    const body = (await response.json()) as {
      rates?: Record<string, unknown>;
      result?: string;
    };
    const rates = body.rates ?? {};

    const table: Record<string, number> = {};
    for (const [code, value] of Object.entries(rates)) {
      const rate = Number(value);
      if (Number.isFinite(rate) && rate > 0) table[code.toUpperCase()] = rate;
    }

    // A feed that answers but has forgotten the currencies we bill in is a
    // feed we cannot use.
    if (Object.keys(table).length < 10) {
      throw new Error("feed returned too few rates");
    }

    return { table, source: `feed:${new URL(FEED_URL).host}` };
  } catch (error) {
    console.error(
      "FX feed unavailable, falling back to FX_RATES_USD:",
      (error as Error).message,
    );
    return { table: manualTable(), source: MANUAL_SOURCE };
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

export async function convertUsd(
  amountUsd: number,
  country: Country,
): Promise<Money> {
  return convertUsdTo(amountUsd, COUNTRY_PAYMENT[country].currency);
}

/**
 * The same conversion into a currency the rail dictates rather than the
 * candidate's country — Paiement Pro charges cards in XOF whoever is paying.
 */
export async function convertUsdTo(
  amountUsd: number,
  currency: string,
): Promise<Money> {
  const { table, source } = await rateTable();
  const fxRate = table[currency];

  if (!fxRate) {
    // Loud rather than falling back to 1:1, which would charge someone 330
    // Kenyan shillings for a $330 pack.
    throw new PaymentConfigError(
      `No FX rate available for ${currency}, from the feed or FX_RATES_USD.`,
    );
  }

  return {
    amountUsd,
    amountLocal: roundLocal(amountUsd * fxRate, currency),
    currency,
    fxRate,
    fxSource: source,
  };
}

/** Rounds to what the currency actually has coins for. */
export function roundLocal(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency)
    ? Math.round(amount)
    : Math.round(amount * 100) / 100;
}

/** Builds a Money for an amount already computed in the rail's currency. */
export function moneyIn(
  amountUsd: number,
  amountLocal: number,
  currency: string,
  fxRate: number,
  fxSource: string,
): Money {
  return { amountUsd, amountLocal, currency, fxRate, fxSource };
}

/**
 * Stripe card payments settle in USD against the US entity, so there is no
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
