import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CandidaturesFilters } from "@/components/admin/CandidaturesFilters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pagination } from "@/components/admin/Pagination";
import {
  parseCandidaturesFilters,
  filtersToSearchParams,
  buildCandidaturesQuery,
} from "@/lib/admin/candidatures-query";
import { PACK_LABELS, PAYS_LABELS } from "@/lib/resend/labels";
import type { CandidatureRow } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

export default async function CandidaturesListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const filters = parseCandidaturesFilters(sp);

  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(rawPage) || 1);

  const supabase = createAdminClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: rows, count } = await buildCandidaturesQuery(supabase, filters)
    .range(from, to)
    .returns<CandidatureRow[]>();

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const exportParams = filtersToSearchParams(filters);

  const sortParams = filtersToSearchParams({
    ...filters,
    sort: filters.sort === "asc" ? "desc" : "asc",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-normal text-blue-dark">
          Candidatures {count !== null && `(${count})`}
        </h1>
        <a
          href={`/api/admin/candidatures/export?${exportParams.toString()}`}
          className="border border-blue-dark px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-dark transition hover:bg-blue-dark hover:text-white"
        >
          Exporter CSV
        </a>
      </div>

      <CandidaturesFilters
        initialQuery={filters.q ?? ""}
        initialStatus={filters.status ?? ""}
        initialPack={filters.pack ?? ""}
        initialPays={filters.pays ?? ""}
      />

      <div className="overflow-x-auto border border-ink-dim/20 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-dim/20 bg-sky-mid text-xs font-semibold uppercase tracking-wide text-ink-mid">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Pack</th>
              <th className="px-4 py-3">Pays</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">
                <Link
                  href={`/admin/candidatures?${sortParams.toString()}`}
                  className="inline-flex items-center gap-1 hover:text-blue"
                >
                  Date {filters.sort === "asc" ? "↑" : "↓"}
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
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
                  {PACK_LABELS.fr[row.pack] ?? row.pack}
                </td>
                <td className="px-4 py-3">
                  {PAYS_LABELS.fr[row.pays] ?? row.pays}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-ink-dim">
                  {new Date(row.created_at).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-dim">
                  Aucune candidature ne correspond à ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/admin/candidatures"
        searchParams={exportParams}
      />
    </div>
  );
}
