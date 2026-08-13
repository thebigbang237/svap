import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { AgendaDayCard } from "@/components/marketing/AgendaDayCard";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";
import { PROGRAMME_DAYS } from "@/lib/constants/program";

export default function AgendaPage() {
  const tCommon = useTranslations("common");
  const t = useTranslations("agenda");

  const days = Array.from({ length: PROGRAMME_DAYS }, (_, i) => `day${i + 1}`);

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("breadcrumbCurrent")}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      />

      <section className="px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
          {days.map((dayKey, i) => (
            <AgendaDayCard
              key={dayKey}
              size="full"
              day={i + 1}
              locationLabel={t(`days.${dayKey}.locationLabel`)}
              title={t(`days.${dayKey}.title`)}
              items={t.raw(`days.${dayKey}.items`)}
            />
          ))}
        </div>
      </section>

      {/* The agenda is the aspiration; the CTA has to point at the free form,
          not at the price list. */}
      <section className="bg-linear-to-b from-blue-dark to-ink px-8 py-[120px] text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 font-serif text-[32px] font-normal sm:text-[42px]">
            {t("closingTitle")}
          </h2>
          <CTAButton
            href="/candidature"
            variant="primary"
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {t("closingCta")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
