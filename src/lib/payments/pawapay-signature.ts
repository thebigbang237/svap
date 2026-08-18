import "server-only";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";

/**
 * pawaPay callback verification — RFC-9421 HTTP Message Signatures.
 *
 * This replaces an earlier HMAC implementation that read a
 * `x-pawapay-signature` header. pawaPay does not sign that way and never did:
 * callbacks carry `Signature`, `Signature-Input`, `Signature-Date` and
 * `Content-Digest`, and are verified with a PUBLIC key fetched from
 * `GET /v2/public-key/http`. The HMAC check therefore rejected every genuine
 * callback — payments still settled, but only because the status poll and the
 * reconciliation job carry the flow on their own.
 *
 * Signed callbacks are OPT-IN: they must be enabled in the pawaPay dashboard.
 * We nonetheless refuse unsigned callbacks. An unauthenticated callback
 * endpoint lets anyone mark any dossier as paid by POSTing a deposit id, and
 * the cost of refusing is only latency — the reconciliation cycle settles the
 * payment within minutes either way.
 *
 * Spec: https://docs.pawapay.io/v2/docs/signatures
 */

const KEY_CACHE_TTL_MS = 60 * 60 * 1000;

interface PublicKeyEntry {
  id: string;
  key: string;
}

let keyCache: { fetchedAt: number; keys: Map<string, string> } | null = null;

/**
 * pawaPay's callback signing keys, cached for an hour.
 *
 * `force` bypasses the cache, which is what makes key rotation survivable: an
 * unknown `keyid` triggers exactly one refetch rather than failing outright or
 * hammering the endpoint on every forged request.
 */
async function fetchPublicKeys(
  baseUrl: string,
  token: string,
  force = false,
): Promise<Map<string, string>> {
  if (!force && keyCache && Date.now() - keyCache.fetchedAt < KEY_CACHE_TTL_MS) {
    return keyCache.keys;
  }

  const response = await fetch(`${baseUrl}/v2/public-key/http`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`pawaPay public-key fetch failed (${response.status})`);
  }

  const body = (await response.json()) as PublicKeyEntry[] | { keys?: PublicKeyEntry[] };
  const entries = Array.isArray(body) ? body : (body.keys ?? []);

  const keys = new Map<string, string>();
  for (const entry of entries) {
    if (entry?.id && entry?.key) keys.set(entry.id, entry.key);
  }

  keyCache = { fetchedAt: Date.now(), keys };
  return keys;
}

/**
 * Structured-field dictionary member: `sig1=("a" "b");keyid="K";alg="X"`.
 *
 * Parsed by hand rather than with a full structured-fields library: pawaPay
 * emits one signature per callback in a fixed shape, and a dependency for this
 * would be more surface than the ten lines it replaces.
 */
function parseSignatureInput(header: string): {
  label: string;
  components: string[];
  params: string;
  keyid?: string;
  alg?: string;
} | null {
  // `[\s\S]` rather than the `s` flag: the tsconfig target predates it.
  const match = /^([A-Za-z0-9_-]+)=\(([\s\S]*?)\)([\s\S]*)$/.exec(header.trim());
  if (!match) return null;

  const [, label, inner, rest] = match;

  const components = inner
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => c.replace(/^"|"$/g, ""));

  return {
    label,
    components,
    // Everything after the component list, verbatim — the signature base's
    // final line must reproduce it byte for byte, so it is never re-serialised.
    params: `(${inner})${rest}`,
    keyid: /keyid="([^"]+)"/.exec(rest)?.[1],
    alg: /alg="([^"]+)"/.exec(rest)?.[1],
  };
}

