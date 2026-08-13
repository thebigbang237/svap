import { statusLabel, statusBadgeClasses } from "@/lib/constants/admin-options";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClasses(
        status,
      )}`}
    >
      {statusLabel(status)}
    </span>
  );
}
