-- The "public" schema comes pre-configured by Supabase with USAGE grants for
-- the anon/authenticated roles, but a custom schema like "svap" does not get
-- these automatically. Without them, PostgREST rejects every request with
-- "permission denied for schema svap" before row level security ever runs —
-- the RLS policies in 0001_svap_schema.sql were correct but unreachable.
--
-- Grants below mirror the RLS policies already in place:
--   - anon can INSERT candidatures ("Anyone can submit a candidature")
--   - authenticated can SELECT/UPDATE candidatures, and SELECT their own
--     admin_profiles row (the admin panel's own read/write paths go through
--     the service-role client and don't strictly need these, but they keep
--     the grants consistent with what the RLS policies already declare).

grant usage on schema svap to anon, authenticated;

grant insert on svap.candidatures to anon;
grant select, update on svap.candidatures to authenticated;
grant select on svap.admin_profiles to authenticated;
