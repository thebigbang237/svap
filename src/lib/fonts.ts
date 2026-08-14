/**
 * Self-hosted webfonts.
 *
 * These were previously loaded through `next/font/google`, which downloads the
 * font files from fonts.gstatic.com **at build time**. That made every
 * deployment depend on Google's CDN being healthy, and it broke: Google
 * rotated the EB Garamond files while Next still held the old hashed URLs,
 * so the build failed with a wall of `Module not found` on woff2 assets that
 * had 404'd. It failed intermittently locally for the same reason.
 *
 * Shipping the fonts as npm packages removes the network from the build
 * entirely — deterministic builds, no upstream to be down.
 *
 * Two further benefits that matter for this project specifically:
 *
 *  - **Speed.** No extra DNS lookup, TLS handshake and round trip to a
 *    third-party origin. Every participating market is majority mobile, often
 *    on 3G, where that handshake is a real fraction of first paint.
 *  - **Privacy.** Requests to Google's font CDN expose each visitor's IP to a
 *    third party. On a site that publishes a privacy policy, names a DPO and
 *    commits to processing data solely to assess an application, quietly
 *    shipping visitor IPs to Google is a contradiction — and one that has been
 *    litigated in Europe.
 *
 * Only the weights actually used are imported. Each fontsource stylesheet
 * carries `unicode-range` per subset, so a browser rendering French never
 * downloads the Arabic files and vice versa — the same saving the old
 * per-locale loading achieved, now handled by the browser.
 */

// EB Garamond — display serif. 400/600/700 plus italic for pull-quotes.
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/600.css";
import "@fontsource/eb-garamond/700.css";

// Inter — body sans.
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";

// Arabic pair. Neither Latin face carries Arabic glyphs, so without these the
// `ar` locale falls back to whatever the OS supplies — which varies enough
// between platforms to break the layout, not just the typography.
//
// Noto Kufi Arabic stands in for EB Garamond on headings: the closest Arabic
// equivalent to a display serif. IBM Plex Sans Arabic pairs with Inter for
// body text — both neo-grotesques on the same skeleton, so weights match.
// Neither has an italic; Arabic typography has no italic tradition, so the
// `font-serif italic` pull-quote simply renders upright, which is correct.
import "@fontsource/noto-kufi-arabic/400.css";
import "@fontsource/noto-kufi-arabic/600.css";
import "@fontsource/noto-kufi-arabic/700.css";

import "@fontsource/ibm-plex-sans-arabic/300.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
