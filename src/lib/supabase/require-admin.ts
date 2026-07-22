import "server-only";
import { createClient } from "./server";
import type { AdminProfileRow } from "./types";

/**
 * Shared auth check for /api/admin/* route handlers. Middleware already
 * gates page navigation to /admin/*, but API routes are excluded from that
 * matcher (see src/proxy.ts) and must verify the caller themselves.
 *
 * Uses the session-bound SSR client, not the service-role admin client —
 * this only needs to read the caller's own admin_profiles row, which RLS
 * already permits ("Admins can view own profile").
 */
export async function requireAdmin(): Promise<{
  userId: string;
  profile: AdminProfileRow;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("admin_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return null;

    return { userId: user.id, profile: profile as AdminProfileRow };
  } catch (error) {
    // Fail closed: a Supabase client/network error must read as
    // "unauthenticated" (→ 401), never crash the route with a 500.
    console.error("requireAdmin check failed:", error);
    return null;
  }
}
