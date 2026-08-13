-- Phase-2 verification fee payments.
--
-- Two rails, one model: pawaPay for mobile money in Cameroun, Kenya and
-- Ghana; Stripe for cards everywhere (mandatory for Morocco, Egypt and South
-- Africa, which pawaPay does not cover). See docs/plan-edition-2026.md §4.

create table svap.payments (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references svap.candidatures(id) on delete cascade,

  provider text not null,
  -- The provider's own identifier: a pawaPay depositId or a Stripe Checkout
  -- Session id. Unique per provider so a webhook can find its payment, and so
  -- a retried initiation cannot create a second row for the same intent.
  provider_ref text not null,
  method text not null,

  kind text not null default 'verification_fee',

  -- The fee is quoted in USD but collected on local rails, so both sides of
  -- the conversion are recorded. Without this a receipt could show an amount
  -- the candidate was never actually charged.
  amount_usd numeric(10,2) not null,
  amount_local numeric(14,2) not null,
  currency text not null,
  fx_rate numeric(16,6) not null,
  -- Locked when the checkout is created, not when it settles: the candidate
  -- agreed to a specific local amount on screen, and a rate that moved
  -- mid-payment must not silently change what they owe.
  fx_locked_at timestamptz not null,
  fx_source text,

  status text not null default 'en_attente',
  failure_reason text,

  initiated_at timestamptz not null default now(),
  completed_at timestamptz,
  receipt_sent_at timestamptz,

  refunded_at timestamptz,
  refund_amount_usd numeric(10,2),
  refund_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table svap.payments
  add constraint payments_provider_check check (provider in ('pawapay','stripe','flutterwave')),
  add constraint payments_method_check check (method in ('mobile_money','card')),
  add constraint payments_kind_check check (kind in ('verification_fee','vip_sponsoring')),
  add constraint payments_status_check
    check (status in ('en_attente','en_cours','paye','echoue','annule','rembourse')),
  add constraint payments_amounts_positive
    check (amount_usd > 0 and amount_local > 0 and fx_rate > 0);

create unique index idx_svap_payments_provider_ref
  on svap.payments(provider, provider_ref);

create index idx_svap_payments_candidature on svap.payments(candidature_id);
create index idx_svap_payments_status on svap.payments(status);

-- Only one settled verification fee per candidature. A double charge on a
-- $330 pack is the kind of support incident that costs far more than the
-- constraint does, and webhook retries make it a live risk rather than a
-- theoretical one.
create unique index idx_svap_payments_one_paid_fee
  on svap.payments(candidature_id, kind)
  where status = 'paye';

-- ---------------------------------------------------------------------------
-- Webhook events
-- ---------------------------------------------------------------------------
-- Payment providers retry aggressively and deliver out of order. This table
-- is the idempotency ledger: the unique constraint on (provider,
-- provider_event_id) means a replayed delivery hits a 23505 and is
-- acknowledged without being applied twice.
--
-- The raw payload is kept because reconciling a disputed payment months later
-- against a provider's dashboard is impossible from a summary.

create table svap.payment_events (
  id bigserial primary key,
  payment_id uuid references svap.payments(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text,
  payload jsonb not null,
  -- Null until applied. A row that exists but was never applied is a
  -- delivery we accepted and then failed to process — exactly what a
  -- reconciliation job needs to find.
  processed_at timestamptz,
  received_at timestamptz not null default now()
);

create unique index idx_svap_payment_events_unique
  on svap.payment_events(provider, provider_event_id);

create index idx_svap_payment_events_payment on svap.payment_events(payment_id);
create index idx_svap_payment_events_unprocessed
  on svap.payment_events(received_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- Visa refusal premiums (§9)
-- ---------------------------------------------------------------------------
-- Lauréat 1 000 USD · Boursier 500 USD · VIP Visitor 4 500 USD, each subject
-- to documentary proof of the official refusal and an internal audit, paid
-- within 60 days. Tracked here rather than handled ad hoc because these are
-- public commitments with a stated deadline.

create table svap.visa_refusal_claims (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references svap.candidatures(id) on delete cascade,

  refusal_document_path text,
  claimed_at timestamptz not null default now(),

  status text not null default 'recu',
  audit_notes text,
  audited_by uuid references auth.users(id),
  audited_at timestamptz,

  amount_usd numeric(10,2),
  paid_at timestamptz,
  -- claimed_at + 60 days, so an overdue commitment is a query rather than
  -- something somebody has to remember.
  due_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table svap.visa_refusal_claims
  add constraint visa_claims_status_check
  check (status in ('recu','en_audit','approuve','rejete','paye'));

create index idx_svap_visa_claims_due on svap.visa_refusal_claims(due_at)
  where status <> 'paye';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Writes are service-role only: a payment status must never be settable by
-- anything except a signature-verified webhook or a server-side status poll.

alter table svap.payments enable row level security;
alter table svap.payment_events enable row level security;
alter table svap.visa_refusal_claims enable row level security;

create policy "Admins can view payments"
  on svap.payments for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create policy "Admins can view visa refusal claims"
  on svap.visa_refusal_claims for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create trigger trg_svap_payments_updated_at
  before update on svap.payments
  for each row execute function svap.set_updated_at();

create trigger trg_svap_visa_claims_updated_at
  before update on svap.visa_refusal_claims
  for each row execute function svap.set_updated_at();
