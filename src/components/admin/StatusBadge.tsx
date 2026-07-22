import { STATUS_LABELS_FR, STATUS_BADGE_CLASSES } from "@/lib/constants/admin-options";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
        STATUS_BADGE_CLASSES[status] ?? "bg-sky-mid text-ink-mid"
      }`}
    >
      {STATUS_LABELS_FR[status] ?? status}
    </span>
  );
}
