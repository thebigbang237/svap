import { useTranslations } from "next-intl";
import { CTAButton } from "./CTAButton";
import { Ltr } from "@/components/layout/Ltr";
import { CheckIcon, CrossIcon } from "./icons";

export interface PackFeature {
  text: string;
  /** Set false for a feature explicitly NOT included (e.g. "Logement non
   * inclus") — renders with a cross instead of a check. Defaults to true. */
  included?: boolean;
}

export interface PackCardProps {
  name: string;
  badgeLabel: string;
  placesCount: number | string;
  /** Large value in the pricing block (e.g. "Bourse Complète", "$330"). */
  costLabel: string;
  /** Small caption under costLabel (e.g. "Pris en charge à 100%"). In
   * "compact" size only costLabel is shown, styled as a short caption. */
  costValue: string;
  /** Plain strings are treated as included; pass a PackFeature to mark an
   * item as explicitly excluded. */
  features: (string | PackFeature)[];
  /** Required in effect for size="full" (the CTA always renders there).
   * Optional only because a "compact" + "default" card (e.g. the homepage
   * teaser's non-featured pack) has no CTA at all. */
  ctaLabel?: string;
  /** Small caption above the CTA button in "full" size (e.g. "Frais de
   * candidature : $50", "Réservation garantie"). Omit when a pack has
   * nothing to note there — the line simply won't render. Not shown in
   * "compact" size. */
  applicationFee?: string;
  variant?: "default" | "featured";
  size?: "compact" | "full";
  href?: string;
  className?: string;
}

export function PackCard({
  name,
  badgeLabel,
  placesCount,
  costLabel,
  costValue,
  features,
  ctaLabel,
  applicationFee,
  variant = "default",
  size = "full",
  href,
  className = "",
}: PackCardProps) {
  const t = useTranslations("packs");
  const featured = variant === "featured";

  const normalizedFeatures = features.map((f) =>
    typeof f === "string" ? { text: f, included: true } : { included: true, ...f },
  );

  const surfaceClasses = featured
    ? "bg-blue-dark text-white border border-terracotta"
    : "bg-white text-ink border border-ink-dim/20 hover:border-blue transition-colors";

  const accentText = featured ? "text-terracotta-light" : "text-blue";
  const mutedText = featured ? "text-white/70" : "text-ink-dim";
  const bodyText = featured ? "text-white/90" : "text-ink";

  if (size === "compact") {
    return (
      <div
        className={[
          "relative flex flex-col p-10",
          surfaceClasses,
          className,
        ].join(" ")}
      >
        {featured && (
          <div className="absolute -top-4 inset-e-8 bg-terracotta px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
            {t("mostPopular")}
          </div>
        )}
        <h3 className="font-serif text-2xl font-normal mb-2">{name}</h3>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] mb-8 ${accentText}`}>
          {costLabel}
        </p>
        <ul className={`space-y-4 ${featured ? "mb-12" : ""} ${bodyText}`}>
          {normalizedFeatures.slice(0, 3).map((feature) => (
            <li
              key={feature.text}
              className={`flex items-start gap-3 ${feature.included ? "" : "opacity-40"}`}
            >
              {feature.included ? (
                <CheckIcon className={`mt-1 h-4 w-4 shrink-0 ${accentText}`} />
              ) : (
                <CrossIcon className={`mt-1 h-4 w-4 shrink-0 ${mutedText}`} />
              )}
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>
        {featured && ctaLabel && (
          <CTAButton href={href} variant="primary" className="mt-auto w-full">
            {ctaLabel}
          </CTAButton>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        "relative flex h-full flex-col p-8",
        surfaceClasses,
        featured ? "lg:-translate-y-4" : "",
        className,
      ].join(" ")}
    >
      {featured && (
        // `left-1/2` is correct here and must NOT become `inset-s-1/2`:
        // Tailwind doesn't mirror transforms, so pairing a logical inset with
        // `-translate-x-1/2` would push the badge off-centre in RTL. Physical
        // left + physical translate stays centred in both directions.
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-terracotta px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
          {t("mostPopular")}
        </div>
      )}

      <div className="mb-6">
        <span
          className={[
            "mb-4 inline-block px-3 py-1 text-[10px] font-semibold uppercase",
            featured ? "bg-terracotta text-white" : "bg-sky-mid text-blue",
          ].join(" ")}
        >
          {badgeLabel}
        </span>
        <div className="flex items-baseline gap-2">
          <Ltr className={`font-serif text-[40px] sm:text-[56px] font-normal leading-none ${accentText}`}>
            {placesCount}
          </Ltr>
          <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${mutedText}`}>
            {t("places")}
          </span>
        </div>
      </div>

      <h3 className="font-serif text-[28px] sm:text-[32px] leading-[1.3] font-normal mb-2">
        {name}
      </h3>

      <div
        className={[
          "mb-8 border-y py-4",
          featured ? "border-white/10" : "border-ink-dim/20",
        ].join(" ")}
      >
        <div className={`font-serif text-2xl font-normal ${accentText}`}>
          {costLabel}
        </div>
        <div className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${mutedText}`}>
          {costValue}
        </div>
      </div>

      <ul className={`mb-auto space-y-4 text-sm ${bodyText}`}>
        {normalizedFeatures.map((feature) => (
          <li
            key={feature.text}
            className={`flex items-start gap-3 ${feature.included ? "" : "opacity-40"}`}
          >
            {feature.included ? (
              <CheckIcon className={`mt-1 h-4 w-4 shrink-0 ${accentText}`} />
            ) : (
              <CrossIcon className={`mt-1 h-4 w-4 shrink-0 ${mutedText}`} />
            )}
            <span>{feature.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        {applicationFee && (
          <div
            className={`mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] ${mutedText}`}
          >
            {applicationFee}
          </div>
        )}
        <CTAButton href={href} variant="primary" className="w-full">
          {ctaLabel}
        </CTAButton>
      </div>
    </div>
  );
}
