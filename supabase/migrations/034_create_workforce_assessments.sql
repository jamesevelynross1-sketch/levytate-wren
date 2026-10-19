-- LevyTate Workforce Assessments V1.
-- Additive, tenant-scoped and service-role only. Existing employee, application
-- and learner records are not changed or backfilled.

create table if not exists public.levytate_assessment_framework_versions (
  framework_key text not null,
  questionnaire_version text not null,
  interpretation_version text not null,
  title text not null,
  status text not null check (status in ('active','retired')),
  questionnaire_snapshot jsonb not null check (jsonb_typeof(questionnaire_snapshot) = 'array'),
  source_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_urls) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (framework_key, questionnaire_version, interpretation_version)
);

insert into public.levytate_assessment_framework_versions (
  framework_key, questionnaire_version, interpretation_version, title, status, questionnaire_snapshot, source_urls
) values (
  'ai_automation_data', 'ai-workforce-v1', 'ai-workforce-rules-v1',
  'AI, automation and data workforce assessment', 'active',
  '[{"id":"role_context","domain":"context"},{"id":"ai_use","domain":"technical"},{"id":"ai_review","domain":"responsible"},{"id":"data_confidence","domain":"technical"},{"id":"automation_confidence","domain":"technical"},{"id":"responsible_handling","domain":"responsible"},{"id":"workplace_opportunity","domain":"non_technical"},{"id":"development_interests","domain":"non_technical"},{"id":"tool_access","domain":"workplace_condition"},{"id":"practice_opportunity","domain":"workplace_condition"},{"id":"time_support","domain":"workplace_condition"},{"id":"work_example","domain":"context"}]'::jsonb,
  '["https://www.gov.uk/government/publications/ai-skills-for-businesses-toolkit","https://www.gov.uk/government/publications/ai-foundation-skills-for-work"]'::jsonb
) on conflict do nothing;

create table if not exists public.levytate_assessment_campaigns (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  purpose text not null check (char_length(btrim(purpose)) between 1 and 2000),
  business_objectives jsonb not null default '[]'::jsonb check (jsonb_typeof(business_objectives) = 'array'),
  departments jsonb not null default '[]'::jsonb check (jsonb_typeof(departments) = 'array'),
  framework_key text not null,
  questionnaire_version text not null,
  interpretation_version text not null,
  owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
  closing_date date,
  sharing_policy text not null check (sharing_policy in ('campaign_owner_summary','manager_and_campaign_owner')),
  status text not null default 'draft' check (status in ('draft','open','closed')),
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (framework_key, questionnaire_version, interpretation_version)
    references public.levytate_assessment_framework_versions(framework_key, questionnaire_version, interpretation_version) on delete restrict
);

create table if not exists public.levytate_assessment_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  employee_id text not null,
  employee_name_snapshot text not null,
  department_snapshot text not null default '',
  role_title_snapshot text not null default '',
  audience_change_type text not null check (audience_change_type in ('initial','added','removed')),
  recorded_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, campaign_id, employee_id, audience_change_type),
  foreign key (organisation_id, campaign_id) references public.levytate_assessment_campaigns(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_workforce_assessments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  employee_id text not null,
  campaign_id uuid,
  framework_key text not null,
  questionnaire_version text not null,
  interpretation_version text not null,
  questionnaire_snapshot jsonb not null check (jsonb_typeof(questionnaire_snapshot) = 'array'),
  role_context text not null default '' check (char_length(role_context) <= 300),
  status text not null default 'draft' check (status in ('draft','submitted','needs_clarification','reviewed','closed')),
  visibility text not null default 'private' check (visibility in ('private','manager_shared','campaign_shared')),
  current_revision integer not null default 1 check (current_revision > 0),
  active_submission_revision integer check (active_submission_revision is null or active_submission_revision > 0),
  baseline_assessment_id uuid,
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, campaign_id) references public.levytate_assessment_campaigns(organisation_id, id) on delete restrict,
  foreign key (organisation_id, baseline_assessment_id) references public.levytate_workforce_assessments(organisation_id, id) on delete restrict,
  foreign key (framework_key, questionnaire_version, interpretation_version)
    references public.levytate_assessment_framework_versions(framework_key, questionnaire_version, interpretation_version) on delete restrict
);

create unique index if not exists levytate_assessments_campaign_employee_idx
  on public.levytate_workforce_assessments(organisation_id, campaign_id, employee_id) where campaign_id is not null;
create index if not exists levytate_assessments_employee_idx
  on public.levytate_workforce_assessments(organisation_id, employee_id, updated_at desc);
create index if not exists levytate_assessments_campaign_submission_idx
  on public.levytate_workforce_assessments(organisation_id, campaign_id, active_submission_revision) where campaign_id is not null;

