export interface StatBlockProps {
  value: string;
  label: string;
  variant: "light" | "dark";
  className?: string;
}

export function StatBlock({
  value,
  label,
  variant,
  className = "",
}: StatBlockProps) {
  const dark = variant === "dark";

  return (
    <div className={className}>
      <p
        className={[
          "font-serif font-normal leading-none",
          "text-[40px] sm:text-[56px]",
          dark ? "text-terracotta-light" : "text-blue",
        ].join(" ")}
      >
        {value}
      </p>
      <p
        className={[
          "mt-2 text-xs font-semibold uppercase tracking-[0.2em]",
          dark ? "text-white/60" : "text-ink-dim",
        ].join(" ")}
      >
        {label}
      </p>
    </div>
  );
}