/** `sig1=:base64:` → the raw signature bytes. */
function parseSignature(header: string, label: string): Buffer | null {
  const match = new RegExp(`${label}=:([^:]+):`).exec(header);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

/**
 * `sha-256=:base64:` — confirms the body wasn't altered in transit.
 *
 * Checked before the signature, because it is the cheap half and because the
 * signature only covers the *digest* of the body, not the body itself. Skipping
 * this would leave the payload swappable under a valid signature.
 */
function contentDigestMatches(header: string, rawBody: string): boolean {
  const entries = header.split(",");

  for (const entry of entries) {
    const match = /^\s*(sha-256|sha-512)=:([^:]+):\s*$/i.exec(entry);
    if (!match) continue;

    const algorithm = match[1].toLowerCase() === "sha-256" ? "sha256" : "sha512";
    const expected = createHash(algorithm).update(rawBody, "utf8").digest("base64");
    if (expected === match[2]) return true;
  }

  return false;
}

/** RFC-9421 algorithm label → what node:crypto needs to verify it. */
const ALGORITHMS: Record<
  string,
  { hash: string; padding?: number; saltLength?: number; ieeeP1363?: boolean }
> = {
  // RSASSA-PSS with SHA-512, MGF1/SHA-512, salt length = digest length.
  "rsa-pss-sha512": { hash: "sha512", padding: 6, saltLength: 64 },
  "rsa-v1_5-sha256": { hash: "sha256", padding: 1 },
  // ECDSA signatures in RFC-9421 are raw r‖s, not DER — node needs telling.
  "ecdsa-p256-sha256": { hash: "sha256", ieeeP1363: true },
  "ecdsa-p384-sha384": { hash: "sha384", ieeeP1363: true },
};

export interface VerificationContext {
  rawBody: string;
  headers: Headers;
  method: string;
  /** Path as pawaPay called it, e.g. "/api/payments/webhooks/pawapay". */
  path: string;
  baseUrl: string;
  token: string;
}

/**
 * True when this callback genuinely came from pawaPay.
 *
 * Every failure path returns false and logs the reason: a callback that cannot
 * be verified is indistinguishable from a forged one, and money must not move
 * on either.
 */
export async function verifyPawapaySignature(
  ctx: VerificationContext,
): Promise<boolean> {
  const { headers } = ctx;

  const signatureInputHeader = headers.get("signature-input");
  const signatureHeader = headers.get("signature");

  if (!signatureInputHeader || !signatureHeader) {
    console.error(
      "pawaPay callback arrived unsigned. Enable signed callbacks in the " +
        "pawaPay dashboard — unsigned callbacks are refused. Payments still " +
        "settle via the status poll and /api/cron/payments.",
    );
    return false;
  }

  const input = parseSignatureInput(signatureInputHeader);
  if (!input) {
    console.error("pawaPay callback: unparseable Signature-Input.");
    return false;
  }

  const signature = parseSignature(signatureHeader, input.label);
  if (!signature) {
    console.error("pawaPay callback: no signature for label", input.label);
    return false;
  }

  // Body integrity first — see contentDigestMatches.
  const digestHeader = headers.get("content-digest");
  if (input.components.includes("content-digest")) {
    if (!digestHeader || !contentDigestMatches(digestHeader, ctx.rawBody)) {
      console.error("pawaPay callback: Content-Digest does not match the body.");
      return false;
    }
  }

  // Reconstruct the signature base exactly as pawaPay built it.
  const lines: string[] = [];
  for (const component of input.components) {
    let value: string | null;

    switch (component) {
      case "@method":
        value = ctx.method.toUpperCase();
        break;
      case "@authority":
        // The host as the CALLER addressed it. Behind Vercel's proxy the
        // forwarded host is the real one; request.url may carry an internal
        // hostname, which would silently break every verification.
        value =
          headers.get("x-forwarded-host") ?? headers.get("host") ?? null;
        break;
      case "@path":
        value = ctx.path;
        break;
      default:
        value = headers.get(component);
    }

    if (value === null) {
      console.error(`pawaPay callback: signed component "${component}" is absent.`);
      return false;
    }

    lines.push(`"${component}": ${value}`);
  }
  lines.push(`"@signature-params": ${input.params}`);

  const base = Buffer.from(lines.join("\n"), "utf8");

  const algorithmName = (input.alg ?? "ecdsa-p256-sha256").toLowerCase();
  const algorithm = ALGORITHMS[algorithmName];
  if (!algorithm) {
    console.error(`pawaPay callback: unsupported algorithm "${algorithmName}".`);
    return false;
  }

  const attempt = async (force: boolean): Promise<boolean | null> => {
    const keys = await fetchPublicKeys(ctx.baseUrl, ctx.token, force);
    const pem = input.keyid ? keys.get(input.keyid) : undefined;

    // Distinguish "key unknown" (retry once, it may have rotated) from
    // "signature invalid" (a definite no).
    if (!pem) return null;

    return verifySignature(
      algorithm.hash,
      base,
      {
        key: createPublicKey(pem),
        ...(algorithm.padding !== undefined ? { padding: algorithm.padding } : {}),
        ...(algorithm.saltLength !== undefined
          ? { saltLength: algorithm.saltLength }
          : {}),
        ...(algorithm.ieeeP1363 ? { dsaEncoding: "ieee-p1363" as const } : {}),
      },
      signature,
    );
  };

  try {
    let result = await attempt(false);
    if (result === null) result = await attempt(true);

    if (result === null) {
      console.error(
        `pawaPay callback: keyid "${input.keyid}" is not among the published keys.`,
      );
      return false;
    }

    if (!result) {
      console.error("pawaPay callback: signature does not verify.");
    }
    return result;
  } catch (error) {
    console.error(
      "pawaPay callback: verification threw:",
      (error as Error).message,
    );
    return false;
  }
}
