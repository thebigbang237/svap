import {
  EB_Garamond,
  Inter,
  Noto_Kufi_Arabic,
  IBM_Plex_Sans_Arabic,
} from "next/font/google";

// EB Garamond has no 300 weight on Google Fonts (400/500/600/700/800 only),
// and italic is available at every weight we load, not a restricted subset.
export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
});

// Arabic pairing. Neither EB Garamond nor Inter carries Arabic glyphs, so
// without these the Arabic locale falls back to whatever the OS supplies —
// which varies enough between platforms to break the layout, not just the
// typography.
//
// Noto Kufi Arabic stands in for EB Garamond on headings: it's the closest
// Arabic equivalent to a display serif, with the same high-contrast,
// editorial feel. IBM Plex Sans Arabic pairs with Inter for body text —
// both are neo-grotesques on the same skeleton, so weights match visually.
//
// Neither has an italic (Arabic typography has no italic tradition); the
// `.font-serif italic` used on the admission page's pull-quote will simply
// render upright in Arabic, which is correct.
export const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-kufi-arabic",
});

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-ibm-plex-sans-arabic",
});
