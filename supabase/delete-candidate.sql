-- Delete ONE candidature, by email, and everything tied to it — so the same
-- address can apply again from scratch.
--
-- For test runs on a database that also holds real applicants, where
-- reset-for-launch.sql would take everyone out with it.
--
-- Run it in the Supabase SQL editor in three steps, replacing the email in
-- steps 1 and 2 (the same address in both).
--
-- ⚠️ THIS DOES NOT TOUCH STORAGE. Uploaded documents live in the
-- `svap-documents` bucket under a folder named after the candidature id. Note
-- the id from step 1 before running step 2 — see step 4.


-- ---------------------------------------------------------------------------
-- 1. Preview — run this alone first
-- ---------------------------------------------------------------------------
-- Expect exactly one row (emails are unique, case-insensitively). Check it is
-- the test dossier, `paid` is 0, and copy the `id`.

select
  c.id,
  c.email,
  c.status,
  c.created_at,
  (select count(*) from svap.payments p where p.candidature_id = c.id) as payments,
  (select count(*) from svap.payments p where p.candidature_id = c.id and p.status = 'paye') as paid,
  (select count(*) from svap.phase2_documents d where d.candidature_id = c.id) as documents
from svap.candidatures c
where lower(c.email) = lower('you@example.com');


-- ---------------------------------------------------------------------------
-- 2. Delete
-- ---------------------------------------------------------------------------
-- A DO block is a single transaction: if any statement fails, or a guard
-- raises, nothing is deleted.

do $$
declare
  target_email text := 'you@example.com';   -- ← the same email as step 1
  cand_id uuid;
begin
  select id into cand_id
  from svap.candidatures
  where lower(email) = lower(target_email);

  if cand_id is null then
    raise exception 'No candidature for %. Nothing deleted.', target_email;
  end if;

  -- A settled payment means money actually moved. Refund and reconcile it
  -- with the provider first; deleting the row would erase the only record of
  -- it on our side.
  if exists (
    select 1 from svap.payments
    where candidature_id = cand_id and status in ('paye', 'rembourse')
  ) then
    raise exception 'Candidature % has a paid or refunded payment. Nothing deleted.', cand_id;
  end if;

  -- payment_events.payment_id is `on delete set null`, so these would be
  -- orphaned rather than removed. Matched by payment id, and by reference for
  -- Paiement Pro, whose event ids are "<reference>:<status>".
  delete from svap.payment_events e
  using svap.payments p
  where p.candidature_id = cand_id
    and (
      e.payment_id = p.id
      or (e.provider = p.provider and e.provider_event_id like p.provider_ref || ':%')
    );

  -- Rate-limit rows for this dossier's access code. No foreign key, so they
  -- have to go before the code does.
  delete from svap.access_code_attempts
  where code_hash in (
    select code_hash from svap.access_codes where candidature_id = cand_id
  );

  -- Admin actions on this dossier (review, rejection, downloads). No foreign
  -- key: entity_id is plain text. Comment out to keep the trail.
  delete from svap.audit_log
  where (entity_type = 'candidature' and entity_id = cand_id::text)
     or (entity_type = 'phase2_document' and entity_id in (
          select id::text from svap.phase2_documents where candidature_id = cand_id))
     or (entity_type = 'payment' and entity_id in (
          select id::text from svap.payments where candidature_id = cand_id));

  -- Cascades to access_codes, phase2_applications, risk_assessments,
  -- phase2_documents, phase2_consents, phase2_financial, payments and
  -- visa_refusal_claims.
  delete from svap.candidatures where id = cand_id;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Verify — expect no rows
-- ---------------------------------------------------------------------------

select id from svap.candidatures where lower(email) = lower('you@example.com');


-- ---------------------------------------------------------------------------
-- 4. Storage — SQL cannot do this
-- ---------------------------------------------------------------------------
-- Supabase → Storage → svap-documents → the folder named after the id from
-- step 1 → select all → delete.
--
-- Confirm it is empty afterwards (replace the id):
--   select count(*) from storage.objects
--   where bucket_id = 'svap-documents'
--     and name like '<candidature id>/%';
