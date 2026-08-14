-- Which mobile money operator actually carried the payment.
--
-- `payments.provider` records the aggregator ("pawapay"), not the operator.
-- pawaPay v2 requires the operator id in the deposit payload anyway, so we
-- already have it — and "did this go over MTN or Orange?" is the first
-- question support asks when a candidate says their money left but the
-- dossier didn't advance. Null for card payments.

alter table svap.payments
  add column if not exists mmo_operator text;

comment on column svap.payments.mmo_operator is
  'pawaPay provider id, e.g. MTN_MOMO_CMR. Null for card payments.';
