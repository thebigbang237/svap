-- Allow Paiement Pro as a payment provider.
--
-- 0010 pinned `payments.provider` to ('pawapay','stripe','flutterwave'). Adding
-- the Paiement Pro adapter without extending that list meant every card
-- checkout failed at the INSERT with a check-constraint violation, which the
-- checkout route surfaced as a bare HTTP 500 — before the candidate ever
-- reached the gateway.
--
-- The constraint itself is worth keeping: it is what stops a typo in a provider
-- id from creating rows that no adapter can ever reconcile. It just has to know
-- about every adapter in lib/payments/registry.ts.
--
-- `svap.payment_events.provider` deliberately has no such constraint — it
-- records what arrived, including from a provider we have since retired, and
-- constraining it would mean dropping the evidence of a delivery we could not
-- classify.

alter table svap.payments
  drop constraint if exists payments_provider_check;

alter table svap.payments
  add constraint payments_provider_check
  check (provider in ('pawapay', 'stripe', 'paiementpro', 'flutterwave'));

-- Verify: expect one row, with `paiementpro` present in the definition.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'svap.payments'::regclass
  and conname = 'payments_provider_check';
