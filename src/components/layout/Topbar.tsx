"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CTAButton } from "@/components/marketing/CTAButton";
import { MenuIcon, CrossIcon } from "@/components/marketing/icons";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function Topbar() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/#why", label: t("programme") },
    { href: "/admission", label: t("admission") },
    { href: "/packs", label: t("packs") },
    { href: "/agenda", label: t("agenda") },
  ];

  return (
    <header className="fixed top-0 z-50 w-full border-b border-ink-dim/10 bg-sky/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-4">
        <Link href="/" className="font-serif text-2xl font-normal text-blue">
          {t("brand")}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-mid transition-colors hover:text-terracotta"
            >
              {link.label}
            </Link>
          ))}
          <LocaleSwitcher />
          <CTAButton href="/candidature" variant="primary">
            {t("cta")}
          </CTAButton>
        </nav>

        <button
          type="button"
          className="text-blue md:hidden"
          aria-label={t("menuLabel")}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <CrossIcon className="h-6 w-6" />
          ) : (
            <MenuIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-6 border-t border-ink-dim/10 bg-sky px-8 py-8 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-mid"
            >
              {link.label}
            </Link>
          ))}
          <LocaleSwitcher />
          <CTAButton href="/candidature" variant="primary" className="w-full">
            {t("cta")}
          </CTAButton>
        </nav>
      )}
    </header>
  );
}
