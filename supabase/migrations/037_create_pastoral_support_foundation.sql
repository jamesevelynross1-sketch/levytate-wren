-- LevyTate My Support / digital pastoral companion foundation.
--
-- Additive, capability-off by default and service-role only. Conversation and
-- shared-request content is application-encrypted before it reaches Postgres;
-- this migration deliberately creates no plaintext transcript columns, no
-- inferred diagnoses or risk scores, and no records for existing employees.

do $$
begin
  if to_regclass('public.levytate_organisation_capabilities') is null
    or to_regclass('public.levytate_users') is null
    or to_regclass('public.levytate_employees') is null
    or to_regclass('public.levytate_provider_memberships') is null
  then
    raise exception 'Migrations 028 and the core LevyTate schema must be applied before migration 037';
  end if;
end $$;

alter table public.levytate_organisation_capabilities
  add column if not exists pastoral_support_enabled boolean not null default false;

comment on column public.levytate_organisation_capabilities.pastoral_support_enabled is
  'Server-owned capability for My Support. Defaults off and is additionally gated by environment and employee eligibility.';

create table if not exists public.levytate_pastoral_access_eligibility (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  employee_id text not null,
  owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
  age_assurance_status text not null default 'not_verified'
    check (age_assurance_status in ('adult','under_18','not_verified')),
  active boolean not null default false,
  approved_by uuid references public.levytate_users(id) on delete restrict,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, employee_id),
  unique (organisation_id, owner_user_id),
  foreign key (organisation_id, employee_id)
    references public.levytate_employees(organisation_id, id) on delete restrict,
  check ((active = false) or (age_assurance_status = 'adult' and approved_by is not null and approved_at is not null))
);

create table if not exists public.levytate_pastoral_preferences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  employee_id text not null,
  owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
  save_history boolean not null default false,
  history_retention_days integer not null default 30 check (history_retention_days between 1 and 90),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, employee_id),
  unique (organisation_id, owner_user_id),
  foreign key (organisation_id, employee_id)
    references public.levytate_employees(organisation_id, id) on delete restrict
);

create table if not exists public.levytate_pastoral_support_recipients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  recipient_kind text not null check (recipient_kind in ('line_manager','apprenticeship_lead','hr_people','provider_support','other_approved_support')),
  employer_user_id uuid references public.levytate_users(id) on delete restrict,
  provider_membership_id uuid references public.levytate_provider_memberships(id) on delete restrict,
  display_label text not null check (char_length(btrim(display_label)) between 1 and 120),
  contact_method text not null check (contact_method in ('in_platform','email_notification','provider_route')),
  availability_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(availability_rules) = 'object'),
  active boolean not null default true,
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  check ((employer_user_id is not null)::integer + (provider_membership_id is not null)::integer = 1)
);

create unique index if not exists levytate_pastoral_recipient_employer_unique_idx
  on public.levytate_pastoral_support_recipients(organisation_id, employer_user_id)
  where employer_user_id is not null;
create unique index if not exists levytate_pastoral_recipient_provider_unique_idx
  on public.levytate_pastoral_support_recipients(organisation_id, provider_membership_id)
  where provider_membership_id is not null;
create index if not exists levytate_pastoral_recipients_active_idx
  on public.levytate_pastoral_support_recipients(organisation_id, active, recipient_kind);

create table if not exists public.levytate_pastoral_conversations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  employee_id text not null,
  owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
  policy_version text not null check (char_length(btrim(policy_version)) between 1 and 80),
  history_saving_enabled boolean not null check (history_saving_enabled = true),
  status text not null default 'active' check (status in ('active','closed')),
  retention_expires_at timestamptz not null,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, id, employee_id, owner_user_id),
  foreign key (organisation_id, employee_id)
    references public.levytate_employees(organisation_id, id) on delete restrict,
  check (retention_expires_at > created_at)
);

create index if not exists levytate_pastoral_conversations_owner_idx
  on public.levytate_pastoral_conversations(organisation_id, owner_user_id, updated_at desc);
