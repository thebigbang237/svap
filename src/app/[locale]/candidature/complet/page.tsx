import { useTranslations } from "next-intl";
import { CTAButton } from "@/components/marketing/CTAButton";
import { Link } from "@/i18n/navigation";

/**
 * Phase-1 outcome: the candidate met every eligibility criterion, but the
 * pack had already reached its pre-selection cap.
 *
 * Kept separate from the non-eligible page on purpose. "You don't qualify"
 * and "you qualified but we ran out of places" are different messages, and
 * conflating them would tell an eligible candidate something untrue about
 * themselves. This page says plainly that nothing was wrong with the dossier.
 */
export default function PackCompletPage() {
  const t = useTranslations("candidature.complet");

  return (
    <section className="flex flex-1 items-center justify-center px-8 py-[120px]">
      <div className="mx-auto max-w-xl">
        <span className="mb-6 block text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          {t("eyebrow")}
        </span>
        <h1 className="mb-8 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
          {t("title")}
        </h1>

        <div className="mb-8 border-s-2 border-terracotta bg-sky-mid/60 p-6">
          <p className="text-ink">{t("explanation")}</p>
        </div>

        <p className="mb-4 text-ink-mid">{t("noFee")}</p>
        <p className="mb-12 text-ink-mid">{t("nextSteps")}</p>

        <div className="flex flex-wrap items-center gap-6">
          <CTAButton href="/packs" variant="primary">
            {t("ctaLabel")}
          </CTAButton>
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue transition-colors hover:text-terracotta"
          >
            {t("homeLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}
