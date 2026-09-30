import { NextResponse } from "next/server";
import { readSession } from "@/lib/access-code/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { predictProvider } from "@/lib/payments/pawapay";
import { providerFor } from "@/lib/payments/registry";
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

  // Asked of whichever rail serves this country — pawaPay for Cameroun and
  // Kenya, SasPay for Ghana — rather than of pawaPay always.
  const provider = providerFor(stored as Country, "mobile_money");
  if (!provider?.listOperators) return NextResponse.json({ operators: [] });

  try {
    const listing = await provider.listOperators(stored as Country);
    return NextResponse.json(listing);
  } catch (error) {
    // A provider outage shouldn't blank the payment step — the card path is
    // still available, and the UI falls back to showing only that.
    console.error(
      "Failed to list mobile money operators:",
      (error as Error).message,
    );
    return NextResponse.json({ operators: [], degraded: true });
  }
}

/**
 * Validates a phone number and predicts its operator.
 *
 * pawaPay recommends this before initiation: it returns the sanitised MSISDN
 * and, in most markets, correctly guesses the operator — which removes a step
 * the payer often gets wrong. Prediction is a suggestion here, never a
 * decision: the candidate can always override it, because it is not accurate
 * enough to be silent about.
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { phone?: string } | null;
  if (!body?.phone || typeof body.phone !== "string" || body.phone.length > 30) {
    return NextResponse.json({ error: "errors.invalidRequest" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const progress = await loadPhase2Progress(supabase, session.cid);
  if (!progress) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const stored = progress.candidature.pays;
  if (!(COUNTRIES as readonly string[]).includes(stored)) {
    return NextResponse.json({ valid: false });
  }

  // Prediction is pawaPay's; SasPay has no equivalent and normalises the
  // number its own side, so there the field is simply accepted as typed.
  const provider = providerFor(stored as Country, "mobile_money");
  if (provider?.id !== "pawapay") return NextResponse.json({ valid: true });

  try {
    const predicted = await predictProvider(body.phone, stored as Country);
    if (!predicted) return NextResponse.json({ valid: false });

    return NextResponse.json({
      valid: true,
      provider: predicted.provider,
    });
  } catch (error) {
    // Unavailable ≠ invalid. Reporting a valid number as invalid would block a
    // payment over our own outage, so this stays silent and the server-side
    // check at checkout has the last word.
    console.error("Phone prediction failed:", (error as Error).message);
    return NextResponse.json({ valid: true, degraded: true });
  }
}
