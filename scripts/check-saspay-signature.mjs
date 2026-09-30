/**
 * Self-check for the SasPay callback signature verifier.
 *
 *   node --experimental-strip-types scripts/check-saspay-signature.mjs
 *
 * Worth having as a runnable check rather than a comment, for the same reason
 * the pawaPay one is: the failure mode is silent. A verifier that rejects
 * everything looks exactly like a quiet integration — payments still settle
 * through the poll and the reconciliation cron, so nothing visibly breaks
 * while every callback is dropped.
 */
import { createHmac } from "node:crypto";
import { verifySaspaySignature } from "../src/lib/payments/saspay-signature.ts";

const SECRET = "test_secret_not_the_real_one";
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);

const body = JSON.stringify({
  event: "transaction.success",
  data: { id: "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02", status: "SUCCESS" },
});

const sign = (timestamp, payload = body, secret = SECRET) =>
  createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");

const seconds = String(Math.floor(NOW / 1000));
const millis = String(NOW);
const iso = new Date(NOW).toISOString();

const cases = [
  ["unix seconds, good signature", body, sign(seconds), seconds, true],
  ["unix milliseconds", body, sign(millis), millis, true],
  ["ISO timestamp", body, sign(iso), iso, true],
  ["uppercase hex", body, sign(seconds).toUpperCase(), seconds, true],
  ["sha256= prefix", body, `sha256=${sign(seconds)}`, seconds, true],

  // Everything a forger would try.
  ["tampered body", body.replace("SUCCESS", "FAILED"), sign(seconds), seconds, false],
  ["wrong secret", body, sign(seconds, body, "other_secret"), seconds, false],
  ["signature of body alone", body, createHmac("sha256", SECRET).update(body).digest("hex"), seconds, false],
  ["timestamp not covered", body, sign(seconds), String(Number(seconds) + 1), false],
  ["replay, 6 minutes old", body, sign(String(Number(seconds) - 360)), String(Number(seconds) - 360), false],
  ["missing signature", body, null, seconds, false],
  ["missing timestamp", body, sign(seconds), null, false],
  ["empty signature", body, "", seconds, false],
  ["garbage timestamp", body, sign("nonsense"), "nonsense", false],
];

let passed = 0;
let failed = 0;

for (const [name, payload, signature, timestamp, want] of cases) {
  const got = verifySaspaySignature(payload, { signature, timestamp }, SECRET, NOW);
  if (got === want) {
    passed += 1;
    console.log(`  ok   ${name} (${got ? "accepted" : "refused"})`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}: ${got ? "accepted" : "refused"}, wanted ${want ? "accepted" : "refused"}`);
  }
}

// A missing secret must never accept anything.
if (verifySaspaySignature(body, { signature: sign(seconds), timestamp: seconds }, "", NOW)) {
  failed += 1;
  console.error("  FAIL empty secret accepted a callback");
} else {
  passed += 1;
  console.log("  ok   empty secret refuses everything");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
