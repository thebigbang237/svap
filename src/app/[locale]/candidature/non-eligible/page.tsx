import { getTranslations } from "next-intl/server";
import { CTAButton } from "@/components/marketing/CTAButton";
import { Link } from "@/i18n/navigation";
import { INELIGIBILITY_REASONS } from "@/lib/constants/program";

/**
 * Phase-1 outcome: a mechanical eligibility gate was not met.
 *
 * Deliberately not styled as an error. No fee was charged, nothing was lost,
 * and per §9 the dossier stays eligible for future editions — the page says
 * exactly that. The specific reason is named rather than hidden behind a
 * generic message, because a candidate who mistyped their age needs to know
 * that's what happened.
 */
export default async function NonEligiblePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const t = await getTranslations("candidature.nonEligible");

  // The reason arrives in the URL, so treat it as untrusted: only render copy
  // for a value we recognise, otherwise fall back to the generic explanation.
  const knownReason = (INELIGIBILITY_REASONS as readonly string[]).includes(
    reason ?? "",
  )
    ? reason
    : null;

  return (
    <section className="flex flex-1 items-center justify-center px-8 py-[120px]">
      <div className="mx-auto max-w-xl">
        <span className="mb-6 block text-xs font-semibold uppercase tracking-[0.2em] text-blue">
          {t("eyebrow")}
        </span>
        <h1 className="mb-8 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
          {t("title")}
        </h1>

        <div className="mb-8 border-s-2 border-blue bg-sky-mid/60 p-6">
          <p className="text-ink">
            {knownReason ? t(`reasons.${knownReason}`) : t("reasons.generic")}
          </p>
        </div>

        <p className="mb-4 text-ink-mid">{t("noFee")}</p>
        <p className="mb-12 text-ink-mid">{t("futureEditions")}</p>

        <div className="flex flex-wrap items-center gap-6">
          <CTAButton href="/" variant="primary">
            {t("ctaLabel")}
          </CTAButton>
          <Link
            href="/admission"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue transition-colors hover:text-terracotta"
          >
            {t("criteriaLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}
