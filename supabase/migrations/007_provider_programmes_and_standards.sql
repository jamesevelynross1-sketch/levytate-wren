alter table if exists public.levytate_providers
  add column if not exists industries jsonb not null default '[]'::jsonb,
  add column if not exists technologies jsonb not null default '[]'::jsonb,
  add column if not exists delivery_models jsonb not null default '[]'::jsonb,
  add column if not exists employer_types jsonb not null default '[]'::jsonb,
  add column if not exists specialisms jsonb not null default '[]'::jsonb;

update public.levytate_providers
set delivery_models = case
  when jsonb_typeof(delivery_models) = 'array' and jsonb_array_length(delivery_models) > 0 then delivery_models
  else coalesce(delivery_model, '[]'::jsonb)
end
where coalesce(delivery_models, '[]'::jsonb) = '[]'::jsonb;

alter table if exists public.levytate_provider_programmes
  add column if not exists programme_name text not null default '',
  add column if not exists short_description text not null default '',
  add column if not exists full_description text not null default '',
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
  add column if not exists funding_route text not null default 'Potentially funded through levy/co-investment';

update public.levytate_provider_programmes
set short_description = case
      when short_description <> '' then short_description
      else coalesce(marketing_description, '')
    end,
    full_description = case
      when full_description <> '' then full_description
      else coalesce(marketing_description, '')
    end,
    target_industries = case
      when jsonb_typeof(target_industries) = 'array' and jsonb_array_length(target_industries) > 0 then target_industries
      else coalesce(industries_served, '[]'::jsonb)
    end,
    target_job_roles = case
      when jsonb_typeof(target_job_roles) = 'array' and jsonb_array_length(target_job_roles) > 0 then target_job_roles
      else coalesce(typical_job_roles, '[]'::jsonb)
    end,
    delivery_models = case
      when jsonb_typeof(delivery_models) = 'array' and jsonb_array_length(delivery_models) > 0 then delivery_models
      else coalesce(delivery_model, '[]'::jsonb)
    end,
    linked_standard_id = coalesce(linked_standard_id, apprenticeship_standard_id),
    linked_standard_ids = case
      when jsonb_typeof(linked_standard_ids) = 'array' and jsonb_array_length(linked_standard_ids) > 0 then linked_standard_ids
      when apprenticeship_standard_id is not null and apprenticeship_standard_id <> '' then jsonb_build_array(apprenticeship_standard_id)
      else '[]'::jsonb
    end
where true;

alter table if exists public.levytate_provider_relationships
  add column if not exists programme_ids jsonb not null default '[]'::jsonb;

alter table if exists public.levytate_matching_requests
  add column if not exists department text not null default '',
  add column if not exists future_capability text not null default '',
  add column if not exists employer_size text not null default '',
  add column if not exists programme_id text not null default '',
  add column if not exists linked_standard_id text not null default '',
  add column if not exists business_problems jsonb not null default '[]'::jsonb,
  add column if not exists target_roles jsonb not null default '[]'::jsonb,
  add column if not exists technologies jsonb not null default '[]'::jsonb,
  add column if not exists industries jsonb not null default '[]'::jsonb;

update public.levytate_matching_requests
set linked_standard_id = case
      when linked_standard_id <> '' then linked_standard_id
      else coalesce(apprenticeship_standard_id, '')
    end
where true;

create table if not exists public.levytate_apprenticeship_standards (
  id text primary key,
  title text not null,
  reference_code text not null,
  level integer not null,
  occupational_route text not null,
  funding_band integer,
  typical_duration text not null default '',
  status text not null,
  official_url text not null default '',
  version text not null default 'Current',
  last_verified date,
  last_synced_at date,
  source_name text not null default 'Skills England apprenticeship finder',
  source_url text not null default 'https://skillsengland.education.gov.uk/apprenticeships/'
);

create index if not exists levytate_provider_programmes_provider_idx on public.levytate_provider_programmes (organisation_id, provider_id, record_status);
create index if not exists levytate_provider_programmes_status_idx on public.levytate_provider_programmes (organisation_id, status);
create index if not exists levytate_matching_requests_programme_idx on public.levytate_matching_requests (organisation_id, programme_id, status);
