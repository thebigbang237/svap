/**
 * Measure what Paiement Pro adds on top of the fee. Costs nothing.
 *
 *   node scripts/paiementpro-calibrate.mjs
 *
 * Their card and PayPal page converts the CFA francs we send into USD at their
 * own rate, adds a margin, then a flat dollar. We compute the francs backwards
 * from that formula so the payer is charged exactly the advertised fee — which
 * only holds while the formula does. It has already bitten once: a candidate
 * quoted $30 was asked for $34.92.
 *
 * Initiating a payment is free and creates nothing but an unpaid session, and
 * their page states the USD total before anyone touches a card. So two
 * initiations at different amounts give both numbers exactly:
 *
 *      usd = (xof / market_rate) × (1 + pct) + fixed
 *
 * Run it before launch, after any pricing change on their side, and whenever a
 * candidate reports a figure other than the fee. It prints the env values to
 * set; nothing is written from here.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const INIT_URL =
  "https://paiementpro.net/webservice/onlinepayment/js/initialize/initialize.php";
const FEED_URL = process.env.FX_FEED_URL ?? "https://open.er-api.com/v6/latest/USD";

/** Two amounts far enough apart that the flat fee separates cleanly. */
const PROBES = [100, 20000];

function merchantId() {
  if (process.env.PAIEMENTPRO_MERCHANT_ID) {
    return process.env.PAIEMENTPRO_MERCHANT_ID.trim();
  }
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("PAIEMENTPRO_MERCHANT_ID="));
    const value = line?.slice("PAIEMENTPRO_MERCHANT_ID=".length).trim();
    if (value) return value;
  } catch {
    /* fall through */
  }
  console.error("PAIEMENTPRO_MERCHANT_ID is not set, and .env.local has no usable value.");
  process.exit(1);
}

/** Initiates a card session and reads the USD total off their payment page. */
async function quotedUsd(amountXof, merchant) {
  const reference = randomBytes(12).toString("hex");

  const init = await fetch(INIT_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantId: merchant,
      amount: amountXof,
      description: "SVAP surcharge calibration",
      channel: "CARD",
      countryCurrencyCode: "952",
      referenceNumber: reference,
      customerEmail: "probe@example.com",
      customerFirstName: "Probe",
      customerLastname: "Test",
      customerPhoneNumber: "0700000000",
      notificationURL: "",
      returnURL: "https://www.siliconvalleyafricaprogram.com/fr/documents/paiement",
      returnContext: "",
    }),
  }).then((r) => r.json());

  if (!init.success || !init.url) {
    console.error(`Initiation refused for ${amountXof} XOF: ${init.error ?? "no url"}`);
    process.exit(1);
  }

  // CARD redirects through to the PayPal-backed form, which carries the total.
  const page = await fetch(init.url, { redirect: "follow" }).then((r) => r.text());
  const total = page.match(/id="Amount"[^>]*value="([0-9.]+)"/)?.[1]
    ?? page.match(/amount=([0-9.]+)/)?.[1];

  if (!total) {
    console.error(
      `Could not find the USD total on their page for ${amountXof} XOF.\n` +
        "Their markup has changed — open the URL and read it by hand:\n  " +
        init.url,
    );
    process.exit(1);
  }

  return Number(total);
}

async function marketRate() {
  const body = await fetch(FEED_URL).then((r) => r.json());
  const rate = Number(body?.rates?.XOF);
  if (!Number.isFinite(rate) || rate <= 0) {
    console.error("The FX feed did not return an XOF rate.");
    process.exit(1);
  }
  return rate;
}

const merchant = merchantId();
const [low, high] = PROBES;
const [usdLow, usdHigh, market] = await Promise.all([
  quotedUsd(low, merchant),
  quotedUsd(high, merchant),
  marketRate(),
]);

// usd = xof/rate + fixed, so the flat fee is what survives at zero francs.
const perXof = (usdHigh - usdLow) / (high - low);
const fixed = usdLow - perXof * low;
const theirRate = 1 / perXof;

console.log(`${low} XOF  → $${usdLow.toFixed(2)}`);
console.log(`${high} XOF → $${usdHigh.toFixed(2)}`);
console.log("");
console.log(`their rate   : ${theirRate.toFixed(2)} XOF/USD`);
console.log(`fixed fee    : $${fixed.toFixed(2)}`);
console.log(
  `market today : ${market.toFixed(2)} XOF/USD — their margin is the gap, ` +
    `${(((market - theirRate) / market) * 100).toFixed(1)}%`,
);
console.log("");
console.log("Set these where the app runs, if they differ from what it has:");
console.log(`  PAIEMENTPRO_XOF_PER_USD=${theirRate.toFixed(0)}`);
console.log(`  PAIEMENTPRO_SURCHARGE_FIXED_USD=${fixed.toFixed(2)}`);
console.log("");
console.log("What a candidate is asked for, with those values:");
for (const fee of [20, 30, 330]) {
  const xof = Math.round((fee - fixed) * theirRate);
  const charged = xof / theirRate + fixed;
  console.log(`  $${fee} fee → send ${xof} XOF → payer pays $${charged.toFixed(2)}`);
}
