import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { EligibilityBox } from "@/components/marketing/EligibilityBox";
import { CTAButton } from "@/components/marketing/CTAButton";

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
      <span className="absolute -top-4 right-4 font-serif text-[56px] font-normal leading-none text-white/10 transition-colors group-hover:text-terracotta-light/40">
        {number}
      </span>
      <div className="relative z-10">
        <h4 className="font-serif text-[24px] font-normal mb-4">{title}</h4>
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
        "flex h-full flex-col justify-between border-y border-r border-l-8 p-12",
        dark
          ? "border-l-terracotta border-y-transparent border-r-transparent bg-ink text-white md:scale-105"
          : "border-l-blue border-y-ink-dim/20 border-r-ink-dim/20 bg-white",
      ].join(" ")}
    >
      <div>
        <span
          className={`mb-4 block text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-terracotta-light" : "text-blue"}`}
        >
          {eyebrow}
        </span>
        <h3 className="font-serif text-[32px] font-normal mb-6">{name}</h3>
        {quote && (
          <p
            className={`mb-8 italic ${dark ? "text-white/80" : "text-ink-mid"}`}
          >
            &ldquo;{quote}&rdquo;
          </p>
        )}
        <ul className="mb-8 space-y-4">
          {items.map((item) => (
            <li
              key={item}
              className={dark ? "text-white/90" : "text-ink-mid"}
            >
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
  const tAdmission = useTranslations("admission");

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={tAdmission("page.breadcrumbCurrent")}
        eyebrow={tAdmission("page.eyebrow")}
        title={tAdmission("page.title")}
        lead={tAdmission("page.lead")}
      />

      {/* ELIGIBILITY COMPARISON */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 md:grid-cols-2">
          <EligibilityBox
            variant="eligible"
            title={tAdmission("eligibility.eligibleTitle")}
            items={tAdmission.raw("eligibility.eligibleItems")}
          />
          <EligibilityBox
            variant="ineligible"
            title={tAdmission("eligibility.ineligibleTitle")}
            items={tAdmission.raw("eligibility.ineligibleItems")}
          />
        </div>
      </section>

      {/* SELECTION CRITERIA */}
      <section className="bg-ink px-8 py-[120px] text-white">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16">
            <SectionEyebrow
              label={tAdmission("criteria.eyebrow")}
              className="mb-6"
            />
            <h2 className="font-serif text-[32px] sm:text-[42px] font-normal">
              {tAdmission("criteria.title")}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <CriteriaCard
              number="01"
              title={tAdmission("criteria.pillar1.title")}
              description={tAdmission("criteria.pillar1.description")}
            />
            <CriteriaCard
              number="02"
              title={tAdmission("criteria.pillar2.title")}
              description={tAdmission("criteria.pillar2.description")}
            />
            <CriteriaCard
              number="03"
              title={tAdmission("criteria.pillar3.title")}
              description={tAdmission("criteria.pillar3.description")}
            />
          </div>
        </div>
      </section>

      {/* BOURSE ELIGIBILITY */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-20 text-center">
            <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark mb-4">
              {tAdmission("statuses.title")}
            </h2>
            <p className="mx-auto max-w-xl text-ink-mid">
              {tAdmission("statuses.lead")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <StatusCard
              eyebrow={tAdmission("statuses.laureat.eyebrow")}
              name={tAdmission("statuses.laureat.name")}
              items={tAdmission.raw("statuses.laureat.items")}
              target={tAdmission("statuses.laureat.target")}
            />
            <StatusCard
              dark
              eyebrow={tAdmission("statuses.boursier.eyebrow")}
              name={tAdmission("statuses.boursier.name")}
              quote={tAdmission("statuses.boursier.quote")}
              items={tAdmission.raw("statuses.boursier.items")}
              target={tAdmission("statuses.boursier.target")}
            />
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="px-8 py-[120px]">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden border border-ink-dim/20 bg-sky-mid p-16 text-center">
          <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark mb-8">
            {tAdmission("closingCta.title")}
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-ink-mid">
            {tAdmission("closingCta.description")}
          </p>
          <CTAButton href="/packs" variant="primary">
            {tAdmission("closingCta.ctaLabel")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
