import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { CTAButton } from "@/components/marketing/CTAButton";
import { CheckIcon } from "@/components/marketing/icons";

/**
 * End of the candidate's part in Phase 2.
 *
 * Not routed through guardPhase2Step: every step is behind them, so the step
 * guard would bounce them back to `consentements` as the "furthest" reachable
 * step. The check here is simply that the dossier actually reached
 * verification.
 */
export default async function Phase2TerminePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await readSession();
  if (!session) redirect({ href: "/documents", locale });

  const supabase = createAdminClient();
  const progress = await loadPhase2Progress(supabase, session.cid);
  if (!progress) redirect({ href: "/documents", locale });

  const reachedVerification = ["verification", "valide", "rejete"].includes(
    progress.candidature.status,
  );
  if (!reachedVerification) {
    redirect({ href: "/documents/consentements", locale });
  }

  const t = await getTranslations("phase2.termine");

  return (
    <section className="flex flex-1 items-center justify-center px-8 py-[120px]">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex h-16 w-16 items-center justify-center border border-terracotta">
          <CheckIcon className="h-8 w-8 text-terracotta" />
        </div>

        <h1 className="mb-8 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
          {t("title")}
        </h1>

        <p className="mb-6 text-ink-mid">{t("description")}</p>

        <h2 className="mb-4 font-serif text-[22px] font-normal text-blue-dark">
          {t("nextTitle")}
        </h2>
        <ol className="mb-10 space-y-4">
          {["checks", "decision", "documents"].map((key, i) => (
            <li key={key} className="flex items-start gap-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-ink-dim/30 text-xs font-semibold text-blue">
                {i + 1}
              </span>
              <span className="text-ink-mid">{t(`next.${key}`)}</span>
            </li>
          ))}
        </ol>

        <div className="mb-10 border-s-2 border-blue bg-sky-mid/60 p-6">
          <p className="text-ink">{t("noAction")}</p>
        </div>

        <CTAButton href="/" variant="primary">
          {t("ctaLabel")}
        </CTAButton>
      </div>
    </section>
  );
}
