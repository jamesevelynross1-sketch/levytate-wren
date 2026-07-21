alter table public.levytate_operational_actions
  alter column learner_record_id drop not null;

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
    'obtain_learner_readiness_confirmation', 'record_gateway', 'move_learner_to_assessment',
    'review_application'
  ));
