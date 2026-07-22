import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { AgendaDayCard } from "@/components/marketing/AgendaDayCard";
import { CTAButton } from "@/components/marketing/CTAButton";

const DAY_KEYS = ["day1", "day2", "day3", "day4", "day5", "day6"] as const;

export default function AgendaPage() {
  const tCommon = useTranslations("common");
  const tAgenda = useTranslations("agenda");

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={tAgenda("page.breadcrumbCurrent")}
        eyebrow={tAgenda("page.eyebrow")}
        title={tAgenda("page.title")}
        lead={tAgenda("page.lead")}
      />

      {/* AGENDA GRID */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
          {DAY_KEYS.map((dayKey, i) => (
            <AgendaDayCard
              key={dayKey}
              size="full"
              day={i + 1}
              locationLabel={tAgenda(`days.${dayKey}.locationLabel`)}
              title={tAgenda(`days.${dayKey}.title`)}
              items={tAgenda.raw(`days.${dayKey}.items`)}
            />
          ))}
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="bg-linear-to-b from-blue-dark to-ink px-8 py-[120px] text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-[32px] sm:text-[42px] font-normal mb-8">
            {tAgenda("closingCta.title")}
          </h2>
          <CTAButton href="/packs" variant="primary">
            {tAgenda("closingCta.ctaLabel")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
