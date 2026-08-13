import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses Row Level Security entirely.
 *
 * DO NOT import this file into any Client Component or anything that could
 * end up in a browser bundle. The `server-only` import above will throw a
 * build error if that happens, but treat it as a hard rule regardless:
 * this key grants full read/write access across the "svap" schema with no
 * RLS checks. Only use it in Server Actions / Route Handlers that
 * genuinely need admin-only access (e.g. reviewing candidatures).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "svap" },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

/**
 * The client type as actually configured — pinned to the "svap" schema.
 *
 * Helpers that accept a client should take this rather than a bare
 * `SupabaseClient`, whose default schema parameter is "public" and therefore
 * won't accept what createAdminClient returns.
 */
export type AdminClient = ReturnType<typeof createAdminClient>;
