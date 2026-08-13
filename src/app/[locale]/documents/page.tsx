import { Suspense } from "react";
import { useTranslations } from "next-intl";
// next-intl's redirect, not next/navigation's — the latter drops the locale
// prefix and would drop an Arabic candidate onto the French tree.
import { redirect } from "@/i18n/navigation";
import { PageHeader } from "@/components/marketing/PageHeader";
import { AccessCodeForm } from "@/components/forms/AccessCodeForm";
import { readSession } from "@/lib/access-code/session";
import { ACCESS_CODE } from "@/lib/constants/program";
import { LockIcon, ShieldIcon, MailIcon } from "@/components/marketing/icons";

/**
 * Phase 2, Étape 0 — the access portal.
 *
 * A candidate arriving with a live session skips the gate entirely: they've
 * already redeemed their code, and asking for it again is exactly the
 * lockout this design exists to avoid.
 */
export default async function DocumentsPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await readSession();
  if (session) redirect({ href: "/documents/informations", locale });

  return <PortalContent />;
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-ink-dim/20 bg-white p-8">
      <div className="mb-4 flex items-center gap-3 text-blue">
        {icon}
        <h3 className="font-serif text-[20px] font-normal">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink-mid">{children}</p>
    </div>
  );
}

function PortalContent() {
  const tCommon = useTranslations("common");
  const t = useTranslations("portal");

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
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Suspense>
              <AccessCodeForm />
            </Suspense>
          </div>

          <div className="space-y-8 lg:col-span-5">
            <InfoCard
              icon={<MailIcon className="h-5 w-5" />}
              title={t("info.codeTitle")}
            >
              {t("info.codeDescription", {
                hours: ACCESS_CODE.sendDelayHours,
                days: ACCESS_CODE.validityDays,
              })}
            </InfoCard>

            <InfoCard
              icon={<ShieldIcon className="h-5 w-5" />}
              title={t("info.securityTitle")}
            >
              {t("info.securityDescription")}
            </InfoCard>

            <InfoCard
              icon={<LockIcon className="h-5 w-5" />}
              title={t("info.fraudTitle")}
            >
              {t("info.fraudDescription")}
            </InfoCard>
          </div>
        </div>
      </section>
    </>
  );
}
