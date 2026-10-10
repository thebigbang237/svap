-- Is the database actually where the code thinks it is?
--
-- Migrations are applied by hand here, so "did 0020 run?" is a real question
-- with an expensive wrong answer: the adapter exists, the checkout reaches the
-- provider, and then the INSERT fails on a check constraint — which the
-- candidate sees as an unexplained error and nobody else sees at all.
--
-- Read-only. Run it in the Supabase SQL editor after any migration, and when
-- a payment fails for no visible reason. Every row should say OK.

select
  '0017/0020 providers' as check,
  case
    when pg_get_constraintdef(oid) like '%saspay%'
     and pg_get_constraintdef(oid) like '%paiementpro%'
    then 'OK'
    else 'MISSING — run 0020 (and 0017)'
  end as status,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'svap.payments'::regclass
  and conname = 'payments_provider_check'

union all

select
  '0018 paypal method',
  case
    when pg_get_constraintdef(oid) like '%paypal%'
    then 'OK'
    else 'MISSING — run 0018'
  end,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'svap.payments'::regclass
  and conname = 'payments_method_check'

union all

select
  '0019 reconciliation',
  case
    when count(*) = 3 then 'OK'
    else 'MISSING — run 0019'
  end,
  string_agg(column_name, ', ' order by column_name)
from information_schema.columns
where table_schema = 'svap'
  and table_name = 'payments'
  and column_name in ('settlement_source', 'reconciled_at', 'reconciled_by')

union all

select
  '0019 audit actions',
  case
    when pg_get_constraintdef(oid) like '%payment.reconcile%'
    then 'OK'
    else 'MISSING — run 0019'
  end,
  'payment.reconcile / payment.reject'
from pg_constraint
where conrelid = 'svap.audit_log'::regclass
  and conname = 'audit_log_action_check';

-- And what the payment rows actually look like right now. Pending rows older
-- than 48h should be none once the cron has run the expiry sweep.
select
  provider,
  method,
  status,
  count(*) as rows,
  count(*) filter (where created_at < now() - interval '48 hours') as older_than_48h
from svap.payments
group by provider, method, status
order by provider, method, status;
