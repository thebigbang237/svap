/**
 * Meta Pixel, adapted from the base code Meta provides for this site.
 *
 * Three deliberate departures from pasting that snippet into <head>:
 *
 *  - PageViews are fired by the app, not by the pixel. The pixel otherwise
 *    listens to `history.pushState` and fires a PageView on every client-side
 *    navigation — including into routes that must never be reported (below).
 *    `disablePushState` turns that off; the MetaPixel component fires them
 *    instead, only on routes that are safe to report.
 *
 *  - Automatic events are off (`autoConfig: false`). By default the pixel
 *    records every button click with its text, plus page metadata, on any page
 *    it is loaded in. In an app where a visitor can navigate from the home page
 *    into the passport form without a page reload, the script stays resident
 *    there, and clicks on that form are not something to hand to an ad network.
 *
 *  - The pixel ID comes from the environment, so local development and preview
 *    deployments don't feed test traffic into the client's ad optimisation.
 */

interface Fbq {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

export const META_PIXEL_SCRIPT = "https://connect.facebook.net/en_US/fbevents.js";

/**
 * Routes where the pixel never fires, matched against the locale-stripped
 * pathname.
 *
 *  - `/documents` — Phase 2: passport, criminal record, payment.
 *  - `/candidature/non-eligible` — its URL carries the ineligibility reason
 *    (`?reason=casier_judiciaire`, for instance). A PageView sends the full
 *    URL to Meta, which would tie a Facebook profile to a declared criminal
 *    record.
 *
 * `/admin` needs no entry: it has its own root layout and never mounts the
 * pixel at all.
 */
const UNTRACKED_PREFIXES = ["/documents", "/candidature/non-eligible"];

export function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Meta's queueing stub from the base code, so calls made before fbevents.js arrives are replayed once it does. */
function installStub(): Fbq {
  const stub = function () {
    // `arguments`, not rest params: fbevents.js replays the queue, and this is
    // exactly the shape Meta's own base code queues.
    // eslint-disable-next-line prefer-rest-params
    const call = arguments;
    if (stub.callMethod) stub.callMethod(...Array.from(call));
    else stub.queue.push(call);
  } as Fbq;

  window.fbq = stub;
  if (!window._fbq) window._fbq = stub;
  stub.push = stub;
  stub.loaded = true;
  stub.version = "2.0";
  stub.queue = [];
  return stub;
}

let initialised = false;

function pixel(): Fbq | null {
  if (!META_PIXEL_ID || typeof window === "undefined") return null;

  const fbq = window.fbq ?? installStub();
  if (!initialised) {
    // Both must be set before `init` to take effect.
    fbq.disablePushState = true;
    fbq("set", "autoConfig", false, META_PIXEL_ID);
    fbq("init", META_PIXEL_ID);
    initialised = true;
  }
  return fbq;
}

let lastPageView: string | null = null;

/**
 * `page` is only a dedupe key: React's dev-mode double effects, and re-renders,
 * would otherwise report one visit twice. The pixel reads the URL itself.
 */
export function trackPageView(page: string) {
  if (page === lastPageView) return;
  lastPageView = page;
  pixel()?.("track", "PageView");
}

/**
 * A completed Phase-1 application.
 *
 * Fired identically whatever the outcome, with no parameters. A separate event
 * for pre-selected versus ineligible candidates would tell Meta which of its
 * users failed eligibility — and a criminal record is one of the reasons.
 */
export function trackLead() {
  pixel()?.("track", "Lead");
}
