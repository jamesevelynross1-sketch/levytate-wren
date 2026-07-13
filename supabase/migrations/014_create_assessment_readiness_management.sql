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

alter table public.levytate_operational_actions
  drop constraint if exists levytate_operational_actions_source_type_check;

alter table public.levytate_operational_actions
  add constraint levytate_operational_actions_source_type_check check (source_type in (
    'lifecycle_rule', 'application_workflow', 'pre_enrolment_readiness', 'progress_exception',
    'review_due', 'break_in_learning', 'assessment_readiness', 'operational_communication',
    'manual_system_correction'
  ));

alter table public.levytate_operational_actions
  drop constraint if exists levytate_operational_actions_action_type_check;

alter table public.levytate_operational_actions
  add constraint levytate_operational_actions_action_type_check check (action_type in (
    'complete_employee_declaration', 'verify_england_working_hours', 'confirm_probation', 'obtain_hr_approval',
    'confirm_programme', 'confirm_provider', 'complete_pre_enrolment', 'complete_enrolment',
    'record_provider_review', 'record_l_and_d_check_in', 'record_manager_check_in', 'add_progress_update',
    'address_progress_exception', 'manage_break_in_learning', 'confirm_return_date', 'return_learner',
    'record_post_return_review', 'send_guides', 'resolve_lifecycle_inconsistency',
    'confirm_assessment_model', 'confirm_assessment_organisation', 'complete_assessment_readiness',
    'obtain_provider_readiness_confirmation', 'obtain_manager_readiness_confirmation',
    'obtain_learner_readiness_confirmation', 'record_gateway', 'move_learner_to_assessment'
  ));
