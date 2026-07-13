create table if not exists public.levytate_operational_actions (
  organisation_id uuid not null,
  id text not null,
  learner_record_id text not null,
  application_id text not null default '',
  employee_id text not null default '',
  source_type text not null,
  source_key text not null,
  action_type text not null,
  title text not null,
  description text not null default '',
  priority text not null,
  priority_rank integer not null,
  status text not null default 'open',
  owner_type text not null,
  owner_user_id text not null default '',
  owner_display_name text not null default '',
  due_date date,
  detected_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  acknowledged_by text not null default '',
  started_at timestamptz,
  started_by text not null default '',
  completed_at timestamptz,
  completed_by text not null default '',
  completion_method text not null default '',
  completion_note text not null default '',
  dismissed_at timestamptz,
  dismissed_by text not null default '',
  dismissal_reason text not null default '',
  source_url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_operational_actions_learner_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_operational_actions_source_type_check check (source_type in (
    'lifecycle_rule', 'application_workflow', 'pre_enrolment_readiness', 'progress_exception',
    'review_due', 'break_in_learning', 'operational_communication', 'manual_system_correction'
  )),
  constraint levytate_operational_actions_action_type_check check (action_type in (
    'complete_employee_declaration', 'verify_england_working_hours', 'confirm_probation', 'obtain_hr_approval',
    'confirm_programme', 'confirm_provider', 'complete_pre_enrolment', 'complete_enrolment',
    'record_provider_review', 'record_l_and_d_check_in', 'record_manager_check_in', 'add_progress_update',
    'address_progress_exception', 'manage_break_in_learning', 'confirm_return_date', 'return_learner',
    'record_post_return_review', 'send_guides', 'resolve_lifecycle_inconsistency'
  )),
  constraint levytate_operational_actions_priority_check check (priority in ('Critical', 'High', 'Medium', 'Low', 'Informational')),
  constraint levytate_operational_actions_status_check check (status in ('open', 'acknowledged', 'in_progress', 'completed', 'dismissed', 'cancelled')),
  constraint levytate_operational_actions_owner_type_check check (owner_type in ('Employee', 'Line Manager', 'Apprenticeship Lead', 'HR', 'Provider', 'Shared')),
  constraint levytate_operational_actions_completion_method_check check (completion_method in ('', 'source_condition_resolved', 'user_completed', 'dismissed', 'system_cancelled')),
  constraint levytate_operational_actions_version_check check (version > 0)
);

alter table public.levytate_operational_actions
  add column if not exists priority_rank integer not null default 4,
  add column if not exists started_at timestamptz,
  add column if not exists started_by text not null default '',
  add column if not exists version integer not null default 1;

create unique index if not exists levytate_operational_actions_active_source_idx
  on public.levytate_operational_actions (organisation_id, source_key)
  where status in ('open', 'acknowledged', 'in_progress');
create index if not exists levytate_operational_actions_org_status_idx
  on public.levytate_operational_actions (organisation_id, status, priority_rank, detected_at desc);
create index if not exists levytate_operational_actions_learner_idx
  on public.levytate_operational_actions (organisation_id, learner_record_id, created_at desc);
create index if not exists levytate_operational_actions_due_idx
  on public.levytate_operational_actions (organisation_id, due_date)
  where status in ('open', 'acknowledged', 'in_progress') and due_date is not null;

drop trigger if exists set_levytate_operational_actions_updated_at on public.levytate_operational_actions;
create trigger set_levytate_operational_actions_updated_at
before update on public.levytate_operational_actions
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_operational_action_events (
  organisation_id uuid not null,
  id text not null,
  operational_action_id text not null,
  event_type text not null,
  previous_status text not null default '',
  new_status text not null default '',
  actor_user_id text not null default '',
  actor_name text not null default '',
  event_date timestamptz not null default timezone('utc', now()),
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_operational_action_events_action_fk foreign key (organisation_id, operational_action_id)
    references public.levytate_operational_actions (organisation_id, id) on delete cascade,
  constraint levytate_operational_action_events_type_check check (event_type in (
    'detected', 'priority_changed', 'owner_changed', 'due_date_changed', 'acknowledged', 'started',
    'completed', 'dismissed', 'cancelled', 'regenerated'
  )),
  constraint levytate_operational_action_events_previous_status_check check (previous_status in ('', 'open', 'acknowledged', 'in_progress', 'completed', 'dismissed', 'cancelled')),
  constraint levytate_operational_action_events_new_status_check check (new_status in ('', 'open', 'acknowledged', 'in_progress', 'completed', 'dismissed', 'cancelled'))
);

create index if not exists levytate_operational_action_events_action_idx
  on public.levytate_operational_action_events (organisation_id, operational_action_id, event_date desc);
create index if not exists levytate_operational_action_events_org_date_idx
  on public.levytate_operational_action_events (organisation_id, event_date desc);

alter table public.levytate_operational_actions enable row level security;
alter table public.levytate_operational_action_events enable row level security;

drop policy if exists levytate_operational_actions_service_role_all on public.levytate_operational_actions;
create policy levytate_operational_actions_service_role_all on public.levytate_operational_actions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists levytate_operational_action_events_service_role_all on public.levytate_operational_action_events;
create policy levytate_operational_action_events_service_role_all on public.levytate_operational_action_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
