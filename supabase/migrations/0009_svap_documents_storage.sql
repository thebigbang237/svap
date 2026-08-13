-- Private Storage bucket for Phase-2 identity documents.
--
-- These are the most sensitive artefacts the system holds: national identity
-- cards, passport pages, liveness selfies and criminal record extracts. The
-- bucket is private, has a hard size ceiling, and accepts only the formats a
-- phone camera or a scanner actually produces.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'svap-documents',
  'svap-documents',
  -- Never public. Files are reachable only through short-lived signed URLs
  -- minted server-side for an authenticated admin.
  false,
  -- 8 MB. The client compresses before upload, so anything approaching this
  -- is either an uncompressed scan or an attempt to exhaust storage.
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
-- No anonymous or authenticated INSERT policy, deliberately.
--
-- Candidates do NOT upload directly to this bucket. Every file goes through
-- POST /api/documents/pieces, which validates the real file type by magic
-- bytes, enforces the size cap, and writes with the service role. A signed
-- upload URL handed to the browser would move that validation to after the
-- fact, and a direct-to-bucket policy would mean trusting a client-declared
-- Content-Type on a criminal record.

create policy "Admins can read candidate documents"
  on storage.objects for select
  using (
    bucket_id = 'svap-documents'
    and exists (
      select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
-- §8 commits to a right of erasure and to processing limited to instructing
-- the application. This column records when a dossier's files become
-- deletable, so a retention job has something to act on rather than the
-- policy living only in a PDF.

alter table svap.phase2_documents
  add column if not exists purge_after timestamptz;

comment on column svap.phase2_documents.purge_after is
  'When this file may be deleted from storage under the retention policy. Set on upload; a scheduled job sweeps expired rows.';

create index if not exists idx_svap_phase2_documents_purge
  on svap.phase2_documents(purge_after)
  where purge_after is not null;
