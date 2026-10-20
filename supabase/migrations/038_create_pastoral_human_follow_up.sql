-- LevyTate My Support: durable, employee-visible human follow-up.
-- Additive only. The shared project must not receive this migration without
-- a fresh backup/restore gate and separate explicit approval.

alter table public.levytate_pastoral_support_requests
  add column if not exists agreed_follow_up_at timestamptz,
  add column if not exists administratively_closed_at timestamptz,
  add column if not exists employee_resolution_status text not null default 'not_requested',
  add column if not exists employee_responded_at timestamptz,
  add column if not exists employee_confirmed_resolved_at timestamptz;

alter table public.levytate_pastoral_support_requests
  drop constraint if exists pastoral_requests_employee_resolution_check;
alter table public.levytate_pastoral_support_requests
  add constraint pastoral_requests_employee_resolution_check
  check (employee_resolution_status in ('not_requested','awaiting_employee_response','helped','further_support_requested'));

alter table public.levytate_pastoral_support_request_events
  drop constraint if exists levytate_pastoral_support_request_events_event_type_check;
alter table public.levytate_pastoral_support_request_events
  add constraint levytate_pastoral_support_request_events_event_type_check
  check (event_type in (
    'submitted','acknowledged','support_started','follow_up_requested','follow_up_agreed',
    'resolved','reopened','disputed','reassigned',
    'employee_confirmed_helped','employee_requested_further_support'
  ));

alter table public.levytate_pastoral_audit_events
  drop constraint if exists levytate_pastoral_audit_events_entity_type_check;
alter table public.levytate_pastoral_audit_events
  add constraint levytate_pastoral_audit_events_entity_type_check
  check (entity_type in ('conversation','support_request','support_action','preference','eligibility'));

create table if not exists public.levytate_pastoral_support_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  support_request_id uuid not null,
  responsible_recipient_id uuid not null,
  status text not null default 'agreed' check (status in ('agreed','in_progress','completed','cancelled')),
  due_at timestamptz,
  payload_ciphertext text not null check (char_length(payload_ciphertext) between 16 and 50000),
  payload_nonce text not null check (char_length(payload_nonce) between 12 and 128),
  payload_authentication_tag text not null check (char_length(payload_authentication_tag) between 12 and 128),
  encryption_key_version text not null check (char_length(btrim(encryption_key_version)) between 1 and 80),
  payload_digest text not null check (char_length(payload_digest) between 32 and 128),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  lock_version integer not null default 0 check (lock_version >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, support_request_id, idempotency_key),
  foreign key (organisation_id, support_request_id)
    references public.levytate_pastoral_support_requests(organisation_id, id) on delete restrict,
  foreign key (organisation_id, responsible_recipient_id)
    references public.levytate_pastoral_support_recipients(organisation_id, id) on delete restrict,
  check ((status = 'completed') = (completed_at is not null))
);

create index if not exists levytate_pastoral_support_actions_request_idx
  on public.levytate_pastoral_support_actions(organisation_id, support_request_id, created_at);
create index if not exists levytate_pastoral_support_actions_owner_idx
  on public.levytate_pastoral_support_actions(organisation_id, responsible_recipient_id, status, due_at);

create table if not exists public.levytate_pastoral_support_action_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  support_request_id uuid not null,
  support_action_id uuid not null,
  event_type text not null check (event_type in ('agreed','started','progress_recorded','completed','cancelled','reassigned')),
  actor_user_id uuid references public.levytate_users(id) on delete restrict,
  actor_provider_membership_id uuid references public.levytate_provider_memberships(id) on delete restrict,
  actor_role text not null check (actor_role in ('Line Manager','Apprenticeship Lead','Employer Admin','Provider Admin','Provider User')),
  previous_state text,
  new_state text not null,
  note_ciphertext text,
  note_nonce text,
  note_authentication_tag text,
  encryption_key_version text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, support_action_id, idempotency_key),
  foreign key (organisation_id, support_request_id)
    references public.levytate_pastoral_support_requests(organisation_id, id) on delete restrict,
  foreign key (organisation_id, support_action_id)
    references public.levytate_pastoral_support_actions(organisation_id, id) on delete restrict,
  check ((actor_user_id is not null)::integer + (actor_provider_membership_id is not null)::integer = 1),
  check (
    (note_ciphertext is null and note_nonce is null and note_authentication_tag is null and encryption_key_version is null)
    or (note_ciphertext is not null and note_nonce is not null and note_authentication_tag is not null and encryption_key_version is not null)
  )
);

