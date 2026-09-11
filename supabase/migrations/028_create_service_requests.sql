-- LevyTate Requests V1.1: employer-controlled briefs, provider opportunities,
-- comparable responses and explicit operational handover.
--
-- This migration is additive. It does not alter the legacy percentage-ranked
-- matching workflow, canonical Marketplace records, employer operational data,
-- Finance data, Provider Intelligence, or migrations 025-027.

create table public.levytate_organisation_capabilities (
  organisation_id uuid primary key references public.levytate_organisations(id) on delete restrict,
  requests_enabled boolean not null default false,
  enabled_by uuid references public.levytate_users(id) on delete set null,
  enabled_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.levytate_organisation_capabilities is
  'Server-owned workspace capabilities. Requests remains off when a row is absent or requests_enabled is false.';

create table public.levytate_provider_memberships (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  email text not null,
  display_name text not null default '',
  auth_subject uuid,
  auth_binding_status text not null default 'pending',
  auth_bound_at timestamptz,
  last_login_at timestamptz,
  role text not null default 'Provider User',
  active boolean not null default true,
  created_by uuid references public.levytate_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint levytate_provider_memberships_email_normalised_check check (email = lower(btrim(email))),
  constraint levytate_provider_memberships_email_nonempty_check check (length(btrim(email)) > 3),
  constraint levytate_provider_memberships_provider_nonempty_check check (length(btrim(provider_id)) > 0),
  constraint levytate_provider_memberships_binding_check check (auth_binding_status in ('pending','bound')),
  constraint levytate_provider_memberships_role_check check (role in ('Provider Admin','Provider User')),
  constraint levytate_provider_memberships_bound_subject_check check (
    (auth_binding_status = 'pending' and auth_subject is null and auth_bound_at is null)
    or (auth_binding_status = 'bound' and auth_subject is not null and auth_bound_at is not null)
  ),
  constraint levytate_provider_memberships_id_provider_unique unique (id, provider_id)
);

create unique index levytate_provider_memberships_email_unique_idx
  on public.levytate_provider_memberships (lower(email));
create unique index levytate_provider_memberships_auth_subject_unique_idx
  on public.levytate_provider_memberships (auth_subject)
  where auth_subject is not null;
create index levytate_provider_memberships_provider_active_idx
  on public.levytate_provider_memberships (provider_id, active, role);

comment on table public.levytate_provider_memberships is
  'Provider tenancy is separate from employer organisation membership and grants no employer workspace permission.';
comment on column public.levytate_provider_memberships.provider_id is
  'Canonical Marketplace provider identifier, verified server-side against the catalogue before provisioning.';

create table public.levytate_service_requests (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  title text not null,
  request_mode text not null,
  requirement text not null,
  programme_id text,
  programme_title text,
  apprenticeship_standard_id text,
  provider_context_id text,
  readiness text not null,
  learner_volume jsonb not null,
  workplace_location jsonb not null,
  delivery_preferences jsonb not null default '[]'::jsonb,
  preferred_start jsonb not null,
  departments jsonb not null default '[]'::jsonb,
  target_roles jsonb not null default '[]'::jsonb,
  workforce_mix text,
  business_outcome text,
  workplace_project_requirements text,
  accessibility_considerations text,
  procurement_requirements text,
  additional_notes text,
  internal_private_context jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  response_deadline date not null,
  current_version integer not null default 0,
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  published_by uuid references public.levytate_users(id) on delete restrict,
  published_at timestamptz,
  closed_at timestamptz,
  cancellation_reason text,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_service_requests_id_unique unique (id),
  constraint levytate_service_requests_title_check check (length(btrim(title)) > 0),
  constraint levytate_service_requests_requirement_check check (length(btrim(requirement)) > 0),
  constraint levytate_service_requests_mode_check check (request_mode in ('programme_led','need_led')),
  constraint levytate_service_requests_programme_mode_check check (
    request_mode <> 'programme_led' or programme_id is not null
  ),
  constraint levytate_service_requests_readiness_check check (
    readiness in ('exploring','planning','approved_to_proceed')
  ),
  constraint levytate_service_requests_workforce_mix_check check (
    workforce_mix is null or workforce_mix in ('existing_employees','new_recruits','mixed','unknown')
  ),
  constraint levytate_service_requests_status_check check (
    status in ('draft','open','responses_received','decision_in_progress','progressed_to_agreement','closed','cancelled','expired')
  ),
  constraint levytate_service_requests_version_check check (current_version >= 0),
  constraint levytate_service_requests_json_shapes_check check (
    jsonb_typeof(learner_volume) = 'object'
    and jsonb_typeof(workplace_location) = 'object'
    and jsonb_typeof(delivery_preferences) = 'array'
    and jsonb_typeof(preferred_start) = 'object'
    and jsonb_typeof(departments) = 'array'
    and jsonb_typeof(target_roles) = 'array'
    and jsonb_typeof(internal_private_context) = 'object'
  )
);

create index levytate_service_requests_status_idx
  on public.levytate_service_requests (organisation_id, status, updated_at desc);
create index levytate_service_requests_deadline_idx
  on public.levytate_service_requests (organisation_id, response_deadline, status);

comment on column public.levytate_service_requests.internal_private_context is
  'Employer-only context. It is never copied automatically into provider-visible published snapshots.';
comment on column public.levytate_service_requests.provider_context_id is
  'Optional Marketplace entry context only; it never auto-invites the provider.';

create table public.levytate_service_request_versions (
  organisation_id uuid not null,
  request_id uuid not null,
  version integer not null,
  published_snapshot jsonb not null,
  published_at timestamptz not null default timezone('utc', now()),
  published_by uuid not null references public.levytate_users(id) on delete restrict,
  change_summary text not null,
  primary key (organisation_id, request_id, version),
  constraint levytate_service_request_versions_request_fk foreign key (organisation_id, request_id)
    references public.levytate_service_requests (organisation_id, id) on delete restrict,
  constraint levytate_service_request_versions_version_check check (version > 0),
  constraint levytate_service_request_versions_snapshot_check check (jsonb_typeof(published_snapshot) = 'object'),
  constraint levytate_service_request_versions_summary_check check (length(btrim(change_summary)) > 0)
);

create index levytate_service_request_versions_recent_idx
  on public.levytate_service_request_versions (organisation_id, request_id, version desc);

comment on table public.levytate_service_request_versions is
  'Immutable provider-visible snapshots. Historical briefs are never rebuilt from mutable request fields.';

create table public.levytate_service_request_invitations (
  organisation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  provider_id text not null,
  request_version integer not null,
  invited_provider_membership_id uuid,
  invited_contact_email text,
  status text not null default 'pending_delivery',
  notification_status text not null default 'pending',
  notification_attempt_count integer not null default 0,
  notification_failure_code text,
  notification_provider_id text,
  sent_at timestamptz,
  viewed_at timestamptz,
  response_deadline date not null,
  declined_at timestamptz,
  decline_reason_category text,
  decline_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_service_request_invitations_id_unique unique (id),
  constraint levytate_service_request_invitations_request_provider_unique unique (
    organisation_id, request_id, provider_id
  ),
  constraint levytate_service_request_invitations_scope_unique unique (
    organisation_id, id, request_id, provider_id, request_version
  ),
  constraint levytate_service_request_invitations_request_scope_unique unique (
    organisation_id, id, request_id, provider_id
  ),
  constraint levytate_service_request_invitations_provider_scope_unique unique (
    organisation_id, id, provider_id
  ),
  constraint levytate_service_request_invitations_version_fk foreign key (
    organisation_id, request_id, request_version
  ) references public.levytate_service_request_versions (organisation_id, request_id, version) on delete restrict,
  constraint levytate_service_request_invitations_member_fk foreign key (
    invited_provider_membership_id, provider_id
  ) references public.levytate_provider_memberships (id, provider_id) on delete restrict,
  constraint levytate_service_request_invitations_status_check check (
    status in ('pending_delivery','sent','viewed','responded','declined','delivery_failed','deadline_passed','cancelled')
  ),
  constraint levytate_service_request_invitations_notification_check check (
    notification_status in ('pending','accepted','failed')
  ),
  constraint levytate_service_request_invitations_attempts_check check (notification_attempt_count >= 0),
  constraint levytate_service_request_invitations_decline_check check (
    decline_reason_category is null or decline_reason_category in (
      'not_a_programme_we_deliver','no_capacity_in_required_timeframe',
      'location_or_delivery_requirements','cohort_size','commercial_fit','other'
    )
  ),
  constraint levytate_service_request_invitations_delivery_truth_check check (
    notification_status <> 'accepted' or sent_at is not null
  )
);

create index levytate_service_request_invitations_request_idx
  on public.levytate_service_request_invitations (organisation_id, request_id, status);
create index levytate_service_request_invitations_provider_idx
  on public.levytate_service_request_invitations (provider_id, status, response_deadline);
create index levytate_service_request_invitations_delivery_idx
  on public.levytate_service_request_invitations (organisation_id, notification_status, updated_at desc);

create function public.enforce_levytate_service_request_provider_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_invitation_count integer;
begin
  -- Serialise invitation creation per Request so concurrent sends cannot bypass
  -- the V1.1 maximum of five employer-selected providers.
  perform pg_advisory_xact_lock(
    hashtextextended(new.organisation_id::text || ':' || new.request_id::text, 0)
  );

  select count(*)
    into existing_invitation_count
    from public.levytate_service_request_invitations invitation
   where invitation.organisation_id = new.organisation_id
     and invitation.request_id = new.request_id
     and invitation.id <> new.id;

  if existing_invitation_count >= 5 then
    raise exception 'A LevyTate Request may invite no more than five providers.'
      using errcode = '23514',
            constraint = 'levytate_service_request_invitations_provider_limit';
  end if;

  return new;
end;
$$;

create trigger levytate_service_request_invitations_provider_limit
before insert or update of organisation_id, request_id, provider_id
on public.levytate_service_request_invitations
for each row execute function public.enforce_levytate_service_request_provider_limit();

create table public.levytate_provider_access_invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  request_invitation_id uuid not null,
  provider_id text not null,
  invited_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_membership_id uuid,
  revoked_at timestamptz,
  created_by uuid not null references public.levytate_users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint levytate_provider_access_invites_invitation_fk foreign key (
    organisation_id, request_invitation_id, provider_id
  ) references public.levytate_service_request_invitations (organisation_id, id, provider_id) on delete restrict,
  constraint levytate_provider_access_invites_membership_fk foreign key (
    redeemed_by_membership_id, provider_id
  ) references public.levytate_provider_memberships (id, provider_id) on delete restrict,
  constraint levytate_provider_access_invites_email_check check (invited_email = lower(btrim(invited_email))),
  constraint levytate_provider_access_invites_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint levytate_provider_access_invites_expiry_check check (expires_at > created_at),
  constraint levytate_provider_access_invites_redemption_check check (
    redeemed_at is null or redeemed_by_membership_id is not null
  )
);

