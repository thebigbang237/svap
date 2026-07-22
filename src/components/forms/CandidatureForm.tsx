"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  candidatureSchema,
  type CandidatureInput,
} from "@/lib/validations/candidature";
import {
  PAYS_OPTIONS,
  SECTEUR_OPTIONS,
  PACK_OPTIONS,
  VISA_HISTORIQUE_OPTIONS,
} from "@/lib/constants/candidature-options";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon, LockIcon } from "@/components/marketing/icons";

const inputClasses =
  "w-full bg-transparent border-b border-ink-dim/30 py-3 text-ink transition-all placeholder:text-ink-dim/50 focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta";
const selectClasses = `${inputClasses} cursor-pointer`;
const textareaClasses =
  "w-full resize-none bg-transparent border border-ink-dim/30 p-4 text-ink transition-all placeholder:text-ink-dim/50 focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta";
const labelClasses =
  "block text-xs font-semibold uppercase tracking-[0.2em] text-ink-mid";
const errorClasses = "text-xs text-terracotta";

function isPackValue(
  value: string | null,
): value is CandidatureInput["pack"] {
  return !!value && (PACK_OPTIONS as readonly string[]).includes(value);
}

export function CandidatureForm() {
  const t = useTranslations("candidature");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();

  const packParam = searchParams.get("pack");
  const defaultPack = isPackValue(packParam) ? packParam : undefined;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CandidatureInput>({
    resolver: zodResolver(candidatureSchema),
    defaultValues: {
      pack: defaultPack,
    },
  });

  const fieldError = (name: keyof CandidatureInput) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await fetch("/api/candidature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locale }),
      });

      if (!res.ok) {
        const body: { errors?: Record<string, string[]> } | null = await res
          .json()
          .catch(() => null);

        const fieldErrors = Object.entries(body?.errors ?? {});

        if (fieldErrors.length > 0) {
          for (const [field, messages] of fieldErrors) {
            if (messages?.[0]) {
              setError(field as keyof CandidatureInput, {
                message: messages[0],
              });
            }
          }
        } else {
          setError("root", { message: "form.submitError" });
        }
        return;
      }

      router.push("/candidature/success");
    } catch {
      setError("root", { message: "form.submitError" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      {/* Identity */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="prenom" className={labelClasses}>
            {t("form.prenomLabel")}
          </label>
          <input
            id="prenom"
            type="text"
            placeholder={t("form.prenomPlaceholder")}
            className={inputClasses}
            {...register("prenom")}
          />
          {fieldError("prenom") && (
            <p className={errorClasses}>{fieldError("prenom")}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="nom" className={labelClasses}>
            {t("form.nomLabel")}
          </label>
          <input
            id="nom"
            type="text"
            placeholder={t("form.nomPlaceholder")}
            className={inputClasses}
            {...register("nom")}
          />
          {fieldError("nom") && (
            <p className={errorClasses}>{fieldError("nom")}</p>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="email" className={labelClasses}>
            {t("form.emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            placeholder={t("form.emailPlaceholder")}
            className={inputClasses}
            {...register("email")}
          />
          {fieldError("email") && (
            <p className={errorClasses}>{fieldError("email")}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="telephone" className={labelClasses}>
            {t("form.telephoneLabel")}
          </label>
          <input
            id="telephone"
            type="tel"
            placeholder={t("form.telephonePlaceholder")}
            className={inputClasses}
            {...register("telephone")}
          />
          {fieldError("telephone") && (
            <p className={errorClasses}>{fieldError("telephone")}</p>
          )}
        </div>
      </div>

      {/* Context */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="pays" className={labelClasses}>
            {t("form.paysLabel")}
          </label>
          <select
            id="pays"
            defaultValue=""
            className={selectClasses}
            {...register("pays")}
          >
            <option value="" disabled>
              {t("form.paysPlaceholder")}
            </option>
            {PAYS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`options.pays.${value}`)}
              </option>
            ))}
          </select>
          {fieldError("pays") && (
            <p className={errorClasses}>{fieldError("pays")}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="secteur" className={labelClasses}>
            {t("form.secteurLabel")}
          </label>
          <select
            id="secteur"
            defaultValue=""
            className={selectClasses}
            {...register("secteur")}
          >
            <option value="" disabled>
              {t("form.secteurPlaceholder")}
            </option>
            {SECTEUR_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`options.secteur.${value}`)}
              </option>
            ))}
          </select>
          {fieldError("secteur") && (
            <p className={errorClasses}>{fieldError("secteur")}</p>
          )}
        </div>
      </div>

      {/* Program */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="pack" className={labelClasses}>
            {t("form.packLabel")}
          </label>
          <select
            id="pack"
            defaultValue={defaultPack ?? ""}
            className={selectClasses}
            {...register("pack")}
          >
            <option value="" disabled>
              {t("form.packPlaceholder")}
            </option>
            {PACK_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`options.pack.${value}`)}
              </option>
            ))}
          </select>
          {fieldError("pack") && (
            <p className={errorClasses}>{fieldError("pack")}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="visaHistorique" className={labelClasses}>
            {t("form.visaHistoriqueLabel")}
          </label>
          <select
            id="visaHistorique"
            defaultValue=""
            className={selectClasses}
            {...register("visaHistorique", {
              setValueAs: (v) => (v === "" ? undefined : v),
            })}
          >
            <option value="" disabled>
              {t("form.visaHistoriquePlaceholder")}
            </option>
            {VISA_HISTORIQUE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`options.visaHistorique.${value}`)}
              </option>
            ))}
          </select>
          {fieldError("visaHistorique") && (
            <p className={errorClasses}>{fieldError("visaHistorique")}</p>
          )}
        </div>
      </div>

      {/* Legal & Motivation */}
      <div className="space-y-2">
        <label htmlFor="casierJudiciaire" className={labelClasses}>
          {t("form.casierJudiciaireLabel")}
        </label>
        <input
          id="casierJudiciaire"
          type="text"
          placeholder={t("form.casierJudiciairePlaceholder")}
          className={inputClasses}
          {...register("casierJudiciaire")}
        />
        {fieldError("casierJudiciaire") && (
          <p className={errorClasses}>{fieldError("casierJudiciaire")}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="motivation" className={labelClasses}>
          {t("form.motivationLabel")}
        </label>
        <textarea
          id="motivation"
          rows={6}
          placeholder={t("form.motivationPlaceholder")}
          className={textareaClasses}
          {...register("motivation")}
        />
        {fieldError("motivation") && (
          <p className={errorClasses}>{fieldError("motivation")}</p>
        )}
      </div>

      {/* Submit */}
      <div className="flex flex-col items-start justify-between gap-8 pt-8 md:flex-row md:items-center">
        <div className="flex items-start gap-4 text-ink-dim">
          <LockIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="max-w-60 text-xs leading-snug">
            {t("form.rgpdNote")}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3">
          <CTAButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {isSubmitting ? t("form.submittingLabel") : t("form.submitLabel")}
          </CTAButton>
          {errors.root?.message && (
            <p className={errorClasses}>{t(errors.root.message)}</p>
          )}
        </div>
      </div>
    </form>
  );
}