create index if not exists levytate_pastoral_support_action_events_action_idx
  on public.levytate_pastoral_support_action_events(organisation_id, support_action_id, created_at);

create or replace function public.levytate_track_pastoral_administrative_closure()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.administratively_closed_at := coalesce(new.resolved_at, timezone('utc', now()));
    new.employee_resolution_status := 'awaiting_employee_response';
    new.employee_responded_at := null;
    new.employee_confirmed_resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists levytate_pastoral_requests_closure_state on public.levytate_pastoral_support_requests;
create trigger levytate_pastoral_requests_closure_state
  before update of status on public.levytate_pastoral_support_requests
  for each row execute function public.levytate_track_pastoral_administrative_closure();

create or replace function public.levytate_protect_pastoral_support_action()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id is distinct from old.id or new.organisation_id is distinct from old.organisation_id
    or new.support_request_id is distinct from old.support_request_id
    or new.payload_ciphertext is distinct from old.payload_ciphertext
    or new.payload_nonce is distinct from old.payload_nonce
    or new.payload_authentication_tag is distinct from old.payload_authentication_tag
    or new.encryption_key_version is distinct from old.encryption_key_version
    or new.payload_digest is distinct from old.payload_digest
    or new.idempotency_key is distinct from old.idempotency_key
    or new.created_at is distinct from old.created_at
  then raise exception 'Agreed pastoral support action content and identity are immutable'; end if;
  return new;
end;
$$;

drop trigger if exists levytate_pastoral_support_actions_content_immutable on public.levytate_pastoral_support_actions;
create trigger levytate_pastoral_support_actions_content_immutable
  before update on public.levytate_pastoral_support_actions
  for each row execute function public.levytate_protect_pastoral_support_action();
drop trigger if exists levytate_pastoral_support_action_events_immutable on public.levytate_pastoral_support_action_events;
create trigger levytate_pastoral_support_action_events_immutable
  before update or delete on public.levytate_pastoral_support_action_events
  for each row execute function public.levytate_reject_pastoral_append_only_mutation();
drop trigger if exists levytate_pastoral_support_actions_updated_at on public.levytate_pastoral_support_actions;
create trigger levytate_pastoral_support_actions_updated_at
  before update on public.levytate_pastoral_support_actions
  for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.levytate_record_pastoral_follow_up(
  p_organisation_id uuid, p_support_request_id uuid,
  p_actor_user_id uuid, p_actor_provider_membership_id uuid,
  p_expected_lock_version integer, p_agreed_follow_up_at timestamptz,
  p_idempotency_key text, p_note_ciphertext text default null, p_note_nonce text default null,
  p_note_authentication_tag text default null, p_encryption_key_version text default null
) returns setof public.levytate_pastoral_support_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.levytate_pastoral_support_requests%rowtype;
  v_recipient public.levytate_pastoral_support_recipients%rowtype;
  v_actor_role text;
  v_previous text;