create index if not exists levytate_pastoral_conversations_retention_idx
  on public.levytate_pastoral_conversations(retention_expires_at) where status = 'closed';

create table if not exists public.levytate_pastoral_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  conversation_id uuid not null,
  employee_id text not null,
  owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
  sequence_number integer not null check (sequence_number > 0),
  author_type text not null check (author_type in ('employee','assistant')),
  ciphertext text not null check (char_length(ciphertext) between 16 and 50000),
  nonce text not null check (char_length(nonce) between 12 and 128),
  authentication_tag text not null check (char_length(authentication_tag) between 12 and 128),
  encryption_key_version text not null check (char_length(btrim(encryption_key_version)) between 1 and 80),
  policy_version text not null check (char_length(btrim(policy_version)) between 1 and 80),
  client_message_id text not null check (char_length(client_message_id) between 8 and 128),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, conversation_id, sequence_number),
  unique (organisation_id, conversation_id, client_message_id),
  foreign key (organisation_id, conversation_id, employee_id, owner_user_id)
    references public.levytate_pastoral_conversations(organisation_id, id, employee_id, owner_user_id) on delete cascade,
  foreign key (organisation_id, employee_id)
    references public.levytate_employees(organisation_id, id) on delete restrict
);

create index if not exists levytate_pastoral_messages_conversation_idx
  on public.levytate_pastoral_messages(organisation_id, conversation_id, sequence_number);

create table if not exists public.levytate_pastoral_support_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  employee_id text not null,
  owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
  recipient_id uuid not null,
  assigned_recipient_id uuid not null,
  topic_category text not null check (topic_category in (
    'apprenticeship_support','workload_pressure','workplace_relationships',
    'bullying_harassment_discrimination','wellbeing','personal_circumstances',
    'accessibility_adjustments','provider_support','other'
  )),
  preferred_contact_method text not null check (preferred_contact_method in ('in_platform','email','phone','meeting','provider_route')),
  urgency_route text not null default 'standard' check (urgency_route in ('standard','prompt_human_support','emergency_guidance')),
  shared_field_names jsonb not null check (jsonb_typeof(shared_field_names) = 'array'),
  payload_ciphertext text not null check (char_length(payload_ciphertext) between 16 and 50000),
  payload_nonce text not null check (char_length(payload_nonce) between 12 and 128),
  payload_authentication_tag text not null check (char_length(payload_authentication_tag) between 12 and 128),
  encryption_key_version text not null check (char_length(btrim(encryption_key_version)) between 1 and 80),
  payload_digest text not null check (char_length(payload_digest) between 32 and 128),
  status text not null default 'submitted' check (status in ('submitted','acknowledged','support_in_progress','follow_up','resolved')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  lock_version integer not null default 0 check (lock_version >= 0),
  submitted_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, owner_user_id, idempotency_key),
  foreign key (organisation_id, employee_id)
    references public.levytate_employees(organisation_id, id) on delete restrict,
  foreign key (organisation_id, recipient_id)
    references public.levytate_pastoral_support_recipients(organisation_id, id) on delete restrict,
  foreign key (organisation_id, assigned_recipient_id)
    references public.levytate_pastoral_support_recipients(organisation_id, id) on delete restrict
);

create index if not exists levytate_pastoral_requests_owner_idx
  on public.levytate_pastoral_support_requests(organisation_id, owner_user_id, updated_at desc);
create index if not exists levytate_pastoral_requests_inbox_idx
  on public.levytate_pastoral_support_requests(organisation_id, assigned_recipient_id, status, submitted_at);
create index if not exists levytate_pastoral_requests_aggregate_idx
  on public.levytate_pastoral_support_requests(organisation_id, topic_category, status, submitted_at);

