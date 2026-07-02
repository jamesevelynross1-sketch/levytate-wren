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

create table if not exists public.levytate_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  workspace_name text,
  primary_contact text,
  contact_email text,
  default_site text,
  sites jsonb not null default '[]'::jsonb,
  departments jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  status text not null default 'Active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.levytate_organisations
  add column if not exists workspace_name text,
  add column if not exists primary_contact text,
  add column if not exists contact_email text,
  add column if not exists default_site text,
  add column if not exists sites jsonb not null default '[]'::jsonb,
  add column if not exists departments jsonb not null default '[]'::jsonb,
  add column if not exists priorities jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'Active',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_users (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  email text not null unique,
  role text not null,
  access_level text not null,
  auth_subject uuid,
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.levytate_users
  add column if not exists organisation_id uuid references public.levytate_organisations(id) on delete cascade,
  add column if not exists email text,
  add column if not exists role text not null default 'Employer Admin',
  add column if not exists access_level text not null default 'beta_user',
  add column if not exists auth_subject uuid,
  add column if not exists last_login_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_employees (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  employee_number text not null,
  name text not null,
  email text not null default '',
  job_title text not null default '',
  role_id text not null default '',
  manager_id text not null default '',
  department text not null default '',
  site text not null default '',
  platform_role text not null,
  status text not null default 'Active',
  start_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

alter table if exists public.levytate_employees
  add column if not exists employee_number text not null default '',
  add column if not exists name text not null default '',
  add column if not exists email text not null default '',
  add column if not exists job_title text not null default '',
  add column if not exists role_id text not null default '',
  add column if not exists manager_id text not null default '',
  add column if not exists department text not null default '',
  add column if not exists site text not null default '',
  add column if not exists platform_role text not null default 'Employee',
  add column if not exists status text not null default 'Active',
  add column if not exists start_date date not null default current_date,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_employee_development_profiles (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  employee_id text not null,
  stage text not null,
  responsibilities jsonb not null default '[]'::jsonb,
  current_skills jsonb not null default '[]'::jsonb,
  business_functions jsonb not null default '[]'::jsonb,
  current_capabilities jsonb not null default '[]'::jsonb,
  apprenticeship_indicators jsonb not null default '[]'::jsonb,
  ai_opportunities jsonb not null default '[]'::jsonb,
  data_opportunities jsonb not null default '[]'::jsonb,
  automation_opportunities jsonb not null default '[]'::jsonb,
  future_capabilities jsonb not null default '[]'::jsonb,
  conversation_history jsonb not null default '[]'::jsonb,
  conversation_profile jsonb,
  recommendation_result jsonb,
  preferred_standard_id text not null default '',
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, employee_id)
);

alter table if exists public.levytate_employee_development_profiles
  add column if not exists stage text not null default 'role_context',
  add column if not exists responsibilities jsonb not null default '[]'::jsonb,
  add column if not exists current_skills jsonb not null default '[]'::jsonb,
  add column if not exists business_functions jsonb not null default '[]'::jsonb,
  add column if not exists current_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists apprenticeship_indicators jsonb not null default '[]'::jsonb,
  add column if not exists ai_opportunities jsonb not null default '[]'::jsonb,
  add column if not exists data_opportunities jsonb not null default '[]'::jsonb,
  add column if not exists automation_opportunities jsonb not null default '[]'::jsonb,
  add column if not exists future_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists conversation_history jsonb not null default '[]'::jsonb,
  add column if not exists conversation_profile jsonb,
  add column if not exists recommendation_result jsonb,
  add column if not exists preferred_standard_id text not null default '',
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_roles (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  title text not null,
  department text not null default '',
  business_area text not null default '',
  career_level text not null,
  skills_tags jsonb not null default '[]'::jsonb,
  progression jsonb not null default '[]'::jsonb,
  status text not null default 'Active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

alter table if exists public.levytate_roles
  add column if not exists title text not null default '',
  add column if not exists department text not null default '',
  add column if not exists business_area text not null default '',
  add column if not exists career_level text not null default 'Entry',
  add column if not exists skills_tags jsonb not null default '[]'::jsonb,
  add column if not exists progression jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'Active',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_role_pathway_mappings (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  role_id text not null,
  apprenticeship_standard_id text not null,
  recommendation_type text not null,
  priority integer not null default 1,
  business_rationale text not null default '',
  funding_route text not null default '',
  delivery_preference text not null default '',
  primary key (organisation_id, id)
);

alter table if exists public.levytate_role_pathway_mappings
  add column if not exists role_id text not null default '',
  add column if not exists apprenticeship_standard_id text not null default '',
  add column if not exists recommendation_type text not null default 'Primary',
  add column if not exists priority integer not null default 1,
  add column if not exists business_rationale text not null default '',
  add column if not exists funding_route text not null default '',
  add column if not exists delivery_preference text not null default '';

create table if not exists public.levytate_applications (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  employee_id text not null,
  apprenticeship_standard_id text not null,
  status text not null,
  current_owner text not null,
  reason text not null default '',
  career_goal text not null default '',
  support_required text not null default '',
  manager_note text not null default '',
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

alter table if exists public.levytate_applications
  add column if not exists employee_id text not null default '',
  add column if not exists apprenticeship_standard_id text not null default '',
  add column if not exists status text not null default 'Draft',
  add column if not exists current_owner text not null default 'Employee',
  add column if not exists reason text not null default '',
  add column if not exists career_goal text not null default '',
  add column if not exists support_required text not null default '',
  add column if not exists manager_note text not null default '',
  add column if not exists submitted_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_application_history (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  application_id text not null,
  status text not null,
  owner text not null,
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

alter table if exists public.levytate_application_history
  add column if not exists application_id text not null default '',
  add column if not exists status text not null default 'Draft',
  add column if not exists owner text not null default 'Employee',
  add column if not exists note text not null default '',
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_providers (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  provider_id text not null,
  provider_name text not null,
  website text not null default '',
  provider_type text not null,
  sectors jsonb not null default '[]'::jsonb,
  delivery_model jsonb not null default '[]'::jsonb,
  delivery_models jsonb not null default '[]'::jsonb,
  industries jsonb not null default '[]'::jsonb,
  technologies jsonb not null default '[]'::jsonb,
  regions jsonb not null default '[]'::jsonb,
  employer_types jsonb not null default '[]'::jsonb,
  specialisms jsonb not null default '[]'::jsonb,
  contact_name text not null default '',
  contact_email text not null default '',
  ofsted_rating text not null default '',
  status text not null default 'Active',
  source_urls jsonb not null default '[]'::jsonb,
  notes text not null default '',
  last_verified date,
  verification_status text not null default 'needs_verification',
  primary key (organisation_id, provider_id)
);

alter table if exists public.levytate_providers
  add column if not exists provider_name text not null default '',
  add column if not exists website text not null default '',
  add column if not exists provider_type text not null default 'Independent training provider',
  add column if not exists sectors jsonb not null default '[]'::jsonb,
  add column if not exists delivery_model jsonb not null default '[]'::jsonb,
  add column if not exists delivery_models jsonb not null default '[]'::jsonb,
  add column if not exists industries jsonb not null default '[]'::jsonb,
  add column if not exists technologies jsonb not null default '[]'::jsonb,
  add column if not exists regions jsonb not null default '[]'::jsonb,
  add column if not exists employer_types jsonb not null default '[]'::jsonb,
  add column if not exists specialisms jsonb not null default '[]'::jsonb,
  add column if not exists contact_name text not null default '',
  add column if not exists contact_email text not null default '',
  add column if not exists ofsted_rating text not null default '',
  add column if not exists status text not null default 'Active',
  add column if not exists source_urls jsonb not null default '[]'::jsonb,
  add column if not exists notes text not null default '',
  add column if not exists last_verified date,
  add column if not exists verification_status text not null default 'needs_verification';

create table if not exists public.levytate_provider_programmes (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  provider_id text not null,
  apprenticeship_standard_id text not null default '',
  delivery_mode text not null default '',
  programme_name text not null default '',
  short_description text not null default '',
  full_description text not null default '',
  status text not null default 'Needs verification',
  verification_status text not null default 'Needs manual verification',
  target_organisations jsonb not null default '[]'::jsonb,
  target_industries jsonb not null default '[]'::jsonb,
  target_job_roles jsonb not null default '[]'::jsonb,
  seniority text not null default 'Mixed',
  employer_size text not null default 'Mixed employer base',
  business_problems_solved jsonb not null default '[]'::jsonb,
  skills_developed jsonb not null default '[]'::jsonb,
  technologies_covered jsonb not null default '[]'::jsonb,
  expected_outcomes jsonb not null default '[]'::jsonb,
  delivery_models jsonb not null default '[]'::jsonb,
  regions jsonb not null default '[]'::jsonb,
  duration text not null default '',
  cohort_options jsonb not null default '[]'::jsonb,
  commercial_notes text not null default '',
  linked_standard_id text,
  linked_standard_ids jsonb not null default '[]'::jsonb,
  linked_standard_name text not null default '',
  level integer,
  route text not null default '',
  funding_band integer,
  official_url text not null default '',
  source_url text not null default '',
  notes text not null default '',
  funding_route text not null default 'Potentially funded through levy/co-investment',
  record_status text not null default 'Active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

alter table if exists public.levytate_provider_programmes
  add column if not exists provider_id text not null default '',
  add column if not exists apprenticeship_standard_id text not null default '',
  add column if not exists delivery_mode text not null default '',
  add column if not exists programme_name text not null default '',
  add column if not exists short_description text not null default '',
  add column if not exists full_description text not null default '',
  add column if not exists status text not null default 'Needs verification',
  add column if not exists verification_status text not null default 'Needs manual verification',
  add column if not exists target_organisations jsonb not null default '[]'::jsonb,
  add column if not exists target_industries jsonb not null default '[]'::jsonb,
  add column if not exists target_job_roles jsonb not null default '[]'::jsonb,
  add column if not exists seniority text not null default 'Mixed',
  add column if not exists employer_size text not null default 'Mixed employer base',
  add column if not exists business_problems_solved jsonb not null default '[]'::jsonb,
  add column if not exists skills_developed jsonb not null default '[]'::jsonb,
  add column if not exists technologies_covered jsonb not null default '[]'::jsonb,
  add column if not exists expected_outcomes jsonb not null default '[]'::jsonb,
  add column if not exists delivery_models jsonb not null default '[]'::jsonb,
  add column if not exists regions jsonb not null default '[]'::jsonb,
  add column if not exists duration text not null default '',
  add column if not exists cohort_options jsonb not null default '[]'::jsonb,
  add column if not exists commercial_notes text not null default '',
  add column if not exists linked_standard_id text,
  add column if not exists linked_standard_ids jsonb not null default '[]'::jsonb,
  add column if not exists linked_standard_name text not null default '',
  add column if not exists level integer,
  add column if not exists route text not null default '',
  add column if not exists funding_band integer,
  add column if not exists official_url text not null default '',
  add column if not exists source_url text not null default '',
  add column if not exists notes text not null default '',
  add column if not exists funding_route text not null default 'Potentially funded through levy/co-investment',
  add column if not exists record_status text not null default 'Active',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_provider_relationships (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  category text not null,
  preferred_provider_id text not null,
  backup_provider_ids jsonb not null default '[]'::jsonb,
  apprenticeship_standard_ids jsonb not null default '[]'::jsonb,
  programme_ids jsonb not null default '[]'::jsonb,
  status text not null,
  notes text not null default '',
  review_date date not null,
  last_used_date date not null,
  primary key (organisation_id, id)
);

alter table if exists public.levytate_provider_relationships
  add column if not exists category text not null default 'Digital',
  add column if not exists preferred_provider_id text not null default '',
  add column if not exists backup_provider_ids jsonb not null default '[]'::jsonb,
  add column if not exists apprenticeship_standard_ids jsonb not null default '[]'::jsonb,
  add column if not exists programme_ids jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'Preferred',
  add column if not exists notes text not null default '',
  add column if not exists review_date date not null default current_date,
  add column if not exists last_used_date date not null default current_date;

create table if not exists public.levytate_matching_requests (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  role_need text not null,
  apprenticeship_standard_id text not null default '',
  department text not null default '',
  future_capability text not null default '',
  employer_size text not null default '',
  programme_id text not null default '',
  linked_standard_id text not null default '',
  learner_count integer not null default 0,
  sites jsonb not null default '[]'::jsonb,
  delivery_preference text not null default '',
  funding_position text not null default '',
  urgency text not null default '',
  notes text not null default '',
  business_problems jsonb not null default '[]'::jsonb,
  target_roles jsonb not null default '[]'::jsonb,
  technologies jsonb not null default '[]'::jsonb,
  industries jsonb not null default '[]'::jsonb,
  status text not null,
  shortlist_provider_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

alter table if exists public.levytate_matching_requests
  add column if not exists role_need text not null default '',
  add column if not exists apprenticeship_standard_id text not null default '',
  add column if not exists department text not null default '',
  add column if not exists future_capability text not null default '',
  add column if not exists employer_size text not null default '',
  add column if not exists programme_id text not null default '',
  add column if not exists linked_standard_id text not null default '',
  add column if not exists learner_count integer not null default 0,
  add column if not exists sites jsonb not null default '[]'::jsonb,
  add column if not exists delivery_preference text not null default '',
  add column if not exists funding_position text not null default '',
  add column if not exists urgency text not null default '',
  add column if not exists notes text not null default '',
  add column if not exists business_problems jsonb not null default '[]'::jsonb,
  add column if not exists target_roles jsonb not null default '[]'::jsonb,
  add column if not exists technologies jsonb not null default '[]'::jsonb,
  add column if not exists industries jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'Submitted',
  add column if not exists shortlist_provider_ids jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_enrolments (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  application_id text not null,
  employee_id text not null,
  provider_id text not null,
  apprenticeship_standard_id text not null,
  status text not null,
  start_date date not null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

alter table if exists public.levytate_enrolments
  add column if not exists application_id text not null default '',
  add column if not exists employee_id text not null default '',
  add column if not exists provider_id text not null default '',
  add column if not exists apprenticeship_standard_id text not null default '',
  add column if not exists status text not null default 'Ready for provider',
  add column if not exists start_date date not null default current_date,
  add column if not exists notes text not null default '',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  actor_email text not null,
  actor_role text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.levytate_audit_events
  add column if not exists actor_email text not null default '',
  add column if not exists actor_role text not null default '',
  add column if not exists entity_type text not null default '',
  add column if not exists entity_id text not null default '',
  add column if not exists action text not null default '',
  add column if not exists summary text not null default '',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_file_assets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  bucket_name text not null,
  object_path text not null,
  original_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint not null default 0,
  uploaded_by_email text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.levytate_file_assets
  add column if not exists entity_type text not null default '',
  add column if not exists entity_id text not null default '',
  add column if not exists bucket_name text not null default '',
  add column if not exists object_path text not null default '',
  add column if not exists original_name text not null default '',
  add column if not exists mime_type text not null default 'application/octet-stream',
  add column if not exists file_size_bytes bigint not null default 0,
  add column if not exists uploaded_by_email text not null default '',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create table if not exists public.levytate_early_access_requests (
  id uuid primary key default gen_random_uuid(),
  organisation text not null,
  contact_name text not null,
  email text not null unique,
  employee_count text not null,
  biggest_challenge text,
  consent boolean not null default false,
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  status text not null default 'New',
  source text not null default 'levytate.co.uk',
  admin_owner_email text,
  approved_at timestamptz,
  notes jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb
);

alter table if exists public.levytate_early_access_requests
  add column if not exists organisation text not null default '',
  add column if not exists contact_name text not null default '',
  add column if not exists email text,
  add column if not exists employee_count text not null default '',
  add column if not exists biggest_challenge text,
  add column if not exists consent boolean not null default false,
  add column if not exists submitted_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists status text not null default 'New',
  add column if not exists source text not null default 'levytate.co.uk',
  add column if not exists admin_owner_email text,
  add column if not exists approved_at timestamptz,
  add column if not exists notes jsonb not null default '[]'::jsonb,
  add column if not exists history jsonb not null default '[]'::jsonb;

create table if not exists public.levytate_apprenticeship_standards (
  id text primary key,
  title text not null,
  reference_code text not null,
  version text not null default 'Current',
  status text not null default 'Approved for delivery',
  programme_type text not null default 'Apprenticeship standard',
  route text not null default '',
  occupational_route text not null default '',
  level integer not null default 0,
  funding_band integer,
  typical_duration text not null default '',
  official_url text not null default '',
  integrated_degree text not null default '',
  professional_recognition text not null default '',
  job_titles jsonb not null default '[]'::jsonb,
  overview text not null default '',
  last_updated date,
  last_verified date,
  last_synced_at date,
  source_name text not null default 'Skills England apprenticeship CSV',
  source_url text not null default 'https://skillsengland.education.gov.uk/apprenticeships/',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.levytate_apprenticeship_standards
  add column if not exists title text not null default '',
  add column if not exists reference_code text not null default '',
  add column if not exists version text not null default 'Current',
  add column if not exists status text not null default 'Approved for delivery',
  add column if not exists programme_type text not null default 'Apprenticeship standard',
  add column if not exists route text not null default '',
  add column if not exists occupational_route text not null default '',
  add column if not exists level integer not null default 0,
  add column if not exists funding_band integer,
  add column if not exists typical_duration text not null default '',
  add column if not exists official_url text not null default '',
  add column if not exists integrated_degree text not null default '',
  add column if not exists professional_recognition text not null default '',
  add column if not exists job_titles jsonb not null default '[]'::jsonb,
  add column if not exists overview text not null default '',
  add column if not exists last_updated date,
  add column if not exists last_verified date,
  add column if not exists last_synced_at date,
  add column if not exists source_name text not null default 'Skills England apprenticeship CSV',
  add column if not exists source_url text not null default 'https://skillsengland.education.gov.uk/apprenticeships/',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists levytate_users_organisation_idx on public.levytate_users (organisation_id);
create index if not exists levytate_employees_organisation_idx on public.levytate_employees (organisation_id, status);
create index if not exists levytate_roles_organisation_idx on public.levytate_roles (organisation_id, status);
create index if not exists levytate_role_pathway_mappings_role_idx on public.levytate_role_pathway_mappings (organisation_id, role_id, priority);
create index if not exists levytate_applications_organisation_idx on public.levytate_applications (organisation_id, status);
create index if not exists levytate_application_history_application_idx on public.levytate_application_history (organisation_id, application_id, created_at desc);
create index if not exists levytate_providers_organisation_idx on public.levytate_providers (organisation_id, status);
create index if not exists levytate_provider_programmes_provider_idx on public.levytate_provider_programmes (organisation_id, provider_id, record_status);
create index if not exists levytate_provider_programmes_status_idx on public.levytate_provider_programmes (organisation_id, status);
create index if not exists levytate_provider_relationships_provider_idx on public.levytate_provider_relationships (organisation_id, preferred_provider_id, status);
create index if not exists levytate_matching_requests_organisation_idx on public.levytate_matching_requests (organisation_id, status);
create index if not exists levytate_matching_requests_programme_idx on public.levytate_matching_requests (organisation_id, programme_id, status);
create index if not exists levytate_enrolments_organisation_idx on public.levytate_enrolments (organisation_id, status, created_at desc);
create index if not exists levytate_audit_events_organisation_idx on public.levytate_audit_events (organisation_id, created_at desc);
create index if not exists levytate_file_assets_organisation_idx on public.levytate_file_assets (organisation_id, created_at desc);
create index if not exists levytate_early_access_requests_status_idx on public.levytate_early_access_requests (status, submitted_at desc);
create index if not exists levytate_apprenticeship_standards_title_idx on public.levytate_apprenticeship_standards (title);
create index if not exists levytate_apprenticeship_standards_reference_idx on public.levytate_apprenticeship_standards (reference_code);
create index if not exists levytate_apprenticeship_standards_programme_type_idx on public.levytate_apprenticeship_standards (programme_type);
create index if not exists levytate_apprenticeship_standards_status_idx on public.levytate_apprenticeship_standards (status);

drop trigger if exists levytate_organisations_set_updated_at on public.levytate_organisations;
create trigger levytate_organisations_set_updated_at
before update on public.levytate_organisations
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_users_set_updated_at on public.levytate_users;
create trigger levytate_users_set_updated_at
before update on public.levytate_users
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_employees_set_updated_at on public.levytate_employees;
create trigger levytate_employees_set_updated_at
before update on public.levytate_employees
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_employee_development_profiles_set_updated_at on public.levytate_employee_development_profiles;
create trigger levytate_employee_development_profiles_set_updated_at
before update on public.levytate_employee_development_profiles
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_roles_set_updated_at on public.levytate_roles;
create trigger levytate_roles_set_updated_at
before update on public.levytate_roles
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_applications_set_updated_at on public.levytate_applications;
create trigger levytate_applications_set_updated_at
before update on public.levytate_applications
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_provider_programmes_set_updated_at on public.levytate_provider_programmes;
create trigger levytate_provider_programmes_set_updated_at
before update on public.levytate_provider_programmes
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_matching_requests_set_updated_at on public.levytate_matching_requests;
create trigger levytate_matching_requests_set_updated_at
before update on public.levytate_matching_requests
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_enrolments_set_updated_at on public.levytate_enrolments;
create trigger levytate_enrolments_set_updated_at
before update on public.levytate_enrolments
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_early_access_requests_set_updated_at on public.levytate_early_access_requests;
create trigger levytate_early_access_requests_set_updated_at
before update on public.levytate_early_access_requests
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists levytate_apprenticeship_standards_set_updated_at on public.levytate_apprenticeship_standards;
create trigger levytate_apprenticeship_standards_set_updated_at
before update on public.levytate_apprenticeship_standards
for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.levytate_organisations enable row level security;
alter table public.levytate_users enable row level security;
alter table public.levytate_employees enable row level security;
alter table public.levytate_employee_development_profiles enable row level security;
alter table public.levytate_roles enable row level security;
alter table public.levytate_role_pathway_mappings enable row level security;
alter table public.levytate_applications enable row level security;
alter table public.levytate_application_history enable row level security;
alter table public.levytate_providers enable row level security;
alter table public.levytate_provider_programmes enable row level security;
alter table public.levytate_provider_relationships enable row level security;
alter table public.levytate_matching_requests enable row level security;
alter table public.levytate_enrolments enable row level security;
alter table public.levytate_audit_events enable row level security;
alter table public.levytate_file_assets enable row level security;
alter table public.levytate_early_access_requests enable row level security;
alter table public.levytate_apprenticeship_standards enable row level security;

insert into storage.buckets (id, name, public)
values
  ('levytate-organisations', 'levytate-organisations', false),
  ('levytate-provider-documents', 'levytate-provider-documents', false),
  ('levytate-uploads', 'levytate-uploads', false)
on conflict (id) do nothing;
