import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { PACK_SPECS, type Country, type Pack } from "@/lib/constants/program";
import { providerFor } from "@/lib/payments/registry";
import { convertUsd, usdOnly } from "@/lib/payments/fx";
import { createPaymentRecord } from "@/lib/payments/record";
import { PaymentConfigError } from "@/lib/payments/types";

const checkoutSchema = z.object({
  method: z.enum(["mobile_money", "card"]),
  /** Required for mobile money; the prompt goes to this handset. */
  phone: z.string().trim().regex(/^[0-9+\s().-]{6,20}$/).optional(),
  /**
   * Mobile money operator id from /api/payments/operators, e.g.
   * "MTN_MOMO_CMR". pawaPay v2 carries the provider in the deposit payload,
   * so the candidate has to pick it. Pattern-bounded rather than free text
   * because it is forwarded to the provider verbatim.
   */
  operator: z.string().trim().regex(/^[A-Z0-9_]{3,40}$/).optional(),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.invalidRequest" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const progress = await loadPhase2Progress(supabase, session.cid);
  if (!progress) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  // Idempotent from the candidate's side: someone who pays, then hits back
  // and retries, must not be charged twice.
  if (progress.hasPaid) {
    return NextResponse.json({ alreadyPaid: true }, { status: 409 });
  }

  // Read-only once submitted. Enforced here as well as in the page guard: a
  // direct POST would otherwise overwrite a dossier that is already under
  // review.
  if (progress.locked) {
    return NextResponse.json({ error: "errors.locked" }, { status: 409 });
  }

  // The earlier steps have to be done — this is also the server-side twin of
  // the page guard, so a direct POST can't skip them.
  if (!progress.hasPersonalInfo || !progress.hasRiskAssessment) {
    return NextResponse.json({ error: "errors.stepsIncomplete" }, { status: 409 });
  }

  const country = progress.candidature.pays as Country;
  const pack = progress.candidature.pack as Pack;
  const spec = PACK_SPECS[pack];

  if (!spec) {
    return NextResponse.json({ error: "errors.server" }, { status: 500 });
  }

  const provider = providerFor(country, parsed.data.method);
  if (!provider) {
    return NextResponse.json(
      { error: "errors.methodUnavailable" },
      { status: 400 },
    );
  }

  if (parsed.data.method === "mobile_money") {
    if (!parsed.data.phone) {
      return NextResponse.json({ error: "errors.phoneRequired" }, { status: 400 });
    }
    if (!parsed.data.operator) {
      return NextResponse.json(
        { error: "errors.operatorRequired" },
        { status: 400 },
      );
    }
  }

  // Mobile money collects in local currency; cards settle in USD against the
  // US entity, so only the former has a rate to lock.
  let money;
  try {
    money =
      parsed.data.method === "mobile_money"
        ? convertUsd(spec.verificationFeeUsd, country)
        : usdOnly(spec.verificationFeeUsd);
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      console.error("Payment configuration error:", error.message);
      return NextResponse.json({ error: "errors.server" }, { status: 500 });
    }
    throw error;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const returnUrl = `${siteUrl}/${progress.candidature.locale}/documents/paiement`;

  try {
    const checkout = await provider.createCheckout({
      candidatureId: session.cid,
      country,
      money,
      phone: parsed.data.phone,
      operator: parsed.data.operator,
      email: progress.candidature.email,
      locale: progress.candidature.locale,
      returnUrl,
      description: `SVAP 2026 verification`,
    });

    const payment = await createPaymentRecord(supabase, {
      candidatureId: session.cid,
      provider: provider.id,
      providerRef: checkout.providerRef,
      method: parsed.data.method,
      money,
      // Recorded for reconciliation: "pawapay" alone doesn't say whether the
      // money moved over MTN or Orange, which is the first thing support asks.
      operator: parsed.data.operator,
    });

    if (!payment) {
      // The provider has an open intent we can't track. Loud, because it
      // needs manual reconciliation rather than a silent retry.
      console.error(
        `Payment record failed AFTER provider checkout ${provider.id}/${checkout.providerRef} — reconcile manually.`,
      );
      return NextResponse.json({ error: "errors.server" }, { status: 500 });
    }

    return NextResponse.json({
      paymentId: payment.id,
      redirectUrl: checkout.redirectUrl,
      asynchronous: checkout.asynchronous,
      amountLocal: money.amountLocal,
      currency: money.currency,
    });
  } catch (error) {
    console.error("Checkout creation failed:", (error as Error).message);
    return NextResponse.json({ error: "errors.checkoutFailed" }, { status: 502 });
  }
}
