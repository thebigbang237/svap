-- Édition 2026 programme model.
--
-- Packs were renamed and re-scoped, the country list narrowed from 15 to the
-- 6 B1/B2-eligible markets, sectors expanded from 7 to 12, and Arabic added
-- as a third locale. See docs/plan-edition-2026.md §2.
--
-- Scope note: this migration covers the *shape of the programme* only. The
-- expanded Phase-1 field set (age, ville, marié, enfants, source, lien au
-- pays, consents) and the new status enum land in the Phase-1 rework
-- migration, not here.

-- ---------------------------------------------------------------------------
-- Packs: invite -> business_visitor, ambassadeur -> vip_visitor
-- ---------------------------------------------------------------------------
-- Both are straight renames of the same commercial offer, so existing rows
-- carry over cleanly. Drop the constraint first: the UPDATE would otherwise
-- fail against the old CHECK on its way to the new values.

alter table svap.candidatures
  drop constraint if exists candidatures_pack_check;

update svap.candidatures set pack = 'business_visitor' where pack = 'invite';
update svap.candidatures set pack = 'vip_visitor' where pack = 'ambassadeur';

alter table svap.candidatures
  add constraint candidatures_pack_check
  check (pack in ('laureat','boursier','delegue','business_visitor','vip_visitor'));

-- ---------------------------------------------------------------------------
-- Countries: 6 eligible markets
-- ---------------------------------------------------------------------------
-- Added NOT VALID on purpose. There is no honest mapping from a dropped
-- country to a kept one — a Nigerian applicant cannot be relabelled Ghanaian —
-- so pre-existing rows keep their original value for the audit trail while
-- every new or updated row is constrained. Run
--   alter table svap.candidatures validate constraint candidatures_pays_check;
-- once legacy rows have been archived or manually resolved.

alter table svap.candidatures
  add constraint candidatures_pays_check
  check (pays in ('zaf','mar','cmr','ken','gha','egy')) not valid;

-- ---------------------------------------------------------------------------
-- Sectors: 7 -> 12
-- ---------------------------------------------------------------------------
-- The column had no CHECK at all before. Same NOT VALID reasoning: the old
-- slugs (tech_fintech, energy_infrastructure, ...) don't map onto the new set
-- one-to-one, and guessing would corrupt the record of what people actually
-- selected.

alter table svap.candidatures
  add constraint candidatures_secteur_check
  check (secteur in (
    'banque_finance','tech_digital','telecoms','commerce','industrie',
    'agriculture','energie','sante','immobilier_btp','conseil',
    'administration','autre'
  )) not valid;

-- ---------------------------------------------------------------------------
-- US visa history: new answer set
-- ---------------------------------------------------------------------------
-- The Phase-1 question changed from "do you hold a US visa?" to "how many US
-- visa refusals?", because refusal count is what drives auto-preselection
-- (4+ refusals is disqualifying).
--
-- 'denied' -> 'refus_1_3' is the one lossy step: the old form never captured
-- how many refusals, and 1-3 is the non-disqualifying reading. Erring the
-- other way would silently reject people on data they never gave us.

update svap.candidatures set visa_historique = case visa_historique
  when 'valid'       then 'aucun_obtenu'
  when 'expired_lt5' then 'aucun_obtenu'
  when 'expired_gt5' then 'aucun_obtenu'
  when 'never'       then 'aucun_jamais'
  when 'denied'      then 'refus_1_3'
  else visa_historique
end
where visa_historique is not null;

-- Left unconstrained until the Phase-1 rework, which makes this field
-- mandatory and adds the CHECK alongside the casier_judiciaire enum.

-- ---------------------------------------------------------------------------
-- Locale: add Arabic
-- ---------------------------------------------------------------------------

alter table svap.candidatures
  drop constraint if exists candidatures_locale_check;

alter table svap.candidatures
  add constraint candidatures_locale_check
  check (locale in ('fr','en','ar'));
