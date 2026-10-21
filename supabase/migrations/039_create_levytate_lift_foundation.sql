-- LevyTate Lift — first working release foundation.
-- Additive, organisation-scoped and disabled by default. This migration is
-- prepared for isolated validation only and must not be applied to the shared
-- project without a fresh backup/restore gate and explicit approval.

alter table public.levytate_organisation_capabilities
  add column if not exists lift_enabled boolean not null default false;

comment on column public.levytate_organisation_capabilities.lift_enabled is
  'Server-controlled Lift capability. Disabled unless an organisation is explicitly authorised.';

create table if not exists public.levytate_lift_framework_versions (
  framework_key text not null,
  questionnaire_version text not null,
  interpretation_version text not null,
  title text not null,
  status text not null check (status in ('pilot','active','retired')),
  item_manifest jsonb not null check (jsonb_typeof(item_manifest) = 'array'),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (framework_key, questionnaire_version, interpretation_version)
);

insert into public.levytate_lift_framework_versions (
  framework_key, questionnaire_version, interpretation_version, title, status, item_manifest, limitations
) values (
  'lift-workforce-v1', 'lift-workforce-questionnaire-v1.1', 'lift-workforce-rules-v1.1',
  'LevyTate Workforce Capability Assessment', 'pilot',
  '[
    {"episode":"check","items":["check_01","check_02","check_03","check_04","check_05"]},
    {"episode":"flow","items":["flow_01","flow_02","flow_03","flow_04","flow_05"]},
    {"episode":"team","items":["team_01","team_02","team_03","team_04","team_05"]},
    {"episode":"data","items":["data_01","data_02","data_03","data_04","data_05"]},
    {"episode":"change","items":["change_01","change_02","change_03","change_04","change_05"]},
    {"episode":"pressure","items":["pressure_01","pressure_02","pressure_03","pressure_04","pressure_05"]}
  ]'::jsonb,
  '["Pilot instrument, not psychometrically validated","Not an occupational competence, performance or employment assessment","Manager and employee perspectives remain independent"]'::jsonb
) on conflict do nothing;

create table if not exists public.levytate_lift_campaigns (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  business_objective text not null check (char_length(btrim(business_objective)) between 1 and 2000),
  framework_key text not null default 'lift-workforce-v1',
  questionnaire_version text not null default 'lift-workforce-questionnaire-v1.1',
  interpretation_version text not null default 'lift-workforce-rules-v1.1',
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  revision integer not null default 1 check (revision > 0),
  unique (organisation_id, id),
  foreign key (framework_key, questionnaire_version, interpretation_version)
    references public.levytate_lift_framework_versions(framework_key, questionnaire_version, interpretation_version) on delete restrict,
  check (framework_key = 'lift-workforce-v1'),
  check (questionnaire_version = 'lift-workforce-questionnaire-v1.1'),
  check (interpretation_version = 'lift-workforce-rules-v1.1')
);

create table if not exists public.levytate_lift_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  employee_id text not null,
  manager_employee_id text,
  employee_name_snapshot text not null,
  department_snapshot text not null default '',
  role_title_snapshot text not null default '',
  status text not null default 'invited' check (status in ('invited','started','submitted','withdrawn')),
  invited_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  unique (organisation_id, id),
  unique (organisation_id, campaign_id, employee_id),
  foreign key (organisation_id, campaign_id) references public.levytate_lift_campaigns(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_lift_assessments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  participant_id uuid not null,
  employee_id text not null,
  framework_key text not null,
  questionnaire_version text not null,
  interpretation_version text not null,
  status text not null default 'draft' check (status in ('draft','submitted')),
  current_revision integer not null default 1 check (current_revision > 0),
  active_submission_revision integer,
  current_question_index integer not null default 0 check (current_question_index >= 0),
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, campaign_id, employee_id),
  foreign key (organisation_id, campaign_id) references public.levytate_lift_campaigns(organisation_id, id) on delete restrict,
  foreign key (organisation_id, participant_id) references public.levytate_lift_participants(organisation_id, id) on delete restrict,
  foreign key (framework_key, questionnaire_version, interpretation_version)
    references public.levytate_lift_framework_versions(framework_key, questionnaire_version, interpretation_version) on delete restrict,
  check (active_submission_revision is null or active_submission_revision > 0)
);

