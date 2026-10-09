-- Configurable application workflows V1. Additive only.
-- This migration is intentionally safe-by-default: the organisation capability
-- defaults off and all workflow persistence is service-role only.

alter table public.levytate_organisation_capabilities
  add column if not exists application_workflows_enabled boolean not null default false;

comment on column public.levytate_organisation_capabilities.application_workflows_enabled is
  'Server-owned capability for versioned configurable application workflows. Defaults off.';

create table if not exists public.levytate_application_workflows (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id),
  name text not null default 'Application workflow',
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id),
  unique (organisation_id, id)
);

create table if not exists public.levytate_application_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id),
  workflow_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null check (status in ('draft', 'published', 'superseded')),
  steps jsonb not null,
  created_by uuid references public.levytate_users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (workflow_id, version_number),
  unique (workflow_id, id),
  unique (organisation_id, id),
  foreign key (organisation_id, workflow_id) references public.levytate_application_workflows(organisation_id, id),
  check (jsonb_typeof(steps) = 'array')
);

alter table public.levytate_application_workflows
  drop constraint if exists levytate_application_workflows_published_version_id_fkey;
alter table public.levytate_application_workflows
  add constraint levytate_application_workflows_published_version_id_fkey
  foreign key (id, published_version_id)
  references public.levytate_application_workflow_versions(workflow_id, id);

create unique index if not exists levytate_application_workflow_one_draft
  on public.levytate_application_workflow_versions(workflow_id)
  where status = 'draft';

create table if not exists public.levytate_application_workflow_instances (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id),
  application_id text not null,
  workflow_version_id uuid not null,
  current_step_id text not null,
  state text not null check (state in ('active', 'needs_information', 'declined', 'ready_for_provider')),
  return_step_id text,
  lock_version integer not null default 0 check (lock_version >= 0),
  last_progressed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, application_id),
  unique (organisation_id, application_id, workflow_version_id),
  foreign key (organisation_id, application_id) references public.levytate_applications(organisation_id, id),
  foreign key (organisation_id, workflow_version_id) references public.levytate_application_workflow_versions(organisation_id, id)
);

create table if not exists public.levytate_application_workflow_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id),
  application_id text not null,
  workflow_version_id uuid not null,
  step_id text not null,
  action text not null check (action in ('submit', 'approve', 'continue', 'request_information', 'resubmit', 'decline')),
  actor_user_id uuid not null references public.levytate_users(id),
  actor_role text not null check (actor_role in ('Employee', 'Line Manager', 'Apprenticeship Lead', 'Employer Admin')),
  note text not null default '',
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  from_lock_version integer not null,
  to_lock_version integer not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, application_id, idempotency_key),
  foreign key (organisation_id, application_id) references public.levytate_applications(organisation_id, id),
  foreign key (organisation_id, workflow_version_id) references public.levytate_application_workflow_versions(organisation_id, id),
  foreign key (organisation_id, application_id, workflow_version_id)
    references public.levytate_application_workflow_instances(organisation_id, application_id, workflow_version_id)
);

create index if not exists levytate_application_workflow_versions_org_idx on public.levytate_application_workflow_versions(organisation_id, workflow_id, version_number desc);
create index if not exists levytate_application_workflow_instances_org_idx on public.levytate_application_workflow_instances(organisation_id, state, last_progressed_at);
create index if not exists levytate_application_workflow_events_application_idx on public.levytate_application_workflow_events(organisation_id, application_id, created_at);

create or replace function public.levytate_validate_application_workflow_steps(p_steps jsonb)
returns boolean language plpgsql immutable as $$
declare
  v_count integer;
  v_step jsonb;
  v_ids integer;
