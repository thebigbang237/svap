import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Anonymous read-only client for the public press page.
 *
 * Deliberately not the cookie-backed server client: reading a session for a
 * list that is identical for every visitor buys nothing. Deliberately not the
 * service role either — the "Anyone can read published articles" policy is
 * what keeps a staged item invisible, and bypassing RLS here would move that
 * guarantee into the query, where a later edit could drop it.
 *
 * Kept out of lib/articles.ts so the client-side admin editor can import the
 * constants there without pulling supabase-js into the browser bundle.
 */
export function createArticlesReader() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "svap" }, auth: { persistSession: false } },
  );
}
