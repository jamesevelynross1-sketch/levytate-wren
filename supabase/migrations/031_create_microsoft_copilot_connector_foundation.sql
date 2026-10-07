-- Microsoft 365 Copilot connector foundation.
--
-- Additive only. The connector remains disabled unless both the runtime flag
-- and an active organisation connection/capability are present. No employer
-- operational record is changed by this migration.

alter table public.levytate_organisation_capabilities
  add column if not exists microsoft_copilot_enabled boolean not null default false;

comment on column public.levytate_organisation_capabilities.microsoft_copilot_enabled is
  'Server-owned organisation capability for the read-only Microsoft 365 Copilot connector. Defaults off.';

create table if not exists public.levytate_external_tenant_connections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  provider text not null,
  external_tenant_id text not null,
  display_name text not null default '',
  status text not null default 'inactive',
  connected_by uuid references public.levytate_users(id) on delete set null,
  connected_at timestamptz,
  last_successful_activity_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint levytate_external_tenant_connections_provider_check
    check (provider in ('microsoft_entra')),
  constraint levytate_external_tenant_connections_tenant_check
    check (external_tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  constraint levytate_external_tenant_connections_status_check
    check (status in ('inactive', 'active', 'suspended')),
  constraint levytate_external_tenant_connections_active_timestamp_check
    check (status <> 'active' or connected_at is not null),
  constraint levytate_external_tenant_connections_provider_tenant_unique
    unique (provider, external_tenant_id),
  constraint levytate_external_tenant_connections_org_provider_tenant_unique
    unique (organisation_id, provider, external_tenant_id),
  constraint levytate_external_tenant_connections_organisation_provider_unique
    unique (organisation_id, provider)
);

create index if not exists levytate_external_tenant_connections_org_status_idx
  on public.levytate_external_tenant_connections (organisation_id, provider, status);

comment on table public.levytate_external_tenant_connections is
  'Explicit external tenant to LevyTate organisation bindings. A Microsoft tenant can resolve to one employer organisation only.';

create table if not exists public.levytate_external_identities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  levytate_user_id uuid not null references public.levytate_users(id) on delete restrict,
  provider text not null,
  external_tenant_id text not null,
  external_object_id text not null,
  email_hint text not null default '',
  status text not null default 'active',
  binding_method text not null default 'explicit',
  first_bound_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint levytate_external_identities_provider_check
    check (provider in ('microsoft_entra')),
  constraint levytate_external_identities_tenant_check
    check (external_tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  constraint levytate_external_identities_object_check
    check (external_object_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  constraint levytate_external_identities_status_check
    check (status in ('active', 'revoked')),
  constraint levytate_external_identities_binding_method_check
    check (binding_method in ('explicit', 'just_in_time')),
  constraint levytate_external_identities_email_hint_check
    check (email_hint = '' or email_hint = lower(btrim(email_hint))),
  constraint levytate_external_identities_subject_unique
    unique (provider, external_tenant_id, external_object_id),
  constraint levytate_external_identities_user_provider_unique
    unique (organisation_id, levytate_user_id, provider),
  constraint levytate_external_identities_connection_fk
    foreign key (organisation_id, provider, external_tenant_id)
    references public.levytate_external_tenant_connections (organisation_id, provider, external_tenant_id)
    on delete restrict
);

create index if not exists levytate_external_identities_org_user_status_idx
  on public.levytate_external_identities (organisation_id, levytate_user_id, provider, status);

comment on table public.levytate_external_identities is
  'Durable external identities keyed by immutable provider tenant and object IDs. Email is a JIT binding hint only.';

create table if not exists public.levytate_external_connector_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.levytate_organisations(id) on delete restrict,
  levytate_user_id uuid references public.levytate_users(id) on delete set null,
  provider text not null,
  external_tenant_id text not null default '',
  external_object_id text not null default '',
  correlation_id uuid not null,
  event_type text not null,
  tool_name text,
  outcome text not null,
  error_code text,
  result_count integer,
  duration_ms integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint levytate_external_connector_events_provider_check
    check (provider in ('microsoft_entra')),
  constraint levytate_external_connector_events_event_type_check
    check (event_type ~ '^[a-z0-9_.:-]{1,100}$'),
  constraint levytate_external_connector_events_tool_name_check
    check (tool_name is null or tool_name ~ '^[a-z0-9_]{1,80}$'),
  constraint levytate_external_connector_events_outcome_check
    check (outcome in ('allowed', 'denied', 'error')),
  constraint levytate_external_connector_events_error_code_check
    check (error_code is null or error_code ~ '^[a-z0-9_.:-]{1,100}$'),
  constraint levytate_external_connector_events_result_count_check
    check (result_count is null or result_count >= 0),
  constraint levytate_external_connector_events_duration_check
    check (duration_ms >= 0)
);

create index if not exists levytate_external_connector_events_org_recent_idx
  on public.levytate_external_connector_events (organisation_id, created_at desc);
