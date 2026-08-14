import { NextResponse } from "next/server";
import { readSession } from "@/lib/access-code/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { listOperators } from "@/lib/payments/pawapay";
import { COUNTRIES, type Country } from "@/lib/constants/program";

/**
 * Mobile money operators available to this candidate.
 *
 * The country comes from their own dossier, not from the request — a payer in
 * Morocco has no business enumerating Cameroonian operators, and the list is
 * only ever needed for the country they applied from.
 *
 * pawaPay v2 requires the operator id in the deposit payload, so this can't be
 * skipped. It also can't be hard-coded: `/v2/active-conf` reports what this
 * account is actually configured for, including operators temporarily CLOSED
 * for maintenance, which a static list would happily keep offering.
 */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const progress = await loadPhase2Progress(supabase, session.cid);
  if (!progress) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const stored = progress.candidature.pays;
  if (!(COUNTRIES as readonly string[]).includes(stored)) {
    return NextResponse.json({ operators: [] });
  }

  try {
    const operators = await listOperators(stored as Country);
    return NextResponse.json({ operators });
  } catch (error) {
    // A pawaPay outage shouldn't blank the payment step — the card path is
    // still available, and the UI falls back to showing only that.
    console.error(
      "Failed to list mobile money operators:",
      (error as Error).message,
    );
    return NextResponse.json({ operators: [], degraded: true });
  }
}
