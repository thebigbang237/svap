import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { StatBlock } from "@/components/marketing/StatBlock";
import { PackCard } from "@/components/marketing/PackCard";
import { HeroBackdrop } from "@/components/marketing/HeroBackdrop";
import { CTAButton } from "@/components/marketing/CTAButton";
import { Ltr } from "@/components/layout/Ltr";
import {
  ArrowRightIcon,
  GlobeIcon,
  ChipIcon,
  CertificateIcon,
  ShieldIcon,
  MailIcon,
  CheckIcon,
} from "@/components/marketing/icons";
import {
  COUNTRIES,
  PACK_SPECS,
  PROGRAMME_DAYS,
  TOTAL_PARTICIPANT_PLACES,
  TOTAL_SCHOLARSHIPS,
  TOTAL_COUNTRIES,
  TOTAL_DELEGATE_PLACES,
} from "@/lib/constants/program";

/** Decorative flags for the six participating countries, in COUNTRIES order. */
const FLAGS: Record<(typeof COUNTRIES)[number], string> = {
  zaf: "🇿🇦",
  mar: "🇲🇦",
  cmr: "🇨🇲",
  ken: "🇰🇪",
  gha: "🇬🇭",
  egy: "🇪🇬",
};

function TextCTA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta transition-all hover:gap-4"
    >
      {children}
      <ArrowRightIcon className="h-4 w-4 shrink-0" />
    </Link>
  );
}

function WhyCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col border border-ink-dim/20 bg-white p-8 transition-colors hover:border-terracotta">
      <div className="mb-6 text-blue">{icon}</div>
      <h3 className="mb-4 font-serif text-[24px] font-normal text-ink">
        {title}
      </h3>
      <p className="text-ink-mid">{description}</p>
    </div>
  );
}