create table if not exists public.levytate_lift_assessment_revisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  assessment_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  status text not null default 'draft' check (status in ('draft','submitted','superseded')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  employee_context jsonb not null default '{}'::jsonb check (jsonb_typeof(employee_context) = 'object'),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, assessment_id, revision_number),
  foreign key (organisation_id, assessment_id) references public.levytate_lift_assessments(organisation_id, id) on delete restrict,
  check ((status = 'submitted' and submitted_at is not null) or status <> 'submitted')
);

create table if not exists public.levytate_lift_team_context_revisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  manager_employee_id text not null,
  revision_number integer not null check (revision_number > 0),
  team_purpose text not null check (char_length(btrim(team_purpose)) between 1 and 3000),
  relevant_workflows text not null default '' check (char_length(relevant_workflows) <= 5000),
  recurring_friction text not null default '' check (char_length(recurring_friction) <= 5000),
  expected_changes text not null default '' check (char_length(expected_changes) <= 5000),
  available_support text not null default '' check (char_length(available_support) <= 5000),
  status text not null default 'submitted' check (status in ('submitted','superseded')),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, manager_employee_id, revision_number)
);

create table if not exists public.levytate_lift_manager_observations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  participant_id uuid not null,
  employee_id text not null,
  manager_employee_id text not null,
  status text not null default 'draft' check (status in ('draft','submitted','released','revoked')),
  current_revision integer not null default 1 check (current_revision > 0),
  active_submission_revision integer,
  submitted_at timestamptz,
  released_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, campaign_id, employee_id, manager_employee_id),
  foreign key (organisation_id, campaign_id) references public.levytate_lift_campaigns(organisation_id, id) on delete restrict,
  foreign key (organisation_id, participant_id) references public.levytate_lift_participants(organisation_id, id) on delete restrict,
  check (employee_id <> manager_employee_id),
  check (active_submission_revision is null or active_submission_revision > 0)
);

create table if not exists public.levytate_lift_manager_observation_revisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  observation_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  observed_work text not null check (char_length(observed_work) <= 5000),
  observation_recency text not null check (char_length(observation_recency) <= 500),
  opportunity_to_observe text not null check (opportunity_to_observe in ('enough','limited','not_enough')),
  support_degree text not null check (support_degree in ('independent','some_support','substantial_support','not_observed')),
  capability_observations jsonb not null default '[]'::jsonb check (jsonb_typeof(capability_observations) = 'array'),
  concrete_examples jsonb not null default '[]'::jsonb check (jsonb_typeof(concrete_examples) = 'array'),
  workflow_group_key text not null default 'other_reviewed' check (workflow_group_key in ('reporting_and_insight','process_and_handoffs','customer_and_service','quality_and_compliance','digital_and_automation','planning_and_delivery','people_and_knowledge','other_reviewed')),
  suitable_opportunity text not null default '' check (char_length(suitable_opportunity) <= 3000),
  intended_outcome text not null default '' check (char_length(intended_outcome) <= 3000),
  condition_time text not null default '',
  condition_tools text not null default '',
  condition_access text not null default '',
  condition_supervision text not null default '',
  condition_suitable_work text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted','superseded')),
  revision_kind text not null default 'initial' check (revision_kind in ('initial','addendum')),
  clarifies_revision_number integer check (clarifies_revision_number is null or clarifies_revision_number > 0),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, observation_id, revision_number),
  foreign key (organisation_id, observation_id) references public.levytate_lift_manager_observations(organisation_id, id) on delete restrict,
  check ((status = 'submitted' and submitted_at is not null) or status <> 'submitted'),
  check ((revision_kind = 'initial' and clarifies_revision_number is null) or (revision_kind = 'addendum' and clarifies_revision_number is not null))
);

create table if not exists public.levytate_lift_employee_observation_contexts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  observation_id uuid not null,
  employee_id text not null,
  context text not null check (char_length(btrim(context)) between 1 and 5000),
  disputed boolean not null default false,
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, observation_id) references public.levytate_lift_manager_observations(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_lift_evidence_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  employee_id text,
  source_type text not null check (source_type in ('employee_task','employee_report','manager_observation','workplace_condition','operational_baseline','measured_outcome')),
  source_record_id uuid,
  source_version text not null,
  permissions text not null check (permissions in ('private_employee','released_pair','authorised_employer','aggregate_only')),
  description text not null check (char_length(description) <= 5000),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  quantity_value numeric,
  quantity_unit text,
  quantity_population text,
  quantity_period text,
  recorded_at timestamptz not null,
  recorded_by uuid references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, campaign_id) references public.levytate_lift_campaigns(organisation_id, id) on delete restrict,
  check ((quantity_value is null and quantity_unit is null and quantity_population is null and quantity_period is null)
    or (quantity_value is not null and nullif(btrim(quantity_unit),'') is not null and nullif(btrim(quantity_population),'') is not null and nullif(btrim(quantity_period),'') is not null))
);