begin
  if (p_actor_user_id is not null)::integer + (p_actor_provider_membership_id is not null)::integer <> 1
  then raise exception 'Exactly one pastoral actor is required'; end if;
  if p_agreed_follow_up_at is null then raise exception 'An agreed follow-up date is required'; end if;
  if exists (select 1 from public.levytate_pastoral_support_request_events
    where organisation_id = p_organisation_id and support_request_id = p_support_request_id and idempotency_key = p_idempotency_key)
  then return query select * from public.levytate_pastoral_support_requests where organisation_id = p_organisation_id and id = p_support_request_id; return; end if;
  select * into v_request from public.levytate_pastoral_support_requests
    where organisation_id = p_organisation_id and id = p_support_request_id for update;
  if v_request.id is null then raise exception 'Support request is unavailable'; end if;
  if v_request.lock_version <> p_expected_lock_version then raise exception 'Support request changed; refresh before trying again'; end if;
  if v_request.status not in ('acknowledged','support_in_progress','follow_up') then raise exception 'A follow-up cannot be agreed in the current state'; end if;
  select * into v_recipient from public.levytate_pastoral_support_recipients
    where organisation_id = p_organisation_id and id = v_request.assigned_recipient_id and active = true;
  if v_recipient.id is null
    or not (
      (p_actor_user_id is not null and v_recipient.employer_user_id = p_actor_user_id)
      or (p_actor_provider_membership_id is not null and v_recipient.provider_membership_id = p_actor_provider_membership_id)
    )
  then raise exception 'Only the active assigned recipient may agree follow-up'; end if;
  if p_actor_user_id is not null then
    select role into v_actor_role from public.levytate_users
      where organisation_id = p_organisation_id and id = p_actor_user_id and active = true and role <> 'Platform Admin';
  else
    select role into v_actor_role from public.levytate_provider_memberships
      where id = p_actor_provider_membership_id and active = true;
  end if;
  if v_actor_role is null then raise exception 'Pastoral actor is not authorised'; end if;
  v_previous := v_request.status;
  update public.levytate_pastoral_support_requests set
    status = 'follow_up', agreed_follow_up_at = p_agreed_follow_up_at, lock_version = lock_version + 1
    where organisation_id = p_organisation_id and id = p_support_request_id returning * into v_request;
  insert into public.levytate_pastoral_support_request_events (
    organisation_id, support_request_id, event_type, actor_user_id, actor_provider_membership_id,
    actor_role, previous_state, new_state, note_ciphertext, note_nonce,
    note_authentication_tag, encryption_key_version, idempotency_key
  ) values (
    p_organisation_id, p_support_request_id, 'follow_up_agreed', p_actor_user_id, p_actor_provider_membership_id,
    v_actor_role, v_previous, 'follow_up', p_note_ciphertext, p_note_nonce,
    p_note_authentication_tag, p_encryption_key_version, p_idempotency_key
  );
  insert into public.levytate_pastoral_audit_events (
    organisation_id, employee_id, actor_user_id, entity_type, entity_id, action, outcome, correlation_id
  ) values (
    p_organisation_id, v_request.employee_id, p_actor_user_id, 'support_request', v_request.id,
    'support_request.follow_up_agreed', 'completed', p_idempotency_key
  );
  return next v_request;
end;
$$;

create or replace function public.levytate_create_pastoral_support_action(
  p_organisation_id uuid, p_support_request_id uuid, p_responsible_recipient_id uuid,
  p_actor_user_id uuid, p_actor_provider_membership_id uuid, p_due_at timestamptz,
  p_payload_ciphertext text, p_payload_nonce text, p_payload_authentication_tag text,
  p_encryption_key_version text, p_payload_digest text, p_idempotency_key text
) returns setof public.levytate_pastoral_support_actions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.levytate_pastoral_support_requests%rowtype;
  v_assigned public.levytate_pastoral_support_recipients%rowtype;
  v_owner public.levytate_pastoral_support_recipients%rowtype;
  v_existing public.levytate_pastoral_support_actions%rowtype;
  v_saved public.levytate_pastoral_support_actions%rowtype;
  v_actor_role text;
