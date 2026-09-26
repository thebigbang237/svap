/**
 * The Paiement Pro amount cross-check, on its own and dependency-free.
 *
 * Split out of `paiementpro.ts` for the same reason `pawapay-signature.ts` is
 * split out: this is the check that stands in for a signature we cannot
 * verify, its failure modes are silent, and a module with no imports can be
 * asserted directly by `scripts/check-paiementpro-amounts.mjs`. No
 * `server-only` marker, because there is nothing here but arithmetic.
 */

/**
 * How Paiement Pro turns the CFA francs we send into the USD the payer is
 * debited, on the card and PayPal path.
 *
 *      usd = xof / xofPerUsd + fixedUsd
 *
 * Measured, exactly, with no money spent (`scripts/paiementpro-calibrate.mjs`
 * reads the totals off their own payment page):
 *
 *      2026-09-25   100 → $1.19   11 436 → $22.18   18 315 → $34.92
 *      2026-09-26   100 → $1.19   20 000 → $38.04
 *
 * Both days give the same two constants: 540 XOF/USD and a flat $1.00. Note
 * what that rate is NOT — the market was 571.8 on the first day and 576.38 on
 * the second, so theirs is a fixed internal rate that does not track it, and
 * the gap is their margin. Modelling it as "market plus a percentage" would
 * therefore drift as the market moves; modelling it as their own flat rate is
 * both simpler and what the evidence says.
 *
 * Because those constants are theirs, they can change without notice, and the
 * only symptom would be a candidate charged something other than the fee.
 * Re-measure whenever that is reported, and periodically regardless.
 */
export interface Surcharge {
  /** Their internal conversion rate, francs per dollar. */
  xofPerUsd: number;
  /** Flat fee in USD, added after the conversion. */
  fixedUsd: number;
  /**
   * Deliberate under-shoot, for if their rate ever starts moving: it lands the
   * error in the candidate's favour rather than above the advertised fee.
   * 0 while their rate holds steady; 0.01 costs ~$3 on a $330 pack.
   */
  bufferPct: number;
}

/**
 * How many CFA francs to send so the payer is charged exactly `feeUsd`.
 *
 * The inverse of their formula. The programme absorbs what they take: a
 * candidate told "$30" pays $30, which is the whole point — the alternative is
 * a site that advertises one price and a checkout that asks for another, which
 * is exactly what a candidate wrote in to ask about.
 */
export function localForFee(feeUsd: number, s: Surcharge): number {
  return Math.round((feeUsd - s.fixedUsd) * s.xofPerUsd * (1 - s.bufferPct));
}

/** What their page will show for a given amount — the forward direction. */
export function feeForLocal(amountLocal: number, s: Surcharge): number {
  return amountLocal / s.xofPerUsd + s.fixedUsd;
}

/** What we charged, in both the figures their API might answer with. */
export interface ExpectedAmount {
  /** The XOF figure we sent to `initialize.php`. */
  amountLocal: number;
  /** The fee in USD, which is the currency their hosted page charges in. */
  amountUsd: number;
}

/**
 * How much over the fee their conversion may come out, before a payment is
 * held rather than settled.
 *
 * Measured at 1.11 on 2026-09-25 (11 436 XOF quoted as $22.18 for a $20 fee —
 * their rate of ~515.6 XOF/USD against a market ~571.8, i.e. their margin is
 * inside the rate). 1.5 leaves room for that to move without stranding
 * candidates, and still cannot be confused with the XOF figure, which is some
 * 500× larger.
 */
const USD_CEILING = 1.5;

/**
 * Does the figure they report account for what we charged?
 *
 * Two answers are acceptable, because we cannot see which currency this field
 * is in and they do not say:
 *
 *   • the XOF amount we sent — the straightforward case;
 *   • a USD figure between the fee and `USD_CEILING`× it — what their page
 *     actually debits, since PayPal (which processes their cards too) cannot
 *     hold CFA francs and they convert at their own rate.
 *
 * Accepting both is what stops a genuinely paid dossier from being held at
 * `amount_mismatch` forever. It stays a real check: the two bands are three
 * orders of magnitude apart, so a payment of, say, their 100 XOF minimum
 * against a $20 fee falls in neither and is still refused.
 */
export function amountIsRight(paid: number, expected: ExpectedAmount): boolean {
  if (Math.abs(paid - expected.amountLocal) <= 0.01) return true;
  return (
    paid >= expected.amountUsd - 0.01 &&
    paid <= expected.amountUsd * USD_CEILING
  );
}
