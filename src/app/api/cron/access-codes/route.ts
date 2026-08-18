import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueAccessCode } from "@/lib/access-code/issue";
import {
  sendAccessCodeEmail,
  sendCodeExpiringEmail,
} from "@/lib/resend/client";
import { ACCESS_CODE } from "@/lib/constants/program";
import type { CandidatureRow } from "@/lib/supabase/types";

/**
 * The access-code lifecycle clock.
 *
 * Three jobs, all idempotent so a scheduler that fires twice — or retries a
 * timed-out run — cannot double-send:
 *
 *   1. retry codes whose send failed during Phase-1 submission;
 *   2. remind candidates at day 7 and day 12 of the 14-day window;
 *   3. expire codes whose window has closed.
 *
 * Job 1 is a safety net, not the normal path — codes are issued and emailed
 * synchronously when the application is submitted. Intended to run hourly.
 */

// Batch size per run. Keeps a single invocation inside serverless time limits;
// a backlog simply drains over successive runs rather than timing one out.
const BATCH_SIZE = 100;

function authorized(request: Request): boolean {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Candidate = Pick<
  CandidatureRow,
  "id" | "prenom" | "email" | "locale" | "status"
>;

export async function POST(request: Request) {
  if (!authorized(request)) {
    // 404 rather than 401: an unauthenticated caller shouldn't learn that a
    // cron endpoint lives here.
    return new NextResponse(null, { status: 404 });
  }

  const supabase = createAdminClient();
  const report = { issued: 0, reminded: 0, expired: 0, failed: 0 };

  // -------------------------------------------------------------------------
  // 1. Retry codes that failed to send at submission time
  // -------------------------------------------------------------------------
  // Codes are normally issued and emailed synchronously inside the Phase-1
  // submission, so a pre-selected dossier reaches 'code_envoye' within
  // seconds. Anything still sitting at 'preselectionne' after the retry
  // window had its send fail — a mail-provider outage, a transient error —
  // and gets another attempt here.
  //
  // That status filter is also what makes this idempotent: a successful send
  // flips the row to 'code_envoye', so it cannot be picked up twice.
  const dueBefore = new Date(
    Date.now() - ACCESS_CODE.retryAfterMinutes * 60_000,
  ).toISOString();

  const { data: due, error: dueError } = await supabase
    .from("candidatures")
    .select("id, prenom, email, locale, status")
    .eq("status", "preselectionne")
    .lte("created_at", dueBefore)
    .limit(BATCH_SIZE)
    .returns<Candidate[]>();

  if (dueError) {
    console.error("Cron: failed to load due candidatures:", dueError);
  }

  for (const candidate of due ?? []) {
    try {
      const { code, expiresAt } = await issueAccessCode(supabase, candidate.id);

      await sendAccessCodeEmail({
        prenom: candidate.prenom,
        email: candidate.email,
        code,
        expiresAt,
        locale: candidate.locale,
      });

      // Only after the mail provider has accepted it. Flipping the status
      // first would strand a candidate with no code and no way back into the
      // queue.
      await supabase
        .from("candidatures")
        .update({ status: "code_envoye" })
        .eq("id", candidate.id);

      report.issued++;
    } catch (error) {
      report.failed++;
      console.error(`Cron: failed to issue code for ${candidate.id}:`, error);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Expiry reminders at day 7 and day 12
  // -------------------------------------------------------------------------
  for (const { daysLeft, column } of [
    { daysLeft: 7, column: "reminder_7d_sent_at" },
    { daysLeft: 2, column: "reminder_12d_sent_at" },
  ] as const) {
    const threshold = new Date(
      Date.now() + daysLeft * 86_400_000,
    ).toISOString();

    // `is(column, null)` is the idempotency guard: the timestamp is stamped
    // after a successful send, so each reminder goes out at most once per
    // issued code.
    const { data: rows, error } = await supabase
      .from("access_codes")
      .select("candidature_id, expires_at")
      .is(column, null)
      .is("redeemed_at", null)
      .lte("expires_at", threshold)
      .gt("expires_at", new Date().toISOString())
      .limit(BATCH_SIZE);

    if (error) {
      console.error(`Cron: failed to load ${column} reminders:`, error);
      continue;
    }

    for (const row of rows ?? []) {
      try {
        const { data: candidate } = await supabase
          .from("candidatures")
          .select("id, prenom, email, locale, status")
          .eq("id", row.candidature_id)
          .maybeSingle<Candidate>();

        // Someone already deep in Phase 2 doesn't need chasing about a code
        // they've long since used.
        if (!candidate || candidate.status !== "code_envoye") continue;

        await sendCodeExpiringEmail({
          prenom: candidate.prenom,
          email: candidate.email,
          daysLeft,
          locale: candidate.locale,
        });

        await supabase
          .from("access_codes")
          .update({ [column]: new Date().toISOString() })
          .eq("candidature_id", row.candidature_id);

        report.reminded++;
      } catch (error) {
        report.failed++;
        console.error(
          `Cron: failed to remind ${row.candidature_id}:`,
          error,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Expire lapsed codes
  // -------------------------------------------------------------------------
  // Only dossiers still sitting at 'code_envoye'. Anyone who reached
  // 'phase2_en_cours' has redeemed their code and now runs on a session, so
  // the code's own expiry is no longer what governs their access.
  const { data: lapsed, error: lapsedError } = await supabase
    .from("access_codes")
    .select("candidature_id")
    .lt("expires_at", new Date().toISOString())
    .limit(BATCH_SIZE);

  if (lapsedError) {
    console.error("Cron: failed to load lapsed codes:", lapsedError);
  }

  const lapsedIds = (lapsed ?? []).map((r) => r.candidature_id);
  if (lapsedIds.length > 0) {
    const { data: updated, error } = await supabase
      .from("candidatures")
      .update({ status: "expire" })
      .in("id", lapsedIds)
      .eq("status", "code_envoye")
      .select("id");

    if (error) console.error("Cron: failed to expire candidatures:", error);
    report.expired = updated?.length ?? 0;
  }

  console.info("Cron access-codes run:", report);
  return NextResponse.json({ success: true, ...report });
}

/**
 * Vercel Cron invokes scheduled paths with GET, not POST.
 *
 * The hourly driver is the GitHub Actions workflow, which POSTs — so the clock
 * did run. What didn't was the daily Vercel cron kept as its backstop: it
 * answered 405, meaning a disabled or unconfigured workflow would have left
 * nothing running at all, silently. Both methods are accepted now.
 */
export async function GET(request: Request) {
  return POST(request);
}
