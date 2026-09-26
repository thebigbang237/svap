/**
 * Self-check for the Paiement Pro amount cross-check.
 *
 *   node --experimental-strip-types scripts/check-paiementpro-amounts.mjs
 *
 * That check is all that stands in for a signature we cannot verify, and both
 * ways it can be wrong are quiet. Too strict, and a candidate who genuinely
 * paid is held at `amount_mismatch` on a spinner. Too loose, and a part-paid
 * or mis-quoted transaction settles a dossier. Neither shows up in a log you
 * happen to be watching, so the bands are asserted here instead.
 */
import {
  amountIsRight,
  feeForLocal,
  localForFee,
} from "../src/lib/payments/paiementpro-amount.ts";

// The two live fees, with the XOF we send at the configured rate.
const laureat = { amountUsd: 20, amountLocal: 11436 };
const visitor = { amountUsd: 330, amountLocal: 188694 };

const cases = [
  // The XOF figure we sent, reported back as-is.
  ["laureat, XOF as sent", laureat, 11436, true],
  ["laureat, XOF off by a rounding hair", laureat, 11435.995, true],
  ["visitor, XOF as sent", visitor, 188694, true],

  // Their own USD conversion, which is what their page debits.
  ["laureat, their USD conversion", laureat, 22.18, true],
  ["laureat, USD exactly the fee", laureat, 20, true],
  ["visitor, their USD conversion", visitor, 366, true],

  // Refusals that matter.
  ["laureat, their 100 XOF minimum", laureat, 100, false],
  ["laureat, USD well under the fee", laureat, 15, false],
  ["laureat, USD past the ceiling", laureat, 31, false],
  ["visitor, USD past the ceiling", visitor, 500, false],
  ["visitor, a laureat-sized payment", visitor, 11436, false],
  ["laureat, zero", laureat, 0, false],
];

let passed = 0;
let failed = 0;

/**
 * The pricing round-trip: the francs we send must come back out of their
 * formula as the advertised fee. This is what stops a candidate being quoted
 * $30 and asked for $34.92, which is how the whole thing was found.
 */
const surcharge = { xofPerUsd: 540, fixedUsd: 1, bufferPct: 0 };

for (const fee of [20, 30, 330]) {
  const xof = localForFee(fee, surcharge);
  const charged = feeForLocal(xof, surcharge);
  const off = Math.abs(charged - fee);
  if (off <= 0.01) {
    passed += 1;
    console.log(`  ok   $${fee} fee → ${xof} XOF → payer pays $${charged.toFixed(2)}`);
  } else {
    failed += 1;
    console.error(`  FAIL $${fee} fee → ${xof} XOF → payer pays $${charged.toFixed(2)}`);
  }
}

// Their 100 XOF floor: every fee must stay well clear of it.
if (localForFee(20, surcharge) > 100) {
  passed += 1;
  console.log("  ok   the cheapest pack is above their 100 XOF minimum");
} else {
  failed += 1;
  console.error("  FAIL the cheapest pack falls under their 100 XOF minimum");
}

for (const [name, expected, paid, want] of cases) {
  const got = amountIsRight(paid, expected);
  if (got === want) {
    passed += 1;
    console.log(`  ok   ${name} (${paid} → ${got ? "settles" : "held"})`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}: ${paid} → ${got ? "settles" : "held"}, wanted ${want ? "settles" : "held"}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
