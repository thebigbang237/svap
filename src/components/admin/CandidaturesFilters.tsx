"use client";

import { useState, type FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { STATUS_OPTIONS, STATUS_LABELS_FR } from "@/lib/constants/admin-options";
import { PACK_OPTIONS, PAYS_OPTIONS } from "@/lib/constants/candidature-options";
import { PACK_LABELS, PAYS_LABELS } from "@/lib/resend/labels";

export interface CandidaturesFiltersProps {
  initialQuery: string;
  initialStatus: string;
  initialPack: string;
  initialPays: string;
}

const selectClasses =
  "border border-ink-dim/30 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta";

export function CandidaturesFilters({
  initialQuery,
  initialStatus,
  initialPack,
  initialPays,
}: CandidaturesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);

  const navigate = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({
      q: query,
      status: initialStatus,
      pack: initialPack,
      pays: initialPays,
      ...overrides,
    });
    for (const [key, value] of [...params.entries()]) {
      if (!value) params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate({ q: query });
  };

  return (
    <div className="flex flex-wrap items-end gap-4 border border-ink-dim/20 bg-white p-4">
      <form onSubmit={handleSearchSubmit} className="min-w-[220px] flex-1">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Recherche
        </label>
        <input
          type="search"
          placeholder="Nom, prénom ou email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-ink-dim/30 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
      </form>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Statut
        </label>
        <select
          value={initialStatus}
          onChange={(e) => navigate({ status: e.target.value })}
          className={selectClasses}
        >
          <option value="">Tous</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS_FR[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Pack
        </label>
        <select
          value={initialPack}
          onChange={(e) => navigate({ pack: e.target.value })}
          className={selectClasses}
        >
          <option value="">Tous</option>
          {PACK_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PACK_LABELS.fr[p]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Pays
        </label>
        <select
          value={initialPays}
          onChange={(e) => navigate({ pays: e.target.value })}
          className={selectClasses}
        >
          <option value="">Tous</option>
          {PAYS_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PAYS_LABELS.fr[p]}
            </option>
          ))}
        </select>
      </div>

      {(initialQuery || initialStatus || initialPack || initialPays) && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            router.push(pathname);
          }}
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-dim hover:text-terracotta"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
