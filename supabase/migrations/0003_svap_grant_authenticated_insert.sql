-- 0002_svap_grants.sql granted INSERT on svap.candidatures to `anon` only,
-- assuming public form submissions always come from a signed-out visitor.
-- In practice an admin testing the form while still logged in at /admin
-- submits as `authenticated` instead (their session cookie is present), and
-- that role only had SELECT/UPDATE — hence "permission denied for table
-- candidatures" instead of the earlier schema-level error. The RLS policy
-- ("Anyone can submit a candidature") already allows this for any role; it
-- just needs the matching grant.

grant insert on svap.candidatures to authenticated;
