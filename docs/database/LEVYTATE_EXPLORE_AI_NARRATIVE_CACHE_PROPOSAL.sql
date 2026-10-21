-- LevyTate Explore De-fluff narrative cache (STAGED ONLY).
-- Must be generated into a formal Supabase migration and applied to a
-- verified isolated Preview database after the backup/restore release gate.
-- No Production schema changes are authorised by this source file.

create table if not exists public.levytate_explore_ai_narratives (
  id uuid primary key default gen_random_uuid(),
  standard_code text not null check (standard_code ~ '^ST[0-9]{4}$'),
  standard_version text not null check (char_length(standard_version) between 1 and 40),
  source_digest text not null check (source_digest ~ '^[a-f0-9]{64}$'),
  prompt_version text not null check (prompt_version ~ '^defluff-v[0-9]+$'),
  source_occupation text not null check (source_occupation ~ '^OCC[0-9]{4}[A-Z]?$'),
  status text not null default 'pending' check (status in ('pending','generating','ready','failed')),
  content jsonb,
  attempts integer not null default 0 check (attempts between 0 and 10),
  claim_token uuid,
  claimed_at timestamptz,
  generated_at timestamptz,
  last_error_code text not null default '' check (char_length(last_error_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_code, standard_version, source_digest, prompt_version),
  check ((status = 'generating') = (claim_token is not null)),
  check (status <> 'ready' or (content is not null and jsonb_typeof(content) = 'object'))
);

create index if not exists levytate_explore_ai_narratives_recent_idx
  on public.levytate_explore_ai_narratives
  (standard_code, standard_version, prompt_version, generated_at desc)
  where status = 'ready';

alter table public.levytate_explore_ai_narratives enable row level security;
alter table public.levytate_explore_ai_narratives force row level security;
revoke all on public.levytate_explore_ai_narratives from public, anon, authenticated;
grant select, insert, update on public.levytate_explore_ai_narratives to service_role;

drop policy if exists levytate_explore_ai_narratives_service on public.levytate_explore_ai_narratives;
create policy levytate_explore_ai_narratives_service on public.levytate_explore_ai_narratives
for all to service_role using (true) with check (true);

create or replace function public.levytate_claim_explore_narrative(
  p_standard_code text,
  p_standard_version text,
  p_source_digest text,
  p_prompt_version text,
  p_source_occupation text
)
returns table(claim_state text, claim_token uuid, cached_content jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.levytate_explore_ai_narratives%rowtype;
  v_claim uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_standard_code !~ '^ST[0-9]{4}$'
     or char_length(coalesce(p_standard_version,'')) not between 1 and 40
     or p_source_digest !~ '^[a-f0-9]{64}$'
     or p_prompt_version !~ '^defluff-v[0-9]+$'
     or p_source_occupation !~ '^OCC[0-9]{4}[A-Z]?$' then
    raise exception 'invalid Explore generation claim' using errcode = '22023';
  end if;

  insert into public.levytate_explore_ai_narratives
  (standard_code, standard_version, source_digest, prompt_version, source_occupation, status)
  values (p_standard_code, p_standard_version, p_source_digest, p_prompt_version, p_source_occupation, 'pending')
  on conflict (standard_code, standard_version, source_digest, prompt_version) do nothing;

  select * into v_row from public.levytate_explore_ai_narratives n
  where n.standard_code = p_standard_code and n.standard_version = p_standard_version
    and n.source_digest = p_source_digest and n.prompt_version = p_prompt_version
  for update;

  if not found then
    raise exception 'Explore generation claim unavailable';
  end if;

  if v_row.status = 'ready' then
    return query select 'ready'::text, null::uuid, v_row.content;
    return;
  end if;

  if v_row.status = 'generating' and v_row.claimed_at >= now() - interval '75 seconds' then
    return query select 'in_progress'::text, null::uuid, null::jsonb;
    return;
  end if;

  if v_row.status = 'failed'
     and v_row.updated_at > now() - interval '15 minutes' then
    return query select 'cooldown'::text, null::uuid, null::jsonb;
    return;
  end if;

  if v_row.attempts >= 6 then
    return query select 'limit_reached'::text, null::uuid, null::jsonb;
    return;
  end if;

  v_claim := gen_random_uuid();
  update public.levytate_explore_ai_narratives as n
    set status = 'generating', claim_token = v_claim, claimed_at = now(),
        attempts = n.attempts + 1, updated_at = now(), last_error_code = ''
   where n.id = v_row.id;

  return query select 'claimed'::text, v_claim, null::jsonb;
end;
$$;

create or replace function public.levytate_complete_explore_narrative(
  p_standard_code text,
  p_standard_version text,
  p_source_digest text,
  p_prompt_version text,
  p_claim_token uuid,
  p_success boolean,
  p_content jsonb default null,
  p_error_code text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_success and (p_content is null or jsonb_typeof(p_content) <> 'object') then
    raise exception 'successful result requires an object' using errcode = '22023';
  end if;
  if char_length(coalesce(p_error_code,'')) > 80 then
    raise exception 'error code too long' using errcode = '22023';
  end if;

  update public.levytate_explore_ai_narratives as n
    set status = case when p_success then 'ready' else 'failed' end,
        content = case when p_success then p_content else null end,
        generated_at = case when p_success then now() else null end,
        claim_token = null, claimed_at = null,
        last_error_code = case when p_success then '' else coalesce(p_error_code,'provider_unavailable') end,
        updated_at = now()
  where n.standard_code = p_standard_code
    and n.standard_version = p_standard_version
    and n.source_digest = p_source_digest
    and n.prompt_version = p_prompt_version
    and n.claim_token = p_claim_token and n.status = 'generating';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.levytate_claim_explore_narrative(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.levytate_claim_explore_narrative(text,text,text,text,text)
  to service_role;
revoke all on function public.levytate_complete_explore_narrative(text,text,text,text,uuid,boolean,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.levytate_complete_explore_narrative(text,text,text,text,uuid,boolean,jsonb,text)
  to service_role;

-- Neither browser users nor employer tenants can access cached narratives.
-- Public routes only return structured plain-English fields after server checks.
