import type { createAdminClient } from "@/lib/supabase/admin";

// createAdminClient() (and the SSR client) are both configured with
// db.schema: "svap", which makes their inferred type incompatible with
// SupabaseClient's default "public"-schema generic — use their own return
// type instead of hand-writing the generic signature.
type SvapClient = ReturnType<typeof createAdminClient>;

export interface CandidaturesFilters {
  q?: string;
  status?: string;
  pack?: string;
  pays?: string;
  sort: "asc" | "desc";
}

type SearchParamsInput = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Shared between the candidatures list page and the CSV export route, so
 * "export the currently filtered rows" always matches what's on screen. */
export function parseCandidaturesFilters(
  searchParams: SearchParamsInput,
): CandidaturesFilters {
  return {
    q: first(searchParams.q) || undefined,
    status: first(searchParams.status) || undefined,
    pack: first(searchParams.pack) || undefined,
    pays: first(searchParams.pays) || undefined,
    sort: first(searchParams.sort) === "asc" ? "asc" : "desc",
  };
}

export function filtersToSearchParams(filters: CandidaturesFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.pack) params.set("pack", filters.pack);
  if (filters.pays) params.set("pays", filters.pays);
  if (filters.sort === "asc") params.set("sort", "asc");
  return params;
}

export function buildCandidaturesQuery(
  supabase: SvapClient,
  filters: CandidaturesFilters,
) {
  let query = supabase.from("candidatures").select("*", { count: "exact" });

  if (filters.q) {
    // Strip characters that have special meaning in Postgrest's .or() DSL
    // or the ILIKE pattern itself, so user input can't inject extra
    // conditions or wildcards.
    const term = filters.q.replace(/[,()%_]/g, "").trim();
    if (term) {
      query = query.or(
        `prenom.ilike.%${term}%,nom.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.pack) query = query.eq("pack", filters.pack);
  if (filters.pays) query = query.eq("pays", filters.pays);

  return query.order("created_at", { ascending: filters.sort === "asc" });
}