create table if not exists public.levytate_pastoral_support_request_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  support_request_id uuid not null,
  event_type text not null check (event_type in (
    'submitted','acknowledged','support_started','follow_up_requested','resolved','reopened','disputed','reassigned'
  )),
  actor_user_id uuid references public.levytate_users(id) on delete restrict,
  actor_provider_membership_id uuid references public.levytate_provider_memberships(id) on delete restrict,
  actor_role text not null check (actor_role in ('Employee','Line Manager','Apprenticeship Lead','Employer Admin','Provider Admin','Provider User')),
  previous_state text,
  new_state text not null,
  note_ciphertext text,
  note_nonce text,
  note_authentication_tag text,
  encryption_key_version text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  unique (organisation_id, support_request_id, idempotency_key),
  foreign key (organisation_id, support_request_id)
    references public.levytate_pastoral_support_requests(organisation_id, id) on delete restrict,
  check ((actor_user_id is not null)::integer + (actor_provider_membership_id is not null)::integer = 1),
  check (
    (note_ciphertext is null and note_nonce is null and note_authentication_tag is null and encryption_key_version is null)
    or (note_ciphertext is not null and note_nonce is not null and note_authentication_tag is not null and encryption_key_version is not null)
  )
);

create index if not exists levytate_pastoral_request_events_request_idx
  on public.levytate_pastoral_support_request_events(organisation_id, support_request_id, created_at);

create table if not exists public.levytate_pastoral_audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  employee_id text,
  actor_user_id uuid references public.levytate_users(id) on delete restrict,
  entity_type text not null check (entity_type in ('conversation','support_request','preference','eligibility')),
  entity_id uuid not null,
  action text not null check (char_length(action) between 3 and 120),
  outcome text not null check (outcome in ('allowed','denied','completed','failed')),
  correlation_id text not null check (char_length(correlation_id) between 8 and 128),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, id),
  foreign key (organisation_id, employee_id)
    references public.levytate_employees(organisation_id, id) on delete restrict
);

create index if not exists levytate_pastoral_audit_created_idx
  on public.levytate_pastoral_audit_events(organisation_id, created_at desc);

create table if not exists public.levytate_pastoral_rate_limits (
  environment_namespace text not null,
  action text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (environment_namespace, action, key_hash, window_started_at)
);

create index if not exists levytate_pastoral_rate_limits_expiry_idx
  on public.levytate_pastoral_rate_limits(expires_at);

create or replace function public.levytate_validate_pastoral_employee_owner()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_user public.levytate_users%rowtype; v_employee public.levytate_employees%rowtype;
begin
  select * into v_user from public.levytate_users
    where id = new.owner_user_id and organisation_id = new.organisation_id and active = true;
  select * into v_employee from public.levytate_employees
    where organisation_id = new.organisation_id and id = new.employee_id and status = 'Active';
  if v_user.id is null or v_employee.id is null or v_user.role <> 'Employee'
    or lower(btrim(v_user.email)) is distinct from lower(btrim(v_employee.email))
  then raise exception 'Pastoral records require the active employee owner for the same organisation'; end if;
  return new;
end;
$$;

create or replace function public.levytate_validate_pastoral_recipient()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_user public.levytate_users%rowtype; v_provider public.levytate_provider_memberships%rowtype;
begin
  if new.active = false then return new; end if;
  if not exists (
    select 1 from public.levytate_users
    where id = new.created_by and organisation_id = new.organisation_id and active = true
      and role in ('Apprenticeship Lead','Employer Admin')
  ) then raise exception 'Support recipient approval requires an active employer support administrator in the same organisation'; end if;
  if new.employer_user_id is not null then
    select * into v_user from public.levytate_users
      where id = new.employer_user_id and organisation_id = new.organisation_id and active = true;
    if v_user.id is null or v_user.role not in ('Line Manager','Apprenticeship Lead','Employer Admin') then
      raise exception 'Employer support recipient must be an explicitly approved active support role in the same organisation';
    end if;
    if (new.recipient_kind = 'line_manager' and v_user.role <> 'Line Manager')
      or (new.recipient_kind = 'apprenticeship_lead' and v_user.role not in ('Apprenticeship Lead','Employer Admin'))
      or new.recipient_kind = 'provider_support'
    then raise exception 'Support recipient kind does not match the approved employer role'; end if;
  else
    select * into v_provider from public.levytate_provider_memberships
      where id = new.provider_membership_id and active = true;
    if v_provider.id is null then raise exception 'Provider support recipient must be an active provider membership'; end if;
    if new.recipient_kind <> 'provider_support' then raise exception 'Provider memberships may only be approved for provider support'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.levytate_reject_pastoral_append_only_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'Pastoral event history is append-only'; end;
