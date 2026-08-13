import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardStats } from "@/lib/admin/dashboard-stats";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { STATUS_OPTIONS, STATUS_LABELS_FR } from "@/lib/constants/admin-options";
import { PACKS } from "@/lib/constants/program";
import { packLabel } from "@/lib/resend/labels";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-ink-dim/20 bg-white p-5">
      <p className="font-serif text-3xl font-normal text-blue-dark">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
        {label}
      </p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const { total, byStatus, byPack, last7Days, recent } =
    await getDashboardStats(supabase);

  return (
    <div className="space-y-10">
      <h1 className="font-serif text-2xl font-normal text-blue-dark">
        Tableau de bord
      </h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total candidatures" value={total} />
        <StatCard label="7 derniers jours" value={last7Days} />
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Par statut
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {STATUS_OPTIONS.map((status) => (
            <StatCard
              key={status}
              label={STATUS_LABELS_FR[status]}
              value={byStatus[status] ?? 0}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Par pack
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {PACKS.map((pack) => (
            <StatCard
              key={pack}
              label={packLabel("fr", pack)}
              value={byPack[pack] ?? 0}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Candidatures récentes
          </h2>
          <Link
            href="/admin/candidatures"
            className="text-xs font-semibold uppercase tracking-wide text-blue hover:underline"
          >
            Voir tout →
          </Link>
        </div>
        <div className="overflow-x-auto border border-ink-dim/20 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-dim/20 bg-sky-mid text-xs font-semibold uppercase tracking-wide text-ink-mid">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Pack</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ink-dim/10 last:border-0 hover:bg-sky/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/candidatures/${row.id}`}
                      className="font-medium text-blue hover:underline"
                    >
                      {row.prenom} {row.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-mid">{row.email}</td>
                  <td className="px-4 py-3">
                    {packLabel("fr", row.pack)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-dim">
                    {new Date(row.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                    Aucune candidature pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