begin
  if (p_actor_user_id is not null)::integer + (p_actor_provider_membership_id is not null)::integer <> 1
  then raise exception 'Exactly one pastoral actor is required'; end if;
  select * into v_existing from public.levytate_pastoral_support_actions
    where organisation_id = p_organisation_id and support_request_id = p_support_request_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.responsible_recipient_id is distinct from p_responsible_recipient_id or v_existing.payload_digest is distinct from p_payload_digest
    then raise exception 'Conflicting pastoral support action idempotency key'; end if;
    return next v_existing; return;
  end if;
  select * into v_request from public.levytate_pastoral_support_requests
    where organisation_id = p_organisation_id and id = p_support_request_id for update;
  if v_request.id is null or v_request.status = 'resolved' then raise exception 'Support request is unavailable for a new action'; end if;
  select * into v_assigned from public.levytate_pastoral_support_recipients
    where organisation_id = p_organisation_id and id = v_request.assigned_recipient_id and active = true;
  if v_assigned.id is null
    or not (
      (p_actor_user_id is not null and v_assigned.employer_user_id = p_actor_user_id)
      or (p_actor_provider_membership_id is not null and v_assigned.provider_membership_id = p_actor_provider_membership_id)
    )
  then raise exception 'Only the active assigned recipient may agree a support action'; end if;
  select * into v_owner from public.levytate_pastoral_support_recipients
    where organisation_id = p_organisation_id and id = p_responsible_recipient_id and active = true;
  if v_owner.id is null then raise exception 'The responsible support-action owner is unavailable'; end if;
  if p_actor_user_id is not null then select role into v_actor_role from public.levytate_users where organisation_id = p_organisation_id and id = p_actor_user_id and active = true and role <> 'Platform Admin';
  else select role into v_actor_role from public.levytate_provider_memberships where id = p_actor_provider_membership_id and active = true; end if;
  if v_actor_role is null then raise exception 'Pastoral actor is not authorised'; end if;
  insert into public.levytate_pastoral_support_actions (
    organisation_id, support_request_id, responsible_recipient_id, due_at,
    payload_ciphertext, payload_nonce, payload_authentication_tag, encryption_key_version,
    payload_digest, idempotency_key
  ) values (
    p_organisation_id, p_support_request_id, p_responsible_recipient_id, p_due_at,
    p_payload_ciphertext, p_payload_nonce, p_payload_authentication_tag, p_encryption_key_version,
    p_payload_digest, p_idempotency_key
  ) returning * into v_saved;
  insert into public.levytate_pastoral_support_action_events (
    organisation_id, support_request_id, support_action_id, event_type,
    actor_user_id, actor_provider_membership_id, actor_role, previous_state, new_state, idempotency_key
  ) values (
    p_organisation_id, p_support_request_id, v_saved.id, 'agreed',
    p_actor_user_id, p_actor_provider_membership_id, v_actor_role, null, 'agreed', left(p_idempotency_key || ':agreed', 128)
  );
  insert into public.levytate_pastoral_audit_events (
    organisation_id, employee_id, actor_user_id, entity_type, entity_id, action, outcome, correlation_id
  ) values (
    p_organisation_id, v_request.employee_id, p_actor_user_id, 'support_action', v_saved.id,
    'support_action.created', 'completed', p_idempotency_key
  );
  return next v_saved;
end;
$$;

create or replace function public.levytate_transition_pastoral_support_action(
  p_organisation_id uuid, p_support_action_id uuid,
  p_actor_user_id uuid, p_actor_provider_membership_id uuid,
  p_action text, p_expected_lock_version integer, p_idempotency_key text,
  p_new_responsible_recipient_id uuid default null,
  p_note_ciphertext text default null, p_note_nonce text default null,
  p_note_authentication_tag text default null, p_encryption_key_version text default null
) returns setof public.levytate_pastoral_support_actions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_action public.levytate_pastoral_support_actions%rowtype;
  v_request public.levytate_pastoral_support_requests%rowtype;
  v_owner public.levytate_pastoral_support_recipients%rowtype;
  v_assigned public.levytate_pastoral_support_recipients%rowtype;
  v_actor_role text; v_previous text; v_next text; v_event text;
