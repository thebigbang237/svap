import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PackCard, type PackFeature } from "@/components/marketing/PackCard";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";

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
    <div className="relative flex w-full flex-col items-center text-center md:w-1/5 md:items-start md:text-left">
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

/** Mark the last feature in a list as explicitly excluded (e.g. the
 * "Invité" pack's "Logement non inclus"). */
function withLastExcluded(features: string[]): (string | PackFeature)[] {
  return features.map((text, i) =>
    i === features.length - 1 ? { text, included: false } : text,
  );
}

export default function PacksPage() {
  const tCommon = useTranslations("common");
  const tPacks = useTranslations("packs");

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={tPacks("page.breadcrumbCurrent")}
        eyebrow={tPacks("page.eyebrow")}
        title={tPacks("page.title")}
        lead={tPacks("page.lead")}
      />

      {/* PACKS GRID */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <PackCard
              size="full"
              variant="default"
              name={tPacks("items.laureat.name")}
              badgeLabel={tPacks("items.laureat.badgeLabel")}
              placesCount={tPacks("items.laureat.placesCount")}
              costLabel={tPacks("items.laureat.costLabel")}
              costValue={tPacks("items.laureat.costValue")}
              features={tPacks.raw("items.laureat.features")}
              applicationFee={tPacks("items.laureat.applicationFee")}
              ctaLabel={tPacks("items.laureat.ctaLabel")}
              href="/candidature"
            />
            <PackCard
              size="full"
              variant="featured"
              name={tPacks("items.boursier.name")}
              badgeLabel={tPacks("items.boursier.badgeLabel")}
              placesCount={tPacks("items.boursier.placesCount")}
              costLabel={tPacks("items.boursier.costLabel")}
              costValue={tPacks("items.boursier.costValue")}
              features={tPacks.raw("items.boursier.features")}
              applicationFee={tPacks("items.boursier.applicationFee")}
              ctaLabel={tPacks("items.boursier.ctaLabel")}
              href="/candidature"
            />
            <PackCard
              size="full"
              variant="default"
              name={tPacks("items.invite.name")}
              badgeLabel={tPacks("items.invite.badgeLabel")}
              placesCount={tPacks("items.invite.placesCount")}
              costLabel={tPacks("items.invite.costLabel")}
              costValue={tPacks("items.invite.costValue")}
              features={withLastExcluded(tPacks.raw("items.invite.features"))}
              applicationFee={tPacks("items.invite.applicationFee")}
              ctaLabel={tPacks("items.invite.ctaLabel")}
              href="/candidature"
            />
            <PackCard
              size="full"
              variant="default"
              name={tPacks("items.ambassadeur.name")}
              badgeLabel={tPacks("items.ambassadeur.badgeLabel")}
              placesCount={tPacks("items.ambassadeur.placesCount")}
              costLabel={tPacks("items.ambassadeur.costLabel")}
              costValue={tPacks("items.ambassadeur.costValue")}
              features={tPacks.raw("items.ambassadeur.features")}
              applicationFee={tPacks("items.ambassadeur.applicationFee")}
              ctaLabel={tPacks("items.ambassadeur.ctaLabel")}
              href="/candidature"
            />
          </div>
        </div>
      </section>

      {/* PROCESS STEPS */}
      <section className="overflow-hidden bg-sky-mid px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16">
            <SectionEyebrow label={tPacks("process.eyebrow")} className="mb-6" />
            <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark">
              {tPacks("process.title")}
            </h2>
          </div>
          <div className="relative flex flex-col items-start gap-12 md:flex-row md:justify-between md:gap-0">
            <div className="absolute top-10 left-0 hidden h-px w-full bg-ink-dim/20 md:block" />
            <ProcessStep
              number="01"
              title={tPacks("process.steps.step1.title")}
              description={tPacks("process.steps.step1.description")}
            />
            <ProcessStep
              number="02"
              title={tPacks("process.steps.step2.title")}
              description={tPacks("process.steps.step2.description")}
            />
            <ProcessStep
              number="03"
              title={tPacks("process.steps.step3.title")}
              description={tPacks("process.steps.step3.description")}
            />
            <ProcessStep
              number="04"
              title={tPacks("process.steps.step4.title")}
              description={tPacks("process.steps.step4.description")}
            />
            <ProcessStep
              number="05"
              title={tPacks("process.steps.step5.title")}
              description={tPacks("process.steps.step5.description")}
              dark
            />
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="px-8 py-[120px] text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark mb-8">
            {tPacks("closingCta.title")}
          </h2>
          <p className="mb-12 text-ink-mid">{tPacks("closingCta.description")}</p>
          <CTAButton
            href="/candidature"
            variant="primary"
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {tPacks("closingCta.ctaLabel")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
