import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlobeIcon, MailIcon } from "@/components/marketing/icons";

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="w-full bg-ink py-16 text-sky md:py-24">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="mb-6 font-serif text-2xl font-normal text-white">
            {t("brand")}
          </div>
          <p className="max-w-sm text-sm text-sky-deep/70">
            {t("description")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 md:col-span-7 md:grid-cols-3">
          <div>
            <h5 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-light">
              {t("navigationTitle")}
            </h5>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/#why"
                  className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                >
                  {tNav("programme")}
                </Link>
              </li>
              <li>
                <Link
                  href="/packs"
                  className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                >
                  {tNav("packs")}
                </Link>
              </li>
              <li>
                <Link
                  href="/agenda"
                  className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                >
                  {tNav("agenda")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-light">
              {t("resourcesTitle")}
            </h5>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="#"
                  className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                >
                  {t("contact")}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                >
                  {t("faq")}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                >
                  {t("privacy")}
                </a>
              </li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h5 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-light">
              {t("followTitle")}
            </h5>
            <div className="flex gap-4">
              <a
                href="#"
                aria-label={t("followTitle")}
                className="text-sky-deep/70 transition-colors hover:text-white"
              >
                <GlobeIcon className="h-5 w-5" />
              </a>
              <a
                href="#"
                aria-label={t("contact")}
                className="text-sky-deep/70 transition-colors hover:text-white"
              >
                <MailIcon className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:col-span-12 md:flex-row">
          <p className="text-xs text-sky-deep/50">{t("copyright")}</p>
          <div className="flex gap-6 text-xs text-sky-deep/50">
            <a href="#" className="transition-colors hover:text-white">
              {t("legal")}
            </a>
            <a href="#" className="transition-colors hover:text-white">
              {t("privacyLink")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
