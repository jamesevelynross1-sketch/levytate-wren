-- LevyTate Learning Time / Off-the-Job Assistant V1.
-- Additive, capability-off by default, and service-role only. This migration
-- does not infer plans or activities for existing learners.

alter table public.levytate_organisation_capabilities
  add column if not exists off_the_job_assistant_enabled boolean not null default false;

comment on column public.levytate_organisation_capabilities.off_the_job_assistant_enabled is
  'Server-owned capability for Learning Time and the Off-the-Job Assistant. Defaults off.';

-- Extend the existing Autopilot vocabulary without changing existing signal rows.
alter table public.levytate_intelligence_signals
  drop constraint if exists levytate_intelligence_signals_category_check,
  drop constraint if exists levytate_intelligence_signals_type_check;
alter table public.levytate_intelligence_signals
  add constraint levytate_intelligence_signals_category_check check (
    category in ('risk','action','quality','pattern','opportunity','reviews','actions','manager_actions','applications','provider_dependencies','learning_time')
  ),
  add constraint levytate_intelligence_signals_type_check check (
    signal_type in (
      'repeated_workplace_blocker','progress_deterioration','repeated_unresolved_action','manager_support_required',
      'provider_action_required','review_progress_inconsistency','repeated_support_requirement','escalating_pattern',
      'assessment_or_completion_opportunity','review_overdue','review_due_with_outstanding_actions','review_upcoming',
      'operational_action_overdue','manager_action_overdue','manager_action_due_soon','application_stalled',
      'application_awaiting_manager','application_awaiting_provider','provider_dependency_overdue',
      'otj_plan_missing','otj_activity_needs_information','otj_submission_awaiting_employer_check',
      'otj_provider_confirmation_pending','otj_working_hours_clarification','otj_no_recent_activity'
    )
  );

create table if not exists public.levytate_standard_otj_requirements (
  id uuid primary key default gen_random_uuid(),
  standard_id text not null,
  standard_version text not null,
  policy_effective_from date not null,
  minimum_minutes integer not null check (minimum_minutes > 0),
  source_url text not null check (source_url ~ '^https://skillsengland\.education\.gov\.uk/'),
  source_updated_at date,
  synced_at timestamptz not null default timezone('utc', now()),
  source_status text not null check (source_status in ('verified', 'needs_review', 'unavailable')),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  unique (standard_id, standard_version, policy_effective_from),
  unique (standard_id, standard_version, id)
);

create table if not exists public.levytate_otj_plans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  learner_record_id text not null,
  status text not null default 'not_configured' check (status in ('not_configured', 'draft', 'published', 'needs_review', 'closed')),
  current_published_version_id uuid,
  created_by uuid references public.levytate_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, learner_record_id),
  unique (organisation_id, id),
  foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_otj_plan_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  plan_id uuid not null,
  version_number integer not null check (version_number > 0),
  policy_regime text not null check (policy_regime in ('legacy_percentage', 'standard_minimum')),
  original_apprenticeship_start_date date not null,
  practical_period_start_date date not null,
  practical_period_end_date date not null,
  standard_id text not null,
  standard_version text not null,
  standard_requirement_id uuid,
  published_standard_minimum_minutes integer check (published_standard_minimum_minutes is null or published_standard_minimum_minutes > 0),
  legacy_indicative_minimum_minutes integer check (legacy_indicative_minimum_minutes is null or legacy_indicative_minimum_minutes >= 0),
  prior_learning_reduction_minutes integer not null default 0 check (prior_learning_reduction_minutes >= 0),
  individual_minimum_minutes integer not null check (individual_minimum_minutes >= 0),
  planned_delivery_minutes integer not null check (planned_delivery_minutes >= individual_minimum_minutes),
  provider_id text not null,
  training_plan_reference text not null check (char_length(btrim(training_plan_reference)) between 1 and 500),
  source_type text not null check (source_type in ('provider_training_plan', 'provider_email', 'provider_review', 'mis_lms_import', 'provider_api', 'other_documented_source')),
  source_date date not null,
  inactivity_attention_days integer not null default 28 check (inactivity_attention_days between 7 and 365),
  notes text not null default '' check (char_length(notes) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  published_by uuid references public.levytate_users(id) on delete set null,
  published_at timestamptz,
  created_by uuid references public.levytate_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, version_number),
  unique (organisation_id, id),
  unique (organisation_id, plan_id, id),
  foreign key (organisation_id, plan_id) references public.levytate_otj_plans(organisation_id, id) on delete restrict,
  foreign key (standard_id, standard_version, standard_requirement_id)
    references public.levytate_standard_otj_requirements(standard_id, standard_version, id) on delete restrict,
  check (practical_period_end_date >= practical_period_start_date),
  check (
    (original_apprenticeship_start_date <= date '2025-07-31' and policy_regime = 'legacy_percentage')
    or (original_apprenticeship_start_date >= date '2025-08-01' and policy_regime = 'standard_minimum')
  ),
  check ((policy_regime = 'legacy_percentage') or published_standard_minimum_minutes is not null),
  check ((policy_regime = 'standard_minimum') or legacy_indicative_minimum_minutes is not null),
  check ((policy_regime = 'legacy_percentage') or individual_minimum_minutes >= greatest(11220, published_standard_minimum_minutes - prior_learning_reduction_minutes)),
  check ((status = 'published' and published_at is not null and published_by is not null) or status <> 'published')
);

