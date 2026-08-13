"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  candidatureSchema,
  countWords,
  type CandidatureInput,
} from "@/lib/validations/candidature";
import {
  COUNTRIES,
  SECTEURS,
  PACKS,
  VISA_HISTORIQUE_OPTIONS,
  CASIER_JUDICIAIRE_OPTIONS,
  SOURCE_OPTIONS,
  MOTIVATION_MAX_WORDS,
} from "@/lib/constants/program";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon, LockIcon } from "@/components/marketing/icons";
import {
  TextField,
  SelectField,
  TextareaField,
  RadioGroup,
  CheckboxField,
  StepProgress,
  errorClasses,
} from "./fields";

/**
 * Draft persistence.
 *
 * A 20-field form with a 150-word essay is a 10-minute commitment, and mobile
 * connections across the six participating markets drop often enough that
 * losing it all to a refresh is a real abandonment cause.
 *
 * Two deliberate limits, because this is personal data sitting in a browser
 * that may well be shared (cybercafé, borrowed phone):
 *  - the draft expires on its own after 24h;
 *  - consent checkboxes are never persisted, so consent is always given
 *    deliberately in the session that submits.
 * It is also cleared the moment a submission succeeds.
 */
const DRAFT_KEY = "svap:candidature:draft:v1";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const UNSAVED_FIELDS = ["consentExactitude", "consentCommunications"] as const;

type Draft = { savedAt: number; values: Partial<CandidatureInput> };

function loadDraft(): Partial<CandidatureInput> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft.values;
  } catch {
    // Corrupt or unavailable storage (private mode, quota) is not worth
    // failing the form over — the candidate just starts fresh.
    return null;
  }
}