$$;

create or replace function public.levytate_protect_pastoral_message()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'Saved pastoral messages are immutable; delete the owning conversation instead'; end;
$$;

create or replace function public.levytate_protect_pastoral_support_request()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id is distinct from old.id or new.organisation_id is distinct from old.organisation_id
    or new.employee_id is distinct from old.employee_id or new.owner_user_id is distinct from old.owner_user_id
    or new.recipient_id is distinct from old.recipient_id or new.topic_category is distinct from old.topic_category
    or new.preferred_contact_method is distinct from old.preferred_contact_method
    or new.urgency_route is distinct from old.urgency_route or new.shared_field_names is distinct from old.shared_field_names
    or new.payload_ciphertext is distinct from old.payload_ciphertext or new.payload_nonce is distinct from old.payload_nonce
    or new.payload_authentication_tag is distinct from old.payload_authentication_tag
    or new.encryption_key_version is distinct from old.encryption_key_version
    or new.payload_digest is distinct from old.payload_digest or new.idempotency_key is distinct from old.idempotency_key
    or new.submitted_at is distinct from old.submitted_at or new.created_at is distinct from old.created_at
  then raise exception 'Submitted support request content and identity are immutable'; end if;
  return new;
end;
$$;

drop trigger if exists levytate_pastoral_eligibility_owner_guard on public.levytate_pastoral_access_eligibility;
create trigger levytate_pastoral_eligibility_owner_guard
  before insert or update of organisation_id, employee_id, owner_user_id
  on public.levytate_pastoral_access_eligibility
  for each row execute function public.levytate_validate_pastoral_employee_owner();
drop trigger if exists levytate_pastoral_preferences_owner_guard on public.levytate_pastoral_preferences;
create trigger levytate_pastoral_preferences_owner_guard
  before insert or update of organisation_id, employee_id, owner_user_id
  on public.levytate_pastoral_preferences
  for each row execute function public.levytate_validate_pastoral_employee_owner();
drop trigger if exists levytate_pastoral_conversations_owner_guard on public.levytate_pastoral_conversations;
create trigger levytate_pastoral_conversations_owner_guard
  before insert or update of organisation_id, employee_id, owner_user_id
  on public.levytate_pastoral_conversations
  for each row execute function public.levytate_validate_pastoral_employee_owner();
drop trigger if exists levytate_pastoral_requests_owner_guard on public.levytate_pastoral_support_requests;
create trigger levytate_pastoral_requests_owner_guard
  before insert or update of organisation_id, employee_id, owner_user_id
  on public.levytate_pastoral_support_requests
  for each row execute function public.levytate_validate_pastoral_employee_owner();
drop trigger if exists levytate_pastoral_recipients_principal_guard on public.levytate_pastoral_support_recipients;
create trigger levytate_pastoral_recipients_principal_guard
  before insert or update of organisation_id, employer_user_id, provider_membership_id, active
  on public.levytate_pastoral_support_recipients
  for each row execute function public.levytate_validate_pastoral_recipient();
drop trigger if exists levytate_pastoral_messages_immutable on public.levytate_pastoral_messages;
create trigger levytate_pastoral_messages_immutable before update on public.levytate_pastoral_messages
  for each row execute function public.levytate_protect_pastoral_message();
drop trigger if exists levytate_pastoral_requests_content_immutable on public.levytate_pastoral_support_requests;
create trigger levytate_pastoral_requests_content_immutable before update on public.levytate_pastoral_support_requests
  for each row execute function public.levytate_protect_pastoral_support_request();
drop trigger if exists levytate_pastoral_request_events_immutable on public.levytate_pastoral_support_request_events;
create trigger levytate_pastoral_request_events_immutable before update or delete on public.levytate_pastoral_support_request_events
  for each row execute function public.levytate_reject_pastoral_append_only_mutation();