begin
  if jsonb_typeof(p_steps) <> 'array' then return false; end if;
  v_count := jsonb_array_length(p_steps);
  if v_count < 3 or v_count > 8 then return false; end if;
  if p_steps->0->>'type' <> 'employee_submission' or p_steps->0->>'responsibleRole' <> 'Employee' then return false; end if;
  if p_steps->(v_count - 1)->>'type' <> 'provider_handoff' or p_steps->(v_count - 1)->>'responsibleRole' <> 'Provider Partner' then return false; end if;
  if (select count(*) from jsonb_array_elements(p_steps) item where item->>'type' = 'employee_submission') <> 1 then return false; end if;
  if (select count(*) from jsonb_array_elements(p_steps) item where item->>'type' = 'provider_handoff') <> 1 then return false; end if;
  select count(distinct item->>'id') into v_ids from jsonb_array_elements(p_steps) item;
  if v_ids <> v_count then return false; end if;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    if coalesce(v_step->>'id', '') !~ '^[a-z0-9][a-z0-9-]{1,63}$' then return false; end if;
    if coalesce(v_step->>'label', '') !~ '^[[:alnum:]][[:alnum:] &''(),./-]{1,78}$' then return false; end if;
    if v_step->>'type' in ('role_review', 'role_approval') and v_step->>'responsibleRole' not in ('Line Manager', 'Apprenticeship Lead', 'Employer Admin') then return false; end if;
    if v_step->>'type' = 'role_approval' and not coalesce((v_step->>'allowDecline')::boolean, false) then return false; end if;
    if v_step->>'type' = 'employee_submission' and (v_step->>'responsibleRole' <> 'Employee' or coalesce((v_step->>'allowDecline')::boolean, false)) then return false; end if;
    if v_step->>'type' = 'provider_handoff' and (v_step->>'responsibleRole' <> 'Provider Partner' or coalesce((v_step->>'allowDecline')::boolean, false)) then return false; end if;
    if v_step->>'type' not in ('employee_submission', 'role_review', 'role_approval', 'provider_handoff') then return false; end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(p_steps) item where item->>'type' in ('role_review', 'role_approval')) then return false; end if;
  return true;
end;
$$;

alter table public.levytate_application_workflow_versions
  drop constraint if exists levytate_application_workflow_versions_steps_valid;
alter table public.levytate_application_workflow_versions
  add constraint levytate_application_workflow_versions_steps_valid
  check (public.levytate_validate_application_workflow_steps(steps));

create or replace function public.levytate_protect_application_workflow_version()
returns trigger language plpgsql as $$
begin
  if old.status = 'published' and new.status = 'superseded'
    and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status')
  then return new; end if;
  if old.status <> 'draft' then raise exception 'Published application workflow versions are immutable'; end if;
  if new.id <> old.id or new.workflow_id <> old.workflow_id or new.organisation_id <> old.organisation_id
    or new.version_number <> old.version_number or new.created_by is distinct from old.created_by
    or new.created_at <> old.created_at
  then raise exception 'Workflow version identity is immutable'; end if;
  return new;
end;
$$;

drop trigger if exists levytate_application_workflow_versions_immutable on public.levytate_application_workflow_versions;
create trigger levytate_application_workflow_versions_immutable before update on public.levytate_application_workflow_versions for each row execute function public.levytate_protect_application_workflow_version();

create or replace function public.levytate_protect_application_workflow_instance_identity()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.organisation_id <> old.organisation_id
    or new.application_id <> old.application_id or new.workflow_version_id <> old.workflow_version_id
    or new.created_at <> old.created_at
  then raise exception 'Application workflow instance identity and pinned version are immutable'; end if;
  return new;
end;
$$;

drop trigger if exists levytate_application_workflow_instances_identity_immutable on public.levytate_application_workflow_instances;
create trigger levytate_application_workflow_instances_identity_immutable before update on public.levytate_application_workflow_instances for each row execute function public.levytate_protect_application_workflow_instance_identity();

create or replace function public.levytate_reject_application_workflow_event_mutation()
returns trigger language plpgsql as $$ begin raise exception 'Application workflow events are append-only'; end; $$;
drop trigger if exists levytate_application_workflow_events_append_only on public.levytate_application_workflow_events;
create trigger levytate_application_workflow_events_append_only before update or delete on public.levytate_application_workflow_events for each row execute function public.levytate_reject_application_workflow_event_mutation();

