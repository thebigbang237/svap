"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PaymentMethod } from "@/lib/payments/types";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";
import { Ltr } from "@/components/layout/Ltr";
import { TextField, errorClasses, labelClasses } from "./fields";

/**
 * Polling cadence for the mobile-money waiting state.
 *
 * A pawaPay deposit resolves when the payer approves a prompt on their
 * handset. That takes anywhere from a few seconds to a couple of minutes —
 * they may have to find their phone, dismiss a call, remember their PIN.
 * Polling every 4s for 5 minutes covers the realistic range without
 * hammering the provider, and the timeout leaves them with a "check your
 * phone" message rather than a spinner that never stops.
 */
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type Phase = "choose" | "waiting" | "failed" | "timeout";

interface Operator {
  provider: string;
  displayName: string;
  currency: string;
}

export function PaymentForm({
  methods,
  defaultPhone,
  amountUsd,
  amountLocal,
  currency,
}: {
  methods: PaymentMethod[];
  defaultPhone: string;
  amountUsd: number;
  /** Local-currency equivalent, null where the country is card-only. */
  amountLocal: number | null;
  currency: string | null;
}) {
  const t = useTranslations("phase2.paiement");
  const router = useRouter();

  const [method, setMethod] = useState<PaymentMethod>(methods[0]);
  const [phone, setPhone] = useState(defaultPhone);
  const [phase, setPhase] = useState<Phase>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charged, setCharged] = useState<{ amount: number; currency: string } | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operator, setOperator] = useState<string>("");
  const [operatorsLoading, setOperatorsLoading] = useState(false);

  // pawaPay v2 carries the operator in the deposit payload, so it has to be
  // chosen. The list comes from their active configuration rather than a
  // hard-coded table, so an operator down for maintenance is never offered.
  useEffect(() => {
    if (!methods.includes("mobile_money")) return;
    let cancelled = false;

    setOperatorsLoading(true);
    fetch("/api/payments/operators")
      .then((res) => res.json())
      .then((body: { operators?: Operator[] }) => {
        if (cancelled) return;
        const list = body.operators ?? [];
        setOperators(list);
        // A single operator is the common case in several markets — preselect
        // it rather than making it a pointless decision.
        if (list.length === 1) setOperator(list[0].provider);
      })
      .catch(() => {
        /* card remains available; the picker simply stays empty */
      })
      .finally(() => {
        if (!cancelled) setOperatorsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [methods]);

  const timers = useRef<{ poll?: number; timeout?: number }>({});

  const clearTimers = useCallback(() => {
    if (timers.current.poll) window.clearInterval(timers.current.poll);
    if (timers.current.timeout) window.clearTimeout(timers.current.timeout);
    timers.current = {};
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const startPolling = useCallback(
    (paymentId: string) => {
      setPhase("waiting");

      timers.current.poll = window.setInterval(async () => {
        try {
          const res = await fetch(
            `/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`,
          );
          const body: { status?: string; failureReason?: string } | null =
            await res.json().catch(() => null);

          if (body?.status === "paye") {
            clearTimers();
            router.push("/documents/pieces");
          } else if (body?.status === "echoue" || body?.status === "annule") {
            clearTimers();
            setError(body.failureReason ?? "errors.paymentFailed");
            setPhase("failed");
          }
        } catch {
          // A dropped poll is not a failed payment — the next tick retries.
        }
      }, POLL_INTERVAL_MS);

      timers.current.timeout = window.setTimeout(() => {
        clearTimers();
        setPhase("timeout");
      }, POLL_TIMEOUT_MS);
    },
    [clearTimers, router],
  );

  async function startCheckout() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          phone: method === "mobile_money" ? phone : undefined,
          operator: method === "mobile_money" ? operator : undefined,
        }),
      });

      const body: {
        paymentId?: string;
        redirectUrl?: string;
        asynchronous?: boolean;
        amountLocal?: number;
        currency?: string;
        alreadyPaid?: boolean;
        error?: string;
      } | null = await res.json().catch(() => null);

      // Someone who paid then hit back: send them onward rather than
      // offering to charge them again.
      if (res.status === 409 && body?.alreadyPaid) {
        router.push("/documents/pieces");
        return;
      }

      if (!res.ok) {
        setError(body?.error ?? "errors.server");
        return;
      }

      if (body?.redirectUrl) {
        // Card: hand off to Stripe's hosted page. Settlement is still
        // confirmed by webhook, never by the return from this redirect.
        window.location.href = body.redirectUrl;
        return;
      }

      if (body?.paymentId) {
        if (body.amountLocal && body.currency) {
          setCharged({ amount: body.amountLocal, currency: body.currency });
        }
        startPolling(body.paymentId);
      }
    } catch {
      setError("errors.network");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "waiting") {
    return (
      <div className="space-y-8">
        <div className="border-s-2 border-terracotta bg-sky-mid/60 p-8">
          <h2 className="mb-4 font-serif text-[24px] font-normal text-blue-dark">
            {t("waiting.title")}
          </h2>
          <p className="mb-4 text-ink">{t("waiting.instruction")}</p>
          {charged && (
            <p className="text-ink-mid">
              {t("waiting.amount")}{" "}
              <Ltr className="font-semibold">
                {`${charged.amount} ${charged.currency}`}
              </Ltr>
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-3 text-ink-dim"
          role="status"
          aria-live="polite"
        >
          <span className="h-2 w-2 animate-pulse bg-terracotta" />
          <span className="text-sm">{t("waiting.polling")}</span>
        </div>

        <p className="text-sm text-ink-dim">{t("waiting.dontClose")}</p>
      </div>
    );
  }

  if (phase === "timeout") {
    return (
      <div className="space-y-8">
        <div className="border-s-2 border-blue bg-sky-mid/60 p-8">
          <h2 className="mb-4 font-serif text-[24px] font-normal text-blue-dark">
            {t("timeout.title")}
          </h2>
          {/* Carefully worded: we genuinely don't know yet. Telling someone
              their payment failed when it may have succeeded is how you get
              a double charge. */}
          <p className="text-ink">{t("timeout.description")}</p>
        </div>
        <CTAButton variant="secondary" onClick={() => window.location.reload()}>
          {t("timeout.refresh")}
        </CTAButton>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <fieldset className="space-y-4">
        <legend className={labelClasses}>{t("chooseMethod")}</legend>
        <div className="mt-4 space-y-4">
          {methods.map((m) => (
            <label
              key={m}
              className={[
                "flex cursor-pointer items-start gap-4 border p-6 transition-colors",
                method === m
                  ? "border-terracotta bg-white"
                  : "border-ink-dim/20 bg-white hover:border-blue",
              ].join(" ")}
            >
              <input
                type="radio"
                name="method"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              <span>
                <span className="block font-semibold text-ink">
                  {t(`methods.${m}.title`)}
                </span>
                <span className="mt-1 block text-sm text-ink-mid">
                  {t(`methods.${m}.description`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {method === "mobile_money" && (
        <div className="space-y-8">
          {/* The candidate pays in their own currency. Showing only USD
              leaves them unable to check the figure against the prompt that
              arrives on their handset. */}
          {amountLocal !== null && currency && (
            <div className="border border-ink-dim/20 bg-white p-6">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim">
                {t("amountToPay")}
              </span>
              <Ltr className="font-serif text-[32px] font-normal leading-none text-terracotta">
                {`${amountLocal.toLocaleString("en-US")} ${currency}`}
              </Ltr>
              <p className="mt-2 text-xs text-ink-dim">
                {t("amountEquivalent", { usd: amountUsd })}
              </p>
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className={labelClasses}>{t("operatorLabel")}</legend>
            {operatorsLoading ? (
              <p className="pt-2 text-sm text-ink-dim">{t("operatorLoading")}</p>
            ) : operators.length === 0 ? (
              <p className="pt-2 text-sm text-terracotta">
                {t("operatorUnavailable")}
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {operators.map((op) => (
                  <label
                    key={op.provider}
                    className={[
                      "flex cursor-pointer items-center gap-3 border p-4 transition-colors",
                      operator === op.provider
                        ? "border-terracotta bg-white"
                        : "border-ink-dim/20 bg-white hover:border-blue",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="operator"
                      value={op.provider}
                      checked={operator === op.provider}
                      onChange={() => setOperator(op.provider)}
                      className="h-4 w-4 accent-terracotta"
                    />
                    <span className="text-sm font-medium text-ink">
                      {op.displayName}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <TextField
            id="paymentPhone"
            type="tel"
            inputMode="tel"
            label={t("phoneLabel")}
            placeholder={t("phonePlaceholder")}
            hint={<p className="text-xs text-ink-dim">{t("phoneHint")}</p>}
            registration={{
              value: phone,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setPhone(e.target.value),
            }}
          />
        </div>
      )}

      {method === "card" && (
        <div className="border border-ink-dim/20 bg-white p-6">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim">
            {t("amountToPay")}
          </span>
          <Ltr className="font-serif text-[32px] font-normal leading-none text-terracotta">
            {`$${amountUsd}`}
          </Ltr>
          {/* Cards settle in USD against the US entity and the issuer converts
              at its own rate, so quoting a local figure here would be a number
              we cannot honour. */}
          <p className="mt-2 text-xs text-ink-dim">{t("cardConversionNote")}</p>
        </div>
      )}

      <div className="flex flex-col items-start gap-3 border-t border-ink-dim/20 pt-10">
        <CTAButton
          variant="primary"
          disabled={
            busy ||
            (method === "mobile_money" && (phone.trim().length < 6 || !operator))
          }
          onClick={startCheckout}
          icon={<ArrowRightIcon className="h-4 w-4" />}
        >
          {busy ? t("processing") : t("pay")}
        </CTAButton>

        {error && (
          <p className={errorClasses} role="alert">
            {error.startsWith("errors.") ? t(error) : error}
          </p>
        )}
      </div>
    </div>
  );
}
