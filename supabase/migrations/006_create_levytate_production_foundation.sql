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

create table if not exists public.levytate_providers (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  provider_id text not null,
  provider_name text not null,
  website text not null default '',
  provider_type text not null,
  sectors jsonb not null default '[]'::jsonb,
  delivery_model jsonb not null default '[]'::jsonb,
  regions jsonb not null default '[]'::jsonb,
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

create table if not exists public.levytate_provider_programmes (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  provider_id text not null,
  apprenticeship_standard_id text not null,
  delivery_mode text not null default '',
  regions jsonb not null default '[]'::jsonb,
  status text not null default 'Needs verification',
  verification_status text not null default 'Needs manual verification',
  source_url text not null default '',
  notes text not null default '',
  record_status text not null default 'Active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

create table if not exists public.levytate_provider_relationships (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  category text not null,
  preferred_provider_id text not null,
  backup_provider_ids jsonb not null default '[]'::jsonb,
  apprenticeship_standard_ids jsonb not null default '[]'::jsonb,
  status text not null,
  notes text not null default '',
  review_date date not null,
  last_used_date date not null,
  primary key (organisation_id, id)
);

create table if not exists public.levytate_matching_requests (
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  id text not null,
  role_need text not null,
  apprenticeship_standard_id text not null,
  learner_count integer not null default 0,
  sites jsonb not null default '[]'::jsonb,
  delivery_preference text not null default '',
  funding_position text not null default '',
  urgency text not null default '',
  notes text not null default '',
  status text not null,
  shortlist_provider_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id)
);

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

create index if not exists levytate_users_organisation_idx on public.levytate_users (organisation_id);
create index if not exists levytate_employees_organisation_idx on public.levytate_employees (organisation_id, status);
create index if not exists levytate_roles_organisation_idx on public.levytate_roles (organisation_id, status);
create index if not exists levytate_applications_organisation_idx on public.levytate_applications (organisation_id, status);
create index if not exists levytate_providers_organisation_idx on public.levytate_providers (organisation_id, status);
create index if not exists levytate_matching_requests_organisation_idx on public.levytate_matching_requests (organisation_id, status);
create index if not exists levytate_audit_events_organisation_idx on public.levytate_audit_events (organisation_id, created_at desc);
create index if not exists levytate_file_assets_organisation_idx on public.levytate_file_assets (organisation_id, created_at desc);

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

insert into storage.buckets (id, name, public)
values
  ('levytate-organisations', 'levytate-organisations', false),
  ('levytate-provider-documents', 'levytate-provider-documents', false),
  ('levytate-uploads', 'levytate-uploads', false)
on conflict (id) do nothing;
