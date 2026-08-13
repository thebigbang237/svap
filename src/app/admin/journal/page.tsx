import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUDIT_ACTION_LABELS_FR, label } from "@/lib/constants/admin-labels";

/**
 * Audit log viewer (§8).
 *
 * Read-only by construction: the table has no UPDATE or DELETE policy for
 * anyone, and there is no UI here that could offer one. An audit trail the
 * audited party can edit is not an audit trail.
 */

interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Actions that touch a candidate's most sensitive data. */
const SENSITIVE = new Set(["passport.reveal", "document.view", "payment.refund"]);

export default async function AuditLogPage() {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<AuditRow[]>();

  const entries = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-blue-dark">
          Journal d&apos;audit
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          300 dernières actions. Registre en ajout seul — aucune entrée ne peut
          être modifiée ou supprimée.
        </p>
      </div>

      <div className="overflow-x-auto border border-ink-dim/20 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-dim/20 bg-sky-mid text-xs font-semibold uppercase tracking-wide text-ink-mid">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Auteur</th>
              <th className="px-4 py-3">Objet</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-ink-dim/10 last:border-0 ${
                  SENSITIVE.has(entry.action) ? "bg-terracotta/5" : ""
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink-dim">
                  {new Date(entry.created_at).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      SENSITIVE.has(entry.action)
                        ? "font-semibold text-terracotta"
                        : "text-ink"
                    }
                  >
                    {label(AUDIT_ACTION_LABELS_FR, entry.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-mid">
                  {entry.actor_email ?? entry.actor_id?.slice(0, 8) ?? "Système"}
                </td>
                <td className="px-4 py-3">
                  {entry.entity_type === "candidature" && entry.entity_id ? (
                    <Link
                      href={`/admin/candidatures/${entry.entity_id}`}
                      className="text-blue hover:underline"
                    >
                      {entry.entity_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-ink-dim">
                      {entry.entity_type}
                      {entry.entity_id ? ` ${entry.entity_id.slice(0, 8)}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-dim">
                  {entry.ip ?? "—"}
                </td>
              </tr>
            ))}

            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                  Aucune entrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
