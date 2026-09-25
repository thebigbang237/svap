/**
 * Probe Paiement Pro directly, for a few cents.
 *
 *   node scripts/paiementpro-probe.mjs init 100 CARD
 *   node scripts/paiementpro-probe.mjs init 100 MOMOCM 6XXXXXXXX
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

/**
 * Their *documented* initiation route (OnlinePayment v1.3 §2.a): RPC-encoded
 * SOAP, returning a session id you then redirect the payer to. The adapter
 * uses the JSON endpoint above, which their own JS SDK uses and which returns
 * the payment URL directly. `--soap` initiates the documented way instead, so
 * the two can be compared — in particular, whether a transaction shows up in
 * the status API afterwards.
 */
const SOAP_URL =
  "https://www.paiementpro.net/webservice/OnlineServicePayment_v2.php";
const PROCESSING_URL =
  "https://paiementpro.net/webservice/onlinepayment/processing_v2.php";

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

function xml(fields) {
  return Object.entries(fields)
    .map(([k, v]) => {
      const type = typeof v === "number" ? "xsd:int" : "xsd:string";
      return `<${k} xsi:type="${type}">${String(v).replace(/[<>&]/g, "")}</${k}>`;
    })
    .join("");
}

async function initSoap(fields) {
  const envelope =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"` +
    ` xmlns:ns1="${SOAP_URL}" xmlns:xsd="http://www.w3.org/2001/XMLSchema"` +
    ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
    `<SOAP-ENV:Body><ns1:initTransact><request xsi:type="ns1:initRequest">` +
    xml(fields) +
    `</request></ns1:initTransact></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

  const response = await fetch(SOAP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${SOAP_URL}#initTransact"`,
    },
    body: envelope,
  });

  const text = await response.text();
  const pick = (tag) => text.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1];
  const code = pick("Code");

  // 0 success, 10 missing parameters, 11 unknown merchant, -1 init error.
  if (code !== "0") {
    console.error(`SOAP initTransact refused (Code ${code}): ${pick("Description")}`);
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  return `${PROCESSING_URL}?sessionid=${pick("Sessionid")}`;
}

async function init(amount, channel, phone, notify, soap) {
  const reference = randomBytes(12).toString("hex");

  const fields = {
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
    // Mobile money pushes the prompt to THIS number, so a placeholder makes
    // their page bounce straight back to the return URL with
    // `responsecode=0` and no payment. Cards ignore it.
    customerPhoneNumber: phone,
    // Empty by default: this payment has no row in our database, so a
    // callback only logs "callback for unknown reference". Pass `--notify`
    // to point it at production anyway — that log line, and the request
    // behind it, are how we find out what they actually send, and from
    // where.
    notificationURL: notify
      ? "https://www.siliconvalleyafricaprogram.com/api/payments/webhooks/paiementpro"
      : "",
    returnURL: "https://www.siliconvalleyafricaprogram.com/fr/documents/paiement",
    returnContext: "",
  };

  let url;

  if (soap) {
    url = await initSoap(fields);
  } else {
    const response = await fetch(INIT_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(fields),
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
    url = data.url;
  }

  console.log(`reference : ${reference}`);
  console.log(`channel   : ${channel}`);
  console.log(`phone     : ${phone}`);
  console.log(`amount    : ${amount} XOF as sent`);
  console.log(`route     : ${soap ? "SOAP initTransact (documented)" : "initialize.php (what the adapter uses)"}`);
  console.log(`notify    : ${notify ? "production webhook" : "none"}`);
  console.log(`pay here  : ${url}`);
  console.log("");
  // Their doc puts the session's life at 5 minutes.
  console.log("Pay it within ~5 minutes, then:");
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
  const notify = args.includes("--notify");
  const positional = args.filter((a) => !a.startsWith("--"));
  const channel = (positional[1] ?? "CARD").toUpperCase();
  const phone = positional[2] ?? "0700000000";
  // `683377363--soap` (a missing space) otherwise reads as the phone, and the
  // flag is silently dropped — which invalidates the very comparison the run
  // was for.
  if (!/^\+?[0-9]{6,15}$/.test(phone)) {
    console.error(`"${phone}" is not a phone number. Did a flag run into it?`);
    process.exit(1);
  }

  if (channel !== "CARD" && channel !== "PAYPAL" && phone === "0700000000") {
    console.error(
      `${channel} pushes a prompt to the payer's handset — pass a real number:\n` +
        `  node scripts/paiementpro-probe.mjs init ${positional[0] ?? 100} ${channel} 6XXXXXXXX`,
    );
    process.exit(1);
  }
  await init(
    Number(positional[0] ?? 100),
    channel,
    phone,
    notify,
    args.includes("--soap"),
  );
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
      "  node scripts/paiementpro-probe.mjs init [amountXof] <MOMOCM|OMCM|…> <phone>\n" +
      "      --notify   point notificationURL at the production webhook\n" +
      "      --soap     initiate via the documented SOAP initTransact instead\n" +
      "  node scripts/paiementpro-probe.mjs status <reference>",
  );
  process.exit(1);
}