alter table public.levytate_otj_plans
  drop constraint if exists levytate_otj_plans_current_published_version_fk;
alter table public.levytate_otj_plans
  add constraint levytate_otj_plans_current_published_version_fk
  foreign key (organisation_id, id, current_published_version_id)
  references public.levytate_otj_plan_versions(organisation_id, plan_id, id) on delete restrict;

create unique index if not exists levytate_otj_plan_versions_one_draft_idx
  on public.levytate_otj_plan_versions(plan_id) where status = 'draft';
create index if not exists levytate_otj_plan_versions_org_status_idx
  on public.levytate_otj_plan_versions(organisation_id, status, created_at desc);

create table if not exists public.levytate_otj_learning_priorities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  learner_record_id text not null,
  plan_version_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 180),
  description text not null default '' check (char_length(description) <= 2000),
  ksb_references jsonb not null default '[]'::jsonb check (jsonb_typeof(ksb_references) = 'array'),
  source_type text not null check (source_type in ('provider_training_plan', 'provider_review', 'employer_priority', 'learner_goal', 'manager_workplace_opportunity', 'mis_lms_import')),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 500),
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'superseded')),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, learner_record_id) references public.levytate_learner_records(organisation_id, id) on delete restrict,
  foreign key (organisation_id, plan_version_id) references public.levytate_otj_plan_versions(organisation_id, id) on delete restrict
);

create index if not exists levytate_otj_priorities_learner_idx
  on public.levytate_otj_learning_priorities(organisation_id, learner_record_id, status, target_date);

create table if not exists public.levytate_otj_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  learner_record_id text not null,
  plan_version_id uuid not null,
  activity_date date not null,
  started_at time not null,
  ended_at time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  timezone text not null default 'Europe/London' check (char_length(timezone) between 1 and 80),
  category text not null check (category in (
    'provider_workshop','theory_teaching','practical_training','structured_shadowing','mentoring_or_coaching',
    'industry_visit','learning_support','assignment_or_project_writing','research','revision',
    'structured_online_learning','employer_delivered_training','other_eligible_learning',
    'initial_assessment','onboarding','standalone_english_or_maths','progress_review','examination',
    'testing_or_assessment','routine_productive_work','unrelated_mandatory_training','training_unrelated_to_standard',
    'repeated_practice','outside_hours_uncompensated','travel_without_learning',
    'epa_resit_preparation_after_requirement','other_ineligible_activity'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text not null check (char_length(btrim(description)) between 1 and 4000),
  what_was_new text not null default '' check (char_length(what_was_new) <= 3000),
  standard_relevance text not null default '' check (char_length(standard_relevance) <= 3000),
  reflection text not null default '' check (char_length(reflection) <= 3000),
  working_hours_basis text not null check (working_hours_basis in ('within_normal_working_hours','paid_exception','time_off_in_lieu_exception','outside_working_hours_uncompensated','not_confirmed')),
  compensation_note text not null default '' check (char_length(compensation_note) <= 1000),
  separate_from_productive_work boolean,
  ksb_references jsonb not null default '[]'::jsonb check (jsonb_typeof(ksb_references) = 'array'),
  evidence_reference text not null default '' check (char_length(evidence_reference) <= 1000),
  deterministic_outcome text not null check (deterministic_outcome in ('likely_eligible','needs_clarification','likely_ineligible')),
  deterministic_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(deterministic_reasons) = 'array'),
  status text not null default 'draft' check (status in ('draft','submitted','needs_information','employer_checked','not_counted','withdrawn')),
  created_by_user_id uuid not null references public.levytate_users(id) on delete restrict,
  created_by_email text not null,
  submitted_at timestamptz,
  lock_version integer not null default 0 check (lock_version >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, learner_record_id) references public.levytate_learner_records(organisation_id, id) on delete restrict,
  foreign key (organisation_id, plan_version_id) references public.levytate_otj_plan_versions(organisation_id, id) on delete restrict,
  check ((working_hours_basis not in ('paid_exception','time_off_in_lieu_exception')) or btrim(compensation_note) <> ''),
  check ((status = 'draft' and submitted_at is null) or (status <> 'draft' and submitted_at is not null))
);

