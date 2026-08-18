"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  APPLICATION_DEADLINE,
  EVENT_START,
  EVENT_END,
} from "@/lib/constants/program";
import { CrossIcon } from "./icons";
import { Ltr } from "@/components/layout/Ltr";

/**
 * Floating deadline and countdown.
 *
 * Opens by itself on the first page of a visit, collapses to a pill a few
 * seconds later, and reopens on click — the live-chat pattern, used here for
 * the one piece of information the whole funnel is paced by.
 *
 * Two deliberate restraints:
 *
 *  - It is NOT a modal. No focus trap, no backdrop, no scroll lock. It is an
 *    announcement, and taking the keyboard hostage over a date would be
 *    hostile — particularly on the pages where someone is trying to read the
 *    eligibility criteria.
 *  - It never appears on the application or Phase-2 pages. Someone filling in
 *    a form has already acted on the deadline; hurrying them through a
 *    passport number is the opposite of useful, and on a payment step it would
 *    read as pressure.
 */

/** How long the panel stays open before folding away on a first visit. */
const AUTO_COLLAPSE_MS = 5000;

/** Set once per tab, so the panel auto-opens on arrival and not on every click. */
const SESSION_KEY = "svap-deadline-seen";

/**
 * Route prefixes where the widget stays hidden. Matched against the
 * locale-stripped pathname that next-intl's `usePathname` returns.
 */
const HIDDEN_ON = ["/candidature", "/documents"];

/**
 * A one-second clock, as an external store.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, for the reason it
 * exists: the current time is external state, its server snapshot is
 * deliberately `null` so nothing renders during SSR *or* hydration, and React
 * swaps in the real value straight afterwards — no mismatch, and no
 * setState-in-an-effect to schedule an extra render pass.
 *
 * The snapshot is cached rather than recomputed per call. Returning a fresh
 * `Date.now()` from `getSnapshot` would differ on every read and spin React
 * into an infinite re-render.
 */
const clock = (() => {
  let value = Date.now();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      if (listeners.size === 1) {
        timer = setInterval(() => {
          value = Date.now();
          for (const listener of listeners) listener();
        }, 1000);
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && timer) clearInterval(timer);
      };
    },
    getSnapshot: () => value,
    getServerSnapshot: (): number | null => null,
  };
})();

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remainingUntil(target: Date, from: number): Remaining | null {
  const ms = target.getTime() - from;
  if (ms <= 0) return null;

  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

export function DeadlineWidget() {
  const t = useTranslations("countdown");
  const locale = useLocale();
  const pathname = usePathname();

  // Read once, at mount: open on a first visit, collapsed on every navigation
  // afterwards. Reading storage in the initialiser rather than in an effect
  // keeps this to a single render — and it cannot desync, because nothing is
  // rendered at all until the clock's client snapshot arrives.
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      // Private mode, or storage blocked. Stay collapsed rather than
      // reopening on every single navigation.
      return false;
    }
  });

  const now = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );

  const autoCollapse = useRef<number | undefined>(undefined);

  const hidden = HIDDEN_ON.some((prefix) => pathname.startsWith(prefix));

  // Mark the visit as seen and start the fold-away timer. Writing to storage
  // is an external-system update, and the collapse happens in the timer's
  // callback — neither is a synchronous setState in an effect body.
  useEffect(() => {
    if (hidden || !expanded) return;

    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* nothing to do — worst case it opens again next navigation */
    }

    autoCollapse.current = window.setTimeout(
      () => setExpanded(false),
      AUTO_COLLAPSE_MS,
    );

    return () => window.clearTimeout(autoCollapse.current);
    // Deliberately mount-only: re-running on every `expanded` change would
    // re-arm the fold-away each time the visitor reopens the panel by hand,
    // which is precisely when they want it to stay put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  /** Cancels the auto-collapse the moment the panel is actually being read. */
  const holdOpen = useCallback(() => {
    window.clearTimeout(autoCollapse.current);
  }, []);

  if (hidden || now === null) return null;

  // The edition is over. Nothing here is true any more, so it goes away
  // rather than counting up from a date nobody cares about.
  if (now > EVENT_END.getTime()) return null;

  const remaining = remainingUntil(APPLICATION_DEADLINE, now);
  const closed = remaining === null;

  const dateFormat: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  };

  const deadlineText = APPLICATION_DEADLINE.toLocaleDateString(locale, dateFormat);
  // formatRange collapses "18 March 2027 – 23 March 2027" to "18–23 March 2027"
  // in every locale, including Arabic, without any string surgery here.
  const eventText = new Intl.DateTimeFormat(locale, dateFormat).formatRange(
    EVENT_START,
    EVENT_END,
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        className="fixed bottom-6 inset-e-6 z-40 flex items-center gap-3 bg-blue-dark px-5 py-3 text-white shadow-lg transition-colors hover:bg-blue"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 animate-pulse bg-terracotta-light"
        />
        <span className="text-xs font-semibold uppercase tracking-[0.15em]">
          {closed
            ? t("collapsedClosed")
            : t("collapsed", { days: remaining.days })}
        </span>
      </button>
    );
  }

  return (
    <section
      // A region, not a dialog: it doesn't trap focus and the page behind it
      // stays fully usable, so announcing it as a dialog would be a lie to a
      // screen reader.
      aria-label={t("title")}
      onMouseEnter={holdOpen}
      onFocusCapture={holdOpen}
      className="fixed bottom-6 inset-e-6 z-40 w-[calc(100vw-3rem)] max-w-sm border border-terracotta bg-blue-dark text-white shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-terracotta-light">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 font-serif text-xl font-normal">
            {closed ? t("closedTitle") : t("title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label={t("close")}
          className="-me-2 -mt-1 p-2 text-white/60 transition-colors hover:text-white"
        >
          <CrossIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 px-6 py-5">
        {closed ? (
          <p className="text-sm leading-relaxed text-white/80">
            {t("closedBody")}
          </p>
        ) : (
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-white/60">
              {t("remainingLabel")}
            </p>
            {/* Always left-to-right: a countdown read right-to-left in Arabic
                would put the seconds where the days belong. */}
            <Ltr className="grid grid-cols-4 gap-2">
              {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
                <div key={unit} className="bg-white/10 px-1 py-2 text-center">
                  <div className="font-serif text-2xl leading-none tabular-nums">
                    {String(remaining[unit]).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-wider text-white/60">
                    {t(`units.${unit}`)}
                  </div>
                </div>
              ))}
            </Ltr>
          </div>
        )}

        <dl className="space-y-3 border-t border-white/10 pt-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-white/60">{t("deadlineLabel")}</dt>
            <dd className="font-semibold">{deadlineText}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-white/60">{t("eventLabel")}</dt>
            <dd className="font-semibold text-terracotta-light">{eventText}</dd>
          </div>
        </dl>

        {!closed && (
          <Link
            href="/candidature"
            onClick={() => setExpanded(false)}
            className="block bg-terracotta px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-90"
          >
            {t("cta")}
          </Link>
        )}
      </div>
    </section>
  );
}