create or replace function public.levytate_publish_application_workflow(p_organisation_id uuid, p_version_id uuid, p_actor_user_id uuid)
returns setof public.levytate_application_workflow_versions
language plpgsql security definer set search_path = public as $$
declare v_version public.levytate_application_workflow_versions%rowtype;
begin
  select * into v_version from public.levytate_application_workflow_versions where id = p_version_id and organisation_id = p_organisation_id and status = 'draft' for update;
  if not found then raise exception 'Draft workflow version not found'; end if;
  if not exists (select 1 from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true and role in ('Employer Admin', 'Apprenticeship Lead')) then raise exception 'Actor is not authorised to publish this workflow'; end if;
  update public.levytate_application_workflow_versions set status = 'superseded' where workflow_id = v_version.workflow_id and status = 'published';
  update public.levytate_application_workflow_versions set status = 'published', published_at = now() where id = p_version_id returning * into v_version;
  update public.levytate_application_workflows set published_version_id = p_version_id, updated_at = now() where id = v_version.workflow_id and organisation_id = p_organisation_id;
  return next v_version;
end;
$$;

create or replace function public.levytate_transition_application_workflow(
  p_organisation_id uuid,
  p_application_id text,
  p_actor_user_id uuid,
  p_action text,
  p_note text,
  p_idempotency_key text,
  p_expected_lock_version integer
)
returns setof public.levytate_application_workflow_instances
language plpgsql security definer set search_path = public as $$
declare
  v_instance public.levytate_application_workflow_instances%rowtype;
  v_version public.levytate_application_workflow_versions%rowtype;
  v_actor public.levytate_users%rowtype;
  v_application public.levytate_applications%rowtype;
  v_step jsonb;
  v_next_step jsonb;
  v_index integer;
  v_state text;
  v_step_id text;
  v_return_step_id text;
  v_existing_action text;
  v_existing_actor uuid;
begin
  select action, actor_user_id into v_existing_action, v_existing_actor from public.levytate_application_workflow_events where organisation_id = p_organisation_id and application_id = p_application_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_action <> p_action or v_existing_actor <> p_actor_user_id then raise exception 'Idempotency key was already used for a different transition'; end if;
    return query select * from public.levytate_application_workflow_instances where organisation_id = p_organisation_id and application_id = p_application_id;
    return;
  end if;
  select * into v_instance from public.levytate_application_workflow_instances where organisation_id = p_organisation_id and application_id = p_application_id for update;
  if not found then raise exception 'Workflow instance not found'; end if;
  if v_instance.lock_version <> p_expected_lock_version then raise exception 'Workflow state changed; refresh before trying again'; end if;
  if v_instance.state in ('declined', 'ready_for_provider') then raise exception 'Workflow is terminal'; end if;
  select * into v_version from public.levytate_application_workflow_versions where id = v_instance.workflow_version_id and organisation_id = p_organisation_id;
  select * into v_actor from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
  select * into v_application from public.levytate_applications where id = p_application_id and organisation_id = p_organisation_id;
  if v_actor.id is null or v_application.id is null then raise exception 'Actor or application is unavailable'; end if;
  select value, ordinality::integer - 1 into v_step, v_index from jsonb_array_elements(v_version.steps) with ordinality where value->>'id' = v_instance.current_step_id;
  if v_step is null then raise exception 'Current workflow step is invalid'; end if;

  if v_instance.state = 'needs_information' then
    if p_action <> 'resubmit' or v_actor.role <> 'Employee' or v_instance.return_step_id is null
      or not exists (select 1 from public.levytate_employees where id = v_application.employee_id and organisation_id = p_organisation_id and lower(email) = lower(v_actor.email) and status = 'Active')
    then raise exception 'Only the application employee may resubmit requested information'; end if;
    v_state := 'active'; v_step_id := v_instance.return_step_id; v_return_step_id := null;
  else
    if v_actor.role <> v_step->>'responsibleRole' then raise exception 'Actor does not own this workflow step'; end if;
    if v_actor.role = 'Line Manager' and not exists (
      select 1 from public.levytate_employees applicant join public.levytate_employees manager on manager.id = applicant.manager_id and manager.organisation_id = applicant.organisation_id
      where applicant.id = v_application.employee_id and applicant.organisation_id = p_organisation_id and lower(manager.email) = lower(v_actor.email) and applicant.status = 'Active' and manager.status = 'Active'
    ) then raise exception 'Only the current direct manager may act'; end if;
    if p_action = 'request_information' and v_step->>'type' in ('role_review', 'role_approval') then
      v_state := 'needs_information'; v_step_id := v_instance.current_step_id; v_return_step_id := v_instance.current_step_id;
    elsif p_action = 'decline' and coalesce((v_step->>'allowDecline')::boolean, false) then
      v_state := 'declined'; v_step_id := v_instance.current_step_id; v_return_step_id := null;
    else
      if not ((v_step->>'type' = 'employee_submission' and p_action = 'submit') or (v_step->>'type' = 'role_review' and p_action = 'continue') or (v_step->>'type' = 'role_approval' and p_action = 'approve')) then raise exception 'Action is not allowed at this step'; end if;
      v_next_step := v_version.steps->(v_index + 1);
      if v_next_step is null then raise exception 'Workflow cannot skip beyond provider handoff'; end if;
      v_step_id := v_next_step->>'id'; v_return_step_id := null;
      v_state := case when v_next_step->>'type' = 'provider_handoff' then 'ready_for_provider' else 'active' end;
    end if;
  end if;

  update public.levytate_application_workflow_instances set current_step_id = v_step_id, state = v_state, return_step_id = v_return_step_id, lock_version = lock_version + 1, last_progressed_at = now(), updated_at = now()
    where id = v_instance.id returning * into v_instance;
  insert into public.levytate_application_workflow_events (organisation_id, application_id, workflow_version_id, step_id, action, actor_user_id, actor_role, note, idempotency_key, from_lock_version, to_lock_version)
    values (p_organisation_id, p_application_id, v_instance.workflow_version_id, v_step->>'id', p_action, p_actor_user_id, v_actor.role, left(coalesce(p_note, ''), 2000), p_idempotency_key, p_expected_lock_version, v_instance.lock_version);
  return next v_instance;
