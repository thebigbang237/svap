"use client";

import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  personalInfoSchema,
  type PersonalInfoInput,
} from "@/lib/validations/phase2";
import { PROFESSION_OPTIONS } from "@/lib/constants/program";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon, LockIcon } from "@/components/marketing/icons";
import { TextField, SelectField, TextareaField, errorClasses } from "./fields";

/**
 * Étape 1 — complete personal information.
 *
 * No localStorage draft here, unlike the Phase-1 form. This step carries
 * passport and address data, and the candidate is already inside an
 * authenticated session that persists server-side once submitted — caching a
 * second copy in a browser that may be shared would add risk without adding
 * resilience.
 */
export function PersonalInfoForm({
  defaultValues,
}: {
  defaultValues?: Partial<PersonalInfoInput>;
}) {
  const t = useTranslations("phase2");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PersonalInfoInput>({
    resolver: zodResolver(personalInfoSchema),
    mode: "onTouched",
    defaultValues,
  });

  const fieldError = (name: FieldPath<PersonalInfoInput>) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await fetch("/api/documents/informations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body: {
        next?: string;
        error?: string;
        errors?: Record<string, string[]>;
      } | null = await res.json().catch(() => null);

      if (!res.ok) {
        const fieldErrors = Object.entries(body?.errors ?? {});
        if (fieldErrors.length > 0) {
          for (const [field, messages] of fieldErrors) {
            if (messages?.[0]) {
              setError(field as FieldPath<PersonalInfoInput>, {
                message: messages[0],
              });
            }
          }
        } else {
          setError("root", { message: body?.error ?? "errors.server" });
        }
        return;
      }

      router.push("/documents/evaluation");
    } catch {
      setError("root", { message: "errors.server" });
    }
  });

  const professionOptions = PROFESSION_OPTIONS.map((value) => ({
    value,
    label: t(`options.profession.${value}`),
  }));

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <fieldset className="space-y-8">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("informations.identitySection")}
        </legend>

        <p className="text-sm text-ink-dim">{t("informations.identityHint")}</p>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <TextField
            id="prenoms"
            label={t("informations.prenomsLabel")}
            placeholder={t("informations.prenomsPlaceholder")}
            error={fieldError("prenoms")}
            registration={register("prenoms")}
          />
          <TextField
            id="nomFamille"
            label={t("informations.nomFamilleLabel")}
            placeholder={t("informations.nomFamillePlaceholder")}
            error={fieldError("nomFamille")}
            registration={register("nomFamille")}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <TextField
            id="dateNaissance"
            type="date"
            label={t("informations.dateNaissanceLabel")}
            error={fieldError("dateNaissance")}
            registration={register("dateNaissance")}
          />
          <TextField
            id="lieuNaissance"
            label={t("informations.lieuNaissanceLabel")}
            placeholder={t("informations.lieuNaissancePlaceholder")}
            error={fieldError("lieuNaissance")}
            registration={register("lieuNaissance")}
          />
        </div>

        <div className="md:w-1/2 md:pe-4">
          <TextField
            id="nationalite"
            label={t("informations.nationaliteLabel")}
            placeholder={t("informations.nationalitePlaceholder")}
            error={fieldError("nationalite")}
            registration={register("nationalite")}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("informations.passportSection")}
        </legend>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <TextField
            id="passeportNumero"
            label={t("informations.passeportNumeroLabel")}
            placeholder={t("informations.passeportNumeroPlaceholder")}
            hint={
              <p className="text-xs text-ink-dim">
                {t("informations.passeportNumeroHint")}
              </p>
            }
            error={fieldError("passeportNumero")}
            registration={register("passeportNumero")}
          />
          <TextField
            id="passeportExpiration"
            type="date"
            label={t("informations.passeportExpirationLabel")}
            error={fieldError("passeportExpiration")}
            registration={register("passeportExpiration")}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("informations.contactSection")}
        </legend>

        <div className="md:w-1/2 md:pe-4">
          <TextField
            id="telephone"
            type="tel"
            inputMode="tel"
            label={t("informations.telephoneLabel")}
            placeholder={t("informations.telephonePlaceholder")}
            error={fieldError("telephone")}
            registration={register("telephone")}
          />
        </div>

        <TextareaField
          id="adresse"
          rows={3}
          label={t("informations.adresseLabel")}
          placeholder={t("informations.adressePlaceholder")}
          error={fieldError("adresse")}
          registration={register("adresse")}
        />
      </fieldset>

      <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("informations.professionSection")}
        </legend>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <SelectField
            id="profession"
            label={t("informations.professionLabel")}
            placeholder={t("informations.professionPlaceholder")}
            options={professionOptions}
            error={fieldError("profession")}
            registration={register("profession", {
              setValueAs: (v: string) => (v === "" ? undefined : v),
            })}
          />
          <TextField
            id="employeur"
            label={t("informations.employeurLabel")}
            placeholder={t("informations.employeurPlaceholder")}
            error={fieldError("employeur")}
            registration={register("employeur")}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
        <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
          {t("informations.emergencySection")}
        </legend>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <TextField
            id="contactUrgenceNom"
            label={t("informations.contactUrgenceNomLabel")}
            error={fieldError("contactUrgenceNom")}
            registration={register("contactUrgenceNom")}
          />
          <TextField
            id="contactUrgenceLien"
            label={t("informations.contactUrgenceLienLabel")}
            placeholder={t("informations.contactUrgenceLienPlaceholder")}
            error={fieldError("contactUrgenceLien")}
            registration={register("contactUrgenceLien")}
          />
          <TextField
            id="contactUrgenceTelephone"
            type="tel"
            inputMode="tel"
            label={t("informations.contactUrgenceTelephoneLabel")}
            error={fieldError("contactUrgenceTelephone")}
            registration={register("contactUrgenceTelephone")}
          />
        </div>
      </fieldset>

      <div className="flex flex-col items-start justify-between gap-8 border-t border-ink-dim/20 pt-10 md:flex-row md:items-center">
        <div className="flex items-start gap-4 text-ink-dim">
          <LockIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="max-w-72 text-xs leading-snug">
            {t("informations.encryptionNote")}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3">
          <CTAButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {isSubmitting ? t("saving") : t("continue")}
          </CTAButton>
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
