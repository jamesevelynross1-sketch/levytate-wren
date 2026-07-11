create extension if not exists "pgcrypto";

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.levytate_learner_records (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  employee_id text not null,
  application_id text not null default '',
  programme_id text not null default '',
  provider_id text not null default '',
  enrolment_id text not null default '',
  lifecycle_status text not null default 'pre_enrolment',
  employment_route text not null default 'not_confirmed',
  expected_start_date date,
  actual_start_date date,
  expected_end_date date,
  actual_end_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by text not null default '',
  updated_by text not null default '',
  record_status text not null default 'Active',
  demonstration_record boolean not null default false,
  primary key (organisation_id, id),
  constraint levytate_learner_records_lifecycle_status_check check (
    lifecycle_status in (
      'pre_enrolment',
      'enrolled',
      'break_in_learning',
      'withdrawn',
      'assessment_preparation',
      'in_assessment',
      'achieved',
      'completed_without_achievement'
    )
  ),
  constraint levytate_learner_records_employment_route_check check (
    employment_route in ('existing_employee_upskill', 'recruited_as_apprentice', 'not_confirmed')
  ),
  constraint levytate_learner_records_record_status_check check (record_status in ('Active', 'Archived'))
);

alter table public.levytate_learner_records
  add column if not exists application_id text not null default '',
  add column if not exists programme_id text not null default '',
  add column if not exists provider_id text not null default '',
  add column if not exists enrolment_id text not null default '',
  add column if not exists lifecycle_status text not null default 'pre_enrolment',
  add column if not exists employment_route text not null default 'not_confirmed',
  add column if not exists expected_start_date date,
  add column if not exists actual_start_date date,
  add column if not exists expected_end_date date,
  add column if not exists actual_end_date date,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists created_by text not null default '',
  add column if not exists updated_by text not null default '',
  add column if not exists record_status text not null default 'Active',
  add column if not exists demonstration_record boolean not null default false;

create unique index if not exists levytate_learner_records_active_application_idx
  on public.levytate_learner_records (organisation_id, application_id)
  where record_status = 'Active' and application_id <> '';

create index if not exists levytate_learner_records_employee_idx on public.levytate_learner_records (organisation_id, employee_id);
create index if not exists levytate_learner_records_status_idx on public.levytate_learner_records (organisation_id, lifecycle_status);
create index if not exists levytate_learner_records_enrolment_idx on public.levytate_learner_records (organisation_id, enrolment_id);

drop trigger if exists set_levytate_learner_records_updated_at on public.levytate_learner_records;
create trigger set_levytate_learner_records_updated_at
before update on public.levytate_learner_records
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_learner_eligibility_declarations (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  declaration_type text not null default 'england_working_hours',
  declaration_wording text not null,
  declaration_version text not null,
  confirmed boolean not null default false,
  confirmed_by_employee text not null default '',
  confirmed_at timestamptz,
  expected_england_working_hours_percentage numeric(5,2),
  verified_by text not null default '',
  verified_at timestamptz,
  verification_status text not null default 'not_confirmed',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_eligibility_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_learner_eligibility_type_check check (declaration_type in ('england_working_hours')),
  constraint levytate_learner_eligibility_status_check check (
    verification_status in ('not_confirmed', 'employee_confirmed', 'employer_verified', 'needs_review', 'not_eligible')
  ),
  constraint levytate_learner_eligibility_percentage_check check (
    expected_england_working_hours_percentage is null or
    (expected_england_working_hours_percentage >= 0 and expected_england_working_hours_percentage <= 100)
  )
);

create index if not exists levytate_learner_eligibility_record_idx on public.levytate_learner_eligibility_declarations (organisation_id, learner_record_id);
create index if not exists levytate_learner_eligibility_status_idx on public.levytate_learner_eligibility_declarations (organisation_id, verification_status);