create table if not exists public.levytate_assessment_revisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  status text not null default 'draft' check (status in ('draft','submitted','superseded')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  role_context text not null default '' check (char_length(role_context) <= 300),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, assessment_id, revision_number),
  foreign key (organisation_id, assessment_id) references public.levytate_workforce_assessments(organisation_id, id) on delete restrict,
  check ((status = 'submitted' and submitted_at is not null) or status <> 'submitted')
);

create table if not exists public.levytate_assessment_results (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid not null,
  revision_number integer not null,
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  interpretation_version text not null,
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, assessment_id, revision_number),
  foreign key (organisation_id, assessment_id, revision_number)
    references public.levytate_assessment_revisions(organisation_id, assessment_id, revision_number) on delete restrict
);

create table if not exists public.levytate_assessment_shares (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid not null,
  shared_with text not null check (shared_with = 'line_manager'),
  shared_with_employee_id text not null,
  active boolean not null default true,
  shared_by uuid not null references public.levytate_users(id) on delete restrict,
  shared_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, assessment_id, shared_with),
  foreign key (organisation_id, assessment_id) references public.levytate_workforce_assessments(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_assessment_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid not null,
  submission_revision integer not null,
  reviewer_user_id uuid not null references public.levytate_users(id) on delete restrict,
  reviewer_role text not null check (reviewer_role in ('Line Manager','Apprenticeship Lead','Employer Admin')),
  status text not null check (status in ('clarification_requested','relevant','not_currently_relevant')),
  business_context text not null default '' check (char_length(business_context) <= 3000),
  support_available text not null default '' check (char_length(support_available) <= 3000),
  constraints text not null default '' check (char_length(constraints) <= 3000),
  recommended_action text not null default '' check (char_length(recommended_action) <= 2000),
  manager_comment text not null check (char_length(btrim(manager_comment)) between 1 and 3000),
  reviewed_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, assessment_id, submission_revision)
    references public.levytate_assessment_revisions(organisation_id, assessment_id, revision_number) on delete restrict
);

create table if not exists public.levytate_assessment_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid not null,
  review_id uuid not null,
  action_text text not null check (char_length(btrim(action_text)) between 1 and 2000),
  owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
  status text not null default 'proposed' check (status in ('proposed','accepted','completed','declined')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, assessment_id) references public.levytate_workforce_assessments(organisation_id, id) on delete restrict,
  foreign key (organisation_id, review_id) references public.levytate_assessment_reviews(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_assessment_application_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid not null,
  application_id text not null,
  source_revision integer not null,
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, assessment_id),
  unique (organisation_id, application_id),
  foreign key (organisation_id, assessment_id, source_revision)
    references public.levytate_assessment_revisions(organisation_id, assessment_id, revision_number) on delete restrict,
  foreign key (organisation_id, application_id) references public.levytate_applications(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_assessment_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid,
  campaign_id uuid,
  event_type text not null check (char_length(event_type) between 3 and 120),
  actor_user_id uuid not null references public.levytate_users(id) on delete restrict,
  actor_role text not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  safe_summary text not null default '' check (char_length(safe_summary) <= 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, actor_user_id, idempotency_key),
  foreign key (organisation_id, assessment_id) references public.levytate_workforce_assessments(organisation_id, id) on delete restrict,
  foreign key (organisation_id, campaign_id) references public.levytate_assessment_campaigns(organisation_id, id) on delete restrict
);

create or replace function public.levytate_reject_assessment_immutable_change()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Submitted assessment history is immutable'; end;
$$;

drop trigger if exists levytate_assessment_results_immutable on public.levytate_assessment_results;
create trigger levytate_assessment_results_immutable before update or delete on public.levytate_assessment_results
for each row execute function public.levytate_reject_assessment_immutable_change();
drop trigger if exists levytate_assessment_events_immutable on public.levytate_assessment_events;
create trigger levytate_assessment_events_immutable before update or delete on public.levytate_assessment_events
for each row execute function public.levytate_reject_assessment_immutable_change();
drop trigger if exists levytate_assessment_framework_versions_immutable on public.levytate_assessment_framework_versions;
create trigger levytate_assessment_framework_versions_immutable before update or delete on public.levytate_assessment_framework_versions
for each row execute function public.levytate_reject_assessment_immutable_change();

revoke all on function public.levytate_reject_assessment_immutable_change() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'levytate_assessment_framework_versions','levytate_assessment_campaigns','levytate_assessment_participants',
    'levytate_workforce_assessments','levytate_assessment_revisions','levytate_assessment_results',
    'levytate_assessment_shares','levytate_assessment_reviews','levytate_assessment_actions',
    'levytate_assessment_application_links','levytate_assessment_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