begin
  if (p_actor_user_id is not null)::integer + (p_actor_provider_membership_id is not null)::integer <> 1
  then raise exception 'Exactly one pastoral actor is required'; end if;
  if exists (select 1 from public.levytate_pastoral_support_action_events
    where organisation_id = p_organisation_id and support_action_id = p_support_action_id and idempotency_key = p_idempotency_key)
  then return query select * from public.levytate_pastoral_support_actions where organisation_id = p_organisation_id and id = p_support_action_id; return; end if;
  select * into v_action from public.levytate_pastoral_support_actions
    where organisation_id = p_organisation_id and id = p_support_action_id for update;
  if v_action.id is null then raise exception 'Support action is unavailable'; end if;
  if v_action.lock_version <> p_expected_lock_version then raise exception 'Support action changed; refresh before trying again'; end if;
  select * into v_request from public.levytate_pastoral_support_requests
    where organisation_id = p_organisation_id and id = v_action.support_request_id;
  select * into v_owner from public.levytate_pastoral_support_recipients
    where organisation_id = p_organisation_id and id = v_action.responsible_recipient_id and active = true;
  select * into v_assigned from public.levytate_pastoral_support_recipients
    where organisation_id = p_organisation_id and id = v_request.assigned_recipient_id and active = true;
  if not (
    (v_owner.id is not null and (
      (p_actor_user_id is not null and v_owner.employer_user_id = p_actor_user_id)
      or (p_actor_provider_membership_id is not null and v_owner.provider_membership_id = p_actor_provider_membership_id)
    ))
    or (v_assigned.id is not null and (
      (p_actor_user_id is not null and v_assigned.employer_user_id = p_actor_user_id)
      or (p_actor_provider_membership_id is not null and v_assigned.provider_membership_id = p_actor_provider_membership_id)
    ))
  ) then raise exception 'Only the active action owner or assigned support recipient may update this action'; end if;
  if p_actor_user_id is not null then select role into v_actor_role from public.levytate_users where organisation_id = p_organisation_id and id = p_actor_user_id and active = true and role <> 'Platform Admin';
  else select role into v_actor_role from public.levytate_provider_memberships where id = p_actor_provider_membership_id and active = true; end if;
  if v_actor_role is null then raise exception 'Pastoral actor is not authorised'; end if;
  v_previous := v_action.status;
  if p_action = 'start' and v_action.status = 'agreed' then v_next := 'in_progress'; v_event := 'started';
  elsif p_action = 'progress' and v_action.status in ('agreed','in_progress') then v_next := v_action.status; v_event := 'progress_recorded';
  elsif p_action = 'complete' and v_action.status in ('agreed','in_progress') then v_next := 'completed'; v_event := 'completed';
  elsif p_action = 'cancel' and v_action.status in ('agreed','in_progress') then v_next := 'cancelled'; v_event := 'cancelled';
  elsif p_action = 'reassign' and v_action.status in ('agreed','in_progress') then
    if p_new_responsible_recipient_id is null or not exists (
      select 1 from public.levytate_pastoral_support_recipients
      where organisation_id = p_organisation_id and id = p_new_responsible_recipient_id and active = true
    ) then raise exception 'The replacement support-action owner is unavailable'; end if;
    v_next := v_action.status; v_event := 'reassigned';
  else raise exception 'The requested support-action transition is not permitted'; end if;
  update public.levytate_pastoral_support_actions set
    status = v_next,
    responsible_recipient_id = case when p_action = 'reassign' then p_new_responsible_recipient_id else responsible_recipient_id end,
    completed_at = case when v_next = 'completed' then timezone('utc', now()) else null end,
    lock_version = lock_version + 1
    where organisation_id = p_organisation_id and id = p_support_action_id returning * into v_action;
  insert into public.levytate_pastoral_support_action_events (
    organisation_id, support_request_id, support_action_id, event_type,
    actor_user_id, actor_provider_membership_id, actor_role, previous_state, new_state,
    note_ciphertext, note_nonce, note_authentication_tag, encryption_key_version, idempotency_key
  ) values (
    p_organisation_id, v_action.support_request_id, v_action.id, v_event,
    p_actor_user_id, p_actor_provider_membership_id, v_actor_role, v_previous, v_next,
    p_note_ciphertext, p_note_nonce, p_note_authentication_tag, p_encryption_key_version, p_idempotency_key
  );
  insert into public.levytate_pastoral_audit_events (
    organisation_id, employee_id, actor_user_id, entity_type, entity_id, action, outcome, correlation_id
  ) values (
    p_organisation_id, v_request.employee_id, p_actor_user_id, 'support_action', v_action.id,
    'support_action.' || p_action, 'completed', p_idempotency_key
  );
  return next v_action;
end;
$$;

