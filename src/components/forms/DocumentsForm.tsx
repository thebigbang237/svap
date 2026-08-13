"use client";

import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  casierMetadataSchema,
  type CasierMetadataInput,
} from "@/lib/validations/phase2";
import { CASIER_MAX_AGE_MONTHS } from "@/lib/constants/program";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon, LockIcon } from "@/components/marketing/icons";
import { DocumentSlot } from "./DocumentSlot";
import { TextField, errorClasses } from "./fields";

const REQUIRED_KINDS = ["id_recto", "selfie_liveness", "casier_judiciaire"] as const;

export function DocumentsForm({ uploaded }: { uploaded: string[] }) {
  const t = useTranslations("phase2.pieces");
  const router = useRouter();

  const [present, setPresent] = useState<Set<string>>(new Set(uploaded));
  const [blocked, setBlocked] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CasierMetadataInput>({
    resolver: zodResolver(casierMetadataSchema),
    mode: "onTouched",
  });

  const fieldError = (name: FieldPath<CasierMetadataInput>) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const markUploaded = (kind: string) =>
    setPresent((prev) => new Set(prev).add(kind));

  const missing = REQUIRED_KINDS.filter((k) => !present.has(k));

  const onSubmit = handleSubmit(async (data) => {
    // Checked here as well as server-side so the candidate gets the message
    // next to the slot that's actually empty, rather than a 409 at the end.
    if (missing.length > 0) {
      setBlocked("errors.documentsMissing");
      return;
    }
    setBlocked(null);

    try {
      const res = await fetch("/api/documents/pieces/casier", {
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
              setError(field as FieldPath<CasierMetadataInput>, {
                message: messages[0],
              });
            }
          }
        } else {
          setBlocked(body?.error ?? "errors.server");
        }
        return;
      }

      router.push("/documents/consentements");
    } catch {
      setBlocked("errors.network");
    }
  });

  return (
    <div className="space-y-10">
      <div className="border-s-2 border-blue bg-sky-mid/60 p-6 text-sm text-ink">
        {t("intro")}
      </div>

      <div className="space-y-6">
        <DocumentSlot
          kind="id_recto"
          initiallyUploaded={present.has("id_recto")}
          onUploaded={markUploaded}
        />
        <DocumentSlot
          kind="id_verso"
          optional
          initiallyUploaded={present.has("id_verso")}
          onUploaded={markUploaded}
        />
        <DocumentSlot
          kind="selfie_liveness"
          capture="user"
          initiallyUploaded={present.has("selfie_liveness")}
          onUploaded={markUploaded}
        />
        <DocumentSlot
          kind="casier_judiciaire"
          acceptPdf
          initiallyUploaded={present.has("casier_judiciaire")}
          onUploaded={markUploaded}
        />
      </div>

      <form onSubmit={onSubmit} className="space-y-8" noValidate>
        <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
          <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
            {t("casierSection")}
          </legend>
          <p className="text-sm text-ink-dim">
            {t("casierHint", { months: CASIER_MAX_AGE_MONTHS })}
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <TextField
              id="casierDate"
              type="date"
              label={t("casierDateLabel")}
              error={fieldError("casierDate")}
              registration={register("casierDate")}
            />
            <TextField
              id="casierNumero"
              label={t("casierNumeroLabel")}
              error={fieldError("casierNumero")}
              registration={register("casierNumero")}
            />
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <TextField
              id="casierLieu"
              label={t("casierLieuLabel")}
              placeholder={t("casierLieuPlaceholder")}
              error={fieldError("casierLieu")}
              registration={register("casierLieu")}
            />
            <TextField
              id="casierStructure"
              label={t("casierStructureLabel")}
              placeholder={t("casierStructurePlaceholder")}
              error={fieldError("casierStructure")}
              registration={register("casierStructure")}
            />
          </div>
        </fieldset>

        <div className="flex flex-col items-start justify-between gap-8 border-t border-ink-dim/20 pt-10 md:flex-row md:items-center">
          <div className="flex items-start gap-4 text-ink-dim">
            <LockIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="max-w-72 text-xs leading-snug">{t("storageNote")}</p>
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

            {blocked && (
              <p className={errorClasses} role="alert">
                {t(blocked)}
                {blocked === "errors.documentsMissing" && (
                  <>
                    {" "}
                    {missing.map((k) => t(`kinds.${k}.label`)).join(", ")}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