create table if not exists public.levytate_lift_interpretations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  participant_id uuid,
  interpretation_version text not null,
  evidence_reference_ids jsonb not null check (jsonb_typeof(evidence_reference_ids) = 'array'),
  findings_snapshot jsonb not null check (jsonb_typeof(findings_snapshot) = 'object'),
  status text not null check (status in ('provisional','reviewed','superseded')),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, campaign_id) references public.levytate_lift_campaigns(organisation_id, id) on delete restrict,
  foreign key (organisation_id, participant_id) references public.levytate_lift_participants(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_lift_opportunity_candidates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  interpretation_id uuid not null,
  employee_id text not null,
  framework_key text not null,
  questionnaire_version text not null,
  interpretation_version text not null,
  grouping_version text not null default 'lift-opportunity-grouping-v1',
  workflow_group_key text not null check (workflow_group_key in ('reporting_and_insight','process_and_handoffs','customer_and_service','quality_and_compliance','digital_and_automation','planning_and_delivery','people_and_knowledge','other_reviewed')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  capability_ids jsonb not null check (jsonb_typeof(capability_ids) = 'array'),
  work_that_could_improve text not null,
  named_constraint text not null,
  outcome_worth_pursuing text not null,
  relationship_type text not null check (relationship_type in ('supported','hypothesis')),
  supporting_evidence_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(supporting_evidence_ids) = 'array'),
  contradictory_evidence_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(contradictory_evidence_ids) = 'array'),
  missing_inputs jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_inputs) = 'array'),
  decision_question text not null,
  evidence_needed jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_needed) = 'array'),
  state text not null default 'signal_identified' check (state in ('signal_identified','work_context_confirmed','change_tested','outcome_evidenced','paused','not_supported','no_improvement')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, campaign_id, employee_id, workflow_group_key, interpretation_version, grouping_version),
  foreign key (organisation_id, campaign_id) references public.levytate_lift_campaigns(organisation_id, id) on delete restrict,
  foreign key (organisation_id, interpretation_id) references public.levytate_lift_interpretations(organisation_id, id) on delete restrict,
  foreign key (framework_key, questionnaire_version, interpretation_version)
    references public.levytate_lift_framework_versions(framework_key, questionnaire_version, interpretation_version) on delete restrict
);

create table if not exists public.levytate_lift_opportunities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  campaign_id uuid not null,
  framework_key text not null,
  questionnaire_version text not null,
  interpretation_version text not null,
  grouping_version text not null,
  workflow_group_key text not null check (workflow_group_key in ('reporting_and_insight','process_and_handoffs','customer_and_service','quality_and_compliance','digital_and_automation','planning_and_delivery','people_and_knowledge','other_reviewed')),
  grouping_key text not null,
  grouping_criteria jsonb not null check (jsonb_typeof(grouping_criteria) = 'object'),
  contributor_count integer not null check (contributor_count >= 5),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  capability_ids jsonb not null check (jsonb_typeof(capability_ids) = 'array'),
  work_that_could_improve text not null,
  named_constraint text not null,
  outcome_worth_pursuing text not null,
  relationship_type text not null check (relationship_type in ('supported','hypothesis')),
  missing_inputs jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_inputs) = 'array'),
  decision_question text not null,
  evidence_needed jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_needed) = 'array'),
  state text not null default 'signal_identified' check (state in ('signal_identified','work_context_confirmed','change_tested','outcome_evidenced','paused','not_supported','no_improvement')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, grouping_key),
  foreign key (organisation_id, campaign_id) references public.levytate_lift_campaigns(organisation_id, id) on delete restrict,
  foreign key (framework_key, questionnaire_version, interpretation_version)
    references public.levytate_lift_framework_versions(framework_key, questionnaire_version, interpretation_version) on delete restrict
);

