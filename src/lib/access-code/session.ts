import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Phase-2 session.
 *
 * The specification calls the access code "à usage unique". Read literally
 * against a five-step Phase 2, that locks a candidate out the first time they
 * close a tab or move from laptop to phone to photograph their ID — mid-way
 * through a process they have already paid for.
 *
 * So the code is single-use *as a credential*, not as a session: redeeming it
 * once marks it spent (nobody else can ever use it, which is what
 * "non-reusable, non-shareable" actually protects) and issues this short-lived
 * signed cookie, which is what the candidate then resumes with.
 *
 * Deliberately hand-rolled rather than pulling in a JWT library: the payload
 * is two fields, the only algorithm needed is HMAC-SHA256, and a dependency
 * whose main feature is supporting algorithms we must never accept (`none`,
 * RS256 confusion) is not a trade worth making here.
 */

const COOKIE_NAME = "svap_phase2";
const SESSION_TTL_SECONDS = 72 * 60 * 60;

export interface Phase2Session {
  /** Candidature id this session grants access to. */
  cid: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

function secret(): string {
  const value = process.env.PHASE2_SESSION_SECRET;
  if (!value) {
    throw new Error(
      "PHASE2_SESSION_SECRET is not configured. Phase-2 sessions cannot be issued or verified without it.",
    );
  }
  return value;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

/** `<base64url(payload)>.<base64url(hmac)>` */
export function createSessionToken(candidatureId: string): string {
  const session: Phase2Session = {
    cid: candidatureId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = b64url(Buffer.from(JSON.stringify(session)));
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify signature and expiry. Returns null on anything suspicious rather
 * than throwing — a tampered cookie is an ordinary condition (stale session,
 * rotated secret), not an exceptional one.
 */
export function verifySessionToken(token: string): Phase2Session | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  // Compare the signatures, not the tokens: equal-length buffers are required
  // by timingSafeEqual, and a forged signature of the wrong length must fail
  // without throwing.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Phase2Session;
    if (!session.cid || typeof session.exp !== "number") return null;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(candidatureId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(candidatureId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" rather than "strict": the candidate arrives at /documents from a
    // link in their email, and "strict" would withhold the cookie on that
    // first cross-site navigation, appearing to log them straight back out.
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSession(): Promise<Phase2Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
