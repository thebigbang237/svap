import "server-only";
import type { AdminClient } from "@/lib/supabase/admin";
import {
  generateAccessCode,
  hashAccessCode,
  accessCodeExpiry,
} from "./code";

/**
 * Mint a code for a candidature and persist only its hash.
 *
 * Returns the plaintext to the caller, which is the ONLY place it ever
 * exists — it is not stored, not logged, and not recoverable. A candidate who
 * loses it gets a new one issued (see `reissue`), never the old one back.
 * That is what makes "jamais affiché en clair dans l'admin" true by
 * construction rather than by policy.
 *
 * Codes are minted at send time rather than at Phase-1 submission precisely
 * so this window stays as short as possible: generate, hash, store, email,
 * discard.
 */
export interface IssuedCode {
  code: string;
  expiresAt: Date;
}

export async function issueAccessCode(
  supabase: AdminClient,
  candidatureId: string,
): Promise<IssuedCode> {
  const now = new Date();
  const expiresAt = accessCodeExpiry(now);

  // Retry on the (vanishingly unlikely) hash collision rather than failing
  // the send: code_hash carries a unique constraint, and 23505 here means we
  // drew a code already in use, not that anything is wrong.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAccessCode();

    const { error } = await supabase.from("access_codes").upsert(
      {
        candidature_id: candidatureId,
        code_hash: hashAccessCode(code),
        issued_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        // A reissue supersedes whatever came before: the previous code stops
        // working, and the reminder clocks restart against the new expiry.
        redeemed_at: null,
        last_sent_at: now.toISOString(),
        reminder_7d_sent_at: null,
        reminder_12d_sent_at: null,
      },
      { onConflict: "candidature_id" },
    );

    if (!error) return { code, expiresAt };
    if (error.code !== "23505") {
      throw new Error(`Failed to issue access code: ${error.message}`);
    }
  }

  throw new Error(
    "Failed to issue access code: repeated hash collisions, which should be impossible — check ACCESS_CODE_PEPPER is stable.",
  );
}

/**
 * Reissue for the "Renvoyer le code" flow. Identical mechanics — a fresh
 * code replacing the old one — but bumps the resend counter so repeated
 * requests are visible to the admin and to abuse review.
 */
export async function reissueAccessCode(
  supabase: AdminClient,
  candidatureId: string,
  currentResendCount: number,
): Promise<IssuedCode> {
  const issued = await issueAccessCode(supabase, candidatureId);

  const { error } = await supabase
    .from("access_codes")
    .update({ resend_count: currentResendCount + 1 })
    .eq("candidature_id", candidatureId);

  if (error) console.error("Failed to bump resend_count:", error);

  return issued;
}
