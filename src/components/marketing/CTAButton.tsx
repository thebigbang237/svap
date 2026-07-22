import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export interface CTAButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<CTAButtonProps["variant"]>, string> =
  {
    primary: "bg-terracotta text-white hover:brightness-90",
    secondary:
      "border border-blue-dark text-blue-dark hover:bg-blue-dark hover:text-white",
    ghost: "border border-current/40 hover:bg-current/10",
  };

export function CTAButton({
  children,
  variant = "primary",
  href,
  onClick,
  type = "button",
  disabled = false,
  icon,
  className = "",
}: CTAButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-3 px-8 py-4",
    "text-xs font-semibold uppercase tracking-[0.2em]",
    "transition-all duration-300",
    variantClasses[variant],
    disabled
      ? "pointer-events-none opacity-40"
      : "hover:scale-[1.02] active:scale-95",
    className,
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
        {icon}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
      {icon}
    </button>
  );
}
