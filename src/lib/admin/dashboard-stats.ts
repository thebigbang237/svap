import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { CandidatureRow } from "@/lib/supabase/types";

export interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
  byPack: Record<string, number>;
  last7Days: number;
  recent: CandidatureRow[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Plain helper, not a component — keeps Date.now() out of the page
// component body (React's purity lint rule flags impure calls made
// directly inside a component/hook).
export async function getDashboardStats(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<DashboardStats> {
  const { data: rows } = await supabase
    .from("candidatures")
    .select("status, pack, created_at")
    .returns<Pick<CandidatureRow, "status" | "pack" | "created_at">[]>();

  const all = rows ?? [];
  const byStatus: Record<string, number> = {};
  const byPack: Record<string, number> = {};
  let last7Days = 0;
  const sevenDaysAgoMs = Date.now() - SEVEN_DAYS_MS;

  for (const row of all) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    byPack[row.pack] = (byPack[row.pack] ?? 0) + 1;
    if (new Date(row.created_at).getTime() >= sevenDaysAgoMs) last7Days++;
  }

  const { data: recent } = await supabase
    .from("candidatures")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<CandidatureRow[]>();

  return {
    total: all.length,
    byStatus,
    byPack,
    last7Days,
    recent: recent ?? [],
  };
}
