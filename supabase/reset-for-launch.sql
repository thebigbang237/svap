-- Empty the database of test data, keeping the admin accounts.
--
-- For the case where ONE Supabase project serves both testing and production:
-- testing is signed off, and everything the test runs produced has to go
-- before real applicants arrive.
--
-- ⚠️ DESTRUCTIVE AND IRREVERSIBLE. Take a snapshot first (Supabase → Database
-- → Backups) so a mistake is a restore rather than an incident.
--
-- ⚠️ THIS SCRIPT DOES NOT TOUCH STORAGE. Test passport scans, ID photos,
-- liveness selfies and criminal-record extracts live in the `svap-documents`
-- bucket and survive every statement below. They are real personal data about
-- real people, even if those people were colleagues testing the flow — delete
-- the bucket's contents separately (see the end of this file).
--
-- Run it in the Supabase SQL editor, in one go. It is wrapped in a transaction
-- so a failure part-way leaves the database exactly as it was.

begin;

-- ---------------------------------------------------------------------------
-- 1. Candidatures, and everything that cascades from them
-- ---------------------------------------------------------------------------
-- These all declare `on delete cascade` on candidature_id, so one delete
-- clears them: access_codes, phase2_applications, risk_assessments,
-- phase2_documents, phase2_consents, phase2_financial, payments,
-- visa_refusal_claims.

delete from svap.candidatures;

-- ---------------------------------------------------------------------------
-- 2. Tables that do NOT cascade — the reason this script exists
-- ---------------------------------------------------------------------------

-- payment_events.payment_id is `on delete set null`, not cascade: deleting the
-- payments above orphans these rows rather than removing them. Left behind,
-- the provider/provider_event_id unique index would still hold every sandbox
-- event id, and the idempotency guard would silently ignore a live callback
-- that happened to reuse one.
truncate table svap.payment_events;

-- No foreign key at all — rate-limit rows keyed by IP and code hash.
truncate table svap.access_code_attempts;

-- No foreign key either: entity_id is plain text, so audit rows outlive the
-- candidatures they describe. Clearing them means the production audit trail
-- starts at launch, with nothing from testing mixed in.
--
-- Comment this line out if you would rather keep the test-period trail. It is
-- the one table where keeping the history is a defensible choice.
truncate table svap.audit_log;

commit;

-- ---------------------------------------------------------------------------
-- 3. Verify — every count must be 0
-- ---------------------------------------------------------------------------

select 'candidatures'         as table_name, count(*) from svap.candidatures
union all select 'access_codes',          count(*) from svap.access_codes
union all select 'access_code_attempts',  count(*) from svap.access_code_attempts
union all select 'phase2_applications',   count(*) from svap.phase2_applications
union all select 'risk_assessments',      count(*) from svap.risk_assessments
union all select 'phase2_documents',      count(*) from svap.phase2_documents
union all select 'phase2_consents',       count(*) from svap.phase2_consents
union all select 'phase2_financial',      count(*) from svap.phase2_financial
union all select 'payments',              count(*) from svap.payments
union all select 'payment_events',        count(*) from svap.payment_events
union all select 'visa_refusal_claims',   count(*) from svap.visa_refusal_claims
union all select 'audit_log',             count(*) from svap.audit_log;

-- ---------------------------------------------------------------------------
-- 4. Deliberately NOT emptied
-- ---------------------------------------------------------------------------
--   svap.admin_profiles  — your admin accounts, and auth.users behind them.
--   svap.articles        — press coverage. Real content; only clear it if the
--                          articles you added were themselves test entries.
--
-- Check what survived:
--   select id, full_name, role from svap.admin_profiles;
--   select media_name, title, published_at, is_published from svap.articles;

-- ---------------------------------------------------------------------------
-- 5. Storage — SQL cannot do this
-- ---------------------------------------------------------------------------
-- Supabase → Storage → svap-documents → select all → delete. Every object in
-- there is a test candidate's identity document.
--
-- Confirm it is empty afterwards:
--   select count(*) from storage.objects where bucket_id = 'svap-documents';
--
-- Leave `svap-articles` alone unless you are also clearing svap.articles —
-- deleting those objects would leave published cards with broken thumbnails.
