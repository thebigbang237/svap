export interface AgendaDayItem {
  time: string;
  description: string;
}

export interface AgendaDayCardProps {
  day: number | string;
  locationLabel: string;
  title: string;
  items: AgendaDayItem[];
  size?: "compact" | "full";
  className?: string;
}

export function AgendaDayCard({
  day,
  locationLabel,
  title,
  items,
  size = "full",
  className = "",
}: AgendaDayCardProps) {
  const dayNumber = String(day).padStart(2, "0");

  if (size === "compact") {
    return (
      <div className={`group flex items-start gap-8 ${className}`}>
        <div className="font-serif text-[40px] sm:text-[56px] font-normal leading-none text-blue/20 transition-colors group-hover:text-terracotta">
          {dayNumber}
        </div>
        <div className="pt-1">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
            {locationLabel}
          </span>
          <h4 className="font-serif text-2xl font-normal text-blue-dark mb-4">
            {title}
          </h4>
          <ul className="space-y-3">
            {items.map((item, i) => (
              <li key={i} className="flex gap-4 text-ink-mid">
                {item.time && (
                  <span className="font-semibold whitespace-nowrap">
                    {item.time}
                  </span>
                )}
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "group relative flex h-full flex-col overflow-hidden",
        "border border-ink-dim/20 bg-white p-8",
        "transition-colors hover:border-terracotta",
        className,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-2 -top-6 z-0 font-serif text-[100px] sm:text-[160px] font-normal leading-none text-blue/5 transition-colors group-hover:text-terracotta/10"
      >
        {dayNumber}
      </span>
      <div className="relative z-10">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          {locationLabel}
        </span>
        <h3 className="font-serif text-[28px] sm:text-[32px] leading-[1.3] font-normal text-blue-dark mb-6">
          {title}
        </h3>
        <ul className="space-y-4">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex gap-4 border-l-2 border-blue-light pl-4 text-ink"
            >
              {item.time && (
                <span className="font-semibold whitespace-nowrap">
                  {item.time}
                </span>
              )}
              <span>{item.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
