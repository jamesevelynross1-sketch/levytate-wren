create table if not exists public.levytate_prospect_access (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete cascade,
  user_id uuid not null references public.levytate_users(id) on delete cascade,
  access_status text not null default 'prepared'
    check (access_status in ('prepared', 'active', 'expired', 'revoked')),
  access_start_at timestamptz,
  access_expires_at timestamptz,
  first_login_at timestamptz,
  guidance_completed_at timestamptz,
  guidance_completed_by text not null default '',
  revoked_at timestamptz,
  revoked_by text not null default '',
  revocation_reason text not null default '',
  reactivated_at timestamptz,
  reactivated_by text not null default '',
  internal_owner_name text not null default '',
  internal_notes text not null default '',
  last_status_changed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  version integer not null default 1 check (version > 0),
  unique (organisation_id, user_id),
  check (access_expires_at is null or access_start_at is null or access_expires_at >= access_start_at)
);

create index if not exists levytate_prospect_access_status_idx
  on public.levytate_prospect_access (access_status, access_expires_at);
create index if not exists levytate_prospect_access_user_idx
  on public.levytate_prospect_access (user_id);

alter table public.levytate_prospect_access enable row level security;

drop policy if exists "Service role manages LevyTate prospect access" on public.levytate_prospect_access;
create policy "Service role manages LevyTate prospect access"
  on public.levytate_prospect_access
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.levytate_prospect_access is
  'Organisation-scoped governance for controlled prospect workspace access. Employer roles cannot administer this table.';
comment on column public.levytate_prospect_access.internal_notes is
  'Internal LevyTate notes. Never expose this field in prospect-facing responses.';
