export interface SectionEyebrowProps {
  label: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionEyebrow({
  label,
  align = "left",
  className = "",
}: SectionEyebrowProps) {
  return (
    <div
      className={[
        "flex items-center gap-4",
        align === "center" ? "justify-center" : "",
        className,
      ].join(" ")}
    >
      <div className="h-px w-6 shrink-0 bg-terracotta" />
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
        {label}
      </span>
      {align === "center" && (
        <div className="h-px w-6 shrink-0 bg-terracotta" />
      )}
    </div>
  );
}
