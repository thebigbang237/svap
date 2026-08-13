import type { CSSProperties } from "react";

// Same palette as src/app/globals.css's @theme block, hand-copied since
// email clients can't read our Tailwind CSS variables.
export const colors = {
  sky: "#EAF4FB",
  skyMid: "#D0E8F5",
  blue: "#1A6FA8",
  blueDark: "#0D4F7C",
  terracotta: "#C9713D",
  terracottaLight: "#E0A876",
  ink: "#1A2A3A",
  inkMid: "#3A5068",
  inkDim: "#6A8099",
  white: "#FFFFFF",
};

// Email clients don't reliably load custom web fonts, so headings fall back
// to a web-safe serif (standing in for EB Garamond) and body text to a
// web-safe sans-serif (standing in for Inter).
//
// The Arabic names are appended rather than swapped in: Georgia and Helvetica
// carry no Arabic glyphs, so without a named Arabic family the client picks
// its own fallback and line metrics vary wildly between Outlook, Gmail and
// Apple Mail. Webfonts aren't an option here — these have to be locally
// installed families.
const arabicFallback =
  "'Segoe UI', Tahoma, 'Geeza Pro', 'Arabic Typesetting', sans-serif";
const fontSerif = `Georgia, 'Times New Roman', Times, ${arabicFallback}, serif`;
const fontSans = `Helvetica, Arial, 'Segoe UI', -apple-system, BlinkMacSystemFont, ${arabicFallback}, sans-serif`;

export const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: colors.sky,
    fontFamily: fontSans,
    margin: 0,
    padding: "24px 0",
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "40px",
    backgroundColor: colors.white,
    border: `1px solid ${colors.skyMid}`,
  },
  brand: {
    fontFamily: fontSerif,
    fontSize: "20px",
    color: colors.blue,
    margin: "0 0 32px",
  },
  heading: {
    fontFamily: fontSerif,
    fontSize: "28px",
    fontWeight: 400,
    color: colors.blueDark,
    lineHeight: 1.3,
    margin: "0 0 20px",
  },
  paragraph: {
    fontFamily: fontSans,
    fontSize: "15px",
    lineHeight: 1.6,
    color: colors.ink,
    margin: "0 0 16px",
  },
  quote: {
    fontFamily: fontSans,
    fontSize: "15px",
    lineHeight: 1.6,
    color: colors.ink,
    fontStyle: "italic",
    margin: "0 0 16px",
    paddingLeft: "16px",
    borderLeft: `2px solid ${colors.terracotta}`,
  },
  // Mirror of `quote` for RTL. Logical properties (padding-inline-start,
  // border-inline-start) are still unreliable across email clients, so the
  // physical sides are flipped by hand instead.
  quoteRtl: {
    fontFamily: fontSans,
    fontSize: "15px",
    lineHeight: 1.6,
    color: colors.ink,
    fontStyle: "italic",
    margin: "0 0 16px",
    paddingRight: "16px",
    borderRight: `2px solid ${colors.terracotta}`,
  },
  label: {
    fontFamily: fontSans,
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: colors.inkDim,
    margin: "0 0 4px",
  },
  value: {
    fontFamily: fontSans,
    fontSize: "14px",
    color: colors.ink,
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: colors.terracotta,
    color: colors.white,
    fontFamily: fontSans,
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "14px 28px",
    textDecoration: "none",
    display: "inline-block",
  },
  hr: {
    borderColor: colors.skyMid,
    margin: "32px 0",
  },
  footer: {
    fontFamily: fontSans,
    fontSize: "12px",
    color: colors.inkDim,
    textAlign: "center",
    marginTop: "8px",
  },
};
