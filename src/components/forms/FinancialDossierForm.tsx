"use client";

import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  financialDossierSchema,
  type FinancialDossierInput,
  type FinancialDossierValues,
} from "@/lib/validations/phase2";
import {
  financialRequirement,
  FLIGHT_ESTIMATE,
  ON_SITE_DAILY_USD,
  PROGRAMME_DAYS,
  type DocumentKind,
} from "@/lib/constants/program";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon, LockIcon } from "@/components/marketing/icons";
import { Ltr } from "@/components/layout/Ltr";
import { DocumentSlot } from "./DocumentSlot";
import { TextField, TextareaField, errorClasses } from "./fields";

const usd = (amount: number) => `$${amount.toLocaleString("en-US")}`;

/**
 * Étape 5 — proof that the candidate can fund the trip they are committing to.
 *
 * Every pack renders from the same component because the difference between
 * them is entirely data (see PACK_FINANCIAL_REQUIREMENTS): a Lauréat sees a
 * project dossier and no amounts at all, a VIP Visitor sees three lines
 * totalling ≈ 20 940 $ and three declarations.
 *
 * The framing at the top is not decoration. This step is the single place a
 * candidate is most likely to mistake "prove you have it" for "send it to
 * us", and that misunderstanding is exactly what the programme's anti-fraud
 * position exists to prevent.
 */