drop trigger if exists set_levytate_learner_eligibility_updated_at on public.levytate_learner_eligibility_declarations;
create trigger set_levytate_learner_eligibility_updated_at
before update on public.levytate_learner_eligibility_declarations
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_learner_pre_enrolment_checks (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  probation_status text not null default 'awaiting_confirmation',
  probation_passed_date date,
  probation_confirmed_by text not null default '',
  probation_confirmed_at timestamptz,
  probation_notes text not null default '',
  hr_approval_status text not null default 'not_requested',
  hr_approved_date date,
  hr_approved_by text not null default '',
  hr_approval_notes text not null default '',
  guides_sent boolean not null default false,
  guides_sent_date date,
  guides_sent_by text not null default '',
  guides_version text not null default '',
  guides_notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_pre_enrolment_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_learner_pre_enrolment_probation_status_check check (
    probation_status in ('not_required', 'awaiting_confirmation', 'passed', 'not_passed', 'under_review')
  ),
  constraint levytate_learner_pre_enrolment_hr_status_check check (
    hr_approval_status in ('not_requested', 'awaiting_approval', 'approved', 'declined', 'more_information_required')
  )
);

create unique index if not exists levytate_learner_pre_enrolment_record_unique_idx
  on public.levytate_learner_pre_enrolment_checks (organisation_id, learner_record_id);

drop trigger if exists set_levytate_learner_pre_enrolment_updated_at on public.levytate_learner_pre_enrolment_checks;
create trigger set_levytate_learner_pre_enrolment_updated_at
before update on public.levytate_learner_pre_enrolment_checks
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_learner_breaks_in_learning (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  start_date date not null,
  expected_return_date date,
  actual_return_date date,
  reason_category text not null default '',
  reason_notes text not null default '',
  status text not null default 'active',
  recorded_by text not null default '',
  recorded_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_break_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_learner_break_status_check check (
    status in ('active', 'returned', 'converted_to_withdrawal', 'cancelled')
  )
);

create index if not exists levytate_learner_break_record_idx on public.levytate_learner_breaks_in_learning (organisation_id, learner_record_id);
create index if not exists levytate_learner_break_status_idx on public.levytate_learner_breaks_in_learning (organisation_id, status);

drop trigger if exists set_levytate_learner_break_updated_at on public.levytate_learner_breaks_in_learning;
create trigger set_levytate_learner_break_updated_at
before update on public.levytate_learner_breaks_in_learning
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_learner_withdrawals (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  withdrawal_date date not null,
  effective_date date,
  reason_category text not null default '',
  reason_notes text not null default '',
  initiated_by text not null default '',
  provider_notified boolean not null default false,
  provider_notified_date date,
  employee_notified boolean not null default false,
  employee_notified_date date,
  recorded_by text not null default '',
  recorded_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_withdrawal_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade
);

create index if not exists levytate_learner_withdrawal_record_idx on public.levytate_learner_withdrawals (organisation_id, learner_record_id);

create table if not exists public.levytate_learner_reviews (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  review_type text not null,
  review_date date not null,
  next_review_date date,
  reviewer_name text not null default '',
  reviewer_user_id text not null default '',
  provider_id text not null default '',
  summary text not null default '',
  actions jsonb not null default '[]'::jsonb,
  support_required text not null default '',
  status text not null default 'completed',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_review_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_learner_review_type_check check (
    review_type in ('provider_review', 'l_and_d_check_in', 'manager_check_in', 'other')
  ),
  constraint levytate_learner_review_status_check check (
    status in ('completed', 'scheduled', 'cancelled', 'action_required')
  )
);

create index if not exists levytate_learner_review_record_type_date_idx on public.levytate_learner_reviews (organisation_id, learner_record_id, review_type, review_date desc);
create index if not exists levytate_learner_review_provider_idx on public.levytate_learner_reviews (organisation_id, provider_id);

drop trigger if exists set_levytate_learner_reviews_updated_at on public.levytate_learner_reviews;
create trigger set_levytate_learner_reviews_updated_at
before update on public.levytate_learner_reviews
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_learner_progress_updates (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  update_date date not null,
  target_progress_percentage numeric(5,2) not null,
  actual_progress_percentage numeric(5,2) not null,
  variance_percentage numeric(5,2) not null,
  progress_source text not null,
  source_reference text not null default '',
  updated_by text not null default '',
  summary text not null default '',
  support_action text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_progress_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_learner_progress_target_check check (target_progress_percentage >= 0 and target_progress_percentage <= 100),
  constraint levytate_learner_progress_actual_check check (actual_progress_percentage >= 0 and actual_progress_percentage <= 100),
  constraint levytate_learner_progress_source_check check (
    progress_source in ('provider_report', 'provider_review', 'manual_l_and_d_update', 'integration', 'other')
  )
);

create index if not exists levytate_learner_progress_record_date_idx on public.levytate_learner_progress_updates (organisation_id, learner_record_id, update_date desc);

