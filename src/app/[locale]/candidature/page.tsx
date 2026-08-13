import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CandidatureForm } from "@/components/forms/CandidatureForm";
import { CheckIcon, ShieldIcon, CertificateIcon } from "@/components/marketing/icons";

export default function CandidaturePage() {
  const tCommon = useTranslations("common");
  const tCandidature = useTranslations("candidature");

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={tCandidature("page.breadcrumbCurrent")}
        title={tCandidature("page.title")}
        lead={tCandidature("page.lead")}
      />

      <section className="px-8 py-[120px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sidebar */}
          <div className="mb-12 space-y-8 lg:col-span-4 lg:mb-0">
            <div className="border border-ink-dim/20 bg-white p-8">
              <h3 className="font-serif text-[24px] font-normal text-blue mb-4">
                {tCandidature("sidebar.eligibilityTitle")}
              </h3>
              <p className="mb-6 text-ink-mid">
                {tCandidature("sidebar.eligibilityDescription")}
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-terracotta" />
                  <span className="text-sm font-medium text-ink">
                    {tCandidature("sidebar.eligibilityItem1")}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-terracotta" />
                  <span className="text-sm font-medium text-ink">
                    {tCandidature("sidebar.eligibilityItem2")}
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-4 border-s-2 border-terracotta bg-sky-mid p-6">
              <ShieldIcon className="h-8 w-8 shrink-0 text-terracotta" />
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
                  {tCandidature("sidebar.securityTitle")}
                </p>
                <p className="text-xs leading-tight text-ink-dim">
                  {tCandidature("sidebar.securityDescription")}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-8">
            <Suspense fallback={null}>
              <CandidatureForm />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Trust / RGPD note */}
      <section className="border-y border-ink-dim/10 bg-white px-8 py-16 text-center">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-6 flex justify-center">
            <CertificateIcon className="h-10 w-10 text-blue/30" />
          </div>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink-mid">
            {tCandidature("trust.title")}
          </h4>
          <p className="mx-auto max-w-2xl italic text-ink-dim">
            &ldquo;{tCandidature("trust.quote")}&rdquo;
          </p>
        </div>
      </section>
    </>
  );
}
