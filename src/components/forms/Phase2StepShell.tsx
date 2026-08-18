import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/marketing/PageHeader";
import { StepProgress } from "@/components/forms/fields";
import type { Phase2Step } from "@/lib/phase2/steps";

/**
 * Chrome shared by every Phase-2 step: breadcrumb, progress bar and the
 * step's own heading.
 *
 * Server component — the access guard runs in each page before this renders,
 * so nothing here needs to re-check it.
 *
 * `steps` comes from the guard's progress rather than the canonical constant:
 * the capacity step exists only for some packs, and a Délégué counting "5 sur
 * 6" would be looking for a step they will never be shown.
 */
export async function Phase2StepShell({
  step,
  steps,
  children,
}: {
  step: Phase2Step;
  steps: Phase2Step[];
  children: React.ReactNode;
}) {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("phase2");

  const index = steps.indexOf(step);

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
            total={steps.length}
            label={t("stepLabel", {
              current: index + 1,
              total: steps.length,
            })}
            stepTitle={t(`steps.${step}.title`)}
          />
          {children}
        </div>
      </section>
    </>
  );
}
