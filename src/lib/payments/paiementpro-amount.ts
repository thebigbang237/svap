/**
 * The Paiement Pro amount cross-check, on its own and dependency-free.
 *
 * Split out of `paiementpro.ts` for the same reason `pawapay-signature.ts` is
 * split out: this is the check that stands in for a signature we cannot
 * verify, its failure modes are silent, and a module with no imports can be
 * asserted directly by `scripts/check-paiementpro-amounts.mjs`. No
 * `server-only` marker, because there is nothing here but arithmetic.
 */

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
