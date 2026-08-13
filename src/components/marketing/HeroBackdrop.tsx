import Image from "next/image";

/**
 * Decorative backdrop for the homepage hero.
 *
 * Ships a lightweight inline-SVG motif by default and swaps to a photograph
 * the moment one is dropped in — without any layout change. The constraints
 * it has to satisfy:
 *
 *  - **Legibility.** The headline is `blue-dark` on a light gradient, so the
 *    backdrop fades to nothing on the text side rather than sitting behind it.
 *  - **RTL.** Anchored to the inline-END edge and masked along the inline
 *    axis, so it mirrors correctly in Arabic. A version pinned to "right"
 *    would sit on top of the Arabic headline.
 *  - **Data cost.** Suppressed entirely below `md`. Users across the six
 *    participating markets are overwhelmingly on metered mobile data, and on
 *    a phone the hero text fills the viewport anyway — the image would be
 *    paid for and never seen.
 *  - **Credibility.** The default motif is abstract on purpose. Stock imagery
 *    of smiling professionals is the visual signature of the programmes this
 *    one has to distinguish itself from.
 */
export interface HeroBackdropProps {
  /**
   * Path under /public, e.g. "/hero-bay.avif". Leave undefined to render the
   * geometric motif.
   *
   * Brief for the photograph: San Francisco or the Bay at blue hour,
   * architecture rather than people, no recognisable Big Tech campus. Export
   * ~1600px wide as AVIF, under 120KB. The treatment below desaturates and
   * tints it into the site palette, so a cool-toned original needs least work.
   */
  imageSrc?: string;
  /** Empty string is correct here: the image is decorative, not informative. */
  imageAlt?: string;
}

export function HeroBackdrop({ imageSrc, imageAlt = "" }: HeroBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-y-0 inset-e-0 hidden w-[58%] md:block",
        // Fades from nothing on the text side to full on the outer edge.
        // `to_right` in LTR, flipped for RTL — Tailwind's rtl: variant reads
        // the dir attribute set on <html>.
        "[mask-image:linear-gradient(to_right,transparent_0%,black_55%)]",
        "rtl:[mask-image:linear-gradient(to_left,transparent_0%,black_55%)]",
      ].join(" ")}
    >
      {imageSrc ? (
        <div className="relative h-full w-full opacity-25">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            // Above the fold, so it must not lazy-load — but it's also only
            // ever served at md+, hence the sizes hint.
            priority
            sizes="(max-width: 768px) 0px, 58vw"
            className="object-cover saturate-[0.35]"
          />
          {/* Pulls whatever the original's colour temperature was into the
              site's blue. Tune with the opacity here rather than editing the
              source file. */}
          <div className="absolute inset-0 bg-blue-dark/25 mix-blend-multiply" />
        </div>
      ) : (
        <GeometricMotif />
      )}
    </div>
  );
}

/**
 * Concentric arcs radiating from the outer corner, over a hairline grid.
 *
 * Reads as both signal propagation and topography — tech and terrain at once
 * — without depicting either literally. Built from the same hairline
 * vocabulary as the rest of the design system, and costs about 2KB inline
 * with no network request at all.
 */
function GeometricMotif() {
  // Arc radii, widening as they travel inward from the corner.
  const radii = [120, 210, 300, 390, 480, 570, 660, 750, 840];

  return (
    <svg
      viewBox="0 0 800 900"
      preserveAspectRatio="xMaxYMid slice"
      className="h-full w-full text-blue"
      fill="none"
    >
      <defs>
        <pattern
          id="svap-hairline-grid"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M40 0H0V40"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.06"
          />
        </pattern>
      </defs>

      <rect width="800" height="900" fill="url(#svap-hairline-grid)" />

      <g stroke="currentColor" strokeWidth="1">
        {radii.map((r, i) => (
          <circle
            key={r}
            cx="800"
            cy="450"
            r={r}
            // Fade the outer rings so the motif dissolves rather than
            // stopping at an edge.
            strokeOpacity={0.16 - i * 0.014}
          />
        ))}
      </g>

      {/* Two accent arcs in terracotta, echoing the CTA colour so the hero
          reads as one composition rather than a background plus a button. */}
      <g stroke="currentColor" className="text-terracotta" strokeWidth="1.5">
        <circle cx="800" cy="450" r="300" strokeOpacity="0.18" />
        <circle cx="800" cy="450" r="570" strokeOpacity="0.1" />
      </g>
    </svg>
  );
}