function saveDraft(values: Partial<CandidatureInput>) {
  try {
    const persisted = { ...values };
    for (const field of UNSAVED_FIELDS) delete persisted[field];
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ savedAt: Date.now(), values: persisted } satisfies Draft),
    );
  } catch {
    /* storage unavailable — drafting is a convenience, never a requirement */
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Which fields each step owns. Used to validate only the current step before
 * advancing — running the whole schema would light up errors on questions the
 * candidate hasn't reached yet.
 */
const STEP_FIELDS: FieldPath<CandidatureInput>[][] = [
  ["prenom", "nom", "email", "telephone", "age"],
  ["pays", "ville", "secteur", "pack", "marie", "enfants", "source", "delegueNom"],
  [
    "casierJudiciaire",
    "visaHistorique",
    "motivation",
    "lienPays",
    "consentExactitude",
    "consentCommunications",
  ],
];
const TOTAL_STEPS = STEP_FIELDS.length;

function isPackValue(value: string | null): value is CandidatureInput["pack"] {
  return !!value && (PACKS as readonly string[]).includes(value);
}

/** "" from an unselected control means "not answered", not "empty string". */
const emptyToUndefined = { setValueAs: (v: string) => (v === "" ? undefined : v) };
/** Radio groups carry booleans as strings; convert on the way in. */
const stringToBoolean = {
  setValueAs: (v: string) => (v === "" ? undefined : v === "true"),
};

export function CandidatureForm() {
  const t = useTranslations("candidature");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  const packParam = searchParams.get("pack");
  const defaultPack = isPackValue(packParam) ? packParam : undefined;

  const {
    register,
    handleSubmit,
    setError,
    trigger,
    watch,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CandidatureInput>({
    resolver: zodResolver(candidatureSchema),
    mode: "onTouched",
    defaultValues: { pack: defaultPack },
  });

  // Restore any draft once, on mount. A ?pack= in the URL is an explicit
  // intent expressed just now, so it wins over whatever the draft holds.
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    reset({ ...draft, ...(defaultPack ? { pack: defaultPack } : {}) });
    setDraftRestored(true);
    // defaultPack is derived from the URL and stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);

  // Persist on change, debounced — this fires on every keystroke otherwise.
  const watched = watch();
  useEffect(() => {
    const id = window.setTimeout(() => saveDraft(getValues()), 600);
    return () => window.clearTimeout(id);
  }, [watched, getValues]);

  const source = watch("source");
  const motivation = watch("motivation") ?? "";
  const motivationWords = countWords(motivation);
  const motivationOver = motivationWords > MOTIVATION_MAX_WORDS;

  const fieldError = (name: FieldPath<CandidatureInput>) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const options = (
    values: readonly string[],
    group: "pays" | "secteur" | "pack" | "visaHistorique" | "casierJudiciaire" | "source",
  ) => values.map((v) => ({ value: v, label: t(`options.${group}.${v}`) }));

  const goToStep = (next: number) => {
    setStep(next);
    // Move focus to the step heading so a screen reader announces the new
    // step, and so keyboard focus doesn't stay on a now-hidden button.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const handleNext = async () => {
    const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (valid) goToStep(step + 1);
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await fetch("/api/candidature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locale }),
      });

      const body: {
        success?: boolean;
        status?: string;
        reason?: string;
        errors?: Record<string, string[]>;
      } | null = await res.json().catch(() => null);

      if (!res.ok) {
        const fieldErrors = Object.entries(body?.errors ?? {});

        if (fieldErrors.length > 0) {
          for (const [field, messages] of fieldErrors) {
            if (messages?.[0]) {
              setError(field as FieldPath<CandidatureInput>, {
                message: messages[0],
              });
            }
          }
          // Surface the step that actually holds the rejected field, rather
          // than leaving the candidate on a step with no visible error.
          const firstBadStep = STEP_FIELDS.findIndex((fields) =>
            fields.some((f) => fieldErrors.some(([name]) => name === f)),
          );
          if (firstBadStep >= 0 && firstBadStep !== step) goToStep(firstBadStep);
        } else {
          setError("root", { message: "form.submitError" });
        }
        return;
      }

      clearDraft();

      // Phase-1 outcome decides the destination. All three are real
      // endpoints, not error states — "not pre-selected" cost nothing and
      // stays eligible for future editions.
      if (body?.status === "non_eligible") {
        router.push(`/candidature/non-eligible?reason=${body.reason ?? ""}`);
      } else if (body?.status === "complet") {
        router.push("/candidature/complet");
      } else {
        router.push("/candidature/success");
      }
    } catch {
      setError("root", { message: "form.submitError" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <StepProgress
        current={step + 1}
        total={TOTAL_STEPS}
        label={t("form.stepLabel", { current: step + 1, total: TOTAL_STEPS })}
        stepTitle={t(`form.steps.step${step + 1}.title`)}
      />

      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <h2 className="font-serif text-[28px] font-normal text-blue-dark">
          {t(`form.steps.step${step + 1}.title`)}
        </h2>
        <p className="mt-2 text-sm text-ink-dim">
          {t(`form.steps.step${step + 1}.description`)}
        </p>
      </div>

      {draftRestored && step === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-s-2 border-blue bg-sky-mid/60 p-4 text-sm text-ink-mid">
          <span>{t("form.draftRestored")}</span>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              reset({ pack: defaultPack });
              setDraftRestored(false);
            }}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue hover:text-terracotta"
          >
            {t("form.draftClear")}
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 1 — Identity & contact                                       */}
      {/* ---------------------------------------------------------------- */}
      {step === 0 && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <TextField
              id="prenom"
              label={t("form.prenomLabel")}
              placeholder={t("form.prenomPlaceholder")}
              error={fieldError("prenom")}
              registration={register("prenom")}
            />
            <TextField
              id="nom"
              label={t("form.nomLabel")}
              placeholder={t("form.nomPlaceholder")}
              error={fieldError("nom")}
              registration={register("nom")}
            />
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <TextField
              id="email"
              type="email"
              inputMode="email"
              label={t("form.emailLabel")}
              placeholder={t("form.emailPlaceholder")}
              hint={
                <p className="text-xs text-ink-dim">{t("form.emailHint")}</p>
              }
              error={fieldError("email")}
              registration={register("email")}
            />
            <TextField
              id="telephone"
              type="tel"
              inputMode="tel"
              label={t("form.telephoneLabel")}
              placeholder={t("form.telephonePlaceholder")}
              error={fieldError("telephone")}
              registration={register("telephone")}
            />
          </div>
          <div className="md:w-1/2 md:pe-4">
            <TextField
              id="age"
              type="number"
              inputMode="numeric"
              label={t("form.ageLabel")}
              placeholder={t("form.agePlaceholder")}
              error={fieldError("age")}
              registration={register("age", { valueAsNumber: true })}
            />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 2 — Profile                                                  */}
      {/* ---------------------------------------------------------------- */}
      {step === 1 && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <SelectField
              id="pays"
              label={t("form.paysLabel")}
              placeholder={t("form.paysPlaceholder")}
              options={options(COUNTRIES, "pays")}
              error={fieldError("pays")}
              registration={register("pays", emptyToUndefined)}
            />
            <TextField
              id="ville"
              label={t("form.villeLabel")}
              placeholder={t("form.villePlaceholder")}
              error={fieldError("ville")}
              registration={register("ville")}
            />
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <SelectField
              id="secteur"
              label={t("form.secteurLabel")}
              placeholder={t("form.secteurPlaceholder")}
              options={options(SECTEURS, "secteur")}
              error={fieldError("secteur")}
              registration={register("secteur", emptyToUndefined)}
            />
            <SelectField
              id="pack"
              label={t("form.packLabel")}
              placeholder={t("form.packPlaceholder")}
              defaultValue={defaultPack ?? ""}
              options={options(PACKS, "pack")}
              error={fieldError("pack")}
              registration={register("pack", emptyToUndefined)}
            />
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <RadioGroup
              name="marie"
              label={t("form.marieLabel")}
              options={[
                { value: "true", label: t("form.yes") },
                { value: "false", label: t("form.no") },
              ]}
              error={fieldError("marie")}
              registration={register("marie", stringToBoolean)}
            />
            <RadioGroup
              name="enfants"
              label={t("form.enfantsLabel")}
              options={[
                { value: "true", label: t("form.yes") },
                { value: "false", label: t("form.no") },
              ]}
              error={fieldError("enfants")}
              registration={register("enfants", stringToBoolean)}
            />
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <SelectField
              id="source"
              label={t("form.sourceLabel")}
              placeholder={t("form.sourcePlaceholder")}
              options={options(SOURCE_OPTIONS, "source")}
              error={fieldError("source")}
              registration={register("source", emptyToUndefined)}
            />
            {source === "delegue" && (
              <TextField
                id="delegueNom"
                label={t("form.delegueNomLabel")}
                placeholder={t("form.delegueNomPlaceholder")}
                error={fieldError("delegueNom")}
                registration={register("delegueNom")}
              />
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 3 — Eligibility & motivation                                 */}
      {/* ---------------------------------------------------------------- */}
      {step === 2 && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <SelectField
              id="casierJudiciaire"
              label={t("form.casierJudiciaireLabel")}
              placeholder={t("form.casierJudiciairePlaceholder")}
              options={options(CASIER_JUDICIAIRE_OPTIONS, "casierJudiciaire")}
              error={fieldError("casierJudiciaire")}
              registration={register("casierJudiciaire", emptyToUndefined)}
            />
            <SelectField
              id="visaHistorique"
              label={t("form.visaHistoriqueLabel")}
              placeholder={t("form.visaHistoriquePlaceholder")}
              options={options(VISA_HISTORIQUE_OPTIONS, "visaHistorique")}
              error={fieldError("visaHistorique")}
              registration={register("visaHistorique", emptyToUndefined)}
            />
          </div>

          <TextareaField
            id="motivation"
            label={t("form.motivationLabel")}
            placeholder={t("form.motivationPlaceholder")}
            error={fieldError("motivation")}
            hint={
              <p
                className={`text-xs ${motivationOver ? "text-terracotta" : "text-ink-dim"}`}
                aria-live="polite"
              >
                {t("form.wordCount", {
                  count: motivationWords,
                  max: MOTIVATION_MAX_WORDS,
                })}
              </p>
            }
            registration={register("motivation")}
          />

          <TextareaField
            id="lienPays"
            rows={4}
            label={t("form.lienPaysLabel")}
            placeholder={t("form.lienPaysPlaceholder")}
            error={fieldError("lienPays")}
            registration={register("lienPays")}
          />

          <div className="space-y-4 border-t border-ink-dim/20 pt-8">
            <CheckboxField
              id="consentExactitude"
              label={t("form.consentExactitude")}
              error={fieldError("consentExactitude")}
              registration={register("consentExactitude")}
            />
            <CheckboxField
              id="consentCommunications"
              label={t("form.consentCommunications")}
              error={fieldError("consentCommunications")}
              registration={register("consentCommunications")}
            />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Navigation                                                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col items-start justify-between gap-8 border-t border-ink-dim/20 pt-8 md:flex-row md:items-center">
        <div className="flex items-start gap-4 text-ink-dim">
          <LockIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="max-w-60 text-xs leading-snug">{t("form.rgpdNote")}</p>
        </div>

        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-6">
            {step > 0 && (
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-mid transition-colors hover:text-blue"
              >
                {t("form.previousLabel")}
              </button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <CTAButton
                type="button"
                variant="primary"
                onClick={handleNext}
                icon={<ArrowRightIcon className="h-4 w-4" />}
              >
                {t("form.nextLabel")}
              </CTAButton>
            ) : (
              <CTAButton
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                icon={<ArrowRightIcon className="h-4 w-4" />}
              >
                {isSubmitting
                  ? t("form.submittingLabel")
                  : t("form.submitLabel")}
              </CTAButton>
            )}
          </div>

          {errors.root?.message && (
            <p className={errorClasses} role="alert">
              {t(errors.root.message)}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
