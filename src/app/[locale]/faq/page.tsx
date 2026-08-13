import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CTAButton } from "@/components/marketing/CTAButton";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/components/marketing/icons";

interface FaqItem {
  q: string;
  a: string;
}

/**
 * FAQ.
 *
 * Built on native <details>/<summary> rather than a JS accordion: it works
 * before hydration, it's keyboard-accessible for free, and — the reason that
 * matters here — the answers are inside the DOM at load, so browser find-in-page
 * and search engines can see them. On a page whose job is partly to answer
 * "is this a scam?", the answers being findable is the point.
 */
export default function FaqPage() {
  const tCommon = useTranslations("common");
  const t = useTranslations("faq");
  const items = t.raw("items") as FaqItem[];

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
        <div className="mx-auto max-w-3xl">
          <ul className="border-t border-ink-dim/20">
            {items.map((item) => (
              <li key={item.q} className="border-b border-ink-dim/20">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-start">
                    <span className="font-serif text-[20px] font-normal text-blue-dark sm:text-[24px]">
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-2 shrink-0 text-2xl leading-none text-terracotta transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-8 leading-relaxed text-ink-mid">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>

          <div className="mt-16 border border-ink-dim/20 bg-sky-mid/60 p-10 text-center">
            <h2 className="mb-8 font-serif text-[28px] font-normal text-blue-dark">
              {t("ctaTitle")}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <CTAButton
                href="/candidature"
                variant="primary"
                icon={<ArrowRightIcon className="h-4 w-4" />}
              >
                {t("ctaLabel")}
              </CTAButton>
              <Link
                href="/confiance"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-blue transition-colors hover:text-terracotta"
              >
                {tCommon("trustLink")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