create table if not exists public.levytate_lift_opportunity_route_members (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  opportunity_id uuid not null,
  candidate_id uuid not null,
  contributor_employee_id text not null,
  grouping_criteria jsonb not null check (jsonb_typeof(grouping_criteria) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, opportunity_id, candidate_id),
  unique (organisation_id, opportunity_id, contributor_employee_id),
  foreign key (organisation_id, opportunity_id) references public.levytate_lift_opportunities(organisation_id, id) on delete restrict,
  foreign key (organisation_id, candidate_id) references public.levytate_lift_opportunity_candidates(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_lift_opportunity_evidence (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  opportunity_id uuid not null,
  evidence_id uuid not null,
  relationship text not null check (relationship in ('supporting','contradictory','missing_input')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, opportunity_id, evidence_id, relationship),
  foreign key (organisation_id, opportunity_id) references public.levytate_lift_opportunities(organisation_id, id) on delete restrict,
  foreign key (organisation_id, evidence_id) references public.levytate_lift_evidence_records(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_lift_decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  opportunity_id uuid not null,
  decision_version integer not null check (decision_version > 0),
  status text not null check (status in ('selected','deferred','gather_evidence')),
  selected_option_id text not null,
  rationale text not null check (char_length(btrim(rationale)) between 1 and 5000),
  responsible_owner text not null check (char_length(btrim(responsible_owner)) between 1 and 500),
  intended_measure text not null check (char_length(btrim(intended_measure)) between 1 and 2000),
  value_scenario jsonb,
  shared_benefit_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(shared_benefit_ids) = 'array'),
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, opportunity_id, decision_version),
  foreign key (organisation_id, opportunity_id) references public.levytate_lift_opportunities(organisation_id, id) on delete restrict,
  check (value_scenario is null or jsonb_typeof(value_scenario) = 'object')
);

create table if not exists public.levytate_lift_decision_assumptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  decision_id uuid not null,
  label text not null,
  value text not null,
  unit text,
  evidence_status text not null check (evidence_status in ('reported','reviewed','measured')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, decision_id) references public.levytate_lift_decisions(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_lift_proof_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  opportunity_id uuid not null,
  state text not null check (state in ('signal_identified','work_context_confirmed','change_tested','outcome_evidenced','paused','not_supported','no_improvement')),
  baseline_evidence_id uuid,
  outcome_evidence_id uuid,
  agreed_scope text not null default '',
  responsible_owner text not null default '',
  intended_measure text not null default '',
  reviewed_by_user_id uuid references public.levytate_users(id) on delete restrict,
  verification text not null default 'not_reviewed' check (verification in ('not_reviewed','internal_review','external_review')),
  other_relevant_changes jsonb not null default '[]'::jsonb check (jsonb_typeof(other_relevant_changes) = 'array'),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  follow_up_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, opportunity_id),
  foreign key (organisation_id, opportunity_id) references public.levytate_lift_opportunities(organisation_id, id) on delete restrict,
  foreign key (organisation_id, baseline_evidence_id) references public.levytate_lift_evidence_records(organisation_id, id) on delete restrict,
  foreign key (organisation_id, outcome_evidence_id) references public.levytate_lift_evidence_records(organisation_id, id) on delete restrict,
  check (baseline_evidence_id is null or baseline_evidence_id <> outcome_evidence_id)
);

create table if not exists public.levytate_lift_proof_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  proof_record_id uuid not null,
  opportunity_id uuid not null,
  previous_state text,
  new_state text not null,
  evidence_reference_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_reference_ids) = 'array'),
  note text not null default '' check (char_length(note) <= 3000),
  actor_user_id uuid not null references public.levytate_users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, actor_user_id, idempotency_key),
  foreign key (organisation_id, proof_record_id) references public.levytate_lift_proof_records(organisation_id, id) on delete restrict,
  foreign key (organisation_id, opportunity_id) references public.levytate_lift_opportunities(organisation_id, id) on delete restrict
);

create index if not exists levytate_lift_participants_employee_idx on public.levytate_lift_participants(organisation_id, employee_id, status);
create index if not exists levytate_lift_assessments_employee_idx on public.levytate_lift_assessments(organisation_id, employee_id, updated_at desc);
create index if not exists levytate_lift_manager_observations_manager_idx on public.levytate_lift_manager_observations(organisation_id, manager_employee_id, status);
create index if not exists levytate_lift_evidence_campaign_idx on public.levytate_lift_evidence_records(organisation_id, campaign_id, source_type, recorded_at desc);
create index if not exists levytate_lift_opportunity_candidates_group_idx on public.levytate_lift_opportunity_candidates(organisation_id, campaign_id, framework_key, questionnaire_version, interpretation_version, grouping_version, workflow_group_key);
create index if not exists levytate_lift_opportunities_campaign_idx on public.levytate_lift_opportunities(organisation_id, campaign_id, state, updated_at desc);
create index if not exists levytate_lift_opportunity_route_members_contributor_idx on public.levytate_lift_opportunity_route_members(organisation_id, contributor_employee_id, opportunity_id);
create index if not exists levytate_lift_decisions_opportunity_idx on public.levytate_lift_decisions(organisation_id, opportunity_id, decision_version desc);
create index if not exists levytate_lift_proof_events_record_idx on public.levytate_lift_proof_events(organisation_id, proof_record_id, created_at);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'levytate_lift_framework_versions','levytate_lift_campaigns','levytate_lift_participants',
    'levytate_lift_assessments','levytate_lift_assessment_revisions','levytate_lift_team_context_revisions',
    'levytate_lift_manager_observations','levytate_lift_manager_observation_revisions',
    'levytate_lift_employee_observation_contexts','levytate_lift_evidence_records','levytate_lift_interpretations',
    'levytate_lift_opportunity_candidates','levytate_lift_opportunities','levytate_lift_opportunity_route_members','levytate_lift_opportunity_evidence','levytate_lift_decisions',
    'levytate_lift_decision_assumptions','levytate_lift_proof_records','levytate_lift_proof_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = table_name
        and policyname = table_name || '_service_role_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        table_name || '_service_role_all', table_name
      );
    end if;
  end loop;
