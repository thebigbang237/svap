-- Allow PayPal as a payment method.
--
-- 0010 pinned `payments.method` to ('mobile_money','card'). PayPal goes
-- through Paiement Pro's hosted page — provider `paiementpro`, method
-- `paypal` — and without this every PayPal checkout would fail at the INSERT
-- with a check-constraint violation, before the candidate reached PayPal. The
-- same trap 0017 fixed for the provider list.
--
-- Run it before setting PAIEMENTPRO_PAYPAL=true.

alter table svap.payments
  drop constraint if exists payments_method_check;

alter table svap.payments
  add constraint payments_method_check
  check (method in ('mobile_money', 'card', 'paypal'));

-- Verify: expect one row, with `paypal` present in the definition.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'svap.payments'::regclass
  and conname = 'payments_method_check';
