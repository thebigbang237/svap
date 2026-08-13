"use client";

import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { consentsSchema, type ConsentsInput } from "@/lib/validations/phase2";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";
import { CheckboxField, errorClasses } from "./fields";

const CONSENTS = [
  "verificationTiers",
  "certificationHonneur",
  "conditionsGenerales",
  "fraudeSignalement",
  "traitementDonnees",
] as const;

/**
 * Étape 5 — consents.
 *
 * No "accept all" control, deliberately. Each box is a separate permission,
 * and a single click that grants all five is exactly the pattern that makes
 * consent unarguable later. Ticking them individually is the point.
 */
export function ConsentsForm() {
  const t = useTranslations("phase2.consentements");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConsentsInput>({
    resolver: zodResolver(consentsSchema),
    mode: "onTouched",
  });

  const fieldError = (name: FieldPath<ConsentsInput>) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await fetch("/api/documents/consentements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body: { error?: string } | null = await res
        .json()
        .catch(() => null);

      if (!res.ok) {
        setError("root", { message: body?.error ?? "errors.server" });
        return;
      }

      router.push("/documents/termine");
    } catch {
      setError("root", { message: "errors.network" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <div className="border-s-2 border-terracotta bg-sky-mid/60 p-6 text-sm text-ink">
        {t("intro")}
      </div>

      <div className="space-y-6">
        {CONSENTS.map((name) => (
          <CheckboxField
            key={name}
            id={name}
            label={t(`items.${name}`)}
            error={fieldError(name)}
            registration={register(name)}
          />
        ))}
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-ink-dim/20 pt-10">
        <p className="mb-2 max-w-xl text-sm text-ink-mid">{t("finalNote")}</p>
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
            {t(errors.root.message)}
          </p>
        )}
      </div>
    </form>
  );
}