create index if not exists levytate_external_connector_events_subject_recent_idx
  on public.levytate_external_connector_events (provider, external_tenant_id, external_object_id, created_at desc);
create index if not exists levytate_external_connector_events_correlation_idx
  on public.levytate_external_connector_events (correlation_id);

comment on table public.levytate_external_connector_events is
  'Metadata-only audit trail for allowed and denied external connector requests. Tokens, request bodies and returned employer data are never stored.';

create or replace function public.levytate_enforce_external_tenant_connection_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.organisation_id is distinct from old.organisation_id
    or new.provider is distinct from old.provider
    or new.external_tenant_id is distinct from old.external_tenant_id
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'External tenant connection identity fields are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists levytate_external_tenant_connections_identity_immutable
  on public.levytate_external_tenant_connections;
create trigger levytate_external_tenant_connections_identity_immutable
  before update on public.levytate_external_tenant_connections
  for each row execute function public.levytate_enforce_external_tenant_connection_identity();

create or replace function public.levytate_enforce_external_identity_key()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.organisation_id is distinct from old.organisation_id
    or new.levytate_user_id is distinct from old.levytate_user_id
    or new.provider is distinct from old.provider
    or new.external_tenant_id is distinct from old.external_tenant_id
    or new.external_object_id is distinct from old.external_object_id
    or new.email_hint is distinct from old.email_hint
    or new.binding_method is distinct from old.binding_method
    or new.first_bound_at is distinct from old.first_bound_at
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'External identity binding fields are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists levytate_external_identities_key_immutable
  on public.levytate_external_identities;
create trigger levytate_external_identities_key_immutable
  before update on public.levytate_external_identities
  for each row execute function public.levytate_enforce_external_identity_key();

revoke all on function public.levytate_enforce_external_tenant_connection_identity() from public, anon, authenticated, service_role;
revoke all on function public.levytate_enforce_external_identity_key() from public, anon, authenticated, service_role;

alter table public.levytate_external_tenant_connections enable row level security;
alter table public.levytate_external_tenant_connections force row level security;
alter table public.levytate_external_identities enable row level security;
alter table public.levytate_external_identities force row level security;
alter table public.levytate_external_connector_events enable row level security;
alter table public.levytate_external_connector_events force row level security;

revoke all on table public.levytate_external_tenant_connections from public, anon, authenticated;
revoke all on table public.levytate_external_identities from public, anon, authenticated;
revoke all on table public.levytate_external_connector_events from public, anon, authenticated;
revoke all privileges on table public.levytate_external_tenant_connections from service_role;
revoke all privileges on table public.levytate_external_identities from service_role;
revoke all privileges on table public.levytate_external_connector_events from service_role;

grant select, insert, update on table public.levytate_external_tenant_connections to service_role;
grant select, insert, update on table public.levytate_external_identities to service_role;
grant select, insert on table public.levytate_external_connector_events to service_role;

drop policy if exists levytate_external_tenant_connections_service_role_all on public.levytate_external_tenant_connections;
drop policy if exists levytate_external_tenant_connections_service_role_select on public.levytate_external_tenant_connections;
create policy levytate_external_tenant_connections_service_role_select
  on public.levytate_external_tenant_connections for select to service_role
  using (auth.role() = 'service_role');
drop policy if exists levytate_external_tenant_connections_service_role_insert on public.levytate_external_tenant_connections;
create policy levytate_external_tenant_connections_service_role_insert
  on public.levytate_external_tenant_connections for insert to service_role
  with check (auth.role() = 'service_role');
drop policy if exists levytate_external_tenant_connections_service_role_update on public.levytate_external_tenant_connections;
create policy levytate_external_tenant_connections_service_role_update
  on public.levytate_external_tenant_connections for update to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists levytate_external_identities_service_role_all on public.levytate_external_identities;
drop policy if exists levytate_external_identities_service_role_select on public.levytate_external_identities;
create policy levytate_external_identities_service_role_select
  on public.levytate_external_identities for select to service_role
  using (auth.role() = 'service_role');
drop policy if exists levytate_external_identities_service_role_insert on public.levytate_external_identities;
create policy levytate_external_identities_service_role_insert
  on public.levytate_external_identities for insert to service_role
  with check (auth.role() = 'service_role');
drop policy if exists levytate_external_identities_service_role_update on public.levytate_external_identities;
create policy levytate_external_identities_service_role_update
  on public.levytate_external_identities for update to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists levytate_external_connector_events_service_role_select on public.levytate_external_connector_events;
create policy levytate_external_connector_events_service_role_select
  on public.levytate_external_connector_events for select to service_role
  using (auth.role() = 'service_role');

drop policy if exists levytate_external_connector_events_service_role_insert on public.levytate_external_connector_events;
create policy levytate_external_connector_events_service_role_insert
  on public.levytate_external_connector_events for insert to service_role
  with check (auth.role() = 'service_role');
