import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { PACK_SPECS, type Country, type Pack } from "@/lib/constants/program";
import { providerFor } from "@/lib/payments/registry";
import { convertUsd, usdOnly } from "@/lib/payments/fx";
import { createPaymentRecord, markPaymentFailed } from "@/lib/payments/record";
import { PaymentConfigError } from "@/lib/payments/types";
import {
  listOperators,
  predictProvider,
  formatAmountForOperator,
  PawapayIndeterminate,
  PawapayRejection,
} from "@/lib/payments/pawapay";

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

  // -------------------------------------------------------------------------
  // Mobile money: everything that can be validated before the money moves
  // -------------------------------------------------------------------------
  // pawaPay documents each of these as an avoidable rejection. Catching them
  // here costs one or two API calls; catching them after initiation costs the
  // candidate a failed payment on a page they had already committed to.
  let msisdn = parsed.data.phone;
  let amountOverride: string | undefined;

  if (parsed.data.method === "mobile_money") {
    let operators;
    try {
      operators = (await listOperators(country)).operators;
    } catch (error) {
      console.error("Operator lookup failed at checkout:", (error as Error).message);
      return NextResponse.json({ error: "errors.checkoutFailed" }, { status: 502 });
    }

    // The operator must still be one this account can actually collect
    // through — a list fetched minutes ago may name one that has since closed.
    const operator = operators.find((o) => o.provider === parsed.data.operator);
    if (!operator) {
      return NextResponse.json(
        { error: "errors.operatorUnavailableNow" },
        { status: 409 },
      );
    }

    // Sanitise the number into the MSISDN pawaPay expects, and reject a
    // malformed one before it becomes an INVALID_PHONE_NUMBER rejection.
    try {
      const predicted = await predictProvider(parsed.data.phone!, country);
      if (!predicted) {
        return NextResponse.json({ error: "errors.phoneInvalid" }, { status: 400 });
      }
      msisdn = predicted.phoneNumber;
    } catch (error) {
      // Validation being unavailable must not block the payment — send the
      // digits as typed and let pawaPay have the final say.
      console.error("predict-provider unavailable:", (error as Error).message);
    }

    // Decimal support and wallet limits vary per operator, and both are known
    // up front.
    const shaped = formatAmountForOperator(money.amountLocal, operator);
    if ("error" in shaped) {
      console.error(
        `Fee ${money.amountLocal} ${money.currency} is ${shaped.error} for ${operator.provider} (limit ${shaped.limit}).`,
      );
      return NextResponse.json(
        {
          error:
            shaped.error === "too_small"
              ? "errors.amountTooSmall"
              : "errors.amountTooLarge",
        },
        { status: 409 },
      );
    }
    amountOverride = shaped.amount;
  }

  // -------------------------------------------------------------------------
  // Persist the reference BEFORE initiating
  // -------------------------------------------------------------------------
  // pawaPay's central consistency rule. If the initiation call times out, this
  // row is what lets /api/cron/payments find out what actually happened
  // instead of the deposit becoming an untracked charge.
  const reference = provider.newReference?.();

  let payment = reference
    ? await createPaymentRecord(supabase, {
        candidatureId: session.cid,
        provider: provider.id,
        providerRef: reference,
        method: parsed.data.method,
        money,
        // Recorded for reconciliation: "pawapay" alone doesn't say whether the
        // money moved over MTN or Orange, which is the first thing support asks.
        operator: parsed.data.operator,
      })
    : null;

  if (reference && !payment) {
    return NextResponse.json({ error: "errors.server" }, { status: 500 });
  }

  try {
    const checkout = await provider.createCheckout({
      candidatureId: session.cid,
      country,
      money,
      reference,
      amountOverride,
      phone: msisdn,
      operator: parsed.data.operator,
      email: progress.candidature.email,
      // Hosted card gateways that don't collect the payer's identity
      // themselves take it from here. Phase-1 values, which is what the
      // dossier is keyed on.
      customer: {
        firstName: progress.candidature.prenom,
        lastName: progress.candidature.nom,
        phone: progress.candidature.telephone ?? "",
      },
      locale: progress.candidature.locale,
      returnUrl,
      notificationUrl: `${siteUrl}/api/payments/webhooks/${provider.id}`,
      description: `SVAP 2026 verification`,
    });

    // Providers that mint their own reference (Stripe) are recorded now, since
    // it did not exist beforehand.
    if (!payment) {
      payment = await createPaymentRecord(supabase, {
        candidatureId: session.cid,
        provider: provider.id,
        providerRef: checkout.providerRef,
        method: parsed.data.method,
        money,
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
    }

    return NextResponse.json({
      paymentId: payment.id,
      redirectUrl: checkout.redirectUrl,
      asynchronous: checkout.asynchronous,
      amountLocal: money.amountLocal,
      currency: money.currency,
    });
  } catch (error) {
    // An outcome we cannot determine is NOT a failure. The deposit may be
    // live, so the row stays pending, the candidate is sent to the waiting
    // screen, and the poll plus the reconciliation cycle resolve it. Telling
    // them it failed here is how a double charge happens.
    if (error instanceof PawapayIndeterminate && payment) {
      console.error("pawaPay initiation indeterminate:", error.message);
      return NextResponse.json({
        paymentId: payment.id,
        asynchronous: true,
        indeterminate: true,
        amountLocal: money.amountLocal,
        currency: money.currency,
      });
    }

    // An explicit rejection is safe to record and safe to retry.
    if (error instanceof PawapayRejection) {
      console.error(
        `pawaPay rejected the deposit (${error.failureCode}):`,
        error.message,
      );
      if (payment) {
        await markPaymentFailed(
          supabase,
          payment.id,
          `${error.failureCode}: ${error.message}`,
        );
      }
      return NextResponse.json(
        { error: rejectionMessageKey(error.failureCode) },
        { status: 502 },
      );
    }

    console.error("Checkout creation failed:", (error as Error).message);
    if (payment) {
      await markPaymentFailed(supabase, payment.id, (error as Error).message);
    }
    return NextResponse.json({ error: "errors.checkoutFailed" }, { status: 502 });
  }
}

/**
 * pawaPay failure codes → a message the candidate can act on.
 *
 * pawaPay is explicit that `failureMessage` is written for our support team,
 * not for the payer, so it is logged rather than shown. Anything unmapped falls
 * back to the generic retry copy.
 */
function rejectionMessageKey(failureCode: string): string {
  switch (failureCode) {
    case "PROVIDER_TEMPORARILY_UNAVAILABLE":
      return "errors.operatorUnavailableNow";
    case "INVALID_PHONE_NUMBER":
      return "errors.phoneInvalid";
    case "AMOUNT_OUT_OF_BOUNDS":
      return "errors.amountOutOfBounds";
    case "INVALID_PROVIDER":
      return "errors.operatorUnavailableNow";
    case "DEPOSITS_NOT_ALLOWED":
    case "AUTHENTICATION_ERROR":
    case "AUTHORISATION_ERROR":
    case "NO_AUTHENTICATION":
    case "HTTP_SIGNATURE_ERROR":
      // Our configuration is wrong, not the candidate's input. Generic copy,
      // loud log — already emitted by the caller.
      return "errors.checkoutFailed";
    default:
      return "errors.paymentFailed";
  }
}
