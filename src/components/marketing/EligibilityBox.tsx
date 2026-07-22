import { CheckIcon, CrossIcon } from "./icons";

export interface EligibilityBoxProps {
  title: string;
  items: string[];
  variant: "eligible" | "ineligible";
  className?: string;
}

export function EligibilityBox({
  title,
  items,
  variant,
  className = "",
}: EligibilityBoxProps) {
  const eligible = variant === "eligible";

  return (
    <div
      className={[
        "flex h-full flex-col border-x border-b border-t-4",
        "border-x-ink-dim/20 border-b-ink-dim/20 bg-white p-8 md:p-12",
        eligible ? "border-t-blue" : "border-t-ink-mid opacity-80",
        className,
      ].join(" ")}
    >
      <h3
        className={[
          "font-serif text-[28px] sm:text-[32px] leading-[1.3] font-normal mb-8",
          eligible ? "text-blue" : "text-ink-mid",
        ].join(" ")}
      >
        {title}
      </h3>
      <ul className="space-y-6">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-4">
            {eligible ? (
              <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
            ) : (
              <CrossIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-mid" />
            )}
            <span className={eligible ? "text-ink" : "text-ink-dim"}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