drop trigger if exists levytate_pastoral_audit_events_immutable on public.levytate_pastoral_audit_events;
create trigger levytate_pastoral_audit_events_immutable before update or delete on public.levytate_pastoral_audit_events
  for each row execute function public.levytate_reject_pastoral_append_only_mutation();

drop trigger if exists levytate_pastoral_eligibility_updated_at on public.levytate_pastoral_access_eligibility;
create trigger levytate_pastoral_eligibility_updated_at before update on public.levytate_pastoral_access_eligibility
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_pastoral_preferences_updated_at on public.levytate_pastoral_preferences;
create trigger levytate_pastoral_preferences_updated_at before update on public.levytate_pastoral_preferences
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_pastoral_recipients_updated_at on public.levytate_pastoral_support_recipients;
create trigger levytate_pastoral_recipients_updated_at before update on public.levytate_pastoral_support_recipients
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_pastoral_conversations_updated_at on public.levytate_pastoral_conversations;
create trigger levytate_pastoral_conversations_updated_at before update on public.levytate_pastoral_conversations
  for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists levytate_pastoral_requests_updated_at on public.levytate_pastoral_support_requests;
create trigger levytate_pastoral_requests_updated_at before update on public.levytate_pastoral_support_requests
  for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.levytate_submit_pastoral_support_request(
  p_organisation_id uuid, p_employee_id text, p_owner_user_id uuid, p_recipient_id uuid,
  p_topic_category text, p_preferred_contact_method text, p_urgency_route text,
  p_shared_field_names jsonb, p_payload_ciphertext text, p_payload_nonce text,
  p_payload_authentication_tag text, p_encryption_key_version text,
  p_payload_digest text, p_idempotency_key text
) returns setof public.levytate_pastoral_support_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existing public.levytate_pastoral_support_requests%rowtype; v_saved public.levytate_pastoral_support_requests%rowtype;
begin
  select * into v_existing from public.levytate_pastoral_support_requests
    where organisation_id = p_organisation_id and owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.employee_id is distinct from p_employee_id or v_existing.recipient_id is distinct from p_recipient_id
      or v_existing.payload_digest is distinct from p_payload_digest
    then raise exception 'Conflicting pastoral support request idempotency key'; end if;
    return next v_existing; return;
  end if;
  if not exists (select 1 from public.levytate_organisation_capabilities where organisation_id = p_organisation_id and pastoral_support_enabled = true)
    or not exists (select 1 from public.levytate_pastoral_access_eligibility where organisation_id = p_organisation_id and employee_id = p_employee_id and owner_user_id = p_owner_user_id and active = true and age_assurance_status = 'adult' and (expires_at is null or expires_at > timezone('utc', now())))
  then raise exception 'Pastoral support is not enabled for this employee'; end if;
  if not exists (select 1 from public.levytate_pastoral_support_recipients where organisation_id = p_organisation_id and id = p_recipient_id and active = true)
  then raise exception 'The selected support recipient is unavailable'; end if;
  if jsonb_typeof(p_shared_field_names) <> 'array' or jsonb_array_length(p_shared_field_names) < 1
    or exists (
      select 1 from jsonb_array_elements_text(p_shared_field_names) as field_name(value)
      where field_name.value not in (
        'topic','what_i_want_you_to_understand','how_it_is_affecting_me',
        'support_i_want','preferred_contact_method','sharing_restrictions','recipient'
      )
    )
  then raise exception 'Support request contains an unapproved shared field'; end if;
  insert into public.levytate_pastoral_support_requests (
    organisation_id, employee_id, owner_user_id, recipient_id, assigned_recipient_id,
    topic_category, preferred_contact_method, urgency_route, shared_field_names,
    payload_ciphertext, payload_nonce, payload_authentication_tag, encryption_key_version,
    payload_digest, idempotency_key
  ) values (
    p_organisation_id, p_employee_id, p_owner_user_id, p_recipient_id, p_recipient_id,
    p_topic_category, p_preferred_contact_method, p_urgency_route, p_shared_field_names,
    p_payload_ciphertext, p_payload_nonce, p_payload_authentication_tag, p_encryption_key_version,
    p_payload_digest, p_idempotency_key
  ) returning * into v_saved;
  insert into public.levytate_pastoral_support_request_events (
    organisation_id, support_request_id, event_type, actor_user_id, actor_role,
    previous_state, new_state, idempotency_key
  ) values (p_organisation_id, v_saved.id, 'submitted', p_owner_user_id, 'Employee', null, 'submitted', left(p_idempotency_key || ':submitted', 128));
  insert into public.levytate_pastoral_audit_events (
    organisation_id, employee_id, actor_user_id, entity_type, entity_id, action, outcome, correlation_id
  ) values (p_organisation_id, p_employee_id, p_owner_user_id, 'support_request', v_saved.id, 'support_request.submitted', 'completed', p_idempotency_key);
  return next v_saved;