end;
$$;

create or replace function public.levytate_start_application_workflow(
  p_organisation_id uuid,
  p_application_id text,
  p_actor_user_id uuid,
  p_idempotency_key text
)
returns setof public.levytate_application_workflow_instances
language plpgsql security definer set search_path = public as $$
declare
  v_workflow public.levytate_application_workflows%rowtype;
  v_version public.levytate_application_workflow_versions%rowtype;
  v_application public.levytate_applications%rowtype;
  v_actor public.levytate_users%rowtype;
  v_instance public.levytate_application_workflow_instances%rowtype;
  v_first_step jsonb;
  v_next_step jsonb;
begin
  if not exists (select 1 from public.levytate_organisation_capabilities where organisation_id = p_organisation_id and application_workflows_enabled = true) then raise exception 'Application workflows are not enabled'; end if;
  select * into v_application from public.levytate_applications where id = p_application_id and organisation_id = p_organisation_id;
  select * into v_actor from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
  if v_application.id is null or v_actor.id is null then raise exception 'Application or actor is unavailable'; end if;
  if v_actor.role <> 'Employee' or not exists (select 1 from public.levytate_employees where id = v_application.employee_id and organisation_id = p_organisation_id and lower(email) = lower(v_actor.email) and status = 'Active') then raise exception 'Only the application employee may submit'; end if;
  select * into v_instance from public.levytate_application_workflow_instances where organisation_id = p_organisation_id and application_id = p_application_id;
  if found then return next v_instance; return; end if;
  select * into v_workflow from public.levytate_application_workflows where organisation_id = p_organisation_id and published_version_id is not null;
  select * into v_version from public.levytate_application_workflow_versions where id = v_workflow.published_version_id and organisation_id = p_organisation_id and status = 'published';
  if v_version.id is null then raise exception 'Published workflow is unavailable'; end if;
  v_first_step := v_version.steps->0; v_next_step := v_version.steps->1;
  if v_first_step->>'type' <> 'employee_submission' or v_next_step is null then raise exception 'Published workflow is invalid'; end if;
  insert into public.levytate_application_workflow_instances (organisation_id, application_id, workflow_version_id, current_step_id, state, lock_version, last_progressed_at)
    values (p_organisation_id, p_application_id, v_version.id, v_next_step->>'id', case when v_next_step->>'type' = 'provider_handoff' then 'ready_for_provider' else 'active' end, 1, now())
    returning * into v_instance;
  insert into public.levytate_application_workflow_events (organisation_id, application_id, workflow_version_id, step_id, action, actor_user_id, actor_role, idempotency_key, from_lock_version, to_lock_version)
    values (p_organisation_id, p_application_id, v_version.id, v_first_step->>'id', 'submit', p_actor_user_id, v_actor.role, p_idempotency_key, 0, 1);
  return next v_instance;