create unique index if not exists levytate_otj_activities_exact_candidate_unique_idx
  on public.levytate_otj_activities(organisation_id, learner_record_id, activity_date, started_at, ended_at, lower(title))
  where status not in ('withdrawn', 'not_counted');
create index if not exists levytate_otj_activities_learner_status_idx
  on public.levytate_otj_activities(organisation_id, learner_record_id, status, activity_date desc);
create index if not exists levytate_otj_activities_review_idx
  on public.levytate_otj_activities(organisation_id, status, submitted_at) where status in ('submitted','needs_information','employer_checked');

create table if not exists public.levytate_otj_activity_confirmations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  activity_id uuid not null,
  outcome text not null check (outcome in ('confirmed','partially_confirmed','not_confirmed','superseded')),
  confirmed_minutes integer not null check (confirmed_minutes >= 0),
  confirmation_source_type text not null check (confirmation_source_type in ('provider_report','provider_email','provider_review','mis_lms_import','provider_api','other_documented_provider_evidence')),
  provider_id text not null,
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 1000),
  source_date date not null,
  recorded_by uuid not null references public.levytate_users(id) on delete restrict,
  recorded_at timestamptz not null default timezone('utc', now()),
  note text not null default '' check (char_length(note) <= 2000),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  unique (organisation_id, activity_id, idempotency_key),
  unique (organisation_id, id),
  foreign key (organisation_id, activity_id) references public.levytate_otj_activities(organisation_id, id) on delete restrict,
  check ((outcome in ('not_confirmed','superseded') and confirmed_minutes = 0) or (outcome in ('confirmed','partially_confirmed') and confirmed_minutes > 0))
);

create index if not exists levytate_otj_confirmations_activity_idx
  on public.levytate_otj_activity_confirmations(organisation_id, activity_id, recorded_at desc);

create table if not exists public.levytate_otj_activity_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  activity_id uuid not null,
  event_type text not null check (event_type in ('draft_created','draft_updated','assistant_assessment_completed','submitted','information_requested','employee_resubmitted','employer_checked','provider_confirmation_recorded','marked_not_counted','withdrawn')),
  actor_user_id uuid not null references public.levytate_users(id) on delete restrict,
  actor_role text not null check (actor_role in ('Employee','Line Manager','Apprenticeship Lead','Employer Admin')),
  previous_state text,
  new_state text not null,
  safe_summary text not null default '' check (char_length(safe_summary) <= 1000),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, activity_id, idempotency_key),
  foreign key (organisation_id, activity_id) references public.levytate_otj_activities(organisation_id, id) on delete restrict
);

create index if not exists levytate_otj_events_activity_idx
  on public.levytate_otj_activity_events(organisation_id, activity_id, created_at);

create or replace function public.levytate_enforce_otj_learner_plan_link()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1
    from public.levytate_otj_plan_versions version
    join public.levytate_otj_plans plan
      on plan.organisation_id = version.organisation_id
     and plan.id = version.plan_id
    where version.organisation_id = new.organisation_id
      and version.id = new.plan_version_id
      and plan.learner_record_id = new.learner_record_id
  ) then
    raise exception 'Learning-time record must use a plan version for the same learner';
  end if;
  return new;
end;
$$;

drop trigger if exists levytate_otj_priorities_learner_plan_link on public.levytate_otj_learning_priorities;
create trigger levytate_otj_priorities_learner_plan_link
  before insert or update of organisation_id, learner_record_id, plan_version_id
  on public.levytate_otj_learning_priorities
  for each row execute function public.levytate_enforce_otj_learner_plan_link();

drop trigger if exists levytate_otj_activities_learner_plan_link on public.levytate_otj_activities;
create trigger levytate_otj_activities_learner_plan_link
  before insert or update of organisation_id, learner_record_id, plan_version_id
  on public.levytate_otj_activities
  for each row execute function public.levytate_enforce_otj_learner_plan_link();

