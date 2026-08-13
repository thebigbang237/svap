import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PackCard } from "@/components/marketing/PackCard";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";
import { PACKS, PACK_SPECS } from "@/lib/constants/program";

function ProcessStep({
  number,
  title,
  description,
  dark = false,
}: {
  number: string;
  title: string;
  description: string;
  dark?: boolean;
}) {
  return (
    <div className="relative flex w-full flex-col items-center text-center md:w-1/5 md:items-start md:text-start">
      <div
        className={[
          "z-10 mb-6 flex h-20 w-20 items-center justify-center",
          dark ? "bg-blue-dark" : "border border-ink-dim/20 bg-white",
        ].join(" ")}
      >
        <span
          className={`font-serif text-2xl font-normal ${dark ? "text-white" : "text-blue"}`}
        >
          {number}
        </span>
      </div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue">
        {title}
      </h4>
      <p className="text-sm text-ink-dim">{description}</p>
    </div>
  );
}

/**
 * The five packs.
 *
 * Places and verification fees are read from PACK_SPECS, never from the
 * translation files — those numbers appear on the pack card, in the payment
 * step, in the FAQ and in the database constraint, and the whole point of the
 * single source of truth is that they cannot disagree.
 */
export default function PacksPage() {
  const tCommon = useTranslations("common");
  const t = useTranslations("packs");
  // Pack display names live in the candidature namespace — the form, the
  // pack cards and the emails all read the same strings.
  const tPack = useTranslations("candidature.options.pack");

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("page.breadcrumbCurrent")}
        eyebrow={t("page.eyebrow")}
        title={t("page.title")}
        lead={t("page.lead")}
      />

      {/* The founding principle, stated before any price is shown. */}
      <section className="px-8 pt-4">
        <div className="mx-auto max-w-[1280px]">
          <p className="border-s-2 border-terracotta bg-sky-mid/60 p-6 text-ink">
            {t("freeNotice")}
          </p>
        </div>
      </section>

      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {PACKS.map((pack) => {
              const spec = PACK_SPECS[pack];
              return (
                <PackCard
                  key={pack}
                  size="full"
                  variant={pack === "boursier" ? "featured" : "default"}
                  name={tPack(pack)}
                  badgeLabel={t(`items.${pack}.badgeLabel`)}
                  placesCount={spec.places}
                  costLabel={t(`items.${pack}.costLabel`)}
                  costValue={t(`items.${pack}.costValue`)}
                  features={t.raw(`items.${pack}.features`)}
                  applicationFee={`${t("feePrefix")} $${spec.verificationFeeUsd} — ${t("feeSuffix")}`}
                  ctaLabel={t(`items.${pack}.ctaLabel`)}
                  href={`/candidature?pack=${pack}`}
                />
              );
            })}
          </div>

          {/* The VIP sponsorship contribution is disclosed, and it is stated
              plainly that it is never collected here — otherwise the amount
              contradicts the anti-fraud guidance on /confiance. */}
          <p className="mt-8 border border-ink-dim/20 bg-white p-6 text-sm text-ink-mid">
            <span className="font-semibold text-ink">VIP Visitor — </span>
            {t("items.vip_visitor.note")}
          </p>
        </div>
      </section>

      <section className="overflow-hidden bg-sky-mid px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16">
            <SectionEyebrow label={t("process.eyebrow")} className="mb-6" />
            <h2 className="font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
              {t("process.title")}
            </h2>
          </div>
          <div className="relative flex flex-col items-start gap-12 md:flex-row md:justify-between md:gap-0">
            <div className="absolute top-10 inset-s-0 hidden h-px w-full bg-ink-dim/20 md:block" />
            {["step1", "step2", "step3", "step4", "step5"].map((step, i) => (
              <ProcessStep
                key={step}
                number={String(i + 1).padStart(2, "0")}
                title={t(`process.steps.${step}.title`)}
                description={t(`process.steps.${step}.description`)}
                dark={i === 4}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 py-[120px] text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
            {t("closingCta.title")}
          </h2>
          <p className="mb-12 text-ink-mid">{t("closingCta.description")}</p>
          <CTAButton
            href="/candidature"
            variant="primary"
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {t("closingCta.ctaLabel")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