end;
$$;

alter table public.levytate_application_workflows enable row level security;
alter table public.levytate_application_workflows force row level security;
alter table public.levytate_application_workflow_versions enable row level security;
alter table public.levytate_application_workflow_versions force row level security;
alter table public.levytate_application_workflow_instances enable row level security;
alter table public.levytate_application_workflow_instances force row level security;
alter table public.levytate_application_workflow_events enable row level security;
alter table public.levytate_application_workflow_events force row level security;

revoke all on table public.levytate_application_workflows from public, anon, authenticated, service_role;
revoke all on table public.levytate_application_workflow_versions from public, anon, authenticated, service_role;
revoke all on table public.levytate_application_workflow_instances from public, anon, authenticated, service_role;
revoke all on table public.levytate_application_workflow_events from public, anon, authenticated, service_role;
grant select, insert on table public.levytate_application_workflows to service_role;
grant select, insert on table public.levytate_application_workflow_versions to service_role;
grant update (steps) on table public.levytate_application_workflow_versions to service_role;
grant select on table public.levytate_application_workflow_instances to service_role;
grant select on table public.levytate_application_workflow_events to service_role;
revoke all on function public.levytate_validate_application_workflow_steps(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.levytate_validate_application_workflow_steps(jsonb) to service_role;
revoke all on function public.levytate_protect_application_workflow_version() from public, anon, authenticated, service_role;
revoke all on function public.levytate_protect_application_workflow_instance_identity() from public, anon, authenticated, service_role;
revoke all on function public.levytate_reject_application_workflow_event_mutation() from public, anon, authenticated, service_role;
revoke all on function public.levytate_publish_application_workflow(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.levytate_publish_application_workflow(uuid, uuid, uuid) to service_role;
revoke all on function public.levytate_transition_application_workflow(uuid, text, uuid, text, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.levytate_transition_application_workflow(uuid, text, uuid, text, text, text, integer) to service_role;
revoke all on function public.levytate_start_application_workflow(uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_start_application_workflow(uuid, text, uuid, text) to service_role;

drop policy if exists levytate_application_workflows_service_role_all on public.levytate_application_workflows;
drop policy if exists levytate_application_workflow_versions_service_role_all on public.levytate_application_workflow_versions;
drop policy if exists levytate_application_workflow_instances_service_role_all on public.levytate_application_workflow_instances;
drop policy if exists levytate_application_workflow_events_service_role_select on public.levytate_application_workflow_events;
drop policy if exists levytate_application_workflow_events_service_role_insert on public.levytate_application_workflow_events;
create policy levytate_application_workflows_service_role_all on public.levytate_application_workflows for all to service_role using (true) with check (true);
create policy levytate_application_workflow_versions_service_role_all on public.levytate_application_workflow_versions for all to service_role using (true) with check (true);
create policy levytate_application_workflow_instances_service_role_all on public.levytate_application_workflow_instances for all to service_role using (true) with check (true);
create policy levytate_application_workflow_events_service_role_select on public.levytate_application_workflow_events for select to service_role using (true);
create policy levytate_application_workflow_events_service_role_insert on public.levytate_application_workflow_events for insert to service_role with check (true);

comment on table public.levytate_application_workflow_versions is 'Immutable-on-publish employer application workflow definitions.';
comment on table public.levytate_application_workflow_instances is 'Pinned workflow version and current state for an application. Existing applications may remain legacy/unpinned.';
comment on table public.levytate_application_workflow_events is 'Append-only application transition history with idempotency and lock versions.';