create or replace function public.levytate_set_otj_activity_duration()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_minutes integer;
begin
  v_minutes := floor(extract(epoch from (new.ended_at - new.started_at)) / 60)::integer - new.break_minutes;
  if v_minutes <= 0 then raise exception 'Activity duration must be positive after breaks'; end if;
  new.duration_minutes := v_minutes;
  return new;
end;
$$;

drop trigger if exists levytate_otj_activity_duration_server_owned on public.levytate_otj_activities;
create trigger levytate_otj_activity_duration_server_owned
  before insert or update of started_at, ended_at, break_minutes on public.levytate_otj_activities
  for each row execute function public.levytate_set_otj_activity_duration();

create or replace function public.levytate_protect_otj_plan_version()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status = 'published' and new.status = 'superseded' and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then return new; end if;
  if old.status <> 'draft' then raise exception 'Published learning-time plan versions are immutable'; end if;
  if new.id is distinct from old.id or new.organisation_id is distinct from old.organisation_id
    or new.plan_id is distinct from old.plan_id or new.version_number is distinct from old.version_number
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
  then raise exception 'Learning-time plan version identity is immutable'; end if;
  return new;
end;
$$;

drop trigger if exists levytate_otj_plan_versions_immutable on public.levytate_otj_plan_versions;
create trigger levytate_otj_plan_versions_immutable before update on public.levytate_otj_plan_versions
  for each row execute function public.levytate_protect_otj_plan_version();

create or replace function public.levytate_protect_otj_activity()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id is distinct from old.id or new.organisation_id is distinct from old.organisation_id
    or new.learner_record_id is distinct from old.learner_record_id or new.plan_version_id is distinct from old.plan_version_id
    or new.created_by_user_id is distinct from old.created_by_user_id or new.created_at is distinct from old.created_at
  then raise exception 'Learning-time activity identity is immutable'; end if;
  if old.status not in ('draft','needs_information') and (
    new.activity_date is distinct from old.activity_date or new.started_at is distinct from old.started_at
    or new.ended_at is distinct from old.ended_at or new.break_minutes is distinct from old.break_minutes
    or new.category is distinct from old.category or new.title is distinct from old.title
    or new.description is distinct from old.description or new.what_was_new is distinct from old.what_was_new
    or new.standard_relevance is distinct from old.standard_relevance or new.reflection is distinct from old.reflection
    or new.working_hours_basis is distinct from old.working_hours_basis
    or new.compensation_note is distinct from old.compensation_note
    or new.separate_from_productive_work is distinct from old.separate_from_productive_work
    or new.ksb_references is distinct from old.ksb_references or new.evidence_reference is distinct from old.evidence_reference
  ) then raise exception 'Submitted activity evidence is locked; use the controlled information-return workflow'; end if;
  return new;
end;
$$;

drop trigger if exists levytate_otj_activities_protected on public.levytate_otj_activities;
create trigger levytate_otj_activities_protected before update on public.levytate_otj_activities
  for each row execute function public.levytate_protect_otj_activity();

create or replace function public.levytate_reject_otj_append_only_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$ begin raise exception 'Learning-time audit and confirmation records are append-only'; end; $$;

drop trigger if exists levytate_otj_confirmations_append_only on public.levytate_otj_activity_confirmations;
create trigger levytate_otj_confirmations_append_only before update or delete on public.levytate_otj_activity_confirmations
  for each row execute function public.levytate_reject_otj_append_only_mutation();
drop trigger if exists levytate_otj_events_append_only on public.levytate_otj_activity_events;
create trigger levytate_otj_events_append_only before update or delete on public.levytate_otj_activity_events
  for each row execute function public.levytate_reject_otj_append_only_mutation();

create or replace function public.levytate_publish_otj_plan(
  p_organisation_id uuid, p_version_id uuid, p_actor_user_id uuid
) returns setof public.levytate_otj_plan_versions
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_version public.levytate_otj_plan_versions%rowtype;
begin
  if not exists (
    select 1 from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id
      and active = true and role in ('Apprenticeship Lead','Employer Admin')
  ) then raise exception 'Actor is not authorised to publish learning-time plans'; end if;
  select * into v_version from public.levytate_otj_plan_versions
    where id = p_version_id and organisation_id = p_organisation_id and status = 'draft' for update;
  if not found then raise exception 'Draft learning-time plan version not found'; end if;
  if v_version.policy_regime = 'standard_minimum'
    and v_version.individual_minimum_minutes < greatest(11220, v_version.published_standard_minimum_minutes - v_version.prior_learning_reduction_minutes)
  then
    raise exception 'Adjusted post-August-2025 minimum cannot be below the applicable standard minimum after prior-learning reduction or the current 187-hour floor';
  end if;
  update public.levytate_otj_plan_versions set status = 'superseded'
    where plan_id = v_version.plan_id and status = 'published';
  update public.levytate_otj_plan_versions
    set status = 'published', published_by = p_actor_user_id, published_at = timezone('utc', now())
    where id = p_version_id returning * into v_version;
  update public.levytate_otj_plans
    set current_published_version_id = p_version_id, status = 'published', updated_at = timezone('utc', now())
    where id = v_version.plan_id and organisation_id = p_organisation_id;
  return next v_version;
