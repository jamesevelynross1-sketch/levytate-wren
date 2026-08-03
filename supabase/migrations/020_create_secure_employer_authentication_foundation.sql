alter table if exists public.levytate_users
  add column if not exists auth_binding_status text not null default 'not_prepared',
  add column if not exists auth_bound_at timestamptz,
  add column if not exists last_authentication_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'levytate_users_auth_binding_status_check'
  ) then
    alter table public.levytate_users
      add constraint levytate_users_auth_binding_status_check
      check (auth_binding_status in ('not_prepared', 'pending', 'bound'));
  end if;
end $$;

create unique index if not exists levytate_users_auth_subject_unique_idx
  on public.levytate_users (auth_subject)
  where auth_subject is not null;

create index if not exists levytate_users_auth_binding_status_idx
  on public.levytate_users (auth_binding_status, active);

comment on column public.levytate_users.auth_subject is
  'Durable binding to auth.users.id. Role and organisation remain authoritative on this membership record.';
comment on column public.levytate_users.auth_binding_status is
  'Safe internal lifecycle state for individual employer authentication.';