export default function HomePage() {
  const tHero = useTranslations("hero");
  const tWhy = useTranslations("why");
  const tPacks = useTranslations("packs");
  const tPack = useTranslations("candidature.options.pack");
  const tHome = useTranslations("home");

  // Every headline figure is derived from program.ts. The old page hard-coded
  // "250 leaders / 10 pays / 110 bourses", none of which matched the edition.
  const stats = [
    { value: TOTAL_PARTICIPANT_PLACES, key: "leaders" },
    { value: TOTAL_COUNTRIES, key: "countries" },
    { value: PROGRAMME_DAYS, key: "days" },
    { value: TOTAL_SCHOLARSHIPS, key: "bourses" },
  ] as const;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-linear-to-b from-sky to-sky-mid px-8 pt-16 pb-[120px]">
        {/* Drop a photograph in by passing imageSrc — see the brief in
            HeroBackdrop. Layout, masking and RTL behaviour are identical
            either way. */}
        <HeroBackdrop />

        <div className="relative z-10 mx-auto max-w-[1280px]">
          <div className="mb-8 flex flex-wrap gap-2" aria-hidden="true">
            {COUNTRIES.map((c) => (
              <span key={c} className="text-2xl">
                {FLAGS[c]}
              </span>
            ))}
          </div>

          <h1 className="mb-8 max-w-4xl font-serif text-[44px] font-normal leading-[1.1] text-blue-dark sm:text-[64px] lg:text-[80px]">
            {tHero("titleLine1")}{" "}
            <span className="text-terracotta">{tHero("titleEmphasis")}</span>
          </h1>

          <p className="mb-8 max-w-2xl text-lg text-ink-mid">
            {tHero("lead")}
          </p>

          {/* The founding principle, above the fold, before any CTA. */}
          <p className="mb-12 inline-flex items-center gap-3 border border-terracotta/40 bg-white px-5 py-3 text-sm font-semibold text-terracotta">
            <CheckIcon className="h-4 w-4 shrink-0" />
            {tHero("freeBadge")}
          </p>

          <div className="mb-20 flex flex-wrap items-center gap-6">
            <CTAButton
              href="/candidature"
              variant="primary"
              icon={<ArrowRightIcon className="h-4 w-4" />}
            >
              {tHero("ctaPrimary")}
            </CTAButton>
            <CTAButton href="/admission" variant="secondary">
              {tHero("ctaSecondary")}
            </CTAButton>
          </div>

          <div className="grid grid-cols-2 gap-8 border-t border-ink-dim/20 pt-12 md:grid-cols-4">
            {stats.map((stat) => (
              <StatBlock
                key={stat.key}
                variant="light"
                value={String(stat.value)}
                label={tHero(`stats.${stat.key}.label`)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* TWO-PHASE PROCESS — the single most important thing a visitor needs
          to understand before they decide whether to trust the site. */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16 max-w-2xl">
            <h2 className="mb-6 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
              {tHome("processTitle")}
            </h2>
            <p className="text-ink-mid">{tHome("processLead")}</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {(["phase1", "phase2"] as const).map((phase, i) => (
              <div
                key={phase}
                className={[
                  "border p-10",
                  i === 0
                    ? "border-terracotta bg-white"
                    : "border-ink-dim/20 bg-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "mb-6 inline-block px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                    i === 0
                      ? "bg-terracotta text-white"
                      : "bg-sky-mid text-blue",
                  ].join(" ")}
                >
                  {tHome(`${phase}.badge`)}
                </span>
                <h3 className="mb-4 font-serif text-[28px] font-normal text-blue-dark">
                  {tHome(`${phase}.title`)}
                </h3>
                <p className="text-ink-mid">{tHome(`${phase}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="bg-sky-mid px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16 max-w-2xl">
            <SectionEyebrow label={tWhy("eyebrow")} className="mb-6" />
            <h2 className="mb-6 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
              {tWhy("title")}
            </h2>
            <p className="text-ink-mid">{tWhy("description")}</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <WhyCard
              icon={<GlobeIcon className="h-8 w-8" />}
              title={tWhy("cards.network.title")}
              description={tWhy("cards.network.description")}
            />
            <WhyCard
              icon={<ChipIcon className="h-8 w-8" />}
              title={tWhy("cards.immersion.title")}
              description={tWhy("cards.immersion.description")}
            />
            <WhyCard
              icon={<GlobeIcon className="h-8 w-8" />}
              title={tWhy("cards.africa.title")}
              description={tWhy("cards.africa.description")}
            />
            <WhyCard
              icon={<CertificateIcon className="h-8 w-8" />}
              title={tWhy("cards.certification.title")}
              description={tWhy("cards.certification.description")}
            />
            <WhyCard
              icon={<ArrowRightIcon className="h-8 w-8" />}
              title={tWhy("cards.impact.title")}
              description={tWhy("cards.impact.description")}
            />
            <WhyCard
              icon={<ShieldIcon className="h-8 w-8" />}
              title={tWhy("cards.selection.title")}
              description={tWhy("cards.selection.description")}
            />
          </div>

          <div className="mt-12">
            <TextCTA href="/agenda">{tWhy("ctaLabel")}</TextCTA>
          </div>
        </div>
      </section>

      {/* PACKS TEASER — the two scholarship tracks, priced from PACK_SPECS. */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
              {tPacks("page.title")}
            </h2>
            <TextCTA href="/packs">{tPacks("closingCta.ctaLabel")}</TextCTA>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {(["laureat", "boursier"] as const).map((pack) => (
              <PackCard
                key={pack}
                size="full"
                variant={pack === "boursier" ? "featured" : "default"}
                name={tPack(pack)}
                badgeLabel={tPacks(`items.${pack}.badgeLabel`)}
                placesCount={PACK_SPECS[pack].places}
                costLabel={tPacks(`items.${pack}.costLabel`)}
                costValue={tPacks(`items.${pack}.costValue`)}
                features={tPacks.raw(`items.${pack}.features`)}
                applicationFee={`${tPacks("feePrefix")} $${PACK_SPECS[pack].verificationFeeUsd} — ${tPacks("feeSuffix")}`}
                ctaLabel={tPacks(`items.${pack}.ctaLabel`)}
                href={`/candidature?pack=${pack}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SCHOLARSHIPS + DELEGATES */}
      <section className="bg-ink px-8 py-[120px] text-white">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-16 lg:grid-cols-2">
          <div>
            <Ltr className="mb-6 block font-serif text-[64px] font-normal leading-none text-terracotta-light">
              {String(TOTAL_SCHOLARSHIPS)}
            </Ltr>
            <h2 className="mb-6 font-serif text-[32px] font-normal">
              {tHome("bourseTitle")}
            </h2>
            <p className="mb-8 text-white/70">{tHome("bourseDescription")}</p>
            <TextCTA href="/admission">{tHome("bourseCta")}</TextCTA>
          </div>

          <div className="border-s border-white/10 ps-16">
            <Ltr className="mb-6 block font-serif text-[64px] font-normal leading-none text-terracotta-light">
              {String(TOTAL_DELEGATE_PLACES)}
            </Ltr>
            <h2 className="mb-6 font-serif text-[32px] font-normal">
              {tHome("delegateTitle")}
            </h2>
            <p className="mb-8 text-white/70">{tHome("delegateDescription")}</p>
            <TextCTA href="/delegues">{tHome("delegateCta")}</TextCTA>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="px-8 py-[120px] text-center">
        <div className="mx-auto max-w-3xl">
          <MailIcon className="mx-auto mb-8 h-10 w-10 text-terracotta" />
          <h2 className="mb-8 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
            {tHome("closingCta.title")}
          </h2>
          <p className="mb-12 text-ink-mid">{tHome("closingCta.description")}</p>
          <CTAButton
            href="/candidature"
            variant="primary"
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {tHome("closingCta.ctaLabel")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
