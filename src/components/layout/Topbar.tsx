"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { CTAButton } from "@/components/marketing/CTAButton";
import { MenuIcon, CrossIcon } from "@/components/marketing/icons";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function Topbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/#why", label: t("programme"), active: pathname === "/" },
    { href: "/admission", label: t("admission"), active: pathname === "/admission" },
    { href: "/packs", label: t("packs"), active: pathname === "/packs" },
    { href: "/agenda", label: t("agenda"), active: pathname === "/agenda" },
  ];

  // Lock background scroll and allow Escape to dismiss while the mobile
  // menu is open.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      {/* z-50, so the toolbar itself always stays crisp above the backdrop
          below — nothing here dims when the mobile menu is open. */}
      <header className="fixed top-0 z-50 w-full border-b border-ink-dim/10 bg-sky backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-4">
          <Link href="/" className="font-serif text-2xl font-normal text-blue">
            {t("brand")}
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={`text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:text-terracotta ${
                  link.active
                    ? "border-b border-terracotta text-terracotta"
                    : "text-ink-mid"
                }`}
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
            className="text-blue lg:hidden"
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

        {/* Dropdown panel — same z-50 layer as the header, so it sits above
            the backdrop too. Animated via grid-template-rows so it can
            smoothly collapse to/from its natural height without measuring
            it in JS. */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out lg:hidden ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <nav className="overflow-hidden">
            <div className="flex flex-col gap-6 border-t border-ink-dim/10 bg-sky px-8 py-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={link.active ? "page" : undefined}
                  className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                    link.active ? "text-terracotta" : "text-ink-mid"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <LocaleSwitcher />
              <CTAButton href="/candidature" variant="primary" className="w-full">
                {t("cta")}
              </CTAButton>
            </div>
          </nav>
        </div>
      </header>

      {/* Full-screen dark overlay, one layer below the header (z-40 < z-50)
          so the toolbar never dims — only the page content underneath does.
          Click anywhere on it to dismiss. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-ink/60 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
    </>
  );
}