end;
$$;

create or replace function public.levytate_submit_otj_activity(
  p_organisation_id uuid, p_activity_id uuid, p_actor_user_id uuid,
  p_idempotency_key text, p_expected_lock_version integer
) returns setof public.levytate_otj_activities
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_activity public.levytate_otj_activities%rowtype; v_actor public.levytate_users%rowtype; v_previous text;
begin
  if exists (select 1 from public.levytate_otj_activity_events where organisation_id = p_organisation_id and activity_id = p_activity_id and idempotency_key = p_idempotency_key) then
    return query select * from public.levytate_otj_activities where organisation_id = p_organisation_id and id = p_activity_id; return;
  end if;
  select * into v_actor from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
  select * into v_activity from public.levytate_otj_activities where id = p_activity_id and organisation_id = p_organisation_id for update;
  if v_actor.id is null or v_actor.role <> 'Employee' or v_activity.id is null or v_activity.created_by_user_id <> p_actor_user_id then raise exception 'Only the activity owner may submit it'; end if;
  if v_activity.status not in ('draft','needs_information') then raise exception 'Activity is not available for submission'; end if;
  if v_activity.lock_version <> p_expected_lock_version then raise exception 'Activity changed; refresh before trying again'; end if;
  if v_activity.deterministic_outcome = 'likely_ineligible' then raise exception 'Likely ineligible activity must be saved as a non-counted learning note'; end if;
  v_previous := v_activity.status;
  update public.levytate_otj_activities set status = 'submitted', submitted_at = coalesce(submitted_at, timezone('utc', now())),
    lock_version = lock_version + 1, updated_at = timezone('utc', now()) where id = p_activity_id returning * into v_activity;
  insert into public.levytate_otj_activity_events(organisation_id, activity_id, event_type, actor_user_id, actor_role, previous_state, new_state, safe_summary, idempotency_key)
    values (p_organisation_id, p_activity_id, case when v_previous = 'draft' then 'submitted' else 'employee_resubmitted' end,
      p_actor_user_id, v_actor.role, v_previous, 'submitted',
      'Candidate learning activity submitted for employer check.', p_idempotency_key);
  return next v_activity;
end;
$$;

create or replace function public.levytate_transition_otj_activity(
  p_organisation_id uuid, p_activity_id uuid, p_actor_user_id uuid,
  p_action text, p_safe_summary text, p_idempotency_key text, p_expected_lock_version integer
) returns setof public.levytate_otj_activities
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_activity public.levytate_otj_activities%rowtype; v_actor public.levytate_users%rowtype; v_next text; v_event text; v_previous text; v_existing_event text; v_existing_summary text;
begin
  select event_type, safe_summary into v_existing_event, v_existing_summary
    from public.levytate_otj_activity_events
    where organisation_id = p_organisation_id and activity_id = p_activity_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_event is distinct from (case p_action
      when 'withdraw' then 'withdrawn'
      when 'request_information' then 'information_requested'
      when 'employer_check' then 'employer_checked'
      when 'mark_not_counted' then 'marked_not_counted'
      else null end)
      or v_existing_summary is distinct from left(coalesce(p_safe_summary,''),1000)
    then raise exception 'Conflicting learning-time idempotency key'; end if;
    return query select * from public.levytate_otj_activities where organisation_id = p_organisation_id and id = p_activity_id; return;
  end if;
  select * into v_actor from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
  select * into v_activity from public.levytate_otj_activities where id = p_activity_id and organisation_id = p_organisation_id for update;
  if v_actor.id is null or v_activity.id is null then raise exception 'Actor or activity is unavailable'; end if;
  if v_activity.lock_version <> p_expected_lock_version then raise exception 'Activity changed; refresh before trying again'; end if;
  v_previous := v_activity.status;
  if p_action = 'withdraw' and v_actor.role = 'Employee' and v_activity.created_by_user_id = p_actor_user_id and v_activity.status in ('submitted','needs_information') then v_next := 'withdrawn'; v_event := 'withdrawn';
  elsif p_action = 'request_information' and v_actor.role in ('Apprenticeship Lead','Employer Admin') and v_activity.status = 'submitted' then v_next := 'needs_information'; v_event := 'information_requested';
  elsif p_action = 'employer_check' and v_actor.role in ('Apprenticeship Lead','Employer Admin') and v_activity.status = 'submitted' then v_next := 'employer_checked'; v_event := 'employer_checked';
  elsif p_action = 'mark_not_counted' and v_actor.role in ('Apprenticeship Lead','Employer Admin') and v_activity.status in ('submitted','needs_information','employer_checked') then v_next := 'not_counted'; v_event := 'marked_not_counted';
  else raise exception 'The requested learning-time transition is not permitted'; end if;
  update public.levytate_otj_activities set status = v_next, lock_version = lock_version + 1, updated_at = timezone('utc', now())
    where id = p_activity_id returning * into v_activity;
  insert into public.levytate_otj_activity_events(organisation_id, activity_id, event_type, actor_user_id, actor_role, previous_state, new_state, safe_summary, idempotency_key)
    values (p_organisation_id, p_activity_id, v_event, p_actor_user_id, v_actor.role, v_previous, v_next, left(coalesce(p_safe_summary,''),1000), p_idempotency_key);
  return next v_activity;
