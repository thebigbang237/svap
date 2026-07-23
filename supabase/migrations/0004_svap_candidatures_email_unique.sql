-- Prevent the same person from submitting more than one candidature. A
-- unique index (not just an application-level check) is what actually
-- guards against race conditions — e.g. a double-click or two open tabs
-- both submitting at once. Case-insensitive so "Name@X.com" and
-- "name@x.com" count as the same applicant.
create unique index idx_svap_candidatures_email_unique
  on svap.candidatures (lower(email));