end $$;

revoke all privileges on table public.levytate_organisation_capabilities from public, anon, authenticated;
grant select, insert, update on table public.levytate_organisation_capabilities to service_role;

drop trigger if exists levytate_lift_campaigns_updated_at on public.levytate_lift_campaigns;
create trigger levytate_lift_campaigns_updated_at before update on public.levytate_lift_campaigns
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_lift_assessments_updated_at on public.levytate_lift_assessments;
create trigger levytate_lift_assessments_updated_at before update on public.levytate_lift_assessments
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_lift_manager_observations_updated_at on public.levytate_lift_manager_observations;
create trigger levytate_lift_manager_observations_updated_at before update on public.levytate_lift_manager_observations
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_lift_opportunities_updated_at on public.levytate_lift_opportunities;
create trigger levytate_lift_opportunities_updated_at before update on public.levytate_lift_opportunities
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_lift_proof_records_updated_at on public.levytate_lift_proof_records;
create trigger levytate_lift_proof_records_updated_at before update on public.levytate_lift_proof_records
  for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.levytate_guard_lift_manager_observation_revision()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Submitted Lift manager observations are immutable';
  end if;
  if old.status <> 'draft' then
    raise exception 'Submitted Lift manager observations are immutable';
  end if;
  if new.observation_id <> old.observation_id or new.revision_number <> old.revision_number
     or new.revision_kind <> old.revision_kind or new.clarifies_revision_number is distinct from old.clarifies_revision_number then
    raise exception 'Lift manager observation revision identity is immutable';
  end if;
  if new.status not in ('draft','submitted') then
    raise exception 'Invalid Lift manager observation revision transition';
  end if;
  return new;
end;
$$;

drop trigger if exists levytate_lift_manager_observation_revision_guard on public.levytate_lift_manager_observation_revisions;
create trigger levytate_lift_manager_observation_revision_guard before update or delete on public.levytate_lift_manager_observation_revisions
  for each row execute function public.levytate_guard_lift_manager_observation_revision();

create or replace function public.levytate_reject_lift_append_only_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'Lift history records are append-only';
end;
$$;

drop trigger if exists levytate_lift_evidence_immutable on public.levytate_lift_evidence_records;
create trigger levytate_lift_evidence_immutable before update or delete on public.levytate_lift_evidence_records
  for each row execute function public.levytate_reject_lift_append_only_mutation();
drop trigger if exists levytate_lift_opportunity_candidates_immutable on public.levytate_lift_opportunity_candidates;
create trigger levytate_lift_opportunity_candidates_immutable before update or delete on public.levytate_lift_opportunity_candidates
  for each row execute function public.levytate_reject_lift_append_only_mutation();
drop trigger if exists levytate_lift_opportunity_route_members_immutable on public.levytate_lift_opportunity_route_members;
create trigger levytate_lift_opportunity_route_members_immutable before update or delete on public.levytate_lift_opportunity_route_members
  for each row execute function public.levytate_reject_lift_append_only_mutation();
drop trigger if exists levytate_lift_decisions_immutable on public.levytate_lift_decisions;
create trigger levytate_lift_decisions_immutable before update or delete on public.levytate_lift_decisions
  for each row execute function public.levytate_reject_lift_append_only_mutation();
drop trigger if exists levytate_lift_proof_events_immutable on public.levytate_lift_proof_events;
create trigger levytate_lift_proof_events_immutable before update or delete on public.levytate_lift_proof_events
  for each row execute function public.levytate_reject_lift_append_only_mutation();