create unique index levytate_provider_access_invites_active_unique_idx
  on public.levytate_provider_access_invites (request_invitation_id, lower(invited_email))
  where redeemed_at is null and revoked_at is null;
create index levytate_provider_access_invites_lookup_idx
  on public.levytate_provider_access_invites (provider_id, invited_email, expires_at)
  where redeemed_at is null and revoked_at is null;

comment on column public.levytate_provider_access_invites.token_hash is
  'SHA-256 hash only. Plaintext invitation credentials must never be persisted.';

create table public.levytate_service_request_responses (
  organisation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  invitation_id uuid not null,
  provider_id text not null,
  provider_membership_id uuid not null,
  request_version integer not null,
  status text not null default 'draft',
  draft_content jsonb not null default '{}'::jsonb,
  current_version integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_service_request_responses_id_unique unique (id),
  constraint levytate_service_request_responses_invitation_unique unique (organisation_id, invitation_id),
  constraint levytate_service_request_responses_scope_unique unique (
    organisation_id, id, request_id, provider_id
  ),
  constraint levytate_service_request_responses_invitation_fk foreign key (
    organisation_id, invitation_id, request_id, provider_id
  ) references public.levytate_service_request_invitations (
    organisation_id, id, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_responses_request_version_fk foreign key (
    organisation_id, request_id, request_version
  ) references public.levytate_service_request_versions (organisation_id, request_id, version) on delete restrict,
  constraint levytate_service_request_responses_member_fk foreign key (
    provider_membership_id, provider_id
  ) references public.levytate_provider_memberships (id, provider_id) on delete restrict,
  constraint levytate_service_request_responses_status_check check (status in ('draft','submitted')),
  constraint levytate_service_request_responses_content_check check (jsonb_typeof(draft_content) = 'object'),
  constraint levytate_service_request_responses_version_check check (current_version >= 0),
  constraint levytate_service_request_responses_submission_check check (
    status <> 'submitted' or (submitted_at is not null and current_version > 0)
  )
);

create index levytate_service_request_responses_request_idx
  on public.levytate_service_request_responses (organisation_id, request_id, status);
create index levytate_service_request_responses_provider_idx
  on public.levytate_service_request_responses (provider_id, status, updated_at desc);

create table public.levytate_service_request_response_versions (
  organisation_id uuid not null,
  response_id uuid not null,
  request_id uuid not null,
  provider_id text not null,
  request_version integer not null,
  version integer not null,
  submitted_content jsonb not null,
  submitted_by_provider_membership_id uuid not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, response_id, version),
  constraint levytate_service_request_response_versions_scope_unique unique (
    organisation_id, response_id, version, request_id, provider_id
  ),
  constraint levytate_service_request_response_versions_response_fk foreign key (
    organisation_id, response_id, request_id, provider_id
  ) references public.levytate_service_request_responses (
    organisation_id, id, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_response_versions_request_version_fk foreign key (
    organisation_id, request_id, request_version
  ) references public.levytate_service_request_versions (organisation_id, request_id, version) on delete restrict,
  constraint levytate_service_request_response_versions_member_fk foreign key (
    submitted_by_provider_membership_id, provider_id
  ) references public.levytate_provider_memberships (id, provider_id) on delete restrict,
  constraint levytate_service_request_response_versions_version_check check (version > 0),
  constraint levytate_service_request_response_versions_content_check check (jsonb_typeof(submitted_content) = 'object')
);

create index levytate_service_request_response_versions_recent_idx
  on public.levytate_service_request_response_versions (organisation_id, response_id, version desc);

comment on table public.levytate_service_request_response_versions is
  'Immutable submitted provider responses tied to the exact Request version answered.';

create table public.levytate_service_request_clarifications (
  organisation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  invitation_id uuid not null,
  provider_id text not null,
  request_version integer not null,
  asked_by_type text not null,
  asked_by_provider_membership_id uuid,
  asked_by_employer_user_id uuid references public.levytate_users(id) on delete restrict,
  question text not null,
  visibility text not null default 'provider_specific',
  asked_at timestamptz not null default timezone('utc', now()),
  answer text,
  answered_by_type text,
  answered_by_provider_membership_id uuid,
  answered_by_employer_user_id uuid references public.levytate_users(id) on delete restrict,
  answered_at timestamptz,
  shared_by_employer_user_id uuid references public.levytate_users(id) on delete restrict,
  shared_at timestamptz,
  primary key (organisation_id, id),
  constraint levytate_service_request_clarifications_invitation_fk foreign key (
    organisation_id, invitation_id, request_id, provider_id
  ) references public.levytate_service_request_invitations (
    organisation_id, id, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_clarifications_request_version_fk foreign key (
    organisation_id, request_id, request_version
  ) references public.levytate_service_request_versions (organisation_id, request_id, version) on delete restrict,
  constraint levytate_service_request_clarifications_member_fk foreign key (
    asked_by_provider_membership_id, provider_id
  ) references public.levytate_provider_memberships (id, provider_id) on delete restrict,
  constraint levytate_service_request_clarifications_answer_member_fk foreign key (
    answered_by_provider_membership_id, provider_id
  ) references public.levytate_provider_memberships (id, provider_id) on delete restrict,
  constraint levytate_service_request_clarifications_question_check check (length(btrim(question)) > 0),
  constraint levytate_service_request_clarifications_asker_type_check check (
    asked_by_type in ('provider_member','employer_user')
  ),
  constraint levytate_service_request_clarifications_asker_check check (
    (asked_by_type = 'provider_member' and asked_by_provider_membership_id is not null and asked_by_employer_user_id is null)
    or
    (asked_by_type = 'employer_user' and asked_by_employer_user_id is not null and asked_by_provider_membership_id is null)
  ),
  constraint levytate_service_request_clarifications_visibility_check check (
    visibility in ('provider_specific','shared_with_invited_providers')
  ),
  constraint levytate_service_request_clarifications_answerer_type_check check (
    answered_by_type is null or answered_by_type in ('provider_member','employer_user')
  ),
  constraint levytate_service_request_clarifications_answer_check check (
    (answered_at is null and answer is null and answered_by_type is null
      and answered_by_provider_membership_id is null and answered_by_employer_user_id is null)
    or
    (answered_at is not null and answer is not null and (
      (asked_by_type = 'provider_member' and answered_by_type = 'employer_user'
        and answered_by_employer_user_id is not null and answered_by_provider_membership_id is null)
      or
      (asked_by_type = 'employer_user' and answered_by_type = 'provider_member'
        and answered_by_provider_membership_id is not null and answered_by_employer_user_id is null)
    ))
  ),
  constraint levytate_service_request_clarifications_share_check check (
    visibility <> 'shared_with_invited_providers'
    or (asked_by_type = 'provider_member' and answer is not null
      and shared_at is not null and shared_by_employer_user_id is not null)
  )
);

create index levytate_service_request_clarifications_request_idx
  on public.levytate_service_request_clarifications (organisation_id, request_id, asked_at);
create index levytate_service_request_clarifications_provider_idx
  on public.levytate_service_request_clarifications (provider_id, invitation_id, visibility);

create table public.levytate_service_request_decisions (
  organisation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  invitation_id uuid not null,
  response_id uuid not null,
  provider_id text not null,
  state text not null default 'pending',
  private_decision_note text,
  shortlisted_at timestamptz,
  shortlisted_by uuid references public.levytate_users(id) on delete restrict,
  declined_at timestamptz,
  declined_by uuid references public.levytate_users(id) on delete restrict,
  progressed_at timestamptz,
  progressed_by uuid references public.levytate_users(id) on delete restrict,
  agreement_confirmed_at timestamptz,
  agreement_confirmed_by uuid references public.levytate_users(id) on delete restrict,
  not_proceeded_at timestamptz,
  not_proceeded_by uuid references public.levytate_users(id) on delete restrict,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_service_request_decisions_request_provider_unique unique (
    organisation_id, request_id, provider_id
  ),
  constraint levytate_service_request_decisions_response_fk foreign key (
    organisation_id, response_id, request_id, provider_id
  ) references public.levytate_service_request_responses (
    organisation_id, id, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_decisions_invitation_fk foreign key (
    organisation_id, invitation_id, request_id, provider_id
  ) references public.levytate_service_request_invitations (
    organisation_id, id, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_decisions_state_check check (
    state in ('pending','shortlisted','declined','progressed_to_agreement','agreement_confirmed','not_proceeded')
  )
);

create index levytate_service_request_decisions_state_idx
  on public.levytate_service_request_decisions (organisation_id, request_id, state);
create unique index levytate_service_request_decisions_one_progressed_idx
  on public.levytate_service_request_decisions (organisation_id, request_id)
  where state in ('progressed_to_agreement','agreement_confirmed');

comment on column public.levytate_service_request_decisions.private_decision_note is
  'Employer-only. It must never be returned to provider users.';

create table public.levytate_service_request_agreements (
  organisation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  invitation_id uuid not null,
  response_id uuid not null,
  response_version integer not null,
  provider_id text not null,
  proposed_programme_id text,
  commitment_snapshot jsonb not null,
  confirmed_by uuid not null references public.levytate_users(id) on delete restrict,
  confirmed_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_service_request_agreements_request_unique unique (organisation_id, request_id),
  constraint levytate_service_request_agreements_scope_unique unique (
    organisation_id, id, request_id, provider_id
  ),
  constraint levytate_service_request_agreements_response_version_fk foreign key (
    organisation_id, response_id, response_version, request_id, provider_id
  ) references public.levytate_service_request_response_versions (
    organisation_id, response_id, version, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_agreements_invitation_fk foreign key (
    organisation_id, invitation_id, request_id, provider_id
  ) references public.levytate_service_request_invitations (
    organisation_id, id, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_agreements_snapshot_check check (jsonb_typeof(commitment_snapshot) = 'object')
);

comment on table public.levytate_service_request_agreements is
  'Request agreement snapshot for operational reference; it is not represented as a contract.';

create table public.levytate_service_request_handovers (
  organisation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  agreement_id uuid not null,
  provider_id text not null,
  programme_id text,
  add_provider boolean not null default false,
  add_programme boolean not null default false,
  provider_added boolean not null default false,
  programme_added boolean not null default false,
  idempotency_key text not null,
  completed_by uuid not null references public.levytate_users(id) on delete restrict,
  completed_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_service_request_handovers_idempotency_unique unique (
    organisation_id, idempotency_key
  ),
  constraint levytate_service_request_handovers_request_unique unique (organisation_id, request_id),
  constraint levytate_service_request_handovers_agreement_fk foreign key (
    organisation_id, agreement_id, request_id, provider_id
  ) references public.levytate_service_request_agreements (
    organisation_id, id, request_id, provider_id
  ) on delete restrict,
  constraint levytate_service_request_handovers_programme_check check (
    not add_programme or programme_id is not null
  )
);

comment on table public.levytate_service_request_handovers is
  'Idempotent audit of explicit My Providers/My Programmes handover. It never creates employees, applications, learners or enrolments.';

create table public.levytate_service_request_events (
  organisation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  invitation_id uuid,
  response_id uuid,
  provider_id text,
  event_type text not null,
  actor_type text not null,
  actor_id uuid,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_service_request_events_idempotency_unique unique (
    organisation_id, request_id, idempotency_key
  ),
  constraint levytate_service_request_events_request_fk foreign key (organisation_id, request_id)
    references public.levytate_service_requests (organisation_id, id) on delete restrict,
  constraint levytate_service_request_events_event_check check (event_type in (
    'request_created','request_published','request_updated','invitation_sent',
    'invitation_delivery_failed','invitation_viewed','provider_response_started',
    'provider_response_submitted','provider_response_revised','employer_response_notification_sent','provider_declined',
    'clarification_asked','clarification_answered','clarification_shared',
    'provider_shortlisted','provider_declined_by_employer','provider_progressed_to_agreement',
    'agreement_confirmed','agreement_not_proceeded','request_deadline_extended',
    'request_expired','request_cancelled','request_closed','workspace_handover_completed'
  )),
  constraint levytate_service_request_events_actor_check check (
    actor_type in ('employer_user','provider_member','system')
  ),
  constraint levytate_service_request_events_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create index levytate_service_request_events_request_idx
  on public.levytate_service_request_events (organisation_id, request_id, occurred_at);
create index levytate_service_request_events_type_idx
  on public.levytate_service_request_events (event_type, occurred_at);
create index levytate_service_request_events_provider_idx
  on public.levytate_service_request_events (provider_id, occurred_at)
  where provider_id is not null;

-- Persist one logical Requests action as one transaction. The application sends
-- only rows changed by that action; the target Request and changed mutable rows
-- carry their previously-read updated_at value so a concurrent action fails
-- rather than committing against stale workflow state.
create function public.levytate_persist_service_request_action(
  p_organisation_id uuid,
  p_changes jsonb,
  p_expected jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  scoped_rows jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role access is required.' using errcode = '42501';
  end if;

  if p_organisation_id is null
     or jsonb_typeof(coalesce(p_changes, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_expected, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid Requests persistence payload.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('levytate-request-action:' || p_organisation_id::text, 0));

  scoped_rows :=
    coalesce(p_changes -> 'requests_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'requests_update', '[]'::jsonb)
    || coalesce(p_changes -> 'versions_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'invitations_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'invitations_update', '[]'::jsonb)
    || coalesce(p_changes -> 'responses_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'responses_update', '[]'::jsonb)
    || coalesce(p_changes -> 'response_versions_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'clarifications_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'clarifications_update', '[]'::jsonb)
    || coalesce(p_changes -> 'decisions_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'decisions_update', '[]'::jsonb)
    || coalesce(p_changes -> 'agreements_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'handovers_insert', '[]'::jsonb)
    || coalesce(p_changes -> 'organisation_providers_upsert', '[]'::jsonb)
    || coalesce(p_changes -> 'organisation_programmes_upsert', '[]'::jsonb)
    || coalesce(p_changes -> 'events_insert', '[]'::jsonb);

  if jsonb_typeof(scoped_rows) <> 'array'
     or exists (
       select 1
       from jsonb_array_elements(scoped_rows) as item
       where item ->> 'organisation_id' is distinct from p_organisation_id::text
     ) then
    raise exception 'Cross-organisation Requests persistence was denied.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_expected -> 'requests', '[]'::jsonb))
      as expected(id uuid, updated_at timestamptz)
    left join public.levytate_service_requests current
      on current.organisation_id = p_organisation_id and current.id = expected.id
    where current.id is null or current.updated_at is distinct from expected.updated_at
  ) or exists (
    select 1
    from jsonb_to_recordset(coalesce(p_expected -> 'invitations', '[]'::jsonb))
      as expected(id uuid, updated_at timestamptz)
    left join public.levytate_service_request_invitations current
      on current.organisation_id = p_organisation_id and current.id = expected.id
    where current.id is null or current.updated_at is distinct from expected.updated_at
  ) or exists (
    select 1
    from jsonb_to_recordset(coalesce(p_expected -> 'responses', '[]'::jsonb))
      as expected(id uuid, updated_at timestamptz)
    left join public.levytate_service_request_responses current
      on current.organisation_id = p_organisation_id and current.id = expected.id
    where current.id is null or current.updated_at is distinct from expected.updated_at
  ) or exists (
    select 1
    from jsonb_to_recordset(coalesce(p_expected -> 'decisions', '[]'::jsonb))
      as expected(id uuid, updated_at timestamptz)
    left join public.levytate_service_request_decisions current
      on current.organisation_id = p_organisation_id and current.id = expected.id
    where current.id is null or current.updated_at is distinct from expected.updated_at
  ) then
    raise exception 'The Request changed while this action was being saved. Reload and retry.'
      using errcode = '40001';
  end if;

  -- Clarifications do not have updated_at; compare the complete previously-read
  -- row before allowing an answer/share update.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_expected -> 'clarifications', '[]'::jsonb)) expected
    left join public.levytate_service_request_clarifications current
      on current.organisation_id = p_organisation_id
     and current.id = (expected ->> 'id')::uuid
    where current.id is null or to_jsonb(current) is distinct from (expected - 'id') || jsonb_build_object(
      'organisation_id', current.organisation_id,
      'id', current.id
    )
  ) then
    raise exception 'The clarification changed while this action was being saved. Reload and retry.'
      using errcode = '40001';
  end if;

  insert into public.levytate_service_requests
  select * from jsonb_populate_recordset(
    null::public.levytate_service_requests,
    coalesce(p_changes -> 'requests_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_requests
  select * from jsonb_populate_recordset(
    null::public.levytate_service_requests,
    coalesce(p_changes -> 'requests_update', '[]'::jsonb)
  )
  on conflict (organisation_id, id) do update set
    title = excluded.title,
    request_mode = excluded.request_mode,
    requirement = excluded.requirement,
    programme_id = excluded.programme_id,
    programme_title = excluded.programme_title,
    apprenticeship_standard_id = excluded.apprenticeship_standard_id,
    provider_context_id = excluded.provider_context_id,
    readiness = excluded.readiness,
    learner_volume = excluded.learner_volume,
    workplace_location = excluded.workplace_location,
    delivery_preferences = excluded.delivery_preferences,
    preferred_start = excluded.preferred_start,
    departments = excluded.departments,
    target_roles = excluded.target_roles,
    workforce_mix = excluded.workforce_mix,
    business_outcome = excluded.business_outcome,
    workplace_project_requirements = excluded.workplace_project_requirements,
    accessibility_considerations = excluded.accessibility_considerations,
    procurement_requirements = excluded.procurement_requirements,
    additional_notes = excluded.additional_notes,
    internal_private_context = excluded.internal_private_context,
    status = excluded.status,
    response_deadline = excluded.response_deadline,
    current_version = excluded.current_version,
    published_by = excluded.published_by,
    published_at = excluded.published_at,
    closed_at = excluded.closed_at,
    cancellation_reason = excluded.cancellation_reason,
    updated_at = excluded.updated_at;

  insert into public.levytate_service_request_versions
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_versions,
    coalesce(p_changes -> 'versions_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_request_invitations
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_invitations,
    coalesce(p_changes -> 'invitations_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_request_invitations
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_invitations,
    coalesce(p_changes -> 'invitations_update', '[]'::jsonb)
  )
  on conflict (organisation_id, id) do update set
    request_version = excluded.request_version,
    invited_provider_membership_id = excluded.invited_provider_membership_id,
    invited_contact_email = excluded.invited_contact_email,
    status = excluded.status,
    notification_status = excluded.notification_status,
    notification_attempt_count = excluded.notification_attempt_count,
    notification_failure_code = excluded.notification_failure_code,
    notification_provider_id = excluded.notification_provider_id,
    sent_at = excluded.sent_at,
    viewed_at = excluded.viewed_at,
    response_deadline = excluded.response_deadline,
    declined_at = excluded.declined_at,
    decline_reason_category = excluded.decline_reason_category,
    decline_note = excluded.decline_note,
    updated_at = excluded.updated_at;

  insert into public.levytate_service_request_responses
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_responses,
    coalesce(p_changes -> 'responses_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_request_responses
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_responses,
    coalesce(p_changes -> 'responses_update', '[]'::jsonb)
  )
  on conflict (organisation_id, id) do update set
    provider_membership_id = excluded.provider_membership_id,
    request_version = excluded.request_version,
    status = excluded.status,
    draft_content = excluded.draft_content,
    current_version = excluded.current_version,
    submitted_at = excluded.submitted_at,
    updated_at = excluded.updated_at;

  insert into public.levytate_service_request_response_versions
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_response_versions,
    coalesce(p_changes -> 'response_versions_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_request_clarifications
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_clarifications,
    coalesce(p_changes -> 'clarifications_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_request_clarifications
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_clarifications,
    coalesce(p_changes -> 'clarifications_update', '[]'::jsonb)
  )
  on conflict (organisation_id, id) do update set
    answer = excluded.answer,
    answered_by_type = excluded.answered_by_type,
    answered_by_provider_membership_id = excluded.answered_by_provider_membership_id,
    answered_by_employer_user_id = excluded.answered_by_employer_user_id,
    answered_at = excluded.answered_at,
    visibility = excluded.visibility,
    shared_by_employer_user_id = excluded.shared_by_employer_user_id,
    shared_at = excluded.shared_at;

  insert into public.levytate_service_request_decisions
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_decisions,
    coalesce(p_changes -> 'decisions_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_request_decisions
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_decisions,
    coalesce(p_changes -> 'decisions_update', '[]'::jsonb)
  )
  on conflict (organisation_id, id) do update set
    state = excluded.state,
    private_decision_note = excluded.private_decision_note,
    shortlisted_at = excluded.shortlisted_at,
    shortlisted_by = excluded.shortlisted_by,
    declined_at = excluded.declined_at,
    declined_by = excluded.declined_by,
    progressed_at = excluded.progressed_at,
    progressed_by = excluded.progressed_by,
    agreement_confirmed_at = excluded.agreement_confirmed_at,
    agreement_confirmed_by = excluded.agreement_confirmed_by,
    not_proceeded_at = excluded.not_proceeded_at,
    not_proceeded_by = excluded.not_proceeded_by,
    updated_at = excluded.updated_at;

  insert into public.levytate_service_request_agreements
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_agreements,
    coalesce(p_changes -> 'agreements_insert', '[]'::jsonb)
  );

  insert into public.levytate_service_request_handovers
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_handovers,
    coalesce(p_changes -> 'handovers_insert', '[]'::jsonb)
  );

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_changes -> 'organisation_providers_upsert', '[]'::jsonb))
      as selection(organisation_id uuid, provider_id text)
    where not exists (
      select 1
      from public.levytate_providers provider
      join public.levytate_organisations owner on owner.id = provider.organisation_id
      where owner.slug = 'levytate-internal'
        and provider.provider_id = selection.provider_id
        and provider.status = 'Active'
    )
  ) then
    raise exception 'Only an active canonical provider can be added to My Providers.' using errcode = '23514';
  end if;

  insert into public.levytate_organisation_providers
  select * from jsonb_populate_recordset(
    null::public.levytate_organisation_providers,
    coalesce(p_changes -> 'organisation_providers_upsert', '[]'::jsonb)
  )
  on conflict (organisation_id, provider_id) do update set
    status = excluded.status,
    selected_by = excluded.selected_by,
    selected_at = excluded.selected_at,
    updated_at = excluded.updated_at;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_changes -> 'organisation_programmes_upsert', '[]'::jsonb))
      as selection(organisation_id uuid, programme_id text, provider_id text)
    where not exists (
      select 1
      from public.levytate_provider_programmes programme
      join public.levytate_organisations owner on owner.id = programme.organisation_id
      where owner.slug = 'levytate-internal'
        and programme.id = selection.programme_id
        and programme.provider_id = selection.provider_id
        and programme.status = 'Active'
        and programme.record_status = 'Active'
    )
  ) then
    raise exception 'Only an active canonical programme can be added to My Programmes.' using errcode = '23514';
  end if;

  insert into public.levytate_organisation_programmes
  select * from jsonb_populate_recordset(
    null::public.levytate_organisation_programmes,
    coalesce(p_changes -> 'organisation_programmes_upsert', '[]'::jsonb)
  )
  on conflict (organisation_id, programme_id) do update set
    provider_id = excluded.provider_id,
    status = excluded.status,
    selected_by = excluded.selected_by,
    selected_at = excluded.selected_at,
    updated_at = excluded.updated_at;

  insert into public.levytate_service_request_events
  select * from jsonb_populate_recordset(
    null::public.levytate_service_request_events,
    coalesce(p_changes -> 'events_insert', '[]'::jsonb)
  );
end;
$$;

-- Platform Admin provider-access changes must not leave a membership without its
-- audit record (or vice versa). Auth-directory preparation happens separately;
-- an unused Auth identity grants no provider access until this transaction
-- creates an active membership and the normal callback binds its subject.
create function public.levytate_mutate_provider_membership(
  p_operation text,
  p_membership jsonb,
  p_expected_updated_at timestamptz,
  p_audit jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  incoming public.levytate_provider_memberships%rowtype;
  current_membership public.levytate_provider_memberships%rowtype;
  saved public.levytate_provider_memberships%rowtype;
  canonical_organisation_id uuid;
  expected_audit_action text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role access is required.' using errcode = '42501';
  end if;
  if p_operation not in ('provision','update','revoke','reactivate')
     or jsonb_typeof(coalesce(p_membership, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_audit, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid provider-access mutation payload.' using errcode = '22023';
  end if;

  select * into incoming
  from jsonb_populate_record(null::public.levytate_provider_memberships, p_membership);
  select organisation.id into canonical_organisation_id
  from public.levytate_organisations organisation
  where organisation.slug = 'levytate-internal' and organisation.status = 'Active'
  limit 1;
  if canonical_organisation_id is null then
    raise exception 'The canonical provider catalogue is unavailable.' using errcode = '23514';
  end if;
  if p_operation <> 'revoke' and not exists (
    select 1 from public.levytate_providers provider
    where provider.organisation_id = canonical_organisation_id
      and provider.provider_id = incoming.provider_id
      and provider.status = 'Active'
  ) then
    raise exception 'Only an active canonical provider can receive provider access.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('levytate-provider-access:' || lower(incoming.email), 0));

  if p_operation = 'provision' then
    if p_expected_updated_at is not null then
      raise exception 'A new provider membership cannot have an expected version.' using errcode = '22023';
    end if;
    if incoming.active is distinct from true
       or incoming.auth_subject is not null
       or incoming.auth_binding_status is distinct from 'pending'
       or incoming.auth_bound_at is not null
       or incoming.last_login_at is not null then
      raise exception 'A new provider membership must begin active with pending Auth binding.' using errcode = '23514';
    end if;
    insert into public.levytate_provider_memberships
    select (incoming).*
    returning * into saved;
  else
    if p_expected_updated_at is null then
      raise exception 'The provider membership version is required.' using errcode = '22023';
    end if;
    select * into current_membership
    from public.levytate_provider_memberships current
    where current.id = incoming.id
      and current.provider_id = incoming.provider_id
      and current.email = incoming.email
    for update;
    if current_membership.id is null
       or current_membership.updated_at is distinct from p_expected_updated_at then
      raise exception 'Provider access changed while it was being saved. Reload and retry.' using errcode = '40001';
    end if;
    if p_operation = 'update' and (
      incoming.active is distinct from current_membership.active
      or incoming.auth_subject is distinct from current_membership.auth_subject
      or incoming.auth_binding_status is distinct from current_membership.auth_binding_status
      or incoming.auth_bound_at is distinct from current_membership.auth_bound_at
      or incoming.last_login_at is distinct from current_membership.last_login_at
    ) then
      raise exception 'A profile update cannot change provider access lifecycle or Auth binding.' using errcode = '23514';
    end if;
    if p_operation = 'revoke' and (
      incoming.active is distinct from false
      or incoming.role is distinct from current_membership.role
      or incoming.display_name is distinct from current_membership.display_name
      or incoming.auth_subject is distinct from current_membership.auth_subject
      or incoming.auth_binding_status is distinct from current_membership.auth_binding_status
      or incoming.auth_bound_at is distinct from current_membership.auth_bound_at
      or incoming.last_login_at is distinct from current_membership.last_login_at
    ) then
      raise exception 'Revocation may only deactivate the existing provider membership.' using errcode = '23514';
    end if;
    if p_operation = 'reactivate' and (
      current_membership.active is distinct from false
      or incoming.active is distinct from true
      or incoming.role is distinct from current_membership.role
      or incoming.display_name is distinct from current_membership.display_name
      or incoming.last_login_at is distinct from current_membership.last_login_at
      or incoming.auth_subject is not null
      or incoming.auth_binding_status is distinct from 'pending'
      or incoming.auth_bound_at is not null
    ) then
      raise exception 'Reactivation must reset Auth binding to pending.' using errcode = '23514';
    end if;
    update public.levytate_provider_memberships current
    set display_name = incoming.display_name,
        auth_subject = incoming.auth_subject,
        auth_binding_status = incoming.auth_binding_status,
        auth_bound_at = incoming.auth_bound_at,
        last_login_at = incoming.last_login_at,
        role = incoming.role,
        active = incoming.active,
        updated_at = incoming.updated_at
    where current.id = incoming.id
      and current.provider_id = incoming.provider_id
      and current.email = incoming.email
    returning * into saved;
  end if;

  expected_audit_action := case p_operation
    when 'provision' then 'provider_access.provisioned'
    when 'update' then 'provider_access.updated'
    when 'revoke' then 'provider_access.revoked'
    when 'reactivate' then 'provider_access.reactivated'
  end;

  if (p_audit ->> 'organisation_id')::uuid is distinct from canonical_organisation_id
     or p_audit ->> 'actor_role' is distinct from 'Platform Admin'
     or p_audit ->> 'entity_type' is distinct from 'provider_membership'
     or p_audit ->> 'entity_id' is distinct from saved.id::text
     or not exists (
       select 1
       from public.levytate_users actor
       where actor.id = (p_audit ->> 'actor_user_id')::uuid
         and actor.organisation_id = canonical_organisation_id
         and actor.active = true
         and actor.role = 'Platform Admin'
         and lower(actor.email) = lower(p_audit ->> 'actor_email')
     )
     or (p_operation = 'provision' and incoming.created_by is distinct from (p_audit ->> 'actor_user_id')::uuid)
     or p_audit ->> 'action' is distinct from expected_audit_action then
    raise exception 'Invalid provider-access audit scope.' using errcode = '42501';
  end if;

  insert into public.levytate_audit_events (
    id, organisation_id, actor_email, actor_role, entity_type,
    entity_id, action, summary, metadata, created_at
  ) values (
    (p_audit ->> 'id')::uuid,
    canonical_organisation_id,
    p_audit ->> 'actor_email',
    'Platform Admin',
    'provider_membership',
    saved.id::text,
    p_audit ->> 'action',
    p_audit ->> 'summary',
    coalesce(p_audit -> 'metadata', '{}'::jsonb),
    coalesce((p_audit ->> 'created_at')::timestamptz, timezone('utc', now()))
  );

  return to_jsonb(saved);
end;
$$;

create trigger levytate_organisation_capabilities_set_updated_at
before update on public.levytate_organisation_capabilities
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger levytate_provider_memberships_set_updated_at
before update on public.levytate_provider_memberships
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger levytate_service_requests_set_updated_at
before update on public.levytate_service_requests
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger levytate_service_request_invitations_set_updated_at
before update on public.levytate_service_request_invitations
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger levytate_service_request_responses_set_updated_at
before update on public.levytate_service_request_responses
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger levytate_service_request_decisions_set_updated_at
before update on public.levytate_service_request_decisions
for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.levytate_organisation_capabilities enable row level security;
alter table public.levytate_organisation_capabilities force row level security;
alter table public.levytate_provider_memberships enable row level security;
alter table public.levytate_provider_memberships force row level security;
alter table public.levytate_service_requests enable row level security;
alter table public.levytate_service_requests force row level security;
alter table public.levytate_service_request_versions enable row level security;
alter table public.levytate_service_request_versions force row level security;
alter table public.levytate_service_request_invitations enable row level security;
alter table public.levytate_service_request_invitations force row level security;
alter table public.levytate_provider_access_invites enable row level security;
alter table public.levytate_provider_access_invites force row level security;
alter table public.levytate_service_request_responses enable row level security;
alter table public.levytate_service_request_responses force row level security;
alter table public.levytate_service_request_response_versions enable row level security;
alter table public.levytate_service_request_response_versions force row level security;
alter table public.levytate_service_request_clarifications enable row level security;
alter table public.levytate_service_request_clarifications force row level security;
alter table public.levytate_service_request_decisions enable row level security;
alter table public.levytate_service_request_decisions force row level security;
alter table public.levytate_service_request_agreements enable row level security;
alter table public.levytate_service_request_agreements force row level security;
alter table public.levytate_service_request_handovers enable row level security;
alter table public.levytate_service_request_handovers force row level security;
alter table public.levytate_service_request_events enable row level security;
alter table public.levytate_service_request_events force row level security;

revoke all on table public.levytate_organisation_capabilities from public, anon, authenticated;
revoke all on table public.levytate_provider_memberships from public, anon, authenticated;
revoke all on table public.levytate_service_requests from public, anon, authenticated;
revoke all on table public.levytate_service_request_versions from public, anon, authenticated;
revoke all on table public.levytate_service_request_invitations from public, anon, authenticated;
revoke all on table public.levytate_provider_access_invites from public, anon, authenticated;
revoke all on table public.levytate_service_request_responses from public, anon, authenticated;
revoke all on table public.levytate_service_request_response_versions from public, anon, authenticated;
revoke all on table public.levytate_service_request_clarifications from public, anon, authenticated;
revoke all on table public.levytate_service_request_decisions from public, anon, authenticated;
revoke all on table public.levytate_service_request_agreements from public, anon, authenticated;
revoke all on table public.levytate_service_request_handovers from public, anon, authenticated;
revoke all on table public.levytate_service_request_events from public, anon, authenticated;
revoke all on function public.enforce_levytate_service_request_provider_limit() from public, anon, authenticated;
revoke all on function public.levytate_persist_service_request_action(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.levytate_mutate_provider_membership(text, jsonb, timestamptz, jsonb) from public, anon, authenticated;

grant select, insert, update on table public.levytate_organisation_capabilities to service_role;
grant select, insert, update on table public.levytate_provider_memberships to service_role;
grant select, insert, update on table public.levytate_service_requests to service_role;
grant select, insert on table public.levytate_service_request_versions to service_role;
grant select, insert, update on table public.levytate_service_request_invitations to service_role;
grant select, insert, update on table public.levytate_provider_access_invites to service_role;
grant select, insert, update on table public.levytate_service_request_responses to service_role;
grant select, insert on table public.levytate_service_request_response_versions to service_role;
grant select, insert, update on table public.levytate_service_request_clarifications to service_role;
grant select, insert, update on table public.levytate_service_request_decisions to service_role;
grant select, insert on table public.levytate_service_request_agreements to service_role;
grant select, insert on table public.levytate_service_request_handovers to service_role;
grant select, insert on table public.levytate_service_request_events to service_role;
grant execute on function public.enforce_levytate_service_request_provider_limit() to service_role;
grant execute on function public.levytate_persist_service_request_action(uuid, jsonb, jsonb) to service_role;
grant execute on function public.levytate_mutate_provider_membership(text, jsonb, timestamptz, jsonb) to service_role;

create policy levytate_organisation_capabilities_service_role_all
  on public.levytate_organisation_capabilities for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_provider_memberships_service_role_all
  on public.levytate_provider_memberships for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_service_requests_service_role_all
  on public.levytate_service_requests for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_service_request_versions_service_role_select
  on public.levytate_service_request_versions for select to service_role
  using (auth.role() = 'service_role');
create policy levytate_service_request_versions_service_role_insert
  on public.levytate_service_request_versions for insert to service_role
  with check (auth.role() = 'service_role');
create policy levytate_service_request_invitations_service_role_all
  on public.levytate_service_request_invitations for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_provider_access_invites_service_role_all
  on public.levytate_provider_access_invites for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_service_request_responses_service_role_all
  on public.levytate_service_request_responses for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_service_request_response_versions_service_role_select
  on public.levytate_service_request_response_versions for select to service_role
  using (auth.role() = 'service_role');
create policy levytate_service_request_response_versions_service_role_insert
  on public.levytate_service_request_response_versions for insert to service_role
  with check (auth.role() = 'service_role');
create policy levytate_service_request_clarifications_service_role_all
  on public.levytate_service_request_clarifications for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_service_request_decisions_service_role_all
  on public.levytate_service_request_decisions for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_service_request_agreements_service_role_select
  on public.levytate_service_request_agreements for select to service_role
  using (auth.role() = 'service_role');
create policy levytate_service_request_agreements_service_role_insert
  on public.levytate_service_request_agreements for insert to service_role
  with check (auth.role() = 'service_role');
create policy levytate_service_request_handovers_service_role_select
  on public.levytate_service_request_handovers for select to service_role
  using (auth.role() = 'service_role');
create policy levytate_service_request_handovers_service_role_insert
  on public.levytate_service_request_handovers for insert to service_role
  with check (auth.role() = 'service_role');
create policy levytate_service_request_events_service_role_select
  on public.levytate_service_request_events for select to service_role
  using (auth.role() = 'service_role');
create policy levytate_service_request_events_service_role_insert
  on public.levytate_service_request_events for insert to service_role
  with check (auth.role() = 'service_role');
