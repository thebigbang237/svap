interface IconProps {
  className?: string;
}

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.415l-7.5 7.6a1 1 0 0 1-1.421 0l-3.5-3.55a1 1 0 1 1 1.422-1.404l2.79 2.828 6.79-6.883a1 1 0 0 1 1.413-.006Z"
      />
    </svg>
  );
}

export function CrossIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.28 6.28a1 1 0 0 1 1.44 0L10 8.586l2.28-2.307a1 1 0 1 1 1.44 1.396L11.42 10l2.3 2.325a1 1 0 1 1-1.44 1.396L10 11.414l-2.28 2.307a1 1 0 0 1-1.44-1.396L8.58 10l-2.3-2.325a1 1 0 0 1 0-1.396Z"
      />
    </svg>
  );
}

/**
 * Points in the reading direction — "forward", not literally right. The
 * mirror is baked in here rather than at the call sites so every CTA gets it
 * for free. Check and cross are deliberately left alone: they're symbolic,
 * not directional, and mirroring a checkmark just makes it look wrong.
 */
export function ArrowRightIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`rtl:-scale-x-100 ${className}`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.293 4.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L14.586 11H4a1 1 0 1 1 0-2h10.586l-3.293-3.293a1 1 0 0 1 0-1.414Z"
      />
    </svg>
  );
}

export function GlobeIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.75 5.5 3.75 9s-1.25 6.5-3.75 9c-2.5-2.5-3.75-5.5-3.75-9S9.5 5.5 12 3Z" />
    </svg>
  );
}

export function ChipIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </svg>
  );
}

export function CertificateIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="6" />
      <path d="M8.5 14.5 7 22l5-3 5 3-1.5-7.5" />
    </svg>
  );
}

export function MenuIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  );
}

export function ShieldIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function LockIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
