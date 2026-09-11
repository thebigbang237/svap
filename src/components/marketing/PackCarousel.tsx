"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "./icons";

/**
 * Horizontal, snap-scrolling rail for the five packs.
 *
 * A grid was the obvious alternative and was rejected: five cards at the
 * homepage's 1280px cap leaves ~230px each once the card's own padding is
 * taken out, which forces the feature lists to wrap into unreadable columns.
 * The /packs page can afford three-up because it has the whole viewport height
 * to stack rows into; the homepage teaser cannot.
 *
 * Scrolling is native — `overflow-x: auto` plus scroll-snap — so touch
 * swiping, trackpad gestures, keyboard arrows and screen-reader navigation all
 * work without a line of JavaScript, and with momentum and rubber-banding no
 * hand-rolled implementation would match.
 *
 * What native scrolling does NOT give you is mouse click-and-drag, which is
 * what most people expect of anything that looks like a carousel. That is the
 * one behaviour added here, and only for `pointerType === "mouse"` so touch
 * keeps its native handling untouched.
 */

/**
 * Pixels of movement before a press becomes a drag.
 *
 * Below this the gesture stays a click, so the "Candidater" button inside a
 * card still works normally; above it the pointer is captured and the
 * subsequent click is swallowed, so releasing over a card after dragging does
 * not navigate away from the page.
 */
const DRAG_THRESHOLD = 4;

export function PackCarousel({ children }: { children: React.ReactNode }) {
  const t = useTranslations("packs.carousel");
  const trackRef = useRef<HTMLDivElement>(null);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [dragging, setDragging] = useState(false);

  const drag = useRef<{
    startX: number;
    startScroll: number;
    moved: number;
    captured: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  /**
   * Which way is "forward" depends on writing direction.
   *
   * Per CSSOM, `scrollLeft` in an RTL container runs from 0 at the right edge
   * into negative numbers going left, so a positive `left` delta moves toward
   * the *start* in Arabic and toward the *end* in French. Reading the computed
   * direction and flipping the sign keeps "next" meaning next in both, rather
   * than silently reversing the controls for Arabic readers.
   */
  const isRtl = () =>
    trackRef.current
      ? getComputedStyle(trackRef.current).direction === "rtl"
      : false;

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;

    // Normalised so the same arithmetic works in both directions: distance
    // travelled from the start, as a positive number.
    const travelled = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;

    // A pixel of slack — fractional scroll positions from zooming or high-DPI
    // rounding would otherwise leave a button permanently enabled.
    setAtStart(travelled <= 1);
    setAtEnd(travelled >= max - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    syncEdges();
    el.addEventListener("scroll", syncEdges, { passive: true });

    // The rail's own width decides how far a page-step moves, so a resize (or
    // an orientation change) has to re-evaluate both edges.
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges]);

  const step = (forward: boolean) => {
    const el = trackRef.current;
    if (!el) return;

    // One card plus its gap, derived from the first child rather than a
    // hard-coded figure — the card width is a responsive class, and a constant
    // here would drift out of step with it at the next breakpoint change.
    const card = el.firstElementChild as HTMLElement | null;
    const distance = card ? card.offsetWidth + 32 : el.clientWidth;

    const sign = (forward ? 1 : -1) * (isRtl() ? -1 : 1);
    el.scrollBy({ left: distance * sign, behavior: "smooth" });
  };

  // -------------------------------------------------------------------------
  // Mouse drag
  // -------------------------------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    // Touch and pen scroll natively and far better than this could.
    if (e.pointerType !== "mouse") return;
    // Only the primary button; a right-click must not start a drag.
    if (e.button !== 0) return;

    const el = trackRef.current;
    if (!el) return;

    suppressClick.current = false;
    drag.current = {
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: 0,
      captured: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = trackRef.current;
    const d = drag.current;
    if (!el || !d) return;

    const dx = e.clientX - d.startX;
    d.moved = Math.max(d.moved, Math.abs(dx));

    // Capture is taken lazily, only once this is unambiguously a drag.
    // Capturing on pointerdown would retarget the click away from whatever the
    // user pressed, breaking the card's own links for ordinary clicks.
    if (!d.captured && d.moved > DRAG_THRESHOLD) {
      d.captured = true;
      setDragging(true);
      el.setPointerCapture(e.pointerId);
    }

    if (!d.captured) return;

    // Assigning scrollLeft directly rather than scrollBy: this tracks the
    // pointer 1:1, and works unchanged in RTL because both the starting value
    // and the target use whatever coordinate system the browser reports.
    el.scrollLeft = d.startScroll - dx;
  };

  const endDrag = (e: React.PointerEvent) => {
    const el = trackRef.current;
    const d = drag.current;
    drag.current = null;
    if (!el || !d) return;

    if (d.captured) {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      setDragging(false);
      // Releasing over a card would otherwise fire a click and navigate to
      // that pack's application form at the end of every drag.
      suppressClick.current = true;
    }
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // Links and images inside the cards would otherwise start a native
        // HTML5 drag, which cancels the pointer stream mid-gesture.
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          // Snap points fight a 1:1 drag — the browser keeps yanking the
          // scroll offset back to the nearest card mid-gesture. Suspended
          // while dragging and restored on release, which lands the rail on a
          // clean snap point anyway.
          scrollSnapType: dragging ? "none" : undefined,
        }}
        // `scroll-ps-8` matches the section's horizontal padding so a snapped
        // card lines up with the heading above it instead of sitting flush to
        // the viewport edge.
        className={[
          "-mx-8 flex snap-x snap-mandatory gap-8 overflow-x-auto scroll-ps-8 px-8 pb-4",
          // `scrollbar-none` alone only emits `scrollbar-width`, which Safari and
          // pre-121 Chromium ignore — a large share of this audience. The webkit
          // rule stays alongside it.
          "scrollbar-none [&::-webkit-scrollbar]:hidden",
          dragging ? "cursor-grabbing select-none" : "cursor-grab",
        ].join(" ")}
      >
        {children}
      </div>

      {/* Shown at every breakpoint.
          These were desktop-only, which left the rail with no visible
          affordance at all on small screens: the scrollbar is hidden, and a
          desktop browser at a narrow width has neither touch nor — before the
          drag handling above — any way to move it. The arrows are the thing
          that says "there is more to the right". */}
      <div className="mt-8 flex justify-end gap-3 sm:mt-10">
        <RailButton
          label={t("previous")}
          disabled={atStart}
          onClick={() => step(false)}
          rotate="rotate-90 rtl:-rotate-90"
        />
        <RailButton
          label={t("next")}
          disabled={atEnd}
          onClick={() => step(true)}
          rotate="-rotate-90 rtl:rotate-90"
        />
      </div>
    </div>
  );
}

function RailButton({
  label,
  disabled,
  onClick,
  rotate,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  rotate: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center border border-ink-dim/30 text-blue transition-colors hover:border-blue hover:bg-sky disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-ink-dim/30 disabled:hover:bg-transparent"
    >
      {/* One chevron asset, rotated — the icon set has no left/right pair, and
          rotating avoids shipping two more near-identical paths. The `rtl:`
          variant flips it back: Tailwind does not mirror transforms, so
          without it "previous" would point right for Arabic readers. */}
      <ChevronDownIcon className={`h-5 w-5 ${rotate}`} />
    </button>
  );
}