end;
$$;

create or replace function public.levytate_transition_pastoral_support_request(
  p_organisation_id uuid, p_support_request_id uuid,
  p_actor_user_id uuid, p_actor_provider_membership_id uuid,
  p_action text, p_expected_lock_version integer, p_idempotency_key text,
  p_new_recipient_id uuid default null, p_note_ciphertext text default null, p_note_nonce text default null,
  p_note_authentication_tag text default null, p_encryption_key_version text default null
) returns setof public.levytate_pastoral_support_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_request public.levytate_pastoral_support_requests%rowtype; v_recipient public.levytate_pastoral_support_recipients%rowtype;
  v_user public.levytate_users%rowtype; v_provider public.levytate_provider_memberships%rowtype;
  v_next text; v_event text; v_actor_role text; v_previous text;
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
        (v_recipient.id is not null and (v_recipient.employer_user_id is not distinct from p_actor_user_id or v_recipient.provider_membership_id is not distinct from p_actor_provider_membership_id))
        or exists (
          select 1 from public.levytate_pastoral_support_recipients approved
          where approved.organisation_id = p_organisation_id and approved.active = true
            and (approved.employer_user_id is not distinct from p_actor_user_id or approved.provider_membership_id is not distinct from p_actor_provider_membership_id)
        )
      ) then raise exception 'Only an approved active support recipient may reassign this request'; end if;
      v_next := v_request.status; v_event := 'reassigned';
    else
      if v_recipient.id is null or (v_recipient.employer_user_id is distinct from p_actor_user_id and v_recipient.provider_membership_id is distinct from p_actor_provider_membership_id)
      then raise exception 'Only the active assigned recipient may update this support request'; end if;
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
    v_actor_role, v_previous,
    v_next, p_note_ciphertext, p_note_nonce, p_note_authentication_tag, p_encryption_key_version, p_idempotency_key
  );
  insert into public.levytate_pastoral_audit_events (
    organisation_id, employee_id, actor_user_id, entity_type, entity_id, action, outcome, correlation_id
  ) values (p_organisation_id, v_request.employee_id, p_actor_user_id, 'support_request', v_request.id, 'support_request.' || p_action, 'completed', p_idempotency_key);
  return next v_request;
end;
$$;

