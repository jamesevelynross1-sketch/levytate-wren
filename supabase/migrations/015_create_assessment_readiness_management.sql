alter table public.levytate_learner_assessment_readiness
  add column if not exists assessment_model_explanation text not null default '',
  add column if not exists expected_assessment_start_date date,
  add column if not exists assessment_start_date date,
  add column if not exists assessment_contact text not null default '',
  add column if not exists assessment_reference text not null default '',
  add column if not exists confirmations jsonb not null default '{}'::jsonb,
  add column if not exists readiness_confirmed_by text not null default '',
  add column if not exists readiness_confirmed_at timestamptz,
  add column if not exists updated_by text not null default '',
  add column if not exists version integer not null default 1;

alter table public.levytate_learner_assessment_readiness
  drop constraint if exists levytate_learner_assessment_version_check;

alter table public.levytate_learner_assessment_readiness
  add constraint levytate_learner_assessment_version_check check (version > 0);

create index if not exists levytate_learner_assessment_status_date_idx
  on public.levytate_learner_assessment_readiness (
    organisation_id,
    assessment_status,
    expected_assessment_readiness_date
  );
