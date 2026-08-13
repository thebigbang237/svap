import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { EligibilityBox } from "@/components/marketing/EligibilityBox";
import { CTAButton } from "@/components/marketing/CTAButton";
import { CheckIcon, ArrowRightIcon } from "@/components/marketing/icons";
import { COUNTRIES, TOTAL_SCHOLARSHIPS } from "@/lib/constants/program";

function CriteriaCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden border border-white/10 p-10 transition-colors duration-500 hover:bg-white/5">
      <span className="absolute -top-4 inset-e-4 font-serif text-[56px] font-normal leading-none text-white/10 transition-colors group-hover:text-terracotta-light/40">
        {number}
      </span>
      <div className="relative z-10">
        <h4 className="mb-4 font-serif text-[24px] font-normal">{title}</h4>
        <p className="leading-relaxed text-white/70">{description}</p>
      </div>
    </div>
  );
}

function StatusCard({
  eyebrow,
  name,
  quote,
  items,
  target,
  dark = false,
}: {
  eyebrow: string;
  name: string;
  quote?: string;
  items: string[];
  target: string;
  dark?: boolean;
}) {
  return (
    <div
      className={[
        "flex h-full flex-col justify-between border-y border-e border-s-8 p-12",
        dark
          ? "border-s-terracotta border-y-transparent border-e-transparent bg-ink text-white md:scale-105"
          : "border-s-blue border-y-ink-dim/20 border-e-ink-dim/20 bg-white",
      ].join(" ")}
    >
      <div>
        <span
          className={`mb-4 block text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-terracotta-light" : "text-blue"}`}
        >
          {eyebrow}
        </span>
        <h3 className="mb-6 font-serif text-[32px] font-normal">{name}</h3>
        {quote && (
          <p className={`mb-8 italic ${dark ? "text-white/80" : "text-ink-mid"}`}>
            &ldquo;{quote}&rdquo;
          </p>
        )}
        <ul className="mb-8 space-y-4">
          {items.map((item) => (
            <li key={item} className={dark ? "text-white/90" : "text-ink-mid"}>
              &bull; {item}
            </li>
          ))}
        </ul>
      </div>
      <div
        className={`border-t pt-8 ${dark ? "border-white/10" : "border-ink-dim/20"}`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-terracotta-light" : "text-blue"}`}
        >
          {target}
        </p>
      </div>
    </div>
  );
}

export default function AdmissionPage() {
  const tCommon = useTranslations("common");
  const t = useTranslations("admission");
  const tPays = useTranslations("candidature.options.pays");

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("page.breadcrumbCurrent")}
        eyebrow={t("page.eyebrow")}
        title={t("page.title")}
        lead={t("page.lead")}
      />

      {/* COUNTRIES — rendered from the constant, so the list can never drift
          from what the form actually accepts. */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="mb-4 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
            {t("countries.title")}
          </h2>
          <p className="mb-12 max-w-2xl text-ink-mid">{t("countries.lead")}</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {COUNTRIES.map((country) => (
              <div
                key={country}
                className="border border-ink-dim/20 bg-white p-6 text-center"
              >
                <span className="font-serif text-[20px] font-normal text-blue-dark">
                  {tPays(country)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ELIGIBILITY */}
      <section className="bg-sky-mid px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 md:grid-cols-2">
          <EligibilityBox
            variant="eligible"
            title={t("eligibility.eligibleTitle")}
            items={t.raw("eligibility.eligibleItems")}
          />
          <EligibilityBox
            variant="ineligible"
            title={t("eligibility.ineligibleTitle")}
            items={t.raw("eligibility.ineligibleItems")}
          />
        </div>
      </section>

      {/* WHAT IS CHECKED AUTOMATICALLY — the honest version of "validation
          automatique": four mechanical checks, and a clear statement that the
          qualitative judgement happens later, by people. */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
            {t("automatic.title")}
          </h2>
          <p className="mb-10 text-ink-mid">{t("automatic.lead")}</p>
          <ul className="mb-10 space-y-4">
            {(t.raw("automatic.items") as string[]).map((item) => (
              <li key={item} className="flex items-start gap-4">
                <CheckIcon className="mt-1 h-5 w-5 shrink-0 text-terracotta" />
                <span className="text-ink">{item}</span>
              </li>
            ))}
          </ul>
          <p className="border-s-2 border-blue bg-sky-mid/60 p-6 text-ink">
            {t("automatic.note")}
          </p>
        </div>
      </section>

      {/* THE THREE PILLARS */}
      <section className="bg-ink px-8 py-[120px] text-white">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16">
            <SectionEyebrow label={t("criteria.eyebrow")} className="mb-6" />
            <h2 className="mb-6 font-serif text-[32px] font-normal sm:text-[42px]">
              {t("criteria.title")}
            </h2>
            <p className="max-w-2xl text-white/70">{t("criteria.lead")}</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {["pillar1", "pillar2", "pillar3"].map((pillar, i) => (
              <CriteriaCard
                key={pillar}
                number={String(i + 1).padStart(2, "0")}
                title={t(`criteria.${pillar}.title`)}
                description={t(`criteria.${pillar}.description`)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SCHOLARSHIPS */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-20 text-center">
            <h2 className="mb-4 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
              {t("bourses.title")}
            </h2>
            <p className="mx-auto max-w-2xl text-ink-mid">{t("bourses.lead")}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
              {TOTAL_SCHOLARSHIPS}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <StatusCard
              eyebrow={t("bourses.laureat.eyebrow")}
              name={t("bourses.laureat.name")}
              items={t.raw("bourses.laureat.items")}
              target={t("bourses.laureat.target")}
            />
            <StatusCard
              dark
              eyebrow={t("bourses.boursier.eyebrow")}
              name={t("bourses.boursier.name")}
              quote={t("bourses.boursier.quote")}
              items={t.raw("bourses.boursier.items")}
              target={t("bourses.boursier.target")}
            />
          </div>
        </div>
      </section>

      <section className="px-8 pb-[120px]">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden border border-ink-dim/20 bg-sky-mid p-16 text-center">
          <h2 className="mb-8 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
            {t("closingCta.title")}
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-ink-mid">
            {t("closingCta.description")}
          </p>
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
