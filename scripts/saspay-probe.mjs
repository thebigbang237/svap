/**
 * Check what SasPay will actually accept, before a candidate finds out.
 *
 *   node scripts/saspay-probe.mjs rates            # networks live on the account
 *   node scripts/saspay-probe.mjs pay 1 mtn_gh 0244000000
 *   node scripts/saspay-probe.mjs status <payment_id>
 *
 * `rates` costs nothing and answers the question that mattered most with
 * pawaPay: is this market actually enabled on THIS account? It reads
 * /pricing/my-rates/, which reports availability, fees and any pre-payment OTP
 * per network — the same source the adapter offers operators from.
 *
 * `pay` pushes a real prompt for a real amount, so keep it to 1 GHS. It is the
 * only way to see the whole path: push, approval on the handset, then the
 * verify endpoint reporting SUCCESS.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const BASE = "https://api.saspay.me/api/v1";

function apiKey() {
  if (process.env.SASPAY_API_KEY) return process.env.SASPAY_API_KEY.trim();
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("SASPAY_API_KEY="));
    const value = line?.slice("SASPAY_API_KEY=".length).trim();
    if (value) return value;
  } catch {
    /* fall through */
  }
  console.error("SASPAY_API_KEY is not set, and .env.local has no usable value.");
  process.exit(1);
}

async function call(path, init) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 400);
  }
  // ⚠️ Every response is wrapped: { success, data }. Their documented examples
  // show the inner object alone, and reading the envelope as the payload is
  // what made this script once report "no networks" for a fully enabled
  // account — the opposite of the truth, and nearly a support ticket.
  const data =
    body && typeof body === "object" && "data" in body ? body.data : body;
  return { status: response.status, body, data };
}

async function rates() {
  const { status, body, data } = await call("/pricing/my-rates/");
  if (status !== 200) {
    console.error(`HTTP ${status}:`, JSON.stringify(body).slice(0, 400));
    console.error(
      status === 401
        ? "The key was refused — check it is the live/test key for this environment."
        : "",
    );
    process.exit(1);
  }

  const rows = Array.isArray(data) ? data : [];
  console.log(`${rows.length} network(s) on this account\n`);

  for (const r of rows) {
    const payin = r.payin ?? {};
    const tier = payin.tiers?.[0] ?? {};
    const fee = [
      tier.percent && tier.percent !== "0.000" ? `${tier.percent}%` : null,
      tier.fixed && tier.fixed !== "0.00" ? `+${tier.fixed}` : null,
      tier.floor_amount && tier.floor_amount !== "0.00"
        ? `min fee ${tier.floor_amount}`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    console.log(
      `${(r.country_code ?? "??").padEnd(3)} ${(r.network_code ?? "").padEnd(16)} ` +
        `${payin.available ? "payin OK " : "payin OFF"} ` +
        `${payin.otp_required ? "OTP-REQUIRED " : ""}` +
        `${(r.currency ?? "").padEnd(4)} ${fee}`,
    );
  }

  const ghana = rows.filter((r) => r.country_code === "GH" && r.payin?.available);
  console.log("");
  console.log(
    ghana.length
      ? `Ghana: ${ghana.map((r) => r.network_code).join(", ")} — the adapter will offer these.`
      : "Ghana: NOTHING available. The account is not enabled for that market yet.",
  );
}

async function pay(amount, network, phone) {
  const { status, body, data } = await call("/payments/softpay/", {
    method: "POST",
    headers: { "Idempotency-Key": randomUUID() },
    body: JSON.stringify({
      amount: String(amount),
      currency: "GHS",
      country: "GH",
      description: "SVAP probe",
      network,
      customer: {
        email: "probe@example.com",
        first_name: "Probe",
        last_name: "Test",
        phone,
      },
      fee_charge_mode: "DEDUCTED",
      return_url:
        "https://www.siliconvalleyafricaprogram.com/fr/documents/paiement",
    }),
  });

  console.log(`HTTP ${status}`);
  console.log(JSON.stringify(body, null, 2));

  if (data?.checkout_url) {
    console.log("\n⚠️ checkout_url is set — NO prompt was pushed. The payer must");
    console.log("   be redirected there. The adapter handles this; note it happened.");
  } else if (body?.id) {
    console.log("\nA prompt should be on the handset. Then:");
    console.log(`  node scripts/saspay-probe.mjs status ${body.id}`);
  }
}

async function status(id) {
  const { status, body } = await call(`/payments/${encodeURIComponent(id)}/verify/`);
  console.log(`HTTP ${status}`);
  console.log(JSON.stringify(body, null, 2));
  if (body?.status) {
    console.log(
      `\nstatus=${body.status} requested=${body.requested_amount} debited=${body.debited_amount} net=${body.net_amount} ${body.currency ?? ""}`,
    );
  }
}

const [command, ...args] = process.argv.slice(2);

if (command === "rates") {
  await rates();
} else if (command === "pay") {
  if (args.length < 3) {
    console.error("Usage: node scripts/saspay-probe.mjs pay <amount> <network> <phone>");
    process.exit(1);
  }
  await pay(args[0], args[1], args[2]);
} else if (command === "status") {
  if (!args[0]) {
    console.error("Usage: node scripts/saspay-probe.mjs status <payment_id>");
    process.exit(1);
  }
  await status(args[0]);
} else {
  console.error(
    "Usage:\n" +
      "  node scripts/saspay-probe.mjs rates\n" +
      "  node scripts/saspay-probe.mjs pay <amount> <network> <phone>\n" +
      "  node scripts/saspay-probe.mjs status <payment_id>",
  );
  process.exit(1);
}
