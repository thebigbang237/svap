-- Grants for service_role on the svap schema.
--
-- 0002 granted `anon` and `authenticated` but not `service_role`, on the
-- assumption that the service key bypasses everything. It doesn't:
-- `service_role` carries BYPASSRLS, so it skips row level security — but it is
-- NOT a superuser, so ordinary schema and table privileges still apply. For
-- the `public` schema Supabase grants those by default; for a custom schema
-- like `svap` nothing is granted automatically.
--
-- The result was `permission denied for schema svap` (SQLSTATE 42501) on
-- every server-side query: the Phase-1 insert, the capacity count, access
-- codes, Phase-2, payments and the audit log all use the service-role client.
--
-- Written as a separate migration rather than an edit to 0002, which has
-- already been applied.

grant usage on schema svap to service_role;

grant all privileges on all tables in schema svap to service_role;
grant all privileges on all sequences in schema svap to service_role;
grant all privileges on all functions in schema svap to service_role;

-- Tables added by later migrations would otherwise arrive ungranted and
-- reproduce exactly this failure. Default privileges cover them in advance.
alter default privileges in schema svap
  grant all on tables to service_role;
alter default privileges in schema svap
  grant all on sequences to service_role;
alter default privileges in schema svap
  grant all on functions to service_role;

-- ---------------------------------------------------------------------------
-- authenticated — reach the admin RLS policies
-- ---------------------------------------------------------------------------
-- 0007–0011 declared "Admins can view …" policies on the Phase-2, payment and
-- audit tables. A policy can only permit what a grant already allows, so
-- without these the policies were unreachable. The admin UI currently reads
-- through the service role, which is why this hadn't surfaced — but a policy
-- that cannot be exercised is a trap for whoever wires up the session client
-- next.

grant select on
  svap.access_codes,
  svap.access_code_attempts,
  svap.phase2_applications,
  svap.risk_assessments,
  svap.phase2_documents,
  svap.phase2_consents,
  svap.payments,
  svap.payment_events,
  svap.visa_refusal_claims,
  svap.audit_log
to authenticated;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- Expect one row: has_schema_privilege = true.
select
  has_schema_privilege('service_role', 'svap', 'USAGE') as schema_usage,
  has_table_privilege('service_role', 'svap.candidatures', 'INSERT') as can_insert,
  has_table_privilege('service_role', 'svap.candidatures', 'SELECT') as can_select;