create or replace function public.levytate_record_pastoral_employee_outcome(
  p_organisation_id uuid, p_support_request_id uuid, p_owner_user_id uuid,
  p_outcome text, p_expected_lock_version integer, p_idempotency_key text,
  p_note_ciphertext text default null, p_note_nonce text default null,
  p_note_authentication_tag text default null, p_encryption_key_version text default null
) returns setof public.levytate_pastoral_support_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_request public.levytate_pastoral_support_requests%rowtype; v_event text;
begin
  if p_outcome not in ('helped','further_support_requested') then raise exception 'Choose a valid employee support outcome'; end if;
  if exists (select 1 from public.levytate_pastoral_support_request_events
    where organisation_id = p_organisation_id and support_request_id = p_support_request_id and idempotency_key = p_idempotency_key)
  then return query select * from public.levytate_pastoral_support_requests where organisation_id = p_organisation_id and id = p_support_request_id; return; end if;
  select * into v_request from public.levytate_pastoral_support_requests
    where organisation_id = p_organisation_id and id = p_support_request_id for update;
  if v_request.id is null or v_request.owner_user_id is distinct from p_owner_user_id
    or not exists (select 1 from public.levytate_users where organisation_id = p_organisation_id and id = p_owner_user_id and active = true and role = 'Employee')
  then raise exception 'Only the owning employee may record the support outcome'; end if;
  if v_request.lock_version <> p_expected_lock_version then raise exception 'Support request changed; refresh before trying again'; end if;
  if v_request.status <> 'resolved' or v_request.employee_resolution_status <> 'awaiting_employee_response'
  then raise exception 'This request is not awaiting employee confirmation'; end if;
  v_event := case when p_outcome = 'helped' then 'employee_confirmed_helped' else 'employee_requested_further_support' end;
  update public.levytate_pastoral_support_requests set
    status = case when p_outcome = 'helped' then status else 'follow_up' end,
    resolved_at = case when p_outcome = 'helped' then resolved_at else null end,
    employee_resolution_status = p_outcome,
    employee_responded_at = timezone('utc', now()),
    employee_confirmed_resolved_at = case when p_outcome = 'helped' then timezone('utc', now()) else null end,
    lock_version = lock_version + 1
    where organisation_id = p_organisation_id and id = p_support_request_id returning * into v_request;
  insert into public.levytate_pastoral_support_request_events (
    organisation_id, support_request_id, event_type, actor_user_id, actor_role,
    previous_state, new_state, note_ciphertext, note_nonce,
    note_authentication_tag, encryption_key_version, idempotency_key
  ) values (
    p_organisation_id, p_support_request_id, v_event, p_owner_user_id, 'Employee',
    'resolved', v_request.status, p_note_ciphertext, p_note_nonce,
    p_note_authentication_tag, p_encryption_key_version, p_idempotency_key
  );
  insert into public.levytate_pastoral_audit_events (
    organisation_id, employee_id, actor_user_id, entity_type, entity_id, action, outcome, correlation_id
  ) values (
    p_organisation_id, v_request.employee_id, p_owner_user_id, 'support_request', v_request.id,
    'support_request.employee_' || p_outcome, 'completed', p_idempotency_key
  );
  return next v_request;
end;
$$;

-- Replace the 037 request transition with explicit non-null principal matching.
-- This closes the possibility of two absent provider IDs being treated as an
-- employer-user match while preserving the original state machine.
create or replace function public.levytate_transition_pastoral_support_request(
  p_organisation_id uuid, p_support_request_id uuid,
  p_actor_user_id uuid, p_actor_provider_membership_id uuid,
  p_action text, p_expected_lock_version integer, p_idempotency_key text,
  p_new_recipient_id uuid default null, p_note_ciphertext text default null, p_note_nonce text default null,
  p_note_authentication_tag text default null, p_encryption_key_version text default null
) returns setof public.levytate_pastoral_support_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.levytate_pastoral_support_requests%rowtype;
  v_recipient public.levytate_pastoral_support_recipients%rowtype;
  v_user public.levytate_users%rowtype;
  v_provider public.levytate_provider_memberships%rowtype;
  v_next text; v_event text; v_actor_role text; v_previous text;
  v_actor_matches_assigned boolean;