create table if not exists public.levytate_learner_assessment_readiness (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  assessment_model text not null default 'not_confirmed',
  expected_assessment_readiness_date date,
  actual_assessment_readiness_date date,
  gateway_date date,
  assessment_status text not null default 'not_started',
  assessment_organisation text not null default '',
  assessment_notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_assessment_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_learner_assessment_model_check check (
    assessment_model in ('end_point_assessment', 'integrated_assessment', 'other', 'not_confirmed')
  ),
  constraint levytate_learner_assessment_status_check check (
    assessment_status in ('not_started', 'preparing', 'readiness_confirmed', 'in_assessment', 'completed', 'unsuccessful', 'resit_required')
  )
);

create unique index if not exists levytate_learner_assessment_record_unique_idx
  on public.levytate_learner_assessment_readiness (organisation_id, learner_record_id);

drop trigger if exists set_levytate_learner_assessment_updated_at on public.levytate_learner_assessment_readiness;
create trigger set_levytate_learner_assessment_updated_at
before update on public.levytate_learner_assessment_readiness
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_learner_achievements (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  expected_achievement_date date,
  actual_achievement_date date,
  grade text not null default '',
  grade_type text not null default '',
  certificate_received boolean not null default false,
  certificate_received_date date,
  result_notes text not null default '',
  recorded_by text not null default '',
  recorded_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_achievement_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade
);

create unique index if not exists levytate_learner_achievement_record_unique_idx
  on public.levytate_learner_achievements (organisation_id, learner_record_id);

create table if not exists public.levytate_learner_operational_actions (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  action_type text not null,
  status text not null default 'not_started',
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by text not null default '',
  recipient_summary text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_action_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade,
  constraint levytate_learner_action_type_check check (
    action_type in ('guides_sent', 'hr_and_manager_assessment_email_sent', 'completion_email_sent', 'provider_notified', 'other')
  ),
  constraint levytate_learner_action_status_check check (
    status in ('not_started', 'scheduled', 'completed', 'cancelled')
  )
);

create index if not exists levytate_learner_action_record_type_idx on public.levytate_learner_operational_actions (organisation_id, learner_record_id, action_type);
create index if not exists levytate_learner_action_completed_idx on public.levytate_learner_operational_actions (organisation_id, completed);

drop trigger if exists set_levytate_learner_action_updated_at on public.levytate_learner_operational_actions;
create trigger set_levytate_learner_action_updated_at
before update on public.levytate_learner_operational_actions
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.levytate_learner_lifecycle_events (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  learner_record_id text not null,
  event_type text not null,
  previous_status text not null default '',
  new_status text not null default '',
  event_date timestamptz not null default timezone('utc', now()),
  actor_user_id text not null default '',
  actor_name text not null default '',
  source text not null default 'levytate',
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_learner_event_record_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete cascade
);

create index if not exists levytate_learner_event_record_date_idx on public.levytate_learner_lifecycle_events (organisation_id, learner_record_id, event_date desc);
create index if not exists levytate_learner_event_type_idx on public.levytate_learner_lifecycle_events (organisation_id, event_type);

alter table public.levytate_learner_records enable row level security;
alter table public.levytate_learner_eligibility_declarations enable row level security;
alter table public.levytate_learner_pre_enrolment_checks enable row level security;
alter table public.levytate_learner_breaks_in_learning enable row level security;
alter table public.levytate_learner_withdrawals enable row level security;
alter table public.levytate_learner_reviews enable row level security;
alter table public.levytate_learner_progress_updates enable row level security;
alter table public.levytate_learner_assessment_readiness enable row level security;
alter table public.levytate_learner_achievements enable row level security;
alter table public.levytate_learner_operational_actions enable row level security;
alter table public.levytate_learner_lifecycle_events enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'levytate_learner_records',
    'levytate_learner_eligibility_declarations',
    'levytate_learner_pre_enrolment_checks',
    'levytate_learner_breaks_in_learning',
    'levytate_learner_withdrawals',
    'levytate_learner_reviews',
    'levytate_learner_progress_updates',
    'levytate_learner_assessment_readiness',
    'levytate_learner_achievements',
    'levytate_learner_operational_actions',
    'levytate_learner_lifecycle_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_service_role_all', table_name);
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      table_name || '_service_role_all',
      table_name
    );
  end loop;
end $$;
