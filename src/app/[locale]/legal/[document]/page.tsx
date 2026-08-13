import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Legal pages.
 *
 * These four documents are legally binding, and the parts that carry legal
 * effect — jurisdiction, liability, cancellation terms, the DPO's identity
 * and contact — are NOT invented here. Each page renders the factual content
 * the specification actually establishes (company details, fee amounts, the
 * refund matrix, the data-protection measures the system genuinely
 * implements) and marks explicitly where a lawyer's text is required.
 *
 * A generated privacy policy on a site collecting passport scans and criminal
 * records from six jurisdictions would be worse than an obviously incomplete
 * one: it would look finished.
 */

const DOCUMENTS = [
  "mentions-legales",
  "confidentialite",
  "conditions-generales",
  "remboursement",
] as const;

type LegalDocument = (typeof DOCUMENTS)[number];

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    DOCUMENTS.map((document) => ({ locale, document })),
  );
}

interface Section {
  title: string;
  body?: string;
  items?: string[];
  /** Marks a block that still needs counsel's wording before launch. */
  pending?: boolean;
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; document: string }>;
}) {
  const { document } = await params;

  if (!(DOCUMENTS as readonly string[]).includes(document)) notFound();

  const tCommon = await getTranslations("common");
  const t = await getTranslations(`legal.${document as LegalDocument}`);
  const tLegal = await getTranslations("legal");

  const sections = t.raw("sections") as Section[];

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("title")}
        eyebrow={tLegal("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      />

      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-3xl">
          <p className="mb-12 text-xs uppercase tracking-[0.2em] text-ink-dim">
            {tLegal("lastUpdated")}
          </p>

          <div className="space-y-12">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="mb-4 font-serif text-[24px] font-normal text-blue-dark">
                  {section.title}
                </h2>

                {section.body && (
                  <p className="leading-relaxed text-ink-mid">{section.body}</p>
                )}

                {section.items && (
                  <ul className="mt-4 space-y-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span aria-hidden="true" className="mt-1 text-terracotta">
                          &bull;
                        </span>
                        <span className="text-ink-mid">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.pending && (
                  <p className="mt-4 border-s-2 border-terracotta bg-sky-mid/60 p-4 text-sm text-ink">
                    {tLegal("pendingCounsel")}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 border-t border-ink-dim/20 pt-8">
            <p className="mb-4 text-sm text-ink-mid">{tLegal("seeAlso")}</p>
            <div className="flex flex-wrap gap-6 text-xs font-semibold uppercase tracking-[0.2em]">
              {DOCUMENTS.filter((d) => d !== document).map((d) => (
                <Link
                  key={d}
                  href={`/legal/${d}`}
                  className="text-blue transition-colors hover:text-terracotta"
                >
                  {tLegal(`titles.${d}`)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
