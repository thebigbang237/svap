import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CTAButton } from "@/components/marketing/CTAButton";
import { CheckIcon, ArrowRightIcon } from "@/components/marketing/icons";
import { Ltr } from "@/components/layout/Ltr";
import {
  PACK_SPECS,
  DELEGUE_STIPEND,
  MIN_AGE,
  DELEGUE_MAX_AGE,
} from "@/lib/constants/program";

interface Benefit {
  title: string;
  description: string;
}

export default function DeleguesPage() {
  const tCommon = useTranslations("common");
  const t = useTranslations("delegues");

  const spec = PACK_SPECS.delegue;
  const benefits = t.raw("benefits") as Benefit[];
  const conditions = t.raw("conditions") as string[];

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("breadcrumbCurrent")}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      />

      {/* Headline numbers, all derived from program.ts. */}
      <section className="px-8 pt-4">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { value: String(spec.places), label: "places" },
            {
              value: `$${DELEGUE_STIPEND.totalUsd}`,
              label: "total",
            },
            { value: `${DELEGUE_STIPEND.months}`, label: "months" },
            { value: `${MIN_AGE}–${DELEGUE_MAX_AGE}`, label: "age" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-ink-dim/20 bg-white p-6 text-center"
            >
              <Ltr className="block font-serif text-[32px] font-normal leading-none text-terracotta">
                {stat.value}
              </Ltr>
              <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim">
                {tCommon(`stats.${stat.label}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-16 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 font-serif text-[32px] font-normal text-blue-dark">
              {t("roleTitle")}
            </h2>
            <p className="mb-6 leading-relaxed text-ink-mid">{t("roleBody")}</p>
            <p className="border-s-2 border-terracotta bg-sky-mid/60 p-6 text-ink">
              {t("roleNote")}
            </p>
          </div>

          <div>
            <h2 className="mb-6 font-serif text-[32px] font-normal text-blue-dark">
              {t("benefitsTitle")}
            </h2>
            <ul className="space-y-6">
              {benefits.map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-4">
                  <CheckIcon className="mt-1 h-5 w-5 shrink-0 text-terracotta" />
                  <div>
                    <p className="font-semibold text-ink">{benefit.title}</p>
                    <p className="mt-1 text-sm text-ink-mid">
                      {benefit.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-sky-mid px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-16 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 font-serif text-[32px] font-normal text-blue-dark">
              {t("conditionsTitle")}
            </h2>
            <ul className="space-y-4">
              {conditions.map((condition) => (
                <li key={condition} className="flex items-start gap-4">
                  <span aria-hidden="true" className="mt-1 text-terracotta">
                    &bull;
                  </span>
                  <span className="text-ink-mid">{condition}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-6 font-serif text-[32px] font-normal text-blue-dark">
              {t("processTitle")}
            </h2>
            <p className="mb-6 leading-relaxed text-ink-mid">
              {t("processBody")}
            </p>
            {/* The anti-fraud line repeated on every page that mentions money. */}
            <p className="border-s-2 border-blue bg-white p-6 text-ink">
              {t("processNote")}
            </p>
          </div>
        </div>
      </section>

      <section className="px-8 py-[120px] text-center">
        <div className="mx-auto max-w-3xl">
          <CTAButton
            href="/candidature?pack=delegue"
            variant="primary"
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {t("ctaLabel")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
