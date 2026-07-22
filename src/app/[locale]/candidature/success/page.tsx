import { useTranslations } from "next-intl";
import { CTAButton } from "@/components/marketing/CTAButton";
import { CheckIcon } from "@/components/marketing/icons";

export default function CandidatureSuccessPage() {
  const t = useTranslations("candidature.success");

  return (
    <section className="flex flex-1 items-center justify-center px-8 py-[120px] text-center">
      <div className="mx-auto max-w-xl">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center border border-terracotta">
          <CheckIcon className="h-8 w-8 text-terracotta" />
        </div>
        <h1 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark mb-8">
          {t("title")}
        </h1>
        <p className="mb-12 text-ink-mid">{t("description")}</p>
        <CTAButton href="/" variant="primary">
          {t("ctaLabel")}
        </CTAButton>
      </div>
    </section>
  );
}
