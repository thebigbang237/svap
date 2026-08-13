import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlobeIcon, MailIcon } from "@/components/marketing/icons";

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  const navigation = [
    { href: "/#why", label: tNav("programme") },
    { href: "/admission", label: tNav("admission") },
    { href: "/packs", label: tNav("packs") },
    { href: "/agenda", label: tNav("agenda") },
    { href: "/delegues", label: tNav("delegues") },
  ];

  const resources = [
    { href: "/faq", label: t("faq") },
    { href: "/confiance", label: t("confiance") },
    { href: "/documents", label: t("documents") },
  ];

  // §8 requires the privacy policy to be reachable from every page — the
  // footer is what makes that true site-wide.
  const legal = [
    { href: "/legal/mentions-legales", label: t("legal") },
    { href: "/legal/confidentialite", label: t("privacyLink") },
    { href: "/legal/conditions-generales", label: t("terms") },
    { href: "/legal/remboursement", label: t("refund") },
  ];

  return (
    <footer className="w-full bg-ink py-16 text-sky md:py-24">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="mb-6 font-serif text-2xl font-normal text-white">
            {t("brand")}
          </div>
          <p className="mb-6 max-w-sm text-sm text-sky-deep/70">
            {t("description")}
          </p>
          {/* The anti-fraud line, on every single page of the site. */}
          <p className="max-w-sm border-s-2 border-terracotta ps-4 text-sm font-semibold text-terracotta-light">
            {t("fraudNote")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 md:col-span-7 md:grid-cols-3">
          <div>
            <h5 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-light">
              {t("navigationTitle")}
            </h5>
            <ul className="space-y-2 text-sm">
              {navigation.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-light">
              {t("resourcesTitle")}
            </h5>
            <ul className="space-y-2 text-sm">
              {resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sky-deep/70 transition-colors hover:text-terracotta-light"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h5 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-light">
              {t("followTitle")}
            </h5>
            <div className="flex gap-4">
              <a
                href="https://firstofall.net"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("followTitle")}
                className="text-sky-deep/70 transition-colors hover:text-white"
              >
                <GlobeIcon className="h-5 w-5" />
              </a>
              <a
                href="https://firstofall.net"
                target="_blank"
                rel="noopener noreferrer"
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
          <div className="flex flex-wrap justify-center gap-6 text-xs text-sky-deep/50">
            {legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
