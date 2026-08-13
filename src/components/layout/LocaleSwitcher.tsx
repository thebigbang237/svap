"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ChevronDownIcon } from "@/components/marketing/icons";

/**
 * Each language is named in its own language — never translated.
 *
 * A French speaker looking for Arabic scans for "العربية", not for "Arabe".
 * Translating these is the classic way to make a language picker useless to
 * exactly the people who need it.
 */
const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  ar: "العربية",
};

/** Delay before a hover-out closes the panel, so crossing the gap between the
 *  button and the list doesn't flicker it shut. */
const HOVER_CLOSE_DELAY_MS = 150;

export interface LocaleSwitcherProps {
  /**
   * `dropdown` for the desktop bar. `inline` renders a flat row instead —
   * used inside the mobile menu, whose animated container is
   * `overflow-hidden` and would clip an absolutely-positioned panel.
   */
  variant?: "dropdown" | "inline";
  className?: string;
}

export function LocaleSwitcher({
  variant = "dropdown",
  className = "",
}: LocaleSwitcherProps) {
  const activeLocale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations("nav");

  const [open, setOpen] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  // Hover-to-open only where hovering is a real thing. On touch devices some
  // browsers synthesise a mouseenter on tap, which would open the panel and
  // let the click immediately toggle it shut again.
  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  // Dismiss on outside click, and on Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    // `pointerdown` rather than `click`: it fires before the link's own
    // navigation, so the panel is already closing as the page changes.
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(
      () => setOpen(false),
      HOVER_CLOSE_DELAY_MS,
    );
  };

  if (variant === "inline") {
    return (
      <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${className}`}>
        {routing.locales.map((locale) => (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            lang={locale}
            aria-current={locale === activeLocale ? "true" : undefined}
            className={
              locale === activeLocale
                ? "text-sm font-semibold text-terracotta"
                : "text-sm text-ink-mid transition-colors hover:text-blue"
            }
          >
            {LOCALE_NAMES[locale]}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={canHover ? () => { cancelClose(); setOpen(true); } : undefined}
      onMouseLeave={canHover ? scheduleClose : undefined}
      // Closes when focus leaves the whole control by keyboard, which
      // `pointerdown` alone wouldn't catch.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        // Translated: the control is announced in the language of the page
        // it sits on. The language *names* stay untranslated; the word
        // "Language" does not.
        aria-label={`${t("language")}: ${LOCALE_NAMES[activeLocale]}`}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-ink-mid transition-colors hover:text-blue"
      >
        {activeLocale.toUpperCase()}
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Bridges the gap between button and panel so a diagonal mouse path
          doesn't cross dead space and trigger the close timer. */}
      <div
        className={`absolute inset-e-0 top-full z-50 pt-3 ${open ? "block" : "hidden"}`}
      >
        <ul className="min-w-40 border border-ink-dim/20 bg-white py-2 shadow-sm">
          {routing.locales.map((locale) => (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                lang={locale}
                onClick={() => setOpen(false)}
                aria-current={locale === activeLocale ? "true" : undefined}
                className={[
                  "block px-4 py-2 text-sm transition-colors",
                  locale === activeLocale
                    ? "font-semibold text-terracotta"
                    : "text-ink-mid hover:bg-sky-mid hover:text-blue",
                ].join(" ")}
              >
                {LOCALE_NAMES[locale]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