end;
$$;

create or replace function public.levytate_record_otj_confirmation(
  p_organisation_id uuid, p_activity_id uuid, p_actor_user_id uuid,
  p_outcome text, p_confirmed_minutes integer, p_source_type text, p_provider_id text,
  p_source_reference text, p_source_date date, p_note text, p_idempotency_key text
) returns setof public.levytate_otj_activity_confirmations
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_activity public.levytate_otj_activities%rowtype; v_confirmation public.levytate_otj_activity_confirmations%rowtype; v_role text; v_expected_provider_id text;
begin
  select * into v_confirmation from public.levytate_otj_activity_confirmations
    where organisation_id = p_organisation_id and activity_id = p_activity_id and idempotency_key = p_idempotency_key;
  if found then
    if v_confirmation.outcome is distinct from p_outcome
      or v_confirmation.confirmed_minutes is distinct from p_confirmed_minutes
      or v_confirmation.confirmation_source_type is distinct from p_source_type
      or v_confirmation.provider_id is distinct from p_provider_id
      or v_confirmation.source_reference is distinct from left(p_source_reference,1000)
      or v_confirmation.source_date is distinct from p_source_date
      or v_confirmation.recorded_by is distinct from p_actor_user_id
      or v_confirmation.note is distinct from left(coalesce(p_note,''),2000)
    then raise exception 'Conflicting learning-time confirmation idempotency key'; end if;
    return next v_confirmation; return;
  end if;
  select role into v_role from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
  if v_role not in ('Apprenticeship Lead','Employer Admin') then raise exception 'Actor cannot record provider confirmation'; end if;
  select * into v_activity from public.levytate_otj_activities where id = p_activity_id and organisation_id = p_organisation_id for update;
  if v_activity.id is null or v_activity.status not in ('submitted','employer_checked') then raise exception 'Activity is unavailable for provider confirmation'; end if;
  select provider_id into v_expected_provider_id from public.levytate_learner_records
    where organisation_id = p_organisation_id and id = v_activity.learner_record_id;
  if v_expected_provider_id is null or p_provider_id is distinct from v_expected_provider_id then raise exception 'Provider confirmation must match the learner provider'; end if;
  if p_confirmed_minutes < 0 or p_confirmed_minutes > v_activity.duration_minutes then raise exception 'Confirmed minutes cannot exceed candidate activity duration'; end if;
  insert into public.levytate_otj_activity_confirmations(organisation_id, activity_id, outcome, confirmed_minutes, confirmation_source_type, provider_id, source_reference, source_date, recorded_by, note, idempotency_key)
    values (p_organisation_id, p_activity_id, p_outcome, p_confirmed_minutes, p_source_type, p_provider_id, left(p_source_reference,1000), p_source_date, p_actor_user_id, left(coalesce(p_note,''),2000), p_idempotency_key)
    returning * into v_confirmation;
  insert into public.levytate_otj_activity_events(organisation_id, activity_id, event_type, actor_user_id, actor_role, previous_state, new_state, safe_summary, idempotency_key)
    values (p_organisation_id, p_activity_id, 'provider_confirmation_recorded', p_actor_user_id, v_role, v_activity.status, v_activity.status,
      'Provider confirmation recorded from an attributable source.', left(p_idempotency_key || ':event', 128));
  return next v_confirmation;
end;
$$;

