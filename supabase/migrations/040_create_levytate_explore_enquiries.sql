-- LevyTate Explore: isolated public lead register and durable notification outbox.
-- STAGED ONLY. Do not apply to shared/Production Supabase before backup, restore,
-- permissions, privacy and release approval gates.
-- No employer tenant tables are altered.

create table if not exists public.levytate_explore_enquiries (
  id uuid primary key default gen_random_uuid(),
  environment_namespace text not null check (environment_namespace in ('local','preview','production')),
  dedupe_key text not null check (dedupe_key ~ '^[a-f0-9]{64}$'),
  origin text not null default 'public_explore' check (origin = 'public_explore'),
  requester_type text not null default 'employee' check (requester_type in ('employee','manager')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  email text not null check (char_length(email) between 6 and 254),
  organisation text not null check (char_length(btrim(organisation)) between 2 and 140),
  job_title text not null default '' check (char_length(job_title) <= 120),
  employee_note text not null default '' check (char_length(employee_note) <= 800),
  standard_code text not null check (standard_code ~ '^ST[0-9]{4}$'),
  standard_title text not null check (char_length(standard_title) between 2 and 180),
  source_url text not null check (char_length(source_url) between 20 and 1200),
  source_version text not null default '' check (char_length(source_version) <= 40),
  source_last_verified date,
  consent_version text not null check (consent_version ~ '^explore-guidance-v[0-9]+$'),
  consent_text text not null check (char_length(consent_text) between 30 and 1000),
  consent_given_at timestamptz not null default now(),
  manager_contact_authorised boolean not null default false check (manager_contact_authorised = false),
  status text not null default 'new' check (status in (
    'new','in_review','guidance_sent','manager_conversation','provider_matching',
    'enrolled','converted_to_levytate','closed'
  )),
  commercial_route text not null default 'unqualified' check (commercial_route in (
    'unqualified','provider_referral','levytate_licence','both','none'
  )),
  internal_notes text not null default '' check (char_length(internal_notes) <= 2000),
  updated_by text not null default '' check (char_length(updated_by) <= 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment_namespace, dedupe_key)
);

create index if not exists levytate_explore_enquiries_queue_idx
  on public.levytate_explore_enquiries (environment_namespace, status, created_at desc);
create index if not exists levytate_explore_enquiries_created_idx
  on public.levytate_explore_enquiries (environment_namespace, created_at desc);

create table if not exists public.levytate_explore_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.levytate_explore_enquiries(id) on delete cascade,
  environment_namespace text not null check (environment_namespace in ('local','preview','production')),
  event_type text not null default 'new_enquiry' check (event_type = 'new_enquiry'),
  status text not null default 'pending' check (status in ('pending','leased','failed','sent','dead')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  lease_token uuid,
  leased_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error_code text not null default '' check (char_length(last_error_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enquiry_id, event_type),
  check ((status = 'leased') = (lease_token is not null))
);

create index if not exists levytate_explore_outbox_due_idx
  on public.levytate_explore_notification_outbox
  (environment_namespace, status, next_attempt_at, created_at);

create table if not exists public.levytate_explore_enquiry_audit (
  id bigint generated always as identity primary key,
  enquiry_id uuid not null references public.levytate_explore_enquiries(id) on delete cascade,
  environment_namespace text not null check (environment_namespace in ('local','preview','production')),
  previous_status text not null,
  new_status text not null,
  previous_route text not null,
  new_route text not null,
  changed_by text not null check (char_length(changed_by) between 3 and 254),
  created_at timestamptz not null default now()
);

create index if not exists levytate_explore_enquiry_audit_lookup_idx
  on public.levytate_explore_enquiry_audit (environment_namespace, enquiry_id, created_at desc);

create or replace function public.levytate_explore_enqueue_notification()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.levytate_explore_notification_outbox (enquiry_id, environment_namespace)
  values (new.id, new.environment_namespace);
  return new;
end;
$$;

drop trigger if exists levytate_explore_enqueue_notification on public.levytate_explore_enquiries;
create trigger levytate_explore_enqueue_notification
after insert on public.levytate_explore_enquiries
for each row execute function public.levytate_explore_enqueue_notification();

create or replace function public.levytate_explore_enquiry_updated()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Public submitters never receive update privileges; the server's admin
  -- workflow must set updated_by whenever changing an existing enquiry.
  if old.status is distinct from new.status
     or old.commercial_route is distinct from new.commercial_route
     or old.internal_notes is distinct from new.internal_notes then
    if char_length(btrim(new.updated_by)) < 3 then
      raise exception 'Explore enquiry changes require an admin identity'
        using errcode = '22023';
    end if;
    insert into public.levytate_explore_enquiry_audit
      (enquiry_id, environment_namespace, previous_status, new_status,
       previous_route, new_route, changed_by)
    values (old.id, old.environment_namespace, old.status, new.status,
            old.commercial_route, new.commercial_route, new.updated_by);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists levytate_explore_enquiry_updated on public.levytate_explore_enquiries;
create trigger levytate_explore_enquiry_updated
before update on public.levytate_explore_enquiries
for each row execute function public.levytate_explore_enquiry_updated();

-- An atomic leasing RPC prevents two Vercel instances from sending the same
-- notification simultaneously. A stale lease is reclaimed after 15 minutes.
create or replace function public.levytate_claim_explore_notifications(
  p_environment_namespace text,
  p_limit integer default 10,
  p_enquiry_id uuid default null
)
returns table(notification_id uuid, enquiry_id uuid, claim_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_environment_namespace not in ('local','preview','production')
     or p_limit < 1 or p_limit > 25 then
    raise exception 'invalid outbox claim' using errcode = '22023';
  end if;

  return query
  with due as (
    select o.id
    from public.levytate_explore_notification_outbox o
    where o.environment_namespace = p_environment_namespace
      and (p_enquiry_id is null or o.enquiry_id = p_enquiry_id)
      and o.attempts < 8
      and (
        (o.status in ('pending','failed') and o.next_attempt_at <= now())
        or (o.status = 'leased' and o.leased_at < now() - interval '15 minutes')
      )
    order by o.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.levytate_explore_notification_outbox o
     set status = 'leased',
         attempts = o.attempts + 1,
         lease_token = gen_random_uuid(),
         leased_at = now(),
         updated_at = now()
    from due
   where o.id = due.id
  returning o.id, o.enquiry_id, o.lease_token;
end;
$$;

create or replace function public.levytate_complete_explore_notification(
  p_notification_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if char_length(coalesce(p_error_code, '')) > 80 then
    raise exception 'error code too long' using errcode = '22023';
  end if;

  update public.levytate_explore_notification_outbox as o
     set status = case when p_success then 'sent'
                       when o.attempts >= 8 then 'dead'
                       else 'failed' end,
         lease_token = null,
         leased_at = null,
         sent_at = case when p_success then now() else null end,
         next_attempt_at = case when p_success then o.next_attempt_at
                               else now() + make_interval(secs => least(3600, 30 * power(2, least(o.attempts, 7))::integer)) end,
         last_error_code = case when p_success then '' else left(coalesce(p_error_code,'delivery_failed'), 80) end,
         updated_at = now()
   where o.id = p_notification_id
     and o.lease_token = p_claim_token
     and o.status = 'leased';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

alter table public.levytate_explore_enquiries enable row level security;
alter table public.levytate_explore_enquiries force row level security;
alter table public.levytate_explore_notification_outbox enable row level security;
alter table public.levytate_explore_notification_outbox force row level security;
alter table public.levytate_explore_enquiry_audit enable row level security;
alter table public.levytate_explore_enquiry_audit force row level security;

revoke all on table public.levytate_explore_enquiries from public, anon, authenticated;
revoke all on table public.levytate_explore_notification_outbox from public, anon, authenticated;
revoke all on table public.levytate_explore_enquiry_audit from public, anon, authenticated;
revoke all on sequence public.levytate_explore_enquiry_audit_id_seq from public, anon, authenticated;

grant select, insert, update, delete on public.levytate_explore_enquiries to service_role;
grant select, insert, update, delete on public.levytate_explore_notification_outbox to service_role;
grant select, insert, update, delete on public.levytate_explore_enquiry_audit to service_role;
grant usage, select on sequence public.levytate_explore_enquiry_audit_id_seq to service_role;

drop policy if exists levytate_explore_enquiries_service on public.levytate_explore_enquiries;
create policy levytate_explore_enquiries_service on public.levytate_explore_enquiries
  for all to service_role using (true) with check (true);
drop policy if exists levytate_explore_outbox_service on public.levytate_explore_notification_outbox;
create policy levytate_explore_outbox_service on public.levytate_explore_notification_outbox
  for all to service_role using (true) with check (true);
drop policy if exists levytate_explore_audit_service on public.levytate_explore_enquiry_audit;
create policy levytate_explore_audit_service on public.levytate_explore_enquiry_audit
  for all to service_role using (true) with check (true);

revoke all on function public.levytate_claim_explore_notifications(text, integer, uuid) from public, anon, authenticated;
grant execute on function public.levytate_claim_explore_notifications(text, integer, uuid) to service_role;
revoke all on function public.levytate_complete_explore_notification(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.levytate_complete_explore_notification(uuid, uuid, boolean, text) to service_role;

-- This schema intentionally has no public SELECT policy, no employer-tenant FK,
-- and no employer outreach permission. All employee browsing remains anonymous.
