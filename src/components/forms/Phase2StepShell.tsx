import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/marketing/PageHeader";
import { StepProgress } from "@/components/forms/fields";
import { PHASE2_STEPS, type Phase2Step } from "@/lib/phase2/steps";

/**
 * Chrome shared by every Phase-2 step: breadcrumb, progress bar and the
 * step's own heading.
 *
 * Server component — the access guard runs in each page before this renders,
 * so nothing here needs to re-check it.
 */
export async function Phase2StepShell({
  step,
  children,
}: {
  step: Phase2Step;
  children: React.ReactNode;
}) {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("phase2");

  const index = PHASE2_STEPS.indexOf(step);

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("breadcrumbCurrent")}
        eyebrow={t("eyebrow")}
        title={t(`steps.${step}.title`)}
        lead={t(`steps.${step}.lead`)}
      />

      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-3xl space-y-12">
          <StepProgress
            current={index + 1}
            total={PHASE2_STEPS.length}
            label={t("stepLabel", {
              current: index + 1,
              total: PHASE2_STEPS.length,
            })}
            stepTitle={t(`steps.${step}.title`)}
          />
          {children}
        </div>
      </section>
    </>
  );
}