export function FinancialDossierForm({
  pack,
  uploaded,
}: {
  pack: string;
  uploaded: string[];
}) {
  const t = useTranslations("phase2.capacite");
  const tPieces = useTranslations("phase2.pieces");
  const router = useRouter();

  const requirement = financialRequirement(pack);

  const [present, setPresent] = useState<Set<string>>(new Set(uploaded));
  const [blocked, setBlocked] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FinancialDossierValues, unknown, FinancialDossierInput>({
    resolver: zodResolver(financialDossierSchema(pack)),
    mode: "onTouched",
  });

  // The step is only routed to for packs that have one, so this is a type
  // narrowing rather than a case the candidate can reach.
  if (!requirement) return null;

  const requiredKinds = requirement.documents
    .filter((doc) => doc.required)
    .map((doc) => doc.kind);
  const missing = requiredKinds.filter((kind) => !present.has(kind));

  const target = requirement.totalUsd ?? requirement.surfaceUsd;
  const attested = Number(watch("montantAtteste") ?? 0);
  // Shown, not enforced — the reviewer decides whether a shortfall is fatal.
  const short = target !== null && attested > 0 && attested < target;

  const fieldError = (name: FieldPath<FinancialDossierValues>) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const markUploaded = (kind: DocumentKind) =>
    setPresent((prev) => new Set(prev).add(kind));

  const onSubmit = handleSubmit(async (data) => {
    if (missing.length > 0) {
      setBlocked("errors.documentsMissing");
      return;
    }
    setBlocked(null);

    try {
      const res = await fetch("/api/documents/capacite", {
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
              setError(field as FieldPath<FinancialDossierValues>, {
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
      {/* What this step is, and — more importantly — what it is not. */}
      <div className="border-s-2 border-terracotta bg-sky-mid/60 p-6 text-sm text-ink">
        <p className="mb-3 font-semibold">{t("noTransferTitle")}</p>
        <p>{t("noTransfer")}</p>
      </div>

      <p className="text-ink-mid">{t(`intro.${pack}`)}</p>

      {/* Amounts table — only for packs that have a figure to justify. */}
      {(requirement.lines.length > 0 || requirement.surfaceUsd !== null) && (
        <div className="border border-ink-dim/20 bg-white">
          <h2 className="border-b border-ink-dim/20 px-6 py-4 font-serif text-[22px] font-normal text-blue-dark">
            {t("amountTitle")}
          </h2>

          {requirement.surfaceUsd !== null && (
            <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 py-5">
              <span className="text-sm text-ink">{t("lines.surface")}</span>
              <Ltr className="font-serif text-[28px] font-normal leading-none text-terracotta">
                {usd(requirement.surfaceUsd)}
              </Ltr>
            </div>
          )}

          {requirement.lines.length > 0 && (
            <>
              <ul>
                {requirement.lines.map((line) => (
                  <li
                    key={line.key}
                    className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink-dim/10 px-6 py-4"
                  >
                    <div>
                      <p className="text-sm text-ink">{t(`lines.${line.key}`)}</p>
                      <p className="mt-1 text-xs text-ink-dim">
                        {line.key === "billet"
                          ? t("lines.billetDetail", {
                              fcfa: FLIGHT_ESTIMATE.fcfa.toLocaleString("fr-FR"),
                            })
                          : line.key === "sejour"
                            ? t("lines.sejourDetail", {
                                daily: usd(ON_SITE_DAILY_USD),
                                days: PROGRAMME_DAYS,
                              })
                            : t("lines.sponsoringDetail")}
                      </p>
                    </div>
                    <Ltr className="text-sm font-semibold text-ink">
                      {usd(line.usd)}
                    </Ltr>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 py-5">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim">
                  {t("lines.total")}
                </span>
                <Ltr className="font-serif text-[28px] font-normal leading-none text-terracotta">
                  ≈ {usd(requirement.totalUsd ?? 0)}
                </Ltr>
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-6">
        <h2 className="font-serif text-[22px] font-normal text-blue-dark">
          {t("documentsTitle")}
        </h2>
        {requirement.documents.map((doc) => (
          <DocumentSlot
            key={doc.kind}
            kind={doc.kind}
            acceptPdf
            optional={!doc.required}
            optionalLabel={t("optional")}
            initiallyUploaded={present.has(doc.kind)}
            onUploaded={markUploaded}
          />
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-8" noValidate>
        {(requirement.requiresBankName || requirement.requiresFundsOrigin) && (
          <fieldset className="space-y-8 border-t border-ink-dim/20 pt-10">
            <legend className="mb-2 font-serif text-[22px] font-normal text-blue-dark">
              {t("declarationsTitle")}
            </legend>

            {requirement.requiresBankName && (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <TextField
                  id="banqueEmettrice"
                  label={t("banqueLabel")}
                  placeholder={t("banquePlaceholder")}
                  hint={
                    <p className="text-xs text-ink-dim">{t("banqueHint")}</p>
                  }
                  error={fieldError("banqueEmettrice")}
                  registration={register("banqueEmettrice")}
                />
                <TextField
                  id="montantAtteste"
                  type="number"
                  inputMode="numeric"
                  label={t("montantLabel")}
                  placeholder={target ? String(target) : undefined}
                  hint={
                    short ? (
                      <p className="text-xs text-terracotta">
                        {t("montantShort", { required: usd(target ?? 0) })}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-dim">{t("montantHint")}</p>
                    )
                  }
                  error={fieldError("montantAtteste")}
                  registration={register("montantAtteste")}
                />
              </div>
            )}

            {requirement.requiresFundsOrigin && (
              <TextareaField
                id="origineFonds"
                label={t("origineLabel")}
                placeholder={t("originePlaceholder")}
                error={fieldError("origineFonds")}
                registration={register("origineFonds")}
              />
            )}
          </fieldset>
        )}

        <div className="flex flex-col items-start justify-between gap-8 border-t border-ink-dim/20 pt-10 md:flex-row md:items-center">
          <div className="flex items-start gap-4 text-ink-dim">
            <LockIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="max-w-72 text-xs leading-snug">
              {tPieces("storageNote")}
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

            {blocked && (
              <p className={errorClasses} role="alert">
                {t(blocked)}
                {blocked === "errors.documentsMissing" && (
                  <>
                    {" "}
                    {missing.map((k) => tPieces(`kinds.${k}.label`)).join(", ")}
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
