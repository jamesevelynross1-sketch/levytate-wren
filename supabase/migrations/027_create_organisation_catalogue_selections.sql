-- Organisation-specific selections of the canonical LevyTate provider catalogue.
-- Canonical providers and programmes remain global records and are never copied.

create table public.levytate_organisation_providers (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  provider_id text not null,
  status text not null default 'Active',
  selected_by text not null default '',
  selected_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, provider_id),
  constraint levytate_organisation_providers_status_check check (status in ('Active','Inactive'))
);

create index levytate_organisation_providers_status_idx
  on public.levytate_organisation_providers (organisation_id, status, selected_at desc);

create table public.levytate_organisation_programmes (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  programme_id text not null,
  provider_id text not null,
  status text not null default 'Active',
  selected_by text not null default '',
  selected_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, programme_id),
  constraint levytate_organisation_programmes_status_check check (status in ('Active','Inactive'))
);

create index levytate_organisation_programmes_status_idx
  on public.levytate_organisation_programmes (organisation_id, status, selected_at desc);
create index levytate_organisation_programmes_provider_idx
  on public.levytate_organisation_programmes (organisation_id, provider_id, status);

alter table public.levytate_organisation_providers enable row level security;
alter table public.levytate_organisation_providers force row level security;
alter table public.levytate_organisation_programmes enable row level security;
alter table public.levytate_organisation_programmes force row level security;

revoke all on table public.levytate_organisation_providers from public, anon, authenticated;
revoke all on table public.levytate_organisation_programmes from public, anon, authenticated;
grant select, insert, update, delete on table public.levytate_organisation_providers to service_role;
grant select, insert, update, delete on table public.levytate_organisation_programmes to service_role;

create policy levytate_organisation_providers_service_role_all
  on public.levytate_organisation_providers for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_organisation_programmes_service_role_all
  on public.levytate_organisation_programmes for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