begin
  if (p_actor_user_id is not null)::integer + (p_actor_provider_membership_id is not null)::integer <> 1
  then raise exception 'Exactly one pastoral actor is required'; end if;
  if exists (select 1 from public.levytate_pastoral_support_request_events where organisation_id = p_organisation_id and support_request_id = p_support_request_id and idempotency_key = p_idempotency_key)
  then return query select * from public.levytate_pastoral_support_requests where organisation_id = p_organisation_id and id = p_support_request_id; return; end if;
  select * into v_request from public.levytate_pastoral_support_requests
    where organisation_id = p_organisation_id and id = p_support_request_id for update;
  if v_request.id is null then raise exception 'Support request is unavailable'; end if;
  if v_request.lock_version <> p_expected_lock_version then raise exception 'Support request changed; refresh before trying again'; end if;
  v_previous := v_request.status;
  select * into v_recipient from public.levytate_pastoral_support_recipients
    where organisation_id = p_organisation_id and id = v_request.assigned_recipient_id and active = true;
  v_actor_matches_assigned := v_recipient.id is not null and (
    (p_actor_user_id is not null and v_recipient.employer_user_id = p_actor_user_id)
    or (p_actor_provider_membership_id is not null and v_recipient.provider_membership_id = p_actor_provider_membership_id)
  );
  if p_actor_user_id is not null then
    select * into v_user from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
    if v_user.id is null or v_user.role = 'Platform Admin' then raise exception 'Pastoral actor is not authorised'; end if;
    v_actor_role := v_user.role;
  else
    select * into v_provider from public.levytate_provider_memberships where id = p_actor_provider_membership_id and active = true;
    if v_provider.id is null then raise exception 'Pastoral provider actor is not authorised'; end if;
    v_actor_role := v_provider.role;
  end if;
  if p_action in ('reopen','dispute') then
    if p_actor_user_id is distinct from v_request.owner_user_id or v_actor_role <> 'Employee' or v_request.status <> 'resolved'
    then raise exception 'Only the owning employee may reopen or dispute a resolved request'; end if;
    v_next := 'follow_up'; v_event := case when p_action = 'reopen' then 'reopened' else 'disputed' end;
  else
    if p_action = 'reassign' then
      if p_new_recipient_id is null or not exists (
        select 1 from public.levytate_pastoral_support_recipients
        where organisation_id = p_organisation_id and id = p_new_recipient_id and active = true
      ) then raise exception 'The replacement support recipient is unavailable'; end if;
      if not (
        v_actor_matches_assigned
        or exists (
          select 1 from public.levytate_pastoral_support_recipients approved
          where approved.organisation_id = p_organisation_id and approved.active = true
            and (
              (p_actor_user_id is not null and approved.employer_user_id = p_actor_user_id)
              or (p_actor_provider_membership_id is not null and approved.provider_membership_id = p_actor_provider_membership_id)
            )
        )
      ) then raise exception 'Only an approved active support recipient may reassign this request'; end if;
      v_next := v_request.status; v_event := 'reassigned';
    else
      if not v_actor_matches_assigned then raise exception 'Only the active assigned recipient may update this support request'; end if;
      if p_action = 'acknowledge' and v_request.status = 'submitted' then v_next := 'acknowledged'; v_event := 'acknowledged';
      elsif p_action = 'start_support' and v_request.status in ('acknowledged','follow_up') then v_next := 'support_in_progress'; v_event := 'support_started';
      elsif p_action = 'request_follow_up' and v_request.status in ('acknowledged','support_in_progress') then v_next := 'follow_up'; v_event := 'follow_up_requested';
      elsif p_action = 'resolve' and v_request.status in ('support_in_progress','follow_up') then v_next := 'resolved'; v_event := 'resolved';
      else raise exception 'The requested pastoral support transition is not permitted'; end if;
    end if;
  end if;
  update public.levytate_pastoral_support_requests set
    status = v_next,
    assigned_recipient_id = case when p_action = 'reassign' then p_new_recipient_id else assigned_recipient_id end,
    acknowledged_at = case when v_next = 'acknowledged' and acknowledged_at is null then timezone('utc', now()) else acknowledged_at end,
    resolved_at = case when v_next = 'resolved' then timezone('utc', now()) else null end,
    lock_version = lock_version + 1
    where organisation_id = p_organisation_id and id = p_support_request_id returning * into v_request;
  insert into public.levytate_pastoral_support_request_events (
    organisation_id, support_request_id, event_type, actor_user_id, actor_provider_membership_id,
    actor_role, previous_state, new_state, note_ciphertext, note_nonce,
    note_authentication_tag, encryption_key_version, idempotency_key
  ) values (
    p_organisation_id, p_support_request_id, v_event, p_actor_user_id, p_actor_provider_membership_id,
    v_actor_role, v_previous, v_next, p_note_ciphertext, p_note_nonce,
    p_note_authentication_tag, p_encryption_key_version, p_idempotency_key
  );
  insert into public.levytate_pastoral_audit_events (
    organisation_id, employee_id, actor_user_id, entity_type, entity_id, action, outcome, correlation_id
  ) values (p_organisation_id, v_request.employee_id, p_actor_user_id, 'support_request', v_request.id, 'support_request.' || p_action, 'completed', p_idempotency_key);
  return next v_request;
