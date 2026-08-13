import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "ar"],
  defaultLocale: "fr",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Locales written right-to-left. Drives the <html dir> attribute, which in
 * turn is what Tailwind's `rtl:` variant and every logical property key off —
 * so this set is the single switch for the entire RTL layout.
 */
const RTL_LOCALES = new Set<string>(["ar"]);

export function getDirection(locale: string): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}
