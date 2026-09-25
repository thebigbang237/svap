-- Everything a test payment should have touched, for one candidate.
--
-- Run it in the Supabase SQL editor after paying as a test candidate, by
-- whichever rail. Replace the email in the first line of each query.
--
-- Read-only. Safe on production.

-- ---------------------------------------------------------------------------
-- 1. The payment itself
-- ---------------------------------------------------------------------------
-- After a successful payment, expect ONE row with:
--   status          = paye
--   completed_at    set
--   receipt_sent_at set (the receipt email was claimed and sent)
--   failure_reason  null
--
-- A row stuck at `en_cours` with failure_reason starting `amount_mismatch`
-- means the gateway reported a different amount than we recorded — see §4.

select
  p.created_at,
  p.provider,
  p.method,
  p.mmo_operator,
  p.status,
  p.amount_usd,
  p.amount_local,
  p.currency,
  p.provider_ref,
  p.completed_at,
  p.receipt_sent_at,
  p.failure_reason
from svap.payments p
join svap.candidatures c on c.id = p.candidature_id
where lower(c.email) = lower('you@example.com')
order by p.created_at desc;

-- ---------------------------------------------------------------------------
-- 2. The dossier moved on
-- ---------------------------------------------------------------------------
-- Expect `phase2_paye`. Still `phase2_en_cours` with a paid payment means
-- settlePayment() didn't run — check the function logs.

select id, email, pays, pack, status
from svap.candidatures
where lower(email) = lower('you@example.com');

-- ---------------------------------------------------------------------------
-- 3. What the provider actually sent
-- ---------------------------------------------------------------------------
-- One row per delivered callback. `processed_at` set means it was applied;
-- a second delivery of the same event is rejected by the unique index on
-- (provider, provider_event_id) and never reaches here — that is the
-- idempotency guard working.
--
-- For Paiement Pro, `payload -> 'status'` holds their status API response
-- verbatim, including the AMOUNT and CURRENCY they report. That is the field
-- to read when a payment is held at amount_mismatch.

select
  e.created_at,
  e.provider,
  e.event_type,
  e.provider_event_id,
  e.processed_at,
  e.payload
from svap.payment_events e
left join svap.payments p on p.id = e.payment_id
left join svap.candidatures c on c.id = p.candidature_id
where lower(c.email) = lower('you@example.com')
   or e.payment_id is null          -- callbacks we couldn't match to a payment
order by e.created_at desc
limit 20;

-- ---------------------------------------------------------------------------
-- 4. Card and PayPal amounts, across all test payments
-- ---------------------------------------------------------------------------
-- Paiement Pro charges the payer in USD, converted from the XOF we send at
-- their own rate. `amount_local` is what we sent; what they report back is in
-- the payload above. If the two disagree, every card payment will hold at
-- `en_cours` with an amount_mismatch reason instead of settling.

select
  method,
  status,
  count(*),
  min(amount_local) as min_local,
  max(amount_local) as max_local,
  currency,
  max(failure_reason) as a_failure_reason
from svap.payments
where provider = 'paiementpro'
group by method, status, currency
order by method, status;
