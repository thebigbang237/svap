"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const activeLocale = useLocale();
  const pathname = usePathname();

  return (
    <div
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] ${className}`}
    >
      {routing.locales.map((locale, i) => (
        <span key={locale} className="flex items-center">
          {i > 0 && <span className="mx-1 text-ink-dim/40">/</span>}
          <Link
            href={pathname}
            locale={locale}
            className={
              locale === activeLocale
                ? "text-terracotta"
                : "text-ink-dim transition-colors hover:text-blue"
            }
          >
            {locale.toUpperCase()}
          </Link>
        </span>
      ))}
    </div>
  );
}