end;
$$;

alter table public.levytate_pastoral_support_actions enable row level security;
alter table public.levytate_pastoral_support_actions force row level security;
alter table public.levytate_pastoral_support_action_events enable row level security;
alter table public.levytate_pastoral_support_action_events force row level security;

revoke all privileges on table public.levytate_pastoral_support_actions from public, anon, authenticated, service_role;
revoke all privileges on table public.levytate_pastoral_support_action_events from public, anon, authenticated, service_role;
grant select on table public.levytate_pastoral_support_actions to service_role;
grant select on table public.levytate_pastoral_support_action_events to service_role;

drop policy if exists levytate_pastoral_support_actions_service_role_all on public.levytate_pastoral_support_actions;
create policy levytate_pastoral_support_actions_service_role_all
  on public.levytate_pastoral_support_actions for all to service_role using (true) with check (true);
drop policy if exists levytate_pastoral_support_action_events_service_role_all on public.levytate_pastoral_support_action_events;
create policy levytate_pastoral_support_action_events_service_role_all
  on public.levytate_pastoral_support_action_events for all to service_role using (true) with check (true);

revoke all on function public.levytate_track_pastoral_administrative_closure() from public, anon, authenticated, service_role;
revoke all on function public.levytate_protect_pastoral_support_action() from public, anon, authenticated, service_role;
revoke all on function public.levytate_record_pastoral_follow_up(uuid,uuid,uuid,uuid,integer,timestamptz,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_record_pastoral_follow_up(uuid,uuid,uuid,uuid,integer,timestamptz,text,text,text,text,text) to service_role;
revoke all on function public.levytate_create_pastoral_support_action(uuid,uuid,uuid,uuid,uuid,timestamptz,text,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_create_pastoral_support_action(uuid,uuid,uuid,uuid,uuid,timestamptz,text,text,text,text,text,text) to service_role;
revoke all on function public.levytate_transition_pastoral_support_action(uuid,uuid,uuid,uuid,text,integer,text,uuid,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_transition_pastoral_support_action(uuid,uuid,uuid,uuid,text,integer,text,uuid,text,text,text,text) to service_role;
revoke all on function public.levytate_record_pastoral_employee_outcome(uuid,uuid,uuid,text,integer,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_record_pastoral_employee_outcome(uuid,uuid,uuid,text,integer,text,text,text,text,text) to service_role;
revoke all on function public.levytate_transition_pastoral_support_request(uuid,uuid,uuid,uuid,text,integer,text,uuid,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_transition_pastoral_support_request(uuid,uuid,uuid,uuid,text,integer,text,uuid,text,text,text,text) to service_role;

comment on column public.levytate_pastoral_support_requests.administratively_closed_at is
  'Administrative closure is distinct from employee-confirmed resolution.';
comment on column public.levytate_pastoral_support_requests.employee_resolution_status is
  'Employee-controlled outcome after administrative closure; no health, performance or risk inference.';
comment on table public.levytate_pastoral_support_actions is
  'Employee-visible agreed support actions. Sensitive action content is application-encrypted.';
comment on table public.levytate_pastoral_support_action_events is
  'Append-only action progress evidence. Optional progress and completion evidence remains encrypted.';

notify pgrst, 'reload schema';
