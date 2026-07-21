alter table if exists public.levytate_organisations
  add column if not exists logo_reference text not null default '',
  add column if not exists workspace_template text not null default '';

alter table if exists public.levytate_users
  add column if not exists display_name text not null default '',
  add column if not exists active boolean not null default true;

create index if not exists levytate_users_active_organisation_idx
  on public.levytate_users (organisation_id, active);

comment on column public.levytate_organisations.workspace_template is
  'Internal provisioning template identifier. Never displayed as employer-facing workspace copy.';
comment on column public.levytate_organisations.logo_reference is
  'Optional employer branding reference. It must not contain secret material.';
comment on column public.levytate_users.active is
  'Controls workspace membership without deleting the user, organisation, audit trail or employer records.';
