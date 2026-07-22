import { EB_Garamond, Inter } from "next/font/google";

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