insert into public.levytate_standard_otj_requirements
  (standard_id, standard_version, policy_effective_from, minimum_minutes, source_url, source_updated_at, source_status, source_metadata)
values
  ('ST1512', '2.1', '2025-08-01', 25200, 'https://skillsengland.education.gov.uk/apprenticeships/st1512-v2-1', '2026-05-22', 'needs_review', '{"title":"Artificial intelligence (AI) and automation practitioner","reviewedHours":420,"reviewReason":"Official page markup requires an attributable reliable parser before automatic verification."}'::jsonb),
  ('ST0118', '1.1', '2025-08-01', 22200, 'https://skillsengland.education.gov.uk/apprenticeship-standards/st0118-v1-1', '2021-06-01', 'verified', '{"title":"Data analyst","officialHours":370}'::jsonb)
on conflict (standard_id, standard_version, policy_effective_from) do nothing;

alter table public.levytate_standard_otj_requirements enable row level security;
alter table public.levytate_standard_otj_requirements force row level security;
alter table public.levytate_otj_plans enable row level security;
alter table public.levytate_otj_plans force row level security;
alter table public.levytate_otj_plan_versions enable row level security;
alter table public.levytate_otj_plan_versions force row level security;
alter table public.levytate_otj_learning_priorities enable row level security;
alter table public.levytate_otj_learning_priorities force row level security;
alter table public.levytate_otj_activities enable row level security;
alter table public.levytate_otj_activities force row level security;
alter table public.levytate_otj_activity_confirmations enable row level security;
alter table public.levytate_otj_activity_confirmations force row level security;
alter table public.levytate_otj_activity_events enable row level security;
alter table public.levytate_otj_activity_events force row level security;

revoke all on table public.levytate_standard_otj_requirements from public, anon, authenticated, service_role;
revoke all on table public.levytate_otj_plans from public, anon, authenticated, service_role;
revoke all on table public.levytate_otj_plan_versions from public, anon, authenticated, service_role;
revoke all on table public.levytate_otj_learning_priorities from public, anon, authenticated, service_role;
revoke all on table public.levytate_otj_activities from public, anon, authenticated, service_role;
revoke all on table public.levytate_otj_activity_confirmations from public, anon, authenticated, service_role;
revoke all on table public.levytate_otj_activity_events from public, anon, authenticated, service_role;

grant select, insert, update on table public.levytate_standard_otj_requirements to service_role;
grant select, insert, update on table public.levytate_otj_plans to service_role;
grant select, insert, update on table public.levytate_otj_plan_versions to service_role;
grant select, insert, update on table public.levytate_otj_learning_priorities to service_role;
grant select, insert, update on table public.levytate_otj_activities to service_role;
grant select, insert on table public.levytate_otj_activity_confirmations to service_role;
grant select, insert on table public.levytate_otj_activity_events to service_role;

drop policy if exists levytate_standard_otj_requirements_service_role_select on public.levytate_standard_otj_requirements;
drop policy if exists levytate_standard_otj_requirements_service_role_insert on public.levytate_standard_otj_requirements;
drop policy if exists levytate_standard_otj_requirements_service_role_update on public.levytate_standard_otj_requirements;
drop policy if exists levytate_otj_plans_service_role_select on public.levytate_otj_plans;
drop policy if exists levytate_otj_plans_service_role_insert on public.levytate_otj_plans;
drop policy if exists levytate_otj_plans_service_role_update on public.levytate_otj_plans;
drop policy if exists levytate_otj_plan_versions_service_role_select on public.levytate_otj_plan_versions;
drop policy if exists levytate_otj_plan_versions_service_role_insert on public.levytate_otj_plan_versions;
drop policy if exists levytate_otj_plan_versions_service_role_update on public.levytate_otj_plan_versions;
drop policy if exists levytate_otj_priorities_service_role_select on public.levytate_otj_learning_priorities;
drop policy if exists levytate_otj_priorities_service_role_insert on public.levytate_otj_learning_priorities;
drop policy if exists levytate_otj_priorities_service_role_update on public.levytate_otj_learning_priorities;
drop policy if exists levytate_otj_activities_service_role_select on public.levytate_otj_activities;
drop policy if exists levytate_otj_activities_service_role_insert on public.levytate_otj_activities;
drop policy if exists levytate_otj_activities_service_role_update on public.levytate_otj_activities;
drop policy if exists levytate_otj_confirmations_service_role_select on public.levytate_otj_activity_confirmations;
drop policy if exists levytate_otj_confirmations_service_role_insert on public.levytate_otj_activity_confirmations;
drop policy if exists levytate_otj_events_service_role_select on public.levytate_otj_activity_events;
drop policy if exists levytate_otj_events_service_role_insert on public.levytate_otj_activity_events;

