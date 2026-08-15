-- Record bulk dossier exports in the audit log.
--
-- `document.view` covers opening one file. Downloading the whole dossier —
-- every identity document plus the decrypted summary, as a zip that leaves
-- the system entirely — is a materially larger disclosure and deserves its
-- own action rather than being logged as several views or, worse, not at all.

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
    'access_code.resend',
    'claim.decision'
  ));
