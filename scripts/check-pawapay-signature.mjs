/**
 * Self-check for the pawaPay callback signature verifier.
 *
 *   node --experimental-strip-types --conditions=react-server \
 *     scripts/check-pawapay-signature.mjs
 *
 * Signs a synthetic callback with each algorithm pawaPay may use, then asserts
 * that a good signature verifies, that tampering with the body or the path is
 * caught, and that an unsigned callback is refused.
 *
 * Worth having as a runnable check rather than a comment: the failure mode of
 * this code is silent. A verifier that rejects everything looks exactly like a
 * quiet integration — payments still settle through the poll and the
 * reconciliation cron, so nothing visibly breaks while every callback is
 * dropped. That is precisely what the previous HMAC implementation did.
 *
 * `--conditions=react-server` is needed because the module imports
 * `server-only`.
 */
import { generateKeyPairSync, createHash, sign as nodeSign } from "node:crypto";
import { verifyPawapaySignature } from "../src/lib/payments/pawapay-signature.ts";

const body = JSON.stringify({
  depositId: "afb57b93-7849-49aa-babb-4c3ccbfe3d79",
  status: "COMPLETED",
});

const cases = [
  { name: "ecdsa-p256-sha256", type: "ec", opts: { namedCurve: "prime256v1" }, hash: "sha256", dsa: "ieee-p1363" },
  { name: "ecdsa-p384-sha384", type: "ec", opts: { namedCurve: "secp384r1" }, hash: "sha384", dsa: "ieee-p1363" },
  { name: "rsa-v1_5-sha256", type: "rsa", opts: { modulusLength: 2048 }, hash: "sha256" },
  { name: "rsa-pss-sha512", type: "rsa-pss", opts: { modulusLength: 2048, hashAlgorithm: "sha512", mgf1HashAlgorithm: "sha512", saltLength: 64 }, hash: "sha512" },
];

const date = "2026-08-18T10:00:00.000Z";
const digest = `sha-512=:${createHash("sha512").update(body, "utf8").digest("base64")}:`;
const contentType = "application/json; charset=UTF-8";

function buildBase(params) {
  return [
    `"@method": POST`,
    `"@authority": svap.example.com`,
    `"@path": /api/payments/webhooks/pawapay`,
    `"signature-date": ${date}`,
    `"content-digest": ${digest}`,
    `"content-type": ${contentType}`,
    `"@signature-params": ${params}`,
  ].join("\n");
}

let pass = 0;
let fail = 0;

for (const c of cases) {
  const { publicKey, privateKey } = generateKeyPairSync(c.type, c.opts);
  const keyid = `TEST_${c.name}`;
  const params = `("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");keyid="${keyid}";alg="${c.name}"`;
  const base = Buffer.from(buildBase(params), "utf8");

  const signature = nodeSign(c.hash, base, {
    key: privateKey,
    ...(c.dsa ? { dsaEncoding: c.dsa } : {}),
  });

  const pem = publicKey.export({ type: "spki", format: "pem" });

  // Stub the public-key endpoint.
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: keyid, key: pem }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const headers = new Headers({
    "signature-input": `sig1=${params}`,
    signature: `sig1=:${signature.toString("base64")}:`,
    "signature-date": date,
    "content-digest": digest,
    "content-type": contentType,
    host: "svap.example.com",
  });

  const ctx = {
    rawBody: body,
    headers,
    method: "POST",
    path: "/api/payments/webhooks/pawapay",
    baseUrl: "https://api.sandbox.pawapay.io",
    token: "test",
  };

  const ok = await verifyPawapaySignature(ctx);

  // Negative controls.
  const tamperedBody = await verifyPawapaySignature({ ...ctx, rawBody: body + " " });
  const tamperedPath = await verifyPawapaySignature({ ...ctx, path: "/elsewhere" });

  const verdict = ok && !tamperedBody && !tamperedPath;
  console.log(
    `${verdict ? "PASS" : "FAIL"}  ${c.name.padEnd(20)} verify=${ok} tamperedBody=${tamperedBody} tamperedPath=${tamperedPath}`,
  );
  verdict ? pass++ : fail++;
}

// Unsigned callback must be refused.
globalThis.fetch = async () => new Response("[]", { status: 200 });
const unsigned = await verifyPawapaySignature({
  rawBody: body,
  headers: new Headers({ host: "svap.example.com" }),
  method: "POST",
  path: "/api/payments/webhooks/pawapay",
  baseUrl: "https://api.sandbox.pawapay.io",
  token: "test",
});
console.log(`${unsigned === false ? "PASS" : "FAIL"}  unsigned callback refused = ${!unsigned}`);
unsigned === false ? pass++ : fail++;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