create policy levytate_standard_otj_requirements_service_role_select on public.levytate_standard_otj_requirements for select to service_role using (auth.role() = 'service_role');
create policy levytate_standard_otj_requirements_service_role_insert on public.levytate_standard_otj_requirements for insert to service_role with check (auth.role() = 'service_role');
create policy levytate_standard_otj_requirements_service_role_update on public.levytate_standard_otj_requirements for update to service_role using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_otj_plans_service_role_select on public.levytate_otj_plans for select to service_role using (auth.role() = 'service_role');
create policy levytate_otj_plans_service_role_insert on public.levytate_otj_plans for insert to service_role with check (auth.role() = 'service_role');
create policy levytate_otj_plans_service_role_update on public.levytate_otj_plans for update to service_role using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_otj_plan_versions_service_role_select on public.levytate_otj_plan_versions for select to service_role using (auth.role() = 'service_role');
create policy levytate_otj_plan_versions_service_role_insert on public.levytate_otj_plan_versions for insert to service_role with check (auth.role() = 'service_role');
create policy levytate_otj_plan_versions_service_role_update on public.levytate_otj_plan_versions for update to service_role using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_otj_priorities_service_role_select on public.levytate_otj_learning_priorities for select to service_role using (auth.role() = 'service_role');
create policy levytate_otj_priorities_service_role_insert on public.levytate_otj_learning_priorities for insert to service_role with check (auth.role() = 'service_role');
create policy levytate_otj_priorities_service_role_update on public.levytate_otj_learning_priorities for update to service_role using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_otj_activities_service_role_select on public.levytate_otj_activities for select to service_role using (auth.role() = 'service_role');
create policy levytate_otj_activities_service_role_insert on public.levytate_otj_activities for insert to service_role with check (auth.role() = 'service_role');
create policy levytate_otj_activities_service_role_update on public.levytate_otj_activities for update to service_role using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_otj_confirmations_service_role_select on public.levytate_otj_activity_confirmations for select to service_role using (auth.role() = 'service_role');
create policy levytate_otj_confirmations_service_role_insert on public.levytate_otj_activity_confirmations for insert to service_role with check (auth.role() = 'service_role');
create policy levytate_otj_events_service_role_select on public.levytate_otj_activity_events for select to service_role using (auth.role() = 'service_role');
create policy levytate_otj_events_service_role_insert on public.levytate_otj_activity_events for insert to service_role with check (auth.role() = 'service_role');

revoke all on function public.levytate_set_otj_activity_duration() from public, anon, authenticated, service_role;
revoke all on function public.levytate_enforce_otj_learner_plan_link() from public, anon, authenticated, service_role;
revoke all on function public.levytate_protect_otj_plan_version() from public, anon, authenticated, service_role;
revoke all on function public.levytate_protect_otj_activity() from public, anon, authenticated, service_role;
revoke all on function public.levytate_reject_otj_append_only_mutation() from public, anon, authenticated, service_role;
revoke all on function public.levytate_publish_otj_plan(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.levytate_publish_otj_plan(uuid, uuid, uuid) to service_role;
revoke all on function public.levytate_submit_otj_activity(uuid, uuid, uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.levytate_submit_otj_activity(uuid, uuid, uuid, text, integer) to service_role;
revoke all on function public.levytate_transition_otj_activity(uuid, uuid, uuid, text, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.levytate_transition_otj_activity(uuid, uuid, uuid, text, text, text, integer) to service_role;
revoke all on function public.levytate_record_otj_confirmation(uuid, uuid, uuid, text, integer, text, text, text, date, text, text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_record_otj_confirmation(uuid, uuid, uuid, text, integer, text, text, text, date, text, text) to service_role;

comment on table public.levytate_standard_otj_requirements is 'Versioned official Skills England minimum-hours references; unknown values are never stored as zero.';
comment on table public.levytate_otj_plan_versions is 'Immutable once published. Snapshots the applicable official and individually agreed learning-time figures.';
comment on table public.levytate_otj_activities is 'Learner-owned candidate learning evidence. Candidate time is distinct from provider-confirmed time.';
comment on table public.levytate_otj_activity_confirmations is 'Append-only attributable provider-confirmation evidence recorded by an authorised employer actor or future integration.';
comment on table public.levytate_otj_activity_events is 'Append-only safe learning-time audit events; raw AI prompts and responses are excluded.';
