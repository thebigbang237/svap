"use client";

import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  riskAssessmentSchema,
  type RiskAssessmentInput,
} from "@/lib/validations/phase2";
import {
  REFUS_USA_COUNT_OPTIONS,
  ATTACHES_FAMILIALES_OPTIONS,
  ACTIVITE_PAYS_OPTIONS,
  VOYAGES_OPTIONS,
  PATRIMOINE_OPTIONS,
  FAMILLE_USA_OPTIONS,
} from "@/lib/constants/program";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";
import {
  SelectField,
  TextareaField,
  BooleanRadioGroup,
  CheckboxField,
  errorClasses,
} from "./fields";

const emptyToUndefined = { setValueAs: (v: string) => (v === "" ? undefined : v) };

const REQUIRED: (keyof RiskAssessmentInput)[] = [
  "refusEntreePaysEtranger", "depassementVisa", "refusUsaCount",
  "attachesFamiliales", "activitePays", "voyagesHorsAfrique",
  "patrimoine", "familleUsa", "engagementsRetour", "motivationRetour",
  "certificationHonneur",
];

function isAnswered(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  if (value === undefined || value === null) return false;
  return String(value).trim() !== "";
}

/**
 * Étape 2 — non-return risk questionnaire (§14 Étape 4).
 *
 * The computed score is never shown back to the candidate: it's an internal
 * review aid, and displaying it would both invite gaming of the answers and
 * read as a verdict the site has no standing to give.
 */
export function RiskAssessmentForm() {
  const t = useTranslations("phase2");
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RiskAssessmentInput>({
    resolver: zodResolver(riskAssessmentSchema),
    mode: "onTouched",
  });

  const values = watch();
  const complete = REQUIRED.every((field) =>
    field === "certificationHonneur"
      ? values[field] === true
      : isAnswered(values[field]),
  );

  const fieldError = (name: FieldPath<RiskAssessmentInput>) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const options = (values: readonly string[], group: string) =>
    values.map((value) => ({
      value,
      label: t(`options.${group}.${value}`),
    }));

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await fetch("/api/documents/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body: {
        error?: string;
        errors?: Record<string, string[]>;
      } | null = await res.json().catch(() => null);

      if (!res.ok) {
        const fieldErrors = Object.entries(body?.errors ?? {});
        if (fieldErrors.length > 0) {
          for (const [field, messages] of fieldErrors) {
            if (messages?.[0]) {
              setError(field as FieldPath<RiskAssessmentInput>, {
                message: messages[0],
              });
            }
          }
        } else {
          setError("root", { message: body?.error ?? "errors.server" });
        }
        return;
      }

      router.push("/documents/paiement");
    } catch {
      setError("root", { message: "errors.server" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <div className="border-s-2 border-blue bg-sky-mid/60 p-6 text-sm text-ink">
        {t("evaluation.intro")}
      </div>

      <fieldset className="space-y-8">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("evaluation.historySection")}
        </legend>

        <BooleanRadioGroup
          name="refusEntreePaysEtranger"
          control={control}
          label={t("evaluation.refusEntreeLabel")}
          yesLabel={t("yes")}
          noLabel={t("no")}
          error={fieldError("refusEntreePaysEtranger")}
        />
        <BooleanRadioGroup
          name="depassementVisa"
          control={control}
          label={t("evaluation.depassementVisaLabel")}
          yesLabel={t("yes")}
          noLabel={t("no")}
          error={fieldError("depassementVisa")}
        />
        <div className="md:w-1/2 md:pe-4">
          <SelectField
            id="refusUsaCount"
            label={t("evaluation.refusUsaCountLabel")}
            placeholder={t("evaluation.selectPlaceholder")}
            options={options(REFUS_USA_COUNT_OPTIONS, "refusUsaCount")}
            error={fieldError("refusUsaCount")}
            registration={register("refusUsaCount", emptyToUndefined)}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("evaluation.tiesSection")}
        </legend>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <SelectField
            id="attachesFamiliales"
            label={t("evaluation.attachesFamilialesLabel")}
            placeholder={t("evaluation.selectPlaceholder")}
            options={options(ATTACHES_FAMILIALES_OPTIONS, "attachesFamiliales")}
            error={fieldError("attachesFamiliales")}
            registration={register("attachesFamiliales", emptyToUndefined)}
          />
          <SelectField
            id="activitePays"
            label={t("evaluation.activitePaysLabel")}
            placeholder={t("evaluation.selectPlaceholder")}
            options={options(ACTIVITE_PAYS_OPTIONS, "activitePays")}
            error={fieldError("activitePays")}
            registration={register("activitePays", emptyToUndefined)}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <SelectField
            id="patrimoine"
            label={t("evaluation.patrimoineLabel")}
            placeholder={t("evaluation.selectPlaceholder")}
            options={options(PATRIMOINE_OPTIONS, "patrimoine")}
            error={fieldError("patrimoine")}
            registration={register("patrimoine", emptyToUndefined)}
          />
          <SelectField
            id="familleUsa"
            label={t("evaluation.familleUsaLabel")}
            placeholder={t("evaluation.selectPlaceholder")}
            options={options(FAMILLE_USA_OPTIONS, "familleUsa")}
            error={fieldError("familleUsa")}
            registration={register("familleUsa", emptyToUndefined)}
          />
        </div>

        <div className="md:w-1/2 md:pe-4">
          <SelectField
            id="voyagesHorsAfrique"
            label={t("evaluation.voyagesLabel")}
            placeholder={t("evaluation.selectPlaceholder")}
            options={options(VOYAGES_OPTIONS, "voyages")}
            error={fieldError("voyagesHorsAfrique")}
            registration={register("voyagesHorsAfrique", emptyToUndefined)}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("evaluation.commitmentSection")}
        </legend>

        <TextareaField
          id="engagementsRetour"
          rows={5}
          label={t("evaluation.engagementsRetourLabel")}
          placeholder={t("evaluation.engagementsRetourPlaceholder")}
          error={fieldError("engagementsRetour")}
          registration={register("engagementsRetour")}
        />
        <TextareaField
          id="motivationRetour"
          rows={5}
          label={t("evaluation.motivationRetourLabel")}
          placeholder={t("evaluation.motivationRetourPlaceholder")}
          error={fieldError("motivationRetour")}
          registration={register("motivationRetour")}
        />
      </fieldset>

      <div className="border-t border-ink-dim/20 pt-10">
        <CheckboxField
          id="certificationHonneur"
          label={t("evaluation.certificationHonneur")}
          error={fieldError("certificationHonneur")}
          registration={register("certificationHonneur")}
        />
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-ink-dim/20 pt-10">
        <CTAButton
          type="submit"
          variant="primary"
          disabled={isSubmitting || !complete}
          icon={<ArrowRightIcon className="h-4 w-4" />}
        >
          {isSubmitting ? t("saving") : t("continue")}
        </CTAButton>
        {!complete && (
          <p className="text-xs text-ink-dim" aria-live="polite">
            {t("incompleteHint")}
          </p>
        )}
        {errors.root?.message && (
          <p className={errorClasses} role="alert">
            {t(errors.root.message)}
          </p>
        )}
      </div>
    </form>
  );
}
