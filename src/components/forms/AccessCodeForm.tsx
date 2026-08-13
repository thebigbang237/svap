"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { ACCESS_CODE } from "@/lib/constants/program";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";
import { TextField, errorClasses } from "./fields";

interface PortalValues {
  fullName: string;
  code: string;
}

interface ResendValues {
  resendFullName: string;
  resendEmail: string;
}

const CODE_PLACEHOLDER = `${ACCESS_CODE.prefix}-XXXX-XXXX`;

/**
 * Phase-2 portal gate (Étape 0).
 *
 * Two factors: the code, and the full name it was issued against. The code
 * arrives pre-filled from the email deep link; the name is always typed,
 * which is what stops a forwarded link from being enough on its own.
 */
export function AccessCodeForm() {
  const t = useTranslations("portal");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showResend, setShowResend] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PortalValues>({
    // Pre-filled from the ?code= deep link in the access-code email — one tap
    // from the inbox on mobile, with only the name left to type.
    defaultValues: { code: searchParams.get("code") ?? "" },
  });

  const resendForm = useForm<ResendValues>();

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await fetch("/api/documents/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        router.push("/documents/informations");
        return;
      }

      const body: { error?: string; canResend?: boolean } | null = await res
        .json()
        .catch(() => null);

      setError("root", { message: body?.error ?? "portal.errors.server" });
      // An expired code is the one failure with an obvious next step, so open
      // the resend panel rather than making the candidate hunt for it.
      if (body?.canResend) setShowResend(true);
    } catch {
      setError("root", { message: "portal.errors.server" });
    }
  });

  const onResend = resendForm.handleSubmit(async (values) => {
    try {
      await fetch("/api/documents/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.resendFullName,
          email: values.resendEmail,
        }),
      });
    } catch {
      /* The endpoint answers identically either way; nothing to branch on. */
    }
    // Always the same confirmation, matching the endpoint's deliberate
    // refusal to reveal whether the address belongs to a candidature.
    setResendDone(true);
  });

  // next-intl namespaces are addressed from the root, but the API returns
  // fully-qualified keys ("portal.errors.invalid") so the server never has to
  // know which namespace the client mounted.
  const message = (key: string) => t(key.replace(/^portal\./, ""));

  return (
    <div className="space-y-10">
      <form onSubmit={onSubmit} className="space-y-8" noValidate>
        <TextField
          id="fullName"
          label={t("fullNameLabel")}
          placeholder={t("fullNamePlaceholder")}
          hint={<p className="text-xs text-ink-dim">{t("fullNameHint")}</p>}
          error={
            errors.fullName ? t("errors.required") : undefined
          }
          registration={register("fullName", { required: true })}
        />

        <TextField
          id="code"
          label={t("codeLabel")}
          placeholder={CODE_PLACEHOLDER}
          hint={<p className="text-xs text-ink-dim">{t("codeHint")}</p>}
          error={errors.code ? t("errors.required") : undefined}
          registration={register("code", { required: true })}
        />

        <div className="flex flex-col items-start gap-4 pt-4">
          <CTAButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </CTAButton>

          {errors.root?.message && (
            <p className={errorClasses} role="alert">
              {message(errors.root.message)}
            </p>
          )}
        </div>
      </form>

      <div className="border-t border-ink-dim/20 pt-8">
        {!showResend && !resendDone && (
          <button
            type="button"
            onClick={() => setShowResend(true)}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue transition-colors hover:text-terracotta"
          >
            {t("resend.trigger")}
          </button>
        )}

        {showResend && !resendDone && (
          <form onSubmit={onResend} className="space-y-6" noValidate>
            <div>
              <h2 className="font-serif text-2xl font-normal text-blue-dark">
                {t("resend.title")}
              </h2>
              <p className="mt-2 text-sm text-ink-dim">
                {t("resend.description")}
              </p>
            </div>

            <TextField
              id="resendFullName"
              label={t("fullNameLabel")}
              placeholder={t("fullNamePlaceholder")}
              registration={resendForm.register("resendFullName", {
                required: true,
              })}
            />
            <TextField
              id="resendEmail"
              type="email"
              inputMode="email"
              label={t("resend.emailLabel")}
              placeholder={t("resend.emailPlaceholder")}
              registration={resendForm.register("resendEmail", {
                required: true,
              })}
            />

            <CTAButton
              type="submit"
              variant="secondary"
              disabled={resendForm.formState.isSubmitting}
            >
              {t("resend.submit")}
            </CTAButton>
          </form>
        )}

        {resendDone && (
          <div className="border-s-2 border-blue bg-sky-mid/60 p-6">
            <p className="text-ink">{t("resend.confirmation")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
