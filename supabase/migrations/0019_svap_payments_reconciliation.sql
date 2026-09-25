-- Record HOW a payment came to be settled, and let an administrator confirm it.
--
-- Paiement Pro cannot prove a payment happened. Their status API reports
-- "Aucune transaction" for our completed transactions, and their support
-- states plainly that the `hashcode` on the notification "est propre aux
-- opérateurs" and is not a merchant-verifiable signature — verify by
-- reference, they say, through the lookup that does not work for us.
--
-- So a Paiement Pro callback is accepted on its own word: `responsecode=0`,
-- an amount matching what we recorded, and a reference we issued. That is
-- enough for the candidate to continue immediately, and NOT enough to be
-- sure the money moved — the reference is visible to the payer in their own
-- return URL, so a determined candidate could replay it without paying.
--
-- These columns are what closes that gap after the fact: every settlement
-- says which evidence it rests on, and the ones resting on an unverifiable
-- callback are listed in /admin/paiements until a human has checked them
-- against the Paiement Pro back office.
--
-- pawaPay and Stripe are unaffected: their callbacks are signed, land as
-- `provider_signature`, and never appear in that list.

alter table svap.payments
  add column if not exists settlement_source text,
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid references auth.users(id);

alter table svap.payments
  drop constraint if exists payments_settlement_source_check;

alter table svap.payments
  add constraint payments_settlement_source_check
  check (settlement_source is null or settlement_source in (
    'provider_signature',   -- a cryptographically verified callback
    'gateway_status',       -- confirmed by the provider's own status API
    'callback_unverified',  -- taken on an unverifiable callback — needs a human
    'manual'                -- an administrator confirmed it by hand
  ));

-- The reconciliation queue reads exactly this predicate, on every page load.
create index if not exists idx_svap_payments_awaiting_reconciliation
  on svap.payments(completed_at desc)
  where settlement_source = 'callback_unverified' and reconciled_at is null;

-- Confirming or rejecting a settlement decides whether a dossier proceeds on
-- money that may never have arrived. That belongs in the audit trail.
alter table svap.audit_log
  drop constraint if exists audit_log_action_check;

alter table svap.audit_log
  add constraint audit_log_action_check
  check (action in (
    'document.view',
    'dossier.download',
    'passport.reveal',
    'candidature.status',
    'candidature.export',
    'payment.refund',
    'payment.reconcile',   -- settlement confirmed against the provider
    'payment.reject',      -- settlement not found at the provider, reversed
    'access_code.resend',
    'claim.decision',
    'article.create',
    'article.update',
    'article.delete'
  ));

-- Verify: expect the four sources and both new audit actions.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('svap.payments'::regclass, 'svap.audit_log'::regclass)
  and conname in ('payments_settlement_source_check', 'audit_log_action_check');