create or replace function public.levytate_consume_pastoral_rate_limit(
  p_environment_namespace text, p_action text, p_key_hash text,
  p_window_seconds integer, p_limit integer, p_now timestamptz default timezone('utc', now())
) returns table (allowed boolean, request_count integer, remaining integer, reset_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_window_started timestamptz; v_count integer;
begin
  if p_window_seconds < 1 or p_limit < 1 or char_length(p_key_hash) < 32 then raise exception 'Invalid pastoral rate-limit input'; end if;
  v_window_started := to_timestamp(floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds);
  insert into public.levytate_pastoral_rate_limits(environment_namespace, action, key_hash, window_started_at, request_count, expires_at)
    values (left(p_environment_namespace, 32), left(p_action, 80), left(p_key_hash, 128), v_window_started, 1, v_window_started + make_interval(secs => p_window_seconds * 2))
  on conflict (environment_namespace, action, key_hash, window_started_at)
  do update set request_count = public.levytate_pastoral_rate_limits.request_count + 1
  returning public.levytate_pastoral_rate_limits.request_count into v_count;
  return query select v_count <= p_limit, v_count, greatest(p_limit - v_count, 0), v_window_started + make_interval(secs => p_window_seconds);
end;
$$;

do $$ declare t text; begin
  foreach t in array array[
    'levytate_pastoral_access_eligibility','levytate_pastoral_preferences',
    'levytate_pastoral_support_recipients','levytate_pastoral_conversations',
    'levytate_pastoral_messages','levytate_pastoral_support_requests',
    'levytate_pastoral_support_request_events','levytate_pastoral_audit_events',
    'levytate_pastoral_rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

grant select, insert, update on table public.levytate_pastoral_access_eligibility to service_role;
grant select, insert, update on table public.levytate_pastoral_preferences to service_role;
grant select, insert, update on table public.levytate_pastoral_support_recipients to service_role;
grant select, insert, update, delete on table public.levytate_pastoral_conversations to service_role;
grant select, insert, delete on table public.levytate_pastoral_messages to service_role;
grant select on table public.levytate_pastoral_support_requests to service_role;
grant select on table public.levytate_pastoral_support_request_events to service_role;
grant select, insert on table public.levytate_pastoral_audit_events to service_role;

do $$ declare t text; p text; begin
  foreach t in array array[
    'levytate_pastoral_access_eligibility','levytate_pastoral_preferences',
    'levytate_pastoral_support_recipients','levytate_pastoral_conversations',
    'levytate_pastoral_messages','levytate_pastoral_support_requests',
    'levytate_pastoral_support_request_events','levytate_pastoral_audit_events'
  ] loop
    p := t || '_service_role_all';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format('create policy %I on public.%I for all to service_role using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', p, t);
  end loop;
end $$;

revoke all on function public.levytate_validate_pastoral_employee_owner() from public, anon, authenticated, service_role;
revoke all on function public.levytate_validate_pastoral_recipient() from public, anon, authenticated, service_role;
revoke all on function public.levytate_reject_pastoral_append_only_mutation() from public, anon, authenticated, service_role;
revoke all on function public.levytate_protect_pastoral_message() from public, anon, authenticated, service_role;
revoke all on function public.levytate_protect_pastoral_support_request() from public, anon, authenticated, service_role;
revoke all on function public.levytate_submit_pastoral_support_request(uuid,text,uuid,uuid,text,text,text,jsonb,text,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_submit_pastoral_support_request(uuid,text,uuid,uuid,text,text,text,jsonb,text,text,text,text,text,text) to service_role;
revoke all on function public.levytate_transition_pastoral_support_request(uuid,uuid,uuid,uuid,text,integer,text,uuid,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_transition_pastoral_support_request(uuid,uuid,uuid,uuid,text,integer,text,uuid,text,text,text,text) to service_role;
revoke all on function public.levytate_consume_pastoral_rate_limit(text,text,text,integer,integer,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.levytate_consume_pastoral_rate_limit(text,text,text,integer,integer,timestamptz) to service_role;

comment on table public.levytate_pastoral_access_eligibility is 'Explicit per-employee adult eligibility gate. Absence, expiry or unverified age fails closed.';
comment on table public.levytate_pastoral_preferences is 'Employee-owned history preference. save_history=false means routine chat turns are not persisted.';
comment on table public.levytate_pastoral_conversations is 'Metadata for explicitly saved private conversations; content is stored only as authenticated ciphertext.';
comment on table public.levytate_pastoral_messages is 'Application-encrypted pastoral conversation content. No plaintext transcript is stored.';
comment on table public.levytate_pastoral_support_requests is 'Explicitly employee-approved, encrypted minimum-necessary handoff content, separate from private conversation history.';
comment on table public.levytate_pastoral_support_request_events is 'Append-only support workflow state evidence. Optional notes remain encrypted.';
comment on table public.levytate_pastoral_audit_events is 'Minimal non-sensitive pastoral audit metadata. No prompt, response or shared-request payload is stored.';
comment on table public.levytate_pastoral_rate_limits is 'HMAC-derived rate-limit keys only; no raw email, IP address or message content.';

notify pgrst, 'reload schema';
