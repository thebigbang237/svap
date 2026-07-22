import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { StatBlock } from "@/components/marketing/StatBlock";
import { PackCard } from "@/components/marketing/PackCard";
import { AgendaDayCard } from "@/components/marketing/AgendaDayCard";
import { CTAButton } from "@/components/marketing/CTAButton";
import {
  ArrowRightIcon,
  GlobeIcon,
  ChipIcon,
  CertificateIcon,
} from "@/components/marketing/icons";

// Decorative country flags — not translated copy, identical in every locale.
const FLAGS = ["🇳🇬", "🇰🇪", "🇿🇦", "🇸🇳", "🇨🇮", "🇲🇦", "🇬🇭", "🇪🇬", "🇷🇼", "🇪🇹"];

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
    <div className="flex h-full flex-col justify-between border border-ink-dim/20 bg-white p-8 transition-colors hover:border-terracotta">
      <div>
        <div className="mb-6 text-blue">{icon}</div>
        <h3 className="font-serif text-[24px] font-normal text-ink mb-4">
          {title}
        </h3>
        <p className="text-ink-mid">{description}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const tHero = useTranslations("hero");
  const tWhy = useTranslations("why");
  const tPacks = useTranslations("packs");
  const tAgenda = useTranslations("agenda");
  const tHome = useTranslations("home");

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-linear-to-b from-blue-dark to-ink text-white">
        <div className="relative z-10 mx-auto grid w-full max-w-[1280px] grid-cols-1 items-end gap-8 px-8 py-16 lg:grid-cols-12">
          <div className="pb-12 lg:col-span-8">
            <div className="mb-8 flex gap-2 text-2xl" aria-hidden="true">
              {FLAGS.map((flag, i) => (
                <span key={i}>{flag}</span>
              ))}
            </div>
            <h1 className="font-serif text-[48px] sm:text-[72px] lg:text-[100px] leading-none font-normal mb-12">
              {tHero("titleLine1")}
              <br />
              <span className="italic text-terracotta-light">
                {tHero("titleEmphasis")}
              </span>
            </h1>
            <div className="flex flex-wrap gap-6">
              <CTAButton
                href="/candidature"
                variant="primary"
                icon={<ArrowRightIcon className="h-4 w-4" />}
              >
                {tHero("ctaPrimary")}
              </CTAButton>
              <CTAButton href="/admission" variant="ghost" className="text-white">
                {tHero("ctaSecondary")}
              </CTAButton>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 pb-12 lg:col-span-4">
            <StatBlock
              value={tHero("stats.leaders.value")}
              label={tHero("stats.leaders.label")}
              variant="dark"
            />
            <StatBlock
              value={tHero("stats.countries.value")}
              label={tHero("stats.countries.label")}
              variant="dark"
            />
            <StatBlock
              value={tHero("stats.days.value")}
              label={tHero("stats.days.label")}
              variant="dark"
            />
            <StatBlock
              value={tHero("stats.opportunities.value")}
              label={tHero("stats.opportunities.label")}
              variant="dark"
            />
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="mx-auto w-full max-w-[1280px] px-8 py-[120px]">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionEyebrow label={tWhy("eyebrow")} className="mb-6" />
            <h2 className="font-serif text-[32px] sm:text-[42px] leading-[1.2] font-normal text-blue-dark mb-8">
              {tWhy("title")}
            </h2>
            <p className="text-[18px] leading-[1.6] text-ink-mid mb-8">
              {tWhy("description")}
            </p>
            <TextCTA href="/#why">{tWhy("ctaLabel")}</TextCTA>
          </div>
          <div className="grid gap-8 md:grid-cols-3 lg:col-span-8">
            <WhyCard
              icon={<GlobeIcon className="h-9 w-9" />}
              title={tWhy("cards.network.title")}
              description={tWhy("cards.network.description")}
            />
            <WhyCard
              icon={<ChipIcon className="h-9 w-9" />}
              title={tWhy("cards.immersion.title")}
              description={tWhy("cards.immersion.description")}
            />
            <WhyCard
              icon={<CertificateIcon className="h-9 w-9" />}
              title={tWhy("cards.certification.title")}
              description={tWhy("cards.certification.description")}
            />
          </div>
        </div>
      </section>

      {/* PACKS TEASER */}
      <section className="border-y border-ink-dim/10 bg-white px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16 text-center">
            <SectionEyebrow
              label={tPacks("teaser.eyebrow")}
              align="center"
              className="mb-4"
            />
            <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark">
              {tPacks("teaser.title")}
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
            <PackCard
              size="compact"
              variant="default"
              name={tPacks("teaser.laureat.name")}
              badgeLabel={tPacks("teaser.laureat.badgeLabel")}
              placesCount={tPacks("teaser.laureat.placesCount")}
              costLabel={tPacks("teaser.laureat.costLabel")}
              costValue={tPacks("teaser.laureat.costValue")}
              features={tPacks.raw("teaser.laureat.features")}
            />
            <PackCard
              size="compact"
              variant="featured"
              name={tPacks("teaser.boursier.name")}
              badgeLabel={tPacks("teaser.boursier.badgeLabel")}
              placesCount={tPacks("teaser.boursier.placesCount")}
              costLabel={tPacks("teaser.boursier.costLabel")}
              costValue={tPacks("teaser.boursier.costValue")}
              features={tPacks.raw("teaser.boursier.features")}
              ctaLabel={tPacks("teaser.boursier.ctaLabel")}
              href="/candidature"
            />
          </div>
          <div className="mt-12 text-center">
            <TextCTA href="/packs">{tPacks("teaser.ctaLabel")}</TextCTA>
          </div>
        </div>
      </section>

      {/* AGENDA TEASER */}
      <section className="mx-auto w-full max-w-[1280px] px-8 py-[120px]">
        <div className="mb-16">
          <SectionEyebrow label={tAgenda("teaser.eyebrow")} className="mb-6" />
          <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark">
            {tAgenda("teaser.title")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <AgendaDayCard
            size="compact"
            day={1}
            locationLabel={tAgenda("teaser.day1.locationLabel")}
            title={tAgenda("teaser.day1.title")}
            items={[{ time: "", description: tAgenda("teaser.day1.description") }]}
          />
          <AgendaDayCard
            size="compact"
            day={3}
            locationLabel={tAgenda("teaser.day3.locationLabel")}
            title={tAgenda("teaser.day3.title")}
            items={[{ time: "", description: tAgenda("teaser.day3.description") }]}
          />
        </div>
        <div className="mt-16 text-right">
          <TextCTA href="/agenda">{tAgenda("teaser.ctaLabel")}</TextCTA>
        </div>
      </section>

      {/* BOURSE TEASER */}
      <section className="relative overflow-hidden bg-linear-to-b from-blue-dark to-ink px-8 py-24">
        <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center gap-12 md:flex-row md:justify-between">
          <div className="max-w-xl text-center md:text-left">
            <StatBlock
              value={tHome("bourseTeaser.statValue")}
              label={tHome("bourseTeaser.statLabel")}
              variant="dark"
              className="mb-6"
            />
            <p className="mb-8 leading-relaxed text-white/80">
              {tHome("bourseTeaser.description")}
            </p>
            <CTAButton href="/admission" variant="ghost" className="text-white">
              {tHome("bourseTeaser.ctaLabel")}
            </CTAButton>
          </div>
        </div>
      </section>

      {/* DELEGATE SECTION */}
      <section className="bg-sky-deep px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionEyebrow label={tHome("delegate.eyebrow")} className="mb-6" />
            <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark mb-8">
              {tHome("delegate.title")}
            </h2>
            <div className="mb-12 space-y-6">
              <div className="flex items-start gap-4 border border-blue/10 bg-white/50 p-6">
                <GlobeIcon className="h-6 w-6 shrink-0 text-blue" />
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
                    {tHome("delegate.highlight1.title")}
                  </h4>
                  <p className="text-ink-mid">
                    {tHome("delegate.highlight1.description")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 border border-blue/10 bg-white/50 p-6">
                <ChipIcon className="h-6 w-6 shrink-0 text-blue" />
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
                    {tHome("delegate.highlight2.title")}
                  </h4>
                  <p className="text-ink-mid">
                    {tHome("delegate.highlight2.description")}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="border border-ink-dim/20 bg-white p-12 text-center">
              <StatBlock
                value={tHome("delegate.statValue")}
                label={tHome("delegate.statLabel")}
                variant="light"
                className="mb-8"
              />
              <div className="mb-8 h-px bg-gradient-to-r from-terracotta to-transparent" />
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="font-serif text-[32px] font-normal text-blue">
                    {tHome("delegate.subStat1Value")}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-dim">
                    {tHome("delegate.subStat1Label")}
                  </p>
                </div>
                <div>
                  <p className="font-serif text-[32px] font-normal text-blue">
                    {tHome("delegate.subStat2Value")}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-dim">
                    {tHome("delegate.subStat2Label")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="border-t border-ink-dim/10 px-8 py-[120px] text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark mb-12">
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
