\set ON_ERROR_STOP on

begin;

do $$
declare
  v_org constant uuid := '12000000-0000-4000-8000-000000000001';
  v_employee_user constant uuid := '22000000-0000-4000-8000-000000000001';
  v_manager_user constant uuid := '22000000-0000-4000-8000-000000000002';
  v_lead_user constant uuid := '22000000-0000-4000-8000-000000000003';
  v_employee constant text := 'gc-rbac-employee-erin';
  v_manager_recipient constant uuid := '38000000-0000-4000-8000-000000000001';
  v_lead_recipient constant uuid := '38000000-0000-4000-8000-000000000002';
  v_request uuid;
  v_action uuid;
  v_lock integer;
  v_count integer;
  v_denied boolean := false;
begin
  insert into public.levytate_organisation_capabilities(organisation_id, pastoral_support_enabled)
  values (v_org, true)
  on conflict (organisation_id) do update set pastoral_support_enabled = excluded.pastoral_support_enabled;

  insert into public.levytate_pastoral_access_eligibility(
    organisation_id, employee_id, owner_user_id, age_assurance_status,
    active, approved_by, approved_at, expires_at
  ) values (
    v_org, v_employee, v_employee_user, 'adult',
    true, v_lead_user, timezone('utc', now()), timezone('utc', now()) + interval '14 days'
  );

  insert into public.levytate_pastoral_support_recipients(
    id, organisation_id, recipient_kind, employer_user_id, display_label,
    contact_method, active, created_by
  ) values
    (v_manager_recipient, v_org, 'line_manager', v_manager_user, 'Fictional line manager', 'in_platform', true, v_lead_user),
    (v_lead_recipient, v_org, 'apprenticeship_lead', v_lead_user, 'Fictional apprenticeship lead', 'in_platform', true, v_lead_user);

  select id into v_request from public.levytate_submit_pastoral_support_request(
    v_org, v_employee, v_employee_user, v_lead_recipient,
    'workload_pressure', 'in_platform', 'standard',
    '["topic","what_i_want_you_to_understand","how_it_is_affecting_me","support_i_want","preferred_contact_method","sharing_restrictions","recipient"]'::jsonb,
    'isolated-request-ciphertext', 'isolated-request-nonce', 'isolated-request-auth-tag',
    'isolated-v1', repeat('a', 64), 'isolated-request-001'
  );
  perform * from public.levytate_submit_pastoral_support_request(
    v_org, v_employee, v_employee_user, v_lead_recipient,
    'workload_pressure', 'in_platform', 'standard',
    '["topic","what_i_want_you_to_understand","how_it_is_affecting_me","support_i_want","preferred_contact_method","sharing_restrictions","recipient"]'::jsonb,
    'isolated-request-ciphertext', 'isolated-request-nonce', 'isolated-request-auth-tag',
    'isolated-v1', repeat('a', 64), 'isolated-request-001'
  );

  select lock_version into v_lock from public.levytate_pastoral_support_requests where id = v_request;
  v_denied := false;
  begin
    perform * from public.levytate_transition_pastoral_support_request(
      v_org, v_request, v_manager_user, null, 'acknowledge', v_lock,
      'isolated-wrong-recipient-001', null, null, null, null, null
    );
  exception when others then v_denied := true; end;
  if not v_denied then raise exception 'Unassigned employer recipient was not denied'; end if;

  select lock_version into v_lock from public.levytate_pastoral_support_requests where id = v_request;
  perform * from public.levytate_transition_pastoral_support_request(
    v_org, v_request, v_lead_user, null, 'acknowledge', v_lock,
    'isolated-acknowledge-001', null, null, null, null, null
  );
  select lock_version into v_lock from public.levytate_pastoral_support_requests where id = v_request;
  perform * from public.levytate_transition_pastoral_support_request(
    v_org, v_request, v_lead_user, null, 'start_support', v_lock,
    'isolated-start-support-001', null, null, null, null, null
  );
  select lock_version into v_lock from public.levytate_pastoral_support_requests where id = v_request;
  perform * from public.levytate_record_pastoral_follow_up(
    v_org, v_request, v_lead_user, null, v_lock, timezone('utc', now()) + interval '7 days',
    'isolated-follow-up-001', 'isolated-followup-note-cipher', 'isolated-followup-nonce',
    'isolated-followup-auth-tag', 'isolated-v1'
  );

  select id into v_action from public.levytate_create_pastoral_support_action(
    v_org, v_request, v_manager_recipient, v_lead_user, null,
    timezone('utc', now()) + interval '5 days', 'isolated-action-ciphertext',
    'isolated-action-nonce', 'isolated-action-auth-tag', 'isolated-v1',
    repeat('b', 64), 'isolated-action-001'
  );
  perform * from public.levytate_create_pastoral_support_action(
    v_org, v_request, v_manager_recipient, v_lead_user, null,
    timezone('utc', now()) + interval '5 days', 'isolated-action-ciphertext',
    'isolated-action-nonce', 'isolated-action-auth-tag', 'isolated-v1',
    repeat('b', 64), 'isolated-action-001'
  );
  select lock_version into v_lock from public.levytate_pastoral_support_actions where id = v_action;
  perform * from public.levytate_transition_pastoral_support_action(
    v_org, v_action, v_manager_user, null, 'start', v_lock, 'isolated-action-start-001',
    null, null, null, null, null
  );

  update public.levytate_pastoral_support_recipients set active = false where id = v_manager_recipient;
  select lock_version into v_lock from public.levytate_pastoral_support_actions where id = v_action;
  begin
    perform * from public.levytate_transition_pastoral_support_action(
      v_org, v_action, v_manager_user, null, 'progress', v_lock, 'isolated-inactive-denial-001',
      null, null, null, null, null
    );
  exception when others then
    v_denied := true;
  end;
  if not v_denied then raise exception 'Inactive action owner was not denied'; end if;

  perform * from public.levytate_transition_pastoral_support_action(
    v_org, v_action, v_lead_user, null, 'reassign', v_lock, 'isolated-action-reassign-001',
    v_lead_recipient, null, null, null, null
  );
  select lock_version into v_lock from public.levytate_pastoral_support_actions where id = v_action;
  perform * from public.levytate_transition_pastoral_support_action(
    v_org, v_action, v_lead_user, null, 'progress', v_lock, 'isolated-action-progress-001',
    null, 'isolated-progress-ciphertext', 'isolated-progress-nonce', 'isolated-progress-auth-tag', 'isolated-v1'
  );
  select lock_version into v_lock from public.levytate_pastoral_support_actions where id = v_action;
  perform * from public.levytate_transition_pastoral_support_action(
    v_org, v_action, v_lead_user, null, 'complete', v_lock, 'isolated-action-complete-001',
    null, 'isolated-evidence-ciphertext', 'isolated-evidence-nonce', 'isolated-evidence-auth-tag', 'isolated-v1'
  );

  select lock_version into v_lock from public.levytate_pastoral_support_requests where id = v_request;
  perform * from public.levytate_transition_pastoral_support_request(
    v_org, v_request, v_lead_user, null, 'resolve', v_lock,
    'isolated-resolve-001', null, 'isolated-close-ciphertext', 'isolated-close-nonce',
    'isolated-close-auth-tag', 'isolated-v1'
  );
  select lock_version into v_lock from public.levytate_pastoral_support_requests where id = v_request;
  perform * from public.levytate_record_pastoral_employee_outcome(
    v_org, v_request, v_employee_user, 'helped', v_lock, 'isolated-employee-helped-001',
    null, null, null, null
  );
  perform * from public.levytate_record_pastoral_employee_outcome(
    v_org, v_request, v_employee_user, 'helped', v_lock, 'isolated-employee-helped-001',
    null, null, null, null
  );

  select count(*) into v_count from public.levytate_pastoral_support_requests where id = v_request;
  if v_count <> 1 then raise exception 'Support-request idempotency failed'; end if;
  select count(*) into v_count from public.levytate_pastoral_support_actions where id = v_action;
  if v_count <> 1 then raise exception 'Support-action idempotency failed'; end if;
  select count(*) into v_count from public.levytate_pastoral_support_action_events where support_action_id = v_action;
  if v_count <> 5 then raise exception 'Unexpected action-event count: %', v_count; end if;
  if not exists (
    select 1 from public.levytate_pastoral_support_requests
    where id = v_request and administratively_closed_at is not null
      and employee_resolution_status = 'helped' and employee_confirmed_resolved_at is not null
  ) then raise exception 'Administrative and employee resolution states were not kept distinct'; end if;

  v_denied := false;
  begin
    perform * from public.levytate_record_pastoral_follow_up(
      '12000000-0000-4000-8000-000000000002', v_request, v_lead_user, null, 0,
      timezone('utc', now()) + interval '1 day', 'isolated-cross-tenant-001', null, null, null, null
    );
  exception when others then v_denied := true; end;
  if not v_denied then raise exception 'Cross-tenant access was not denied'; end if;
end;
$$;

do $$
declare v_browser_grants integer; v_missing_security integer;
begin
  select count(*) into v_browser_grants from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('levytate_pastoral_support_actions','levytate_pastoral_support_action_events')
    and grantee in ('PUBLIC','anon','authenticated');
  if v_browser_grants <> 0 then raise exception 'Browser roles have pastoral follow-up grants'; end if;
  select count(*) into v_missing_security from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('levytate_pastoral_support_actions','levytate_pastoral_support_action_events')
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if v_missing_security <> 0 then raise exception 'Pastoral follow-up tables are missing forced RLS'; end if;
end;
$$;

select 'PASS migration 038 isolated workflow, idempotency, inactive-owner handling, resolution separation and tenant denial';

rollback;
