import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerById } from "@/lib/payments/registry";
import { settlePayment, type PaymentRow } from "@/lib/payments/record";
import type { PaymentProviderId } from "@/lib/payments/types";

/**
 * Payment reconciliation.
 *
 * pawaPay is explicit that a callback is not a guarantee: network problems,
 * downtime on our side, or a misconfigured callback URL all lose deliveries,
 * and the merchant is expected to run a recheck cycle rather than leave
 * customers waiting. This is that cycle.
 *
 * It matters more here than in a typical integration, because our other
 * settlement path is a poll that only runs while the candidate has the payment
 * page open. Someone who approves the PIN prompt and then closes the tab — on
 * a phone, with a flaky connection, which is the normal case in these markets
 * — has genuinely paid and has nothing to show for it until this job runs.
 *
 * Everything it does is idempotent: `settlePayment` guards the receipt with
 * `receipt_sent_at`, and advancing the dossier is scoped to the one status it
 * may move from. A double run cannot double-charge, double-send or rewind.
 */

/** pawaPay's own suggested threshold: anything pending longer than this is stale. */
const STALE_AFTER_MINUTES = 15;

/**
 * Stop re-checking eventually. A deposit still unresolved after two days is an
 * operations problem, not a timing one, and polling it forever hides that.
 */
const GIVE_UP_AFTER_HOURS = 48;

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

async function reconcile() {
  const supabase = createAdminClient();
  const now = Date.now();

  const staleBefore = new Date(now - STALE_AFTER_MINUTES * 60_000).toISOString();
  const giveUpBefore = new Date(now - GIVE_UP_AFTER_HOURS * 3_600_000).toISOString();

  const { data: pending, error } = await supabase
    .from("payments")
    .select("*")
    .in("status", ["en_attente", "en_cours"])
    .lt("created_at", staleBefore)
    .gt("created_at", giveUpBefore)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)
    .returns<(PaymentRow & { created_at: string })[]>();

  if (error) {
    console.error("Payment reconciliation query failed:", error.message);
    return { checked: 0, settled: 0, failed: 0, unresolved: 0 };
  }

  let settled = 0;
  let failed = 0;
  let unresolved = 0;

  for (const payment of pending ?? []) {
    const provider = providerById(payment.provider as PaymentProviderId);
    if (!provider) continue;

    try {
      const live = await provider.getStatus(payment.provider_ref);

      if (live.status === payment.status) {
        unresolved += 1;
        continue;
      }

      const becamePaid = live.status === "paye";

      await supabase
        .from("payments")
        .update({
          status: live.status,
          failure_reason: live.failureReason ?? null,
          completed_at: becamePaid
            ? new Date().toISOString()
            : payment.completed_at,
        })
        .eq("id", payment.id)
        // Guards against the poll or a callback resolving the same row
        // concurrently.
        .in("status", ["en_attente", "en_cours"]);

      if (becamePaid) {
        await settlePayment(supabase, { ...payment, status: "paye" });
        settled += 1;
      } else if (live.status === "echoue" || live.status === "annule") {
        failed += 1;
      } else {
        unresolved += 1;
      }
    } catch (err) {
      // Provider unreachable, or a status we can't interpret. Left pending
      // deliberately — the next run tries again, and a payment is never
      // failed on the strength of our own outage.
      unresolved += 1;
      console.error(
        `Reconciliation failed for ${payment.provider}/${payment.provider_ref}:`,
        (err as Error).message,
      );
    }
  }

  const checked = pending?.length ?? 0;
  console.log(
    `Cron payments run: checked=${checked} settled=${settled} failed=${failed} unresolved=${unresolved}`,
  );

  return { checked, settled, failed, unresolved };
}

/**
 * Vercel Cron issues a GET. POST is kept so the job can be triggered by hand
 * (see docs/runbook.md) without a second code path.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse(null, { status: 404 });
  return NextResponse.json(await reconcile());
}

export async function POST(request: Request) {
  return GET(request);
}
