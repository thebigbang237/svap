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

export function ArrowRightIcon({ className = "" }: IconProps) {
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
        d="M11.293 4.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L14.586 11H4a1 1 0 1 1 0-2h10.586l-3.293-3.293a1 1 0 0 1 0-1.414Z"
      />
    </svg>
  );
}
