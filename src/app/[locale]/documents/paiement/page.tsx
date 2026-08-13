import { getTranslations } from "next-intl/server";
import { guardPhase2Step } from "@/lib/phase2/guard";
import { Phase2StepShell } from "@/components/forms/Phase2StepShell";
import { PaymentForm } from "@/components/forms/PaymentForm";
import { Ltr } from "@/components/layout/Ltr";
import { availableMethods } from "@/lib/payments/registry";
import { COUNTRIES, PACK_SPECS, type Country, type Pack } from "@/lib/constants/program";

/**
 * Étape 3 — verification fee.
 *
 * States the exact amount, names what the fee buys, and — per the client
 * decision on capacity — is explicit that it covers verification rather than
 * a guaranteed seat. That last part has to be said *before* the money moves.
 */
export default async function Phase2PaiementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const progress = await guardPhase2Step("paiement", locale);

  const t = await getTranslations("phase2.paiement");
  const pack = progress.candidature.pack as Pack;
  const spec = PACK_SPECS[pack];

  // `pays` is typed as string on the row because 0005's country CHECK was
  // added NOT VALID — a legacy row can hold a dropped country. Fall back to
  // card-only rather than crashing the step for one.
  const stored = progress.candidature.pays;
  const country = (COUNTRIES as readonly string[]).includes(stored)
    ? (stored as Country)
    : null;

  const methods = country ? availableMethods(country) : (["card"] as const);

  return (
    <Phase2StepShell step="paiement">
      <div className="space-y-10">
        <div className="border border-ink-dim/20 bg-white p-8">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-blue">
            {t("packLabel")}
          </span>
          <p className="mb-6 font-serif text-[28px] font-normal text-blue-dark">
            {t(`packs.${pack}`)}
          </p>

          <div className="flex items-baseline gap-3 border-t border-ink-dim/20 pt-6">
            <Ltr className="font-serif text-[42px] font-normal leading-none text-terracotta">
              {`$${spec.verificationFeeUsd}`}
            </Ltr>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim">
              {t("feeLabel")}
            </span>
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-serif text-[22px] font-normal text-blue-dark">
            {t("coversTitle")}
          </h2>
          <ul className="space-y-3 text-ink-mid">
            {["identity", "criminalRecord", "riskTest", "processing"].map(
              (key) => (
                <li key={key} className="flex gap-3">
                  <span aria-hidden="true" className="text-terracotta">
                    &bull;
                  </span>
                  <span>{t(`covers.${key}`)}</span>
                </li>
              ),
            )}
          </ul>
        </div>

        {/* The capacity decision, made explicit at the moment of payment: the
            fee buys verification, not a seat. */}
        <div className="border-s-2 border-terracotta bg-sky-mid/60 p-6">
          <p className="text-ink">{t("notASeat")}</p>
        </div>

        <div className="border-t border-ink-dim/20 pt-10">
          <h2 className="mb-6 font-serif text-[22px] font-normal text-blue-dark">
            {t("methodsTitle")}
          </h2>
          <PaymentForm
            methods={[...methods]}
            defaultPhone={progress.candidature.telephone ?? ""}
          />
        </div>
      </div>
    </Phase2StepShell>
  );
}
