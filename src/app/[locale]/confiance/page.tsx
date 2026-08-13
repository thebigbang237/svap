import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CTAButton } from "@/components/marketing/CTAButton";
import { Link } from "@/i18n/navigation";
import {
  ShieldIcon,
  LockIcon,
  CrossIcon,
  ArrowRightIcon,
} from "@/components/marketing/icons";

interface Item {
  label?: string;
  value?: string;
  title?: string;
  description?: string;
}

/**
 * Trust and transparency.
 *
 * This page exists because the programme asks people in six countries to hand
 * over passport scans, criminal records and money — and because the anti-fraud
 * guidance is only useful if a candidate can find it in one place and check it
 * against what is being asked of them.
 */
export default function ConfiancePage() {
  const tCommon = useTranslations("common");
  const t = useTranslations("confiance");

  const groupItems = t.raw("groupItems") as Item[];
  const fraudRules = t.raw("fraudRules") as string[];
  const securityItems = t.raw("securityItems") as Item[];
  const refundRows = t.raw("refundRows") as [string, string][];

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("breadcrumbCurrent")}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      />

      {/* WHO WE ARE */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 font-serif text-[32px] font-normal text-blue-dark">
            {t("groupTitle")}
          </h2>
          <dl className="border-t border-ink-dim/20">
            {groupItems.map((item) => (
              <div
                key={item.label}
                className="flex flex-col gap-1 border-b border-ink-dim/20 py-5 sm:flex-row sm:gap-8"
              >
                <dt className="w-48 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim">
                  {item.label}
                </dt>
                <dd className="text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FRAUD — the most operationally useful section on the site. */}
      <section className="bg-ink px-8 py-[120px] text-white">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center gap-4">
            <CrossIcon className="h-7 w-7 shrink-0 text-terracotta-light" />
            <h2 className="font-serif text-[32px] font-normal">
              {t("fraudTitle")}
            </h2>
          </div>
          <p className="mb-10 text-white/70">{t("fraudLead")}</p>

          <ul className="space-y-5">
            {fraudRules.map((rule) => (
              <li
                key={rule}
                className="border-s-2 border-terracotta bg-white/5 p-5 text-white/90"
              >
                {rule}
              </li>
            ))}
          </ul>

          <p className="mt-10 font-semibold text-terracotta-light">
            {t("fraudReport")}
          </p>
        </div>
      </section>

      {/* SECURITY */}
      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 flex items-center gap-4">
            <ShieldIcon className="h-7 w-7 shrink-0 text-blue" />
            <h2 className="font-serif text-[32px] font-normal text-blue-dark">
              {t("securityTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {securityItems.map((item) => (
              <div
                key={item.title}
                className="border border-ink-dim/20 bg-white p-8"
              >
                <LockIcon className="mb-4 h-5 w-5 text-terracotta" />
                <h3 className="mb-3 font-serif text-[20px] font-normal text-blue-dark">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-mid">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REFUNDS */}
      <section className="bg-sky-mid px-8 py-[120px]">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 font-serif text-[32px] font-normal text-blue-dark">
            {t("refundTitle")}
          </h2>
          <div className="overflow-x-auto border border-ink-dim/20 bg-white">
            <table className="w-full text-start text-sm">
              <tbody>
                {refundRows.map(([situation, treatment]) => (
                  <tr
                    key={situation}
                    className="border-b border-ink-dim/10 last:border-0"
                  >
                    <th
                      scope="row"
                      className="w-64 px-6 py-5 text-start align-top font-semibold text-ink"
                    >
                      {situation}
                    </th>
                    <td className="px-6 py-5 align-top text-ink-mid">
                      {treatment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-8 py-[120px] text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 font-serif text-[32px] font-normal text-blue-dark">
            {t("ctaTitle")}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <CTAButton
              href="/candidature"
              variant="primary"
              icon={<ArrowRightIcon className="h-4 w-4" />}
            >
              {t("ctaApply")}
            </CTAButton>
            <Link
              href="/faq"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-blue transition-colors hover:text-terracotta"
            >
              {t("ctaFaq")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
