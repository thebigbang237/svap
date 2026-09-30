-- Allow SasPay as a payment provider.
--
-- Ghana's mobile money could not be opened on the pawaPay account: wallets are
-- provisioned per country, and that one needs documents the programme cannot
-- produce. Ghanaian candidates were left with nothing — mobile money
-- unavailable, and their cards refused by PayPal, which is what Paiement Pro
-- settles cards through. SasPay covers Ghana (MTN, Telecel/Vodafone,
-- AirtelTigo) and is routed for that country only; Cameroun and Kenya stay on
-- pawaPay, which is proven and signs its callbacks.
--
-- As with 0017 and 0018: without this, the adapter exists but every checkout
-- fails at the INSERT on `payments_provider_check`, before the candidate ever
-- reaches the operator prompt — and reads as an unexplained 500.

alter table svap.payments
  drop constraint if exists payments_provider_check;

alter table svap.payments
  add constraint payments_provider_check
  check (provider in (
    'pawapay',
    'saspay',
    'stripe',
    'paiementpro',
    'flutterwave'
  ));

-- Verify: expect one row, with `saspay` present in the definition.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'svap.payments'::regclass
  and conname = 'payments_provider_check';
