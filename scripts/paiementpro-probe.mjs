/**
 * Probe Paiement Pro directly, for a few cents.
 *
 *   node scripts/paiementpro-probe.mjs init 100
 *   node scripts/paiementpro-probe.mjs status <reference>
 *
 * Why this exists: card and PayPal have no sandbox, and the one thing we
 * cannot know without a *completed* payment is what their status API reports
 * as the `amount` — the XOF we sent, or the USD their page converted it to.
 * That single field decides whether `interpret()` settles a payment or holds
 * it at `amount_mismatch`, so guessing it is not an option.
 *
 * `init 100` initiates the smallest payment they accept (100 FCFA, about
 * $0.20 on their page), prints the reference and the payment URL, and touches
 * nothing in our database — it is their API, called directly. Pay it with a
 * real card, then run `status <reference>` and read the `amount` field.
 *
 * Nothing here is part of the app. It is a diagnostic, kept because this
 * question will come back every time they change their conversion.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const INIT_URL =
  "https://paiementpro.net/webservice/onlinepayment/js/initialize/initialize.php";
const STATUS_URL = "https://api.paiementpro.net/status";

/** The merchant id, from the environment or .env.local. Not a secret — their
 *  own SDK ships it to the browser. */
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
    /* fall through to the error below */
  }
  console.error("PAIEMENTPRO_MERCHANT_ID is not set, and .env.local has no usable value.");
  process.exit(1);
}

async function init(amount, channel) {
  const reference = randomBytes(12).toString("hex");

  const response = await fetch(INIT_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantId: merchantId(),
      amount,
      description: "SVAP amount-format probe",
      channel,
      // 952 = XOF. They accept other codes and ignore them: the amount is
      // read as francs regardless.
      countryCurrencyCode: "952",
      referenceNumber: reference,
      customerEmail: "probe@example.com",
      customerFirstName: "Probe",
      customerLastname: "Test",
      customerPhoneNumber: "0700000000",
      // Left empty on purpose: this payment has no row in our database, so a
      // callback would only log "callback for unknown reference".
      notificationURL: "",
      returnURL: "https://siliconvalleyafricaprogram.com/fr/documents/paiement",
      returnContext: "",
    }),
  });

  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    console.error(`HTTP ${response.status}, unparseable body:`, body.slice(0, 500));
    process.exit(1);
  }

  if (!data.success || !data.url) {
    console.error(`Refused: ${data.error ?? body.slice(0, 300)}`);
    process.exit(1);
  }

  console.log(`reference : ${reference}`);
  console.log(`channel   : ${channel}`);
  console.log(`amount    : ${amount} XOF as sent`);
  console.log(`pay here  : ${data.url}`);
  console.log("");
  console.log("Pay it, then:");
  console.log(`  node scripts/paiementpro-probe.mjs status ${reference}`);
}

async function status(reference) {
  const response = await fetch(`${STATUS_URL}/${encodeURIComponent(reference)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  console.log(`HTTP ${response.status}`);
  console.log(text);

  try {
    const body = JSON.parse(text);
    if (body.success === true) {
      console.log("");
      console.log(`amount reported: ${body.amount}`);
      console.log(
        "→ equal to the XOF sent means interpret() settles as-is; a much smaller\n" +
          "  figure is their USD conversion, which the USD band must cover.",
      );
    } else if (body.error === "Aucune transaction") {
      console.log("");
      console.log("Not paid yet (or never started): they only report completed payments.");
    }
  } catch {
    /* the raw output above is the answer */
  }
}

const [command, ...args] = process.argv.slice(2);

if (command === "init") {
  await init(Number(args[0] ?? 100), (args[1] ?? "CARD").toUpperCase());
} else if (command === "status") {
  if (!args[0]) {
    console.error("Usage: node scripts/paiementpro-probe.mjs status <reference>");
    process.exit(1);
  }
  await status(args[0]);
} else {
  console.error(
    "Usage:\n" +
      "  node scripts/paiementpro-probe.mjs init [amountXof] [CARD|PAYPAL]\n" +
      "  node scripts/paiementpro-probe.mjs status <reference>",
  );
  process.exit(1);
}
