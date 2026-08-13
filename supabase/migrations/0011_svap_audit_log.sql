-- Audit log (§8 "Journaux d'audit complets sur chaque accès et chaque
-- paiement").
--
-- Records what an administrator DID, not what the system did to itself.
-- Automatic transitions are already reconstructable from the payment events
-- and status columns; what none of those capture is a named human opening a
-- candidate's passport scan, revealing a decrypted passport number, or
-- issuing a refund. Those are the accesses the commitment is about.

create table svap.audit_log (
  id bigserial primary key,

  -- Nullable so a system action (cron, webhook) can be logged with a null
  -- actor rather than being attributed to whoever happened to be logged in.
  actor_id uuid references auth.users(id),
  actor_email text,

  action text not null,
  entity_type text not null,
  entity_id text,

  ip inet,
  user_agent text,
  metadata jsonb,

  created_at timestamptz not null default now()
);

alter table svap.audit_log
  add constraint audit_log_action_check
  check (action in (
    'document.view',       -- signed URL minted for an identity document
    'passport.reveal',     -- passport number decrypted and shown
    'candidature.status',  -- status changed by a reviewer
    'candidature.export',  -- CSV export taken
    'payment.refund',      -- refund issued
    'access_code.resend',  -- new code issued from the admin
    'claim.decision'       -- visa-refusal premium approved or rejected
  ));

create index idx_svap_audit_log_actor on svap.audit_log(actor_id, created_at desc);
create index idx_svap_audit_log_entity on svap.audit_log(entity_type, entity_id, created_at desc);
create index idx_svap_audit_log_created on svap.audit_log(created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Readable by admins, writable only by the service role. An audit trail that
-- the audited party can edit is not an audit trail — there is deliberately no
-- UPDATE or DELETE policy for anyone.

alter table svap.audit_log enable row level security;

create policy "Admins can read the audit log"
  on svap.audit_log for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

comment on table svap.audit_log is
  'Append-only record of administrator actions on candidate data. No UPDATE or DELETE policy exists by design.';
