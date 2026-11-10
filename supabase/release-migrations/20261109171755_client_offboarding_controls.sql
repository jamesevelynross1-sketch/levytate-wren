-- Local isolated candidate, generated filename via CLI migration new. No hosted
-- execution or real tenant disposal authorised. Apply after all reviewed local
-- tenant-integrity candidates; newly added/unguarded tenant tables fail closed.
-- Public RPCs are service-only; direct case/approval writes are not granted.
create table public.levytate_tenant_offboarding_cases(
 id uuid primary key, tenant_id uuid not null, requester_id uuid not null, approver_id uuid,
 purpose text not null check(purpose in ('export','delete')), status text not null default 'requested'
 check(status in ('requested','approved','exported','deleting','completed','cancelled')),
 policy jsonb not null, recipient_public_key text not null, export_expires_at timestamptz not null,
 request_hash text not null, revision integer not null default 1, legal_hold boolean not null default false,
 hold_actor_id uuid, hold_reference text, approval_reference text, client_delivery_reference text,
 encrypted_package jsonb, manifest jsonb, snapshot_hash text, storage_inventory jsonb,
 deletion_evidence jsonb not null default '{}'::jsonb, auth_inventory jsonb, evidence_retain_until timestamptz not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 approved_at timestamptz,exported_at timestamptz,issued_at timestamptz,completed_at timestamptz,
 check(approver_id is null or approver_id<>requester_id),
 check(encrypted_package is null or octet_length(encrypted_package::text)<=25000000)
);
create index tenant_offboarding_due_idx on public.levytate_tenant_offboarding_cases(status,export_expires_at);
create index tenant_offboarding_owner_idx on public.levytate_tenant_offboarding_cases(tenant_id,created_at);
create table public.levytate_tenant_offboarding_events(
 id bigint generated always as identity primary key,case_id uuid not null references public.levytate_tenant_offboarding_cases(id),
 actor_id uuid not null,action text not null,revision integer not null,created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);
alter table public.levytate_tenant_offboarding_cases enable row level security;
alter table public.levytate_tenant_offboarding_events enable row level security;
revoke all on public.levytate_tenant_offboarding_cases,public.levytate_tenant_offboarding_events from public,anon,authenticated,service_role;
revoke all on sequence public.levytate_tenant_offboarding_events_id_seq from public,anon,authenticated,service_role;
create unique index tenant_offboarding_one_case_idx on public.levytate_tenant_offboarding_cases(tenant_id) where status not in ('completed','cancelled');
create table public.levytate_tenant_offboarding_commands(
 request_id uuid primary key,case_id uuid not null references public.levytate_tenant_offboarding_cases(id),
 actor_id uuid not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table public.levytate_tenant_offboarding_commands enable row level security;
revoke all on public.levytate_tenant_offboarding_commands from public,anon,authenticated,service_role;
-- Revocation deliberately clears the live binding. Keep its restricted subject
-- tombstone so later account disposal cannot lose that association after email
-- changes. No credential, session or recovery material is recorded.
create table public.levytate_retired_auth_bindings(
 organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
 user_id uuid not null,auth_subject uuid not null,retired_at timestamptz not null default now(),
 primary key(organisation_id,user_id,auth_subject)
);
alter table public.levytate_retired_auth_bindings enable row level security;
revoke all on public.levytate_retired_auth_bindings from public,anon,authenticated,service_role;
insert into public.levytate_retired_auth_bindings(organisation_id,user_id,auth_subject)
 select organisation_id,id,auth_subject from public.levytate_users where auth_subject is not null;
create function public.levytate_record_retired_auth_binding() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='UPDATE' and old.auth_subject is not null and (new.auth_subject is distinct from old.auth_subject or new.email is distinct from old.email) then
  insert into public.levytate_retired_auth_bindings(organisation_id,user_id,auth_subject)
   values(old.organisation_id,old.id,old.auth_subject) on conflict do nothing;
 end if;
 return new;
end; $$;

create function public.levytate_offboarding_command(p_actor uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.levytate_tenant_offboarding_cases%rowtype; receipt public.levytate_tenant_offboarding_commands%rowtype;
 v_case_id uuid; v_request_id uuid; action text; policy jsonb; cls text; t uuid; result jsonb; stamp timestamptz:=clock_timestamp(); snapshot jsonb;
begin
 perform public.levytate_offboarding_actor(p_actor);
 if jsonb_typeof(p_command) is distinct from 'object' then raise exception using errcode='PT422',message='Lifecycle command required';end if;
 v_case_id:=(p_command->>'caseId')::uuid;v_request_id:=(p_command->>'requestId')::uuid;action:=p_command->>'action';
 if v_case_id is null or v_request_id is null or action is null then raise exception using errcode='PT422',message='Case, request and action required';end if;
 perform pg_advisory_xact_lock(hashtextextended('offboard-request:'||v_request_id::text,0));
 select * into receipt from public.levytate_tenant_offboarding_commands where levytate_tenant_offboarding_commands.request_id=v_request_id;
 if found then
  if receipt.actor_id=p_actor and receipt.case_id=v_case_id and receipt.payload=coalesce(p_command->'clientCommand',p_command) then return receipt.result;end if;
  raise exception using errcode='PT409',message='Request key is already used';end if;
 select * into c from public.levytate_tenant_offboarding_cases where levytate_tenant_offboarding_cases.id=v_case_id;
 t:=coalesce(c.tenant_id,(p_command->>'organisationId')::uuid);
 if t is null then raise exception using errcode='PT404',message='Lifecycle case not found';end if;
 perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||t::text,0));
 select * into c from public.levytate_tenant_offboarding_cases where levytate_tenant_offboarding_cases.id=v_case_id for update;
 stamp:=clock_timestamp(); -- Re-evaluate expiry after every authority/row lock wait.
 if action='request' then
  if found then raise exception using errcode='PT409',message='Case key already used';end if;
  policy:=p_command->'policy';
  if p_command->>'purpose' not in('export','delete') or jsonb_typeof(policy) is distinct from 'object'
   or policy->>'version' is distinct from 'levytate-offboarding-v1' or jsonb_typeof(policy->'schedules') is distinct from 'array'
   or jsonb_array_length(policy->'schedules')<>11 then raise exception using errcode='PT422',message='Explicit approved policy required';end if;
  foreach cls in array array['identity','people','applications','learners','finance','catalogue','files','assessments','lift','support','audit'] loop
   if (select count(*) from jsonb_array_elements(policy->'schedules') s where s->>'dataClass'=cls and s->>'action' in('delete','retain')
    and length(btrim(s->>'approvalReference')) between 5 and 500 and (s->>'retainUntil')::timestamptz is not null)<>1 then
    raise exception using errcode='PT422',message='Every data class needs one reviewed schedule';end if;
  end loop;
  foreach cls in array array['approvalReference','clientNoticeReference','supportHandoverReference','recoveryBoundaryReference'] loop
   if coalesce(length(btrim(policy->>cls)),0) not between 5 and 500 then raise exception using errcode='PT422',message='Explicit notice, support and recovery evidence required';end if;
  end loop;
  if (policy->>'evidenceRetainUntil')::timestamptz is null or (policy->>'evidenceRetainUntil')::timestamptz<=stamp
   or (p_command->>'exportExpiresAt')::timestamptz is null or (p_command->>'exportExpiresAt')::timestamptz not between stamp and stamp+interval '7 days'
   or coalesce(length(p_command->>'recipientPublicKey'),0) not between 100 and 16000 then raise exception using errcode='PT422',message='Bounded export and evidence schedule required';end if;
  perform public.levytate_offboarding_actor((policy->>'dataOwnerUserId')::uuid);
  perform public.levytate_offboarding_actor((policy->>'serviceOwnerUserId')::uuid);
  perform 1 from public.levytate_organisations o where o.id=t and o.status='Suspended' and o.workspace_template='levytate-client-v1'
   and not exists(select 1 from public.levytate_users u where u.organisation_id=o.id and u.role='Platform Admin') for share;
  if not found then raise exception using errcode='PT409',message='Suspend a client-only workspace before offboarding';end if;
  perform public.levytate_offboarding_assert_inventory();
  insert into public.levytate_tenant_offboarding_cases(id,tenant_id,requester_id,purpose,policy,recipient_public_key,export_expires_at,request_hash,evidence_retain_until)
   values(v_case_id,t,p_actor,p_command->>'purpose',policy,p_command->>'recipientPublicKey',(p_command->>'exportExpiresAt')::timestamptz,
    encode(sha256(convert_to(p_command::text,'UTF8')),'hex'),(policy->>'evidenceRetainUntil')::timestamptz) returning * into c;
 else
  if c.id is null then raise exception using errcode='PT404',message='Lifecycle case not found';end if;
  if (p_command->>'expectedRevision')::integer is distinct from c.revision then raise exception using errcode='PT409',message='Lifecycle case changed; refresh';end if;
  if action='approve' then
   if c.status<>'requested' or p_actor=c.requester_id or coalesce(length(btrim(p_command->>'approvalReference')),0) not between 5 and 500 then
    raise exception using errcode='PT403',message='Independent approval and evidence required';end if;
   perform public.levytate_offboarding_assert_inventory();
   update public.levytate_tenant_offboarding_cases set status='approved',approver_id=p_actor,approval_reference=p_command->>'approvalReference',approved_at=stamp where levytate_tenant_offboarding_cases.id=c.id;
  elsif action='hold' then
   if jsonb_typeof(p_command->'active') is distinct from 'boolean' or coalesce(length(btrim(p_command->>'reference')),0) not between 5 and 500
    or c.status in('completed','cancelled') then raise exception using errcode='PT409',message='Hold requires evidence on an unfinished case';end if;
   if not(p_command->>'active')::boolean and (not c.legal_hold or c.hold_actor_id=p_actor) then raise exception using errcode='PT403',message='Another authorised person must release a hold';end if;
   update public.levytate_tenant_offboarding_cases set legal_hold=(p_command->>'active')::boolean,hold_actor_id=case when (p_command->>'active')::boolean then p_actor else hold_actor_id end,hold_reference=p_command->>'reference' where levytate_tenant_offboarding_cases.id=c.id;
  elsif action='cancel' then
   if c.status in('deleting','completed') or c.legal_hold then raise exception using errcode='PT409',message='Irreversible work or a hold prevents cancellation';end if;
   update public.levytate_tenant_offboarding_cases set status='cancelled',encrypted_package=null where levytate_tenant_offboarding_cases.id=c.id;
  elsif action='record_export' then
   if c.status<>'approved' or c.export_expires_at<=stamp or p_actor not in(c.requester_id,c.approver_id)
    or jsonb_typeof(p_command->'envelope') is distinct from 'object' or jsonb_typeof(p_command->'manifest') is distinct from 'object'
    or p_command->'manifest'->>'organisationId' is distinct from c.tenant_id::text
    or p_command->'envelope'->>'version' is distinct from 'levytate-encrypted-export-v1'
    or (p_command->'envelope'->>'expiresAt')::timestamptz is distinct from c.export_expires_at then raise exception using errcode='PT409',message='Approved export could not be reconciled';end if;
   snapshot:=public.levytate_offboarding_data(c.tenant_id);
   if p_command->>'snapshotHash' is distinct from encode(sha256(convert_to(snapshot::text,'UTF8')),'hex')
    or p_command->'storageInventory' is distinct from public.levytate_offboarding_storage_inventory(c.tenant_id) then
    raise exception using errcode='PT409',message='Snapshot changed during export';end if;
   update public.levytate_tenant_offboarding_cases set status='exported',encrypted_package=p_command->'envelope',manifest=p_command->'manifest',
    snapshot_hash=p_command->>'snapshotHash',storage_inventory=p_command->'storageInventory',exported_at=stamp where levytate_tenant_offboarding_cases.id=c.id;
  elsif action='record_delivery' then
   if c.status<>'exported' or c.export_expires_at<=stamp or c.issued_at is null or coalesce(length(btrim(p_command->>'reference')),0) not between 5 and 500 then
    raise exception using errcode='PT409',message='Unexpired issued export and explicit delivery evidence required';end if;
   update public.levytate_tenant_offboarding_cases set client_delivery_reference=p_command->>'reference' where levytate_tenant_offboarding_cases.id=c.id;
  elsif action='begin_delete' then
   if c.status<>'exported' or p_actor not in(c.requester_id,c.approver_id) then raise exception using errcode='PT403',message='Approved exported case required';end if;
   perform public.levytate_offboarding_due(c.id);
   perform public.levytate_offboarding_foreign_links(c.tenant_id);
   snapshot:=public.levytate_offboarding_data(c.tenant_id);
   if c.snapshot_hash is distinct from encode(sha256(convert_to(snapshot::text,'UTF8')),'hex')
    or c.storage_inventory is distinct from public.levytate_offboarding_storage_inventory(c.tenant_id) then
    raise exception using errcode='PT409',message='Export no longer matches data for disposal';end if;
   -- Same per-identity locks as membership/provider binding triggers. A new
   -- external binding either commits before this read or is denied afterwards.
   perform public.levytate_offboarding_lock_identities(c.tenant_id);
   update public.levytate_tenant_offboarding_cases set status='deleting',auth_inventory=public.levytate_offboarding_auth_inventory(c.tenant_id) where levytate_tenant_offboarding_cases.id=c.id;
  elsif action='erase_expired_export' then
   if c.export_expires_at>stamp or c.encrypted_package is null then raise exception using errcode='PT409',message='No expired package is awaiting erasure';end if;
   update public.levytate_tenant_offboarding_cases set encrypted_package=null where levytate_tenant_offboarding_cases.id=c.id;
  else raise exception using errcode='PT422',message='Supported lifecycle command required';end if;
  update public.levytate_tenant_offboarding_cases set revision=revision+1,updated_at=stamp where levytate_tenant_offboarding_cases.id=c.id returning * into c;
 end if;
 result:=jsonb_build_object('id',c.id,'status',c.status,'revision',c.revision);
 insert into public.levytate_tenant_offboarding_events(case_id,actor_id,action,revision) values(c.id,p_actor,action,c.revision);
 insert into public.levytate_tenant_offboarding_commands(request_id,case_id,actor_id,payload,result) values(v_request_id,c.id,p_actor,coalesce(p_command->'clientCommand',p_command),result);
 if action in('request','record_export','record_delivery') and c.export_expires_at<=clock_timestamp() then
  raise exception using errcode='PT409',message='Export expired before the command completed';end if;
 if action='begin_delete' then perform public.levytate_offboarding_due(c.id);end if;
 return result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
 raise exception using errcode='PT422',message='Invalid lifecycle identifiers or schedule';
end; $$;

create function public.levytate_offboarding_snapshot(p_actor uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.levytate_tenant_offboarding_cases%rowtype;data jsonb;result jsonb;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case;
 if not found or c.status<>'approved' or c.export_expires_at<=clock_timestamp() or p_actor not in(c.requester_id,c.approver_id) then raise exception using errcode='PT403',message='Approved export required';end if;
 perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||c.tenant_id::text,0));
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case for share;
 if c.status<>'approved' or c.export_expires_at<=clock_timestamp() then raise exception using errcode='PT409',message='Export case changed';end if;
 perform 1 from public.levytate_organisations where id=c.tenant_id and status='Suspended' for share;
 if not found then raise exception using errcode='PT409',message='Export requires a suspended tenant';end if;
 data:=public.levytate_offboarding_data(c.tenant_id);
 result:=data||jsonb_build_object('organisationId',c.tenant_id,'snapshotId',c.id,'generatedAt',c.approved_at,
  'storageObjects',public.levytate_offboarding_storage_inventory(c.tenant_id),'recipientPublicKey',c.recipient_public_key,
  'snapshotHash',encode(sha256(convert_to(data::text,'UTF8')),'hex'),'expiresAt',c.export_expires_at,'revision',c.revision);
 if c.export_expires_at<=clock_timestamp() then raise exception using errcode='PT409',message='Export expired during snapshot';end if;
 return result;
end; $$;

create function public.levytate_offboarding_download(p_actor uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.levytate_tenant_offboarding_cases%rowtype;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case for update;
 if not found or c.status<>'exported' or c.encrypted_package is null or c.export_expires_at<=clock_timestamp()
  or p_actor not in(c.requester_id,c.approver_id) then raise exception using errcode='PT403',message='Export delivery is unavailable';end if;
 update public.levytate_tenant_offboarding_cases set issued_at=clock_timestamp() where id=p_case;
 insert into public.levytate_tenant_offboarding_events(case_id,actor_id,action,revision) values(p_case,p_actor,'encrypted_package_issued',c.revision);
 if c.export_expires_at<=clock_timestamp() then raise exception using errcode='PT409',message='Export expired before delivery completed';end if;
 return c.encrypted_package;
end; $$;

-- Sensitive internal disposal plan is never returned by a browser route.
create function public.levytate_offboarding_disposal_plan(p_actor uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.levytate_tenant_offboarding_cases%rowtype;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case for share;
 if not found or c.status<>'deleting' or p_actor not in(c.requester_id,c.approver_id) then raise exception using errcode='PT403',message='Approved disposal required';end if;
 perform public.levytate_offboarding_due(c.id);
 return jsonb_build_object('caseId',c.id,'organisationId',c.tenant_id,'revision',c.revision,
  'storageOutstanding',(select count(*) from storage.objects o where split_part(o.name,'/',1)=c.tenant_id::text
   or exists(select 1 from jsonb_array_elements(c.storage_inventory) s where o.bucket_id=s->>'bucket' and o.name=s->>'path')),
  'storage',c.storage_inventory,'identities',c.auth_inventory,'manifest',c.manifest);
end; $$;
revoke all on function public.levytate_record_retired_auth_binding() from public,anon,authenticated,service_role;
create trigger levytate_retire_auth_binding before update on public.levytate_users for each row execute function public.levytate_record_retired_auth_binding();
create function public.levytate_tenant_data_inventory() returns table(table_name text,data_class text)
language sql immutable set search_path=pg_catalog as $$ values
('levytate_users','identity'),
('levytate_organisation_capabilities','identity'),
('levytate_prospect_access','identity'),
('levytate_external_identities','identity'),
('levytate_external_tenant_connections','identity'),
('levytate_provider_access_invites','identity'),
('levytate_retired_auth_bindings','identity'),
('levytate_client_admin_commands','identity'),
('levytate_employees','people'),
('levytate_employee_development_profiles','people'),
('levytate_people_import_receipts','people'),
('levytate_applications','applications'),
('levytate_application_history','applications'),
('levytate_application_command_receipts','applications'),
('levytate_application_workflows','applications'),
('levytate_application_workflow_versions','applications'),
('levytate_application_workflow_instances','applications'),
('levytate_application_workflow_events','applications'),
('levytate_enrolments','learners'),
('levytate_learner_records','learners'),
('levytate_learner_eligibility_declarations','learners'),
('levytate_learner_pre_enrolment_checks','learners'),
('levytate_learner_breaks_in_learning','learners'),
('levytate_learner_withdrawals','learners'),
('levytate_learner_reviews','learners'),
('levytate_learner_progress_updates','learners'),
('levytate_learner_assessment_readiness','learners'),
('levytate_learner_achievements','learners'),
('levytate_learner_operational_actions','learners'),
('levytate_learner_lifecycle_events','learners'),
('levytate_learner_command_receipts','learners'),
('levytate_operational_actions','learners'),
('levytate_operational_action_events','learners'),
('levytate_operational_action_receipts','learners'),
('levytate_intelligence_signals','learners'),
('levytate_intelligence_signal_events','learners'),
('levytate_otj_plans','learners'),
('levytate_otj_plan_versions','learners'),
('levytate_otj_learning_priorities','learners'),
('levytate_otj_activities','learners'),
('levytate_otj_activity_confirmations','learners'),
('levytate_otj_activity_events','learners'),
('levytate_otj_command_receipts','learners'),
('levytate_finance_balances','finance'),
('levytate_finance_imports','finance'),
('levytate_finance_transactions','finance'),
('levytate_finance_command_receipts','finance'),
('levytate_finance_versions','finance'),
('levytate_roles','catalogue'),
('levytate_role_pathway_mappings','catalogue'),
('levytate_providers','catalogue'),
('levytate_provider_programmes','catalogue'),
('levytate_provider_relationships','catalogue'),
('levytate_matching_requests','catalogue'),
('levytate_organisation_providers','catalogue'),
('levytate_organisation_programmes','catalogue'),
('levytate_service_requests','catalogue'),
('levytate_service_request_versions','catalogue'),
('levytate_service_request_invitations','catalogue'),
('levytate_service_request_responses','catalogue'),
('levytate_service_request_response_versions','catalogue'),
('levytate_service_request_clarifications','catalogue'),
('levytate_service_request_decisions','catalogue'),
('levytate_service_request_agreements','catalogue'),
('levytate_service_request_handovers','catalogue'),
('levytate_service_request_events','catalogue'),
('levytate_request_command_receipts','catalogue'),
('levytate_workspace_entity_versions','catalogue'),
('levytate_workspace_command_receipts','catalogue'),
('levytate_file_assets','files'),
('levytate_assessment_campaigns','assessments'),
('levytate_assessment_participants','assessments'),
('levytate_workforce_assessments','assessments'),
('levytate_assessment_revisions','assessments'),
('levytate_assessment_results','assessments'),
('levytate_assessment_shares','assessments'),
('levytate_assessment_reviews','assessments'),
('levytate_assessment_actions','assessments'),
('levytate_assessment_application_links','assessments'),
('levytate_assessment_events','assessments'),
('levytate_lift_campaigns','lift'),
('levytate_lift_participants','lift'),
('levytate_lift_assessments','lift'),
('levytate_lift_assessment_revisions','lift'),
('levytate_lift_evidence_records','lift'),
('levytate_lift_interpretations','lift'),
('levytate_lift_manager_observations','lift'),
('levytate_lift_manager_observation_revisions','lift'),
('levytate_lift_employee_observation_contexts','lift'),
('levytate_lift_team_context_revisions','lift'),
('levytate_lift_opportunities','lift'),
('levytate_lift_opportunity_candidates','lift'),
('levytate_lift_opportunity_evidence','lift'),
('levytate_lift_opportunity_route_members','lift'),
('levytate_lift_decisions','lift'),
('levytate_lift_decision_assumptions','lift'),
('levytate_lift_proof_records','lift'),
('levytate_lift_proof_events','lift'),
('levytate_lift_workspace_revisions','lift'),
('levytate_lift_command_receipts','lift'),
('levytate_pastoral_access_eligibility','support'),
('levytate_pastoral_preferences','support'),
('levytate_pastoral_conversations','support'),
('levytate_pastoral_messages','support'),
('levytate_pastoral_audit_events','support'),
('levytate_pastoral_support_recipients','support'),
('levytate_pastoral_support_requests','support'),
('levytate_pastoral_support_request_events','support'),
('levytate_pastoral_history_receipts','support'),
('levytate_audit_events','audit'),
('levytate_early_access_terms_acceptances','audit'),
('levytate_external_connector_events','audit')
$$;
revoke all on function public.levytate_tenant_data_inventory() from public,anon,authenticated,service_role;

create function public.levytate_offboarding_actor(p_actor uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Service role required'; end if;
 perform 1 from public.levytate_users u join public.levytate_organisations o on o.id=u.organisation_id
 where u.id=p_actor and u.active and u.role='Platform Admin' and u.auth_binding_status='bound' and u.auth_subject is not null and o.status='Active' for share of u,o;
 if not found then raise exception using errcode='PT403',message='Active platform administrator required'; end if;
end; $$;
revoke all on function public.levytate_offboarding_actor(uuid) from public,anon,authenticated,service_role;

-- All internal helpers are revoked even from service_role. The only entry
-- points validate a current platform actor and the bound two-person case.
create function public.levytate_offboarding_internal_delete(p_tenant uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.levytate_tenant_offboarding_cases c
  where c.tenant_id=p_tenant and c.status='deleting' and not c.legal_hold
  and c.id::text=current_setting('levytate.offboarding_case',true)
  and current_setting('levytate.offboarding_transaction',true)=txid_current()::text)
$$;
create function public.levytate_offboarding_freeze() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare t uuid; t_old uuid;
begin
 t:=case when tg_table_name='levytate_organisations' then
  coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(old)->>'id')::uuid)
 else coalesce((to_jsonb(new)->>'organisation_id')::uuid,(to_jsonb(old)->>'organisation_id')::uuid) end;
 t_old:=case when tg_op='INSERT' then t when tg_table_name='levytate_organisations' then (to_jsonb(old)->>'id')::uuid else (to_jsonb(old)->>'organisation_id')::uuid end;
 -- Cascading FK actions must never escape the exact tenant of a disposal,
 -- even when a concurrent external reference appeared after the preflight.
 if current_setting('levytate.offboarding_transaction',true)=txid_current()::text
  and exists(select 1 from public.levytate_tenant_offboarding_cases c where c.id::text=current_setting('levytate.offboarding_case',true)
   and c.status='deleting' and (c.tenant_id is distinct from t or c.tenant_id is distinct from t_old)) then
  raise exception using errcode='PT409',message='Disposal cannot mutate another tenant';end if;
 perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||t::text,0));
 if t_old is distinct from t then perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||t_old::text,0));end if;
 if exists(select 1 from public.levytate_tenant_offboarding_cases where tenant_id in(t,t_old) and status in('approved','exported','deleting')) then
  if tg_op='DELETE' and public.levytate_offboarding_internal_delete(t) then return old;end if;
  raise exception using errcode='PT409',message='Tenant data is frozen by an approved offboarding case';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end; $$;

-- Freeze membership reuse of a subject while provider/Auth deletion is in flight.
-- This covers inactive provider memberships as well as active ones.
create function public.levytate_offboarding_identity_freeze() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare lock_key text; keys text[];
begin
 keys:=array['email:'||encode(sha256(convert_to(lower(btrim(new.email)),'UTF8')),'hex'),'subject:'||new.auth_subject::text];
 if tg_op='UPDATE' then keys:=keys||array['email:'||encode(sha256(convert_to(lower(btrim(old.email)),'UTF8')),'hex'),'subject:'||old.auth_subject::text];end if;
 for lock_key in select distinct k from unnest(keys) k where k is not null order by k loop
  perform pg_advisory_xact_lock(hashtextextended('offboard-identity:'||lock_key,0));
 end loop;
 if exists(select 1 from public.levytate_tenant_offboarding_cases c
  cross join lateral jsonb_array_elements(coalesce(c.auth_inventory,'[]')) a
  where c.status='deleting' and (a->>'delete')::boolean
   and ((new.auth_subject is not null and a->>'id'=new.auth_subject::text)
     or a->>'emailHash'=encode(sha256(convert_to(lower(btrim(new.email)),'UTF8')),'hex'))) then
  raise exception using errcode='PT409',message='Identity is reserved for an approved disposal';
 end if;
 return new;
end; $$;
create function public.levytate_offboarding_lock_identities(p_tenant uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare lock_key text;
begin
 for lock_key in select distinct k from jsonb_array_elements(public.levytate_offboarding_auth_inventory(p_tenant)) a
  cross join lateral unnest(array['email:'||(a->>'emailHash'),'subject:'||(a->>'id')]) k order by k loop
  perform pg_advisory_xact_lock(hashtextextended('offboard-identity:'||lock_key,0));
 end loop;
end; $$;
create trigger levytate_offboarding_identity_freeze before insert or update on public.levytate_users
 for each row execute function public.levytate_offboarding_identity_freeze();
create trigger levytate_offboarding_provider_identity_freeze before insert or update on public.levytate_provider_memberships
 for each row execute function public.levytate_offboarding_identity_freeze();

do $install$
declare r record;
begin
 for r in select i.table_name from public.levytate_tenant_data_inventory() i where to_regclass('public.'||i.table_name) is not null
  union all select 'levytate_organisations' loop
  execute format('create trigger levytate_offboarding_freeze before insert or update or delete on public.%I for each row execute function public.levytate_offboarding_freeze()',r.table_name);
 end loop;
end; $install$;

create function public.levytate_offboarding_assert_inventory() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if to_regprocedure('public.levytate_offboarding_assert_storage_boundary()') is null then
  raise exception using errcode='PT409',message='Storage lifecycle boundary has not been independently installed';end if;
 perform public.levytate_offboarding_assert_storage_boundary();
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  join pg_attribute a on a.attrelid=c.oid and a.attname='organisation_id' and not a.attisdropped
  where n.nspname='public' and c.relkind in('r','p') and
   (not exists(select 1 from public.levytate_tenant_data_inventory() i where i.table_name=c.relname)
    or not exists(select 1 from pg_trigger g where g.tgrelid=c.oid and g.tgname='levytate_offboarding_freeze' and g.tgenabled='O'))) then
  raise exception using errcode='PT409',message='Tenant inventory or freeze guards changed; independent review required';
 end if;
 if exists(select 1 from pg_constraint con
  join pg_class cc on cc.oid=con.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
  join pg_class pc on pc.oid=con.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
  where con.contype='f' and pn.nspname='public'
   and (pc.relname='levytate_organisations' or exists(select 1 from public.levytate_tenant_data_inventory() i where i.table_name=pc.relname))
   and (cn.nspname<>'public' or not exists(select 1 from pg_trigger g where g.tgrelid=cc.oid
    and g.tgname='levytate_offboarding_foreign_boundary' and g.tgenabled='O'))) then
  raise exception using errcode='PT409',message='External ownership guards changed; independent review required';
 end if;
end; $$;

create function public.levytate_offboarding_auth_inventory(p_tenant uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 with candidates as (
  select a.id,a.email from auth.users a where
   exists(select 1 from public.levytate_users u where u.organisation_id=p_tenant and (u.auth_subject=a.id or lower(u.email)=lower(a.email)))
   or exists(select 1 from public.levytate_retired_auth_bindings r where r.organisation_id=p_tenant and r.auth_subject=a.id)
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'emailHash',encode(sha256(convert_to(lower(coalesce(a.email,'')),'UTF8')),'hex'),
  'delete',not(
   exists(select 1 from public.levytate_users u where u.organisation_id<>p_tenant and (u.auth_subject=a.id or lower(u.email)=lower(a.email)))
   or exists(select 1 from public.levytate_retired_auth_bindings r where r.organisation_id<>p_tenant and r.auth_subject=a.id)
   or exists(select 1 from public.levytate_provider_memberships p where p.auth_subject=a.id or lower(p.email)=lower(a.email))
  )) order by a.id),'[]') from candidates a
$$;

create function public.levytate_offboarding_storage_inventory(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare objects jsonb;
begin
 if exists(select 1 from public.levytate_file_assets where organisation_id=p_tenant
  and bucket_name not in('levytate-organisations','levytate-provider-documents','levytate-uploads','levytate-guidance-sources')) then
  raise exception using errcode='PT409',message='Storage bucket is outside the reviewed lifecycle boundary';end if;
 if exists(select 1 from public.levytate_file_assets a join public.levytate_file_assets b using(bucket_name,object_path)
  where a.organisation_id=p_tenant and b.organisation_id<>p_tenant) then
  raise exception using errcode='PT409',message='Storage ownership is ambiguous';end if;
 if exists(select 1 from public.levytate_file_assets a left join storage.objects o on o.bucket_id=a.bucket_name and o.name=a.object_path
  left join storage.buckets b on b.id=a.bucket_name
  where a.organisation_id=p_tenant and (o.id is null or b.public is distinct from false
   or a.object_path ~ '(^|/)\.\.(/|$)' or a.object_path ~ '^(https?://|/)'
   or coalesce(o.metadata->>'size','')!~'^[0-9]+$' or (o.metadata->>'size')::bigint<>a.file_size_bytes
   or coalesce(to_jsonb(o)->>'version','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) then
  raise exception using errcode='PT409',message='Registered private Storage bytes could not be reconciled';end if;
 -- A namespaced or exclusively owned orphan is not silently left behind.
 if exists(select 1 from storage.objects o where
  (split_part(o.name,'/',1)=p_tenant::text or exists(
   select 1 from jsonb_array_elements(public.levytate_offboarding_auth_inventory(p_tenant)) a
   where (a->>'delete')::boolean and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner')=a->>'id'))
  and not exists(select 1 from public.levytate_file_assets f where f.organisation_id=p_tenant and f.bucket_name=o.bucket_id and f.object_path=o.name)) then
  raise exception using errcode='PT409',message='Unregistered tenant Storage objects require inventory review';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'bucket',a.bucket_name,'path',a.object_path,
  'size',(o.metadata->>'size')::bigint,'contentType',coalesce(o.metadata->>'mimetype',a.mime_type),
  'version',to_jsonb(o)->>'version','updatedAt',o.updated_at) order by a.bucket_name,a.object_path),'[]') into objects
 from (select distinct organisation_id,bucket_name,object_path,mime_type from public.levytate_file_assets where organisation_id=p_tenant) a
 join storage.objects o on o.bucket_id=a.bucket_name and o.name=a.object_path;
 return objects;
end; $$;

create function public.levytate_offboarding_data(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare q text:='';r record;result jsonb;
begin
 perform public.levytate_offboarding_assert_inventory();
 for r in select i.table_name from public.levytate_tenant_data_inventory() i where to_regclass('public.'||i.table_name) is not null order by i.table_name loop
  if q<>'' then q:=q||' union all ';end if;
  q:=q||format('select %L k,(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t where organisation_id=$1) v',r.table_name,r.table_name);
 end loop;
 execute 'select jsonb_build_object(''organisation'',(select to_jsonb(o) from public.levytate_organisations o where id=$1),''tables'',(select jsonb_object_agg(k,v) from ('||q||') scoped))' into result using p_tenant;
 return result;
end; $$;

create function public.levytate_offboarding_due(p_case uuid) returns void
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare c public.levytate_tenant_offboarding_cases%rowtype;
begin
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case;
 if not found then raise exception using errcode='PT409',message='Disposal case is unavailable';end if;
 perform public.levytate_offboarding_actor(c.requester_id);
 perform public.levytate_offboarding_actor(c.approver_id);
 if not found or c.purpose<>'delete' or c.legal_hold or c.approver_id is null or c.approver_id=c.requester_id
  or c.client_delivery_reference is null or c.evidence_retain_until<=clock_timestamp()
  or exists(select 1 from jsonb_array_elements(c.policy->'schedules') s where s->>'action'<>'delete' or (s->>'retainUntil')::timestamptz>clock_timestamp()) then
  raise exception using errcode='PT409',message='Hold, schedule, delivery or independent approval blocks disposal';end if;
end; $$;

-- Inspection only. Expiry blocks delivery even if scheduled erasure is delayed.
create function public.levytate_offboarding_status(p_actor uuid,p_case uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.levytate_offboarding_actor(p_actor);
 return coalesce((select jsonb_agg(to_jsonb(c)-array['recipient_public_key','encrypted_package','storage_inventory','auth_inventory','deletion_evidence','request_hash'] order by created_at desc)
 from public.levytate_tenant_offboarding_cases c where p_case is null or c.id=p_case),'[]');
end; $$;


-- Prevent CASCADE/SET NULL from changing any out-of-tenant record. Unknown
-- non-tenant ownership links stop disposal; they are not silently rewritten.
create function public.levytate_offboarding_foreign_links(p_tenant uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f record;join_sql text;parent_pred text;child_pred text;present boolean;
begin
 for f in select con.oid,con.conkey,con.confkey,con.conrelid,con.confrelid,cn.nspname child_schema,cc.relname child_table,pc.relname parent_table
  from pg_constraint con join pg_class cc on cc.oid=con.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
  join pg_class pc on pc.oid=con.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
  where con.contype='f' and pn.nspname='public' and (pc.relname='levytate_organisations'
   or exists(select 1 from public.levytate_tenant_data_inventory() i where i.table_name=pc.relname)) loop
  select string_agg(format('ch.%I=pa.%I',ca.attname,pa.attname),' and ' order by k.ord) into join_sql
   from unnest(f.conkey,f.confkey) with ordinality k(child_key,parent_key,ord)
   join pg_attribute ca on ca.attrelid=f.conrelid and ca.attnum=k.child_key
   join pg_attribute pa on pa.attrelid=f.confrelid and pa.attnum=k.parent_key;
  parent_pred:=case when f.parent_table='levytate_organisations' then 'pa.id=$1' else 'pa.organisation_id=$1' end;
  child_pred:=case when exists(select 1 from pg_attribute where attrelid=f.conrelid and attname='organisation_id' and not attisdropped)
   then 'ch.organisation_id is distinct from $1' else 'true' end;
  execute format('select exists(select 1 from %I.%I ch join public.%I pa on %s where %s and %s)',f.child_schema,f.child_table,f.parent_table,join_sql,parent_pred,child_pred)
   into present using p_tenant;
  if present then raise exception using errcode='PT409',message='Out-of-tenant reference prevents isolated disposal';end if;
 end loop;
end; $$;

-- Serialise new out-of-tenant FK references against approval/disposal. This also
-- covers global tables (for example provider memberships) that lack a tenant
-- column but reference an employer user. Managed schemas are not altered.
create function public.levytate_offboarding_foreign_boundary() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f record;join_sql text;parent_expr text;target uuid;own_tenant uuid;row_value jsonb;
begin
 row_value:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 own_tenant:=(row_value->>'organisation_id')::uuid;
 if current_setting('levytate.offboarding_transaction',true)=txid_current()::text and
  exists(select 1 from public.levytate_tenant_offboarding_cases c where c.id::text=current_setting('levytate.offboarding_case',true)
   and c.status='deleting' and c.tenant_id is distinct from own_tenant) then
  raise exception using errcode='PT409',message='Disposal cannot alter external ownership';end if;
 if tg_op='DELETE' then return old;end if;
 for f in select con.conkey,con.confkey,con.conrelid,con.confrelid,pc.relname parent_table
  from pg_constraint con join pg_class pc on pc.oid=con.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
  where con.contype='f' and con.conrelid=tg_relid and pn.nspname='public'
   and (pc.relname='levytate_organisations' or exists(select 1 from public.levytate_tenant_data_inventory() i where i.table_name=pc.relname)) loop
  select string_agg(format('ch.%I=pa.%I',ca.attname,pa.attname),' and ' order by k.ord) into join_sql
   from unnest(f.conkey,f.confkey) with ordinality k(child_key,parent_key,ord)
   join pg_attribute ca on ca.attrelid=f.conrelid and ca.attnum=k.child_key
   join pg_attribute pa on pa.attrelid=f.confrelid and pa.attnum=k.parent_key;
  parent_expr:=case when f.parent_table='levytate_organisations' then 'pa.id' else 'pa.organisation_id' end;
  for target in execute format('select distinct %s from jsonb_populate_record(null::%I.%I,$1) ch join public.%I pa on %s',parent_expr,tg_table_schema,tg_table_name,f.parent_table,join_sql) using row_value loop
   if target is distinct from own_tenant then
    perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||target::text,0));
    if exists(select 1 from public.levytate_tenant_offboarding_cases where tenant_id=target and status in('approved','exported','deleting')) then
     raise exception using errcode='PT409',message='Approved offboarding blocks new external references';end if;
   end if;
  end loop;
 end loop;
 return new;
end; $$;
do $foreign_guards$
declare r record;
begin
 for r in select distinct cc.relname from pg_constraint con
  join pg_class cc on cc.oid=con.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
  join pg_class pc on pc.oid=con.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
  where con.contype='f' and cn.nspname='public' and pn.nspname='public' and
   (pc.relname='levytate_organisations' or exists(select 1 from public.levytate_tenant_data_inventory() i where i.table_name=pc.relname)) loop
  execute format('create trigger levytate_offboarding_foreign_boundary before insert or update or delete on public.%I for each row execute function public.levytate_offboarding_foreign_boundary()',r.relname);
 end loop;
end; $foreign_guards$;

-- Exact-case exception only; ordinary evidence remains immutable. Framework
-- registrations have no tenant ID and can never use the exception.
create or replace function public.levytate_reject_assessment_immutable_change() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' and public.levytate_offboarding_internal_delete((to_jsonb(old)->>'organisation_id')::uuid) then return old;end if;
 raise exception 'Submitted assessment history is immutable';
end; $$;
create or replace function public.levytate_reject_pastoral_append_only_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' and public.levytate_offboarding_internal_delete((to_jsonb(old)->>'organisation_id')::uuid) then return old;end if;
 raise exception 'Pastoral history records are append-only';
end; $$;
create or replace function public.levytate_reject_otj_append_only_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' and public.levytate_offboarding_internal_delete((to_jsonb(old)->>'organisation_id')::uuid) then return old;end if;
 raise exception 'Learning Time history records are append-only';
end; $$;
create or replace function public.levytate_reject_application_workflow_event_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' and public.levytate_offboarding_internal_delete((to_jsonb(old)->>'organisation_id')::uuid) then return old;end if;
 raise exception 'Application workflow events are append-only';
end; $$;
create or replace function public.levytate_reject_lift_append_only_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' and public.levytate_offboarding_internal_delete((to_jsonb(old)->>'organisation_id')::uuid) then return old;end if;
 raise exception 'Lift history records are append-only';
end; $$;
create or replace function public.levytate_guard_lift_manager_observation_revision() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then
  if public.levytate_offboarding_internal_delete(old.organisation_id) then return old;end if;
  raise exception 'Submitted Lift manager observations are immutable';
 end if;
 if old.status<>'draft' then raise exception 'Submitted Lift manager observations are immutable';end if;
 if new.observation_id<>old.observation_id or new.revision_number<>old.revision_number or new.revision_kind<>old.revision_kind
  or new.clarifies_revision_number is distinct from old.clarifies_revision_number then raise exception 'Lift manager observation revision identity is immutable';end if;
 if new.status not in('draft','submitted') then raise exception 'Invalid Lift manager observation revision transition';end if;
 return new;
end; $$;

create or replace function public.levytate_record_workspace_entity_version() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row jsonb;v_org uuid;v_id text;v_entity_table text:=TG_TABLE_NAME;
begin
 if TG_OP='UPDATE' and (to_jsonb(NEW)-array['created_at','updated_at'])=(to_jsonb(OLD)-array['created_at','updated_at']) then return NEW;end if;
 v_row:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 v_org:=case when TG_TABLE_NAME='levytate_organisations' then (v_row->>'id')::uuid else (v_row->>'organisation_id')::uuid end;
 if TG_OP='DELETE' and public.levytate_offboarding_internal_delete(v_org) then return OLD;end if;
 if TG_TABLE_NAME='levytate_role_pathway_mappings' then v_entity_table:='levytate_roles';end if;
 v_id:=case when TG_TABLE_NAME='levytate_role_pathway_mappings' then v_row->>'role_id'
   when TG_TABLE_NAME='levytate_employee_development_profiles' then v_row->>'employee_id'
   when TG_TABLE_NAME in ('levytate_providers','levytate_organisation_providers') then v_row->>'provider_id'
   when TG_TABLE_NAME='levytate_organisation_programmes' then v_row->>'programme_id' else v_row->>'id' end;
 insert into public.levytate_workspace_entity_versions values(v_org,v_entity_table||':'||v_id,1)
 on conflict(organisation_id,entity_key) do update set revision=levytate_workspace_entity_versions.revision+1;
 if TG_OP='DELETE' then return OLD;else return NEW;end if;
end; $$;
revoke all on function public.levytate_record_workspace_entity_version() from public,anon,authenticated,service_role;

create function public.levytate_offboarding_finish_delete(p_actor uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.levytate_tenant_offboarding_cases%rowtype;remaining text[];pending text[];table_name text;
 changed boolean;amount bigint;counts jsonb:='{}';stamp timestamptz:=clock_timestamp();evidence jsonb;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case;
 if not found or p_actor not in(c.requester_id,c.approver_id) then raise exception using errcode='PT403',message='Approved disposal required';end if;
 perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||c.tenant_id::text,0));
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case for update;
 stamp:=clock_timestamp();
 if c.status='completed' then return c.deletion_evidence;end if;
 if c.status<>'deleting' then raise exception using errcode='PT409',message='Disposal has not started';end if;
 perform public.levytate_offboarding_due(c.id);
 perform public.levytate_offboarding_assert_inventory();
 if exists(select 1 from jsonb_array_elements(c.storage_inventory) s join storage.objects o on o.bucket_id=s->>'bucket' and o.name=s->>'path')
  or exists(select 1 from storage.objects o where split_part(o.name,'/',1)=c.tenant_id::text)
  or exists(select 1 from jsonb_array_elements(c.auth_inventory) a join auth.users u on u.id=(a->>'id')::uuid where (a->>'delete')::boolean) then
  raise exception using errcode='PT409',message='Storage or Auth disposal has not been independently confirmed';end if;
 perform public.levytate_offboarding_foreign_links(c.tenant_id);
 perform set_config('levytate.offboarding_case',c.id::text,true);
 perform set_config('levytate.offboarding_transaction',txid_current()::text,true);
 select array_agg(i.table_name order by i.table_name) into remaining from public.levytate_tenant_data_inventory() i where to_regclass('public.'||i.table_name) is not null;
 -- Restrictive FKs determine deletion order. Each failed attempt is rolled back
 -- in its own subtransaction. Cycles/unknown constraints abort the whole DB step.
 while coalesce(array_length(remaining,1),0)>0 loop
  pending:='{}';changed:=false;
  foreach table_name in array remaining loop
   begin
    execute format('delete from public.%I where organisation_id=$1',table_name) using c.tenant_id;
    get diagnostics amount=row_count;
    counts:=counts||jsonb_build_object(table_name,amount);changed:=true;
   exception when foreign_key_violation or sqlstate 'PT409' then pending:=array_append(pending,table_name);
   end;
  end loop;
  if not changed then raise exception using errcode='PT409',message='Scoped database disposal is blocked; no database rows were committed';end if;
  remaining:=pending;
 end loop;
 perform public.levytate_offboarding_due(c.id);
 stamp:=clock_timestamp();
 delete from public.levytate_organisations where id=c.tenant_id and status='Suspended';
 if not found then raise exception using errcode='PT409',message='Suspended tenant changed during disposal';end if;
 evidence:=jsonb_build_object('version','levytate-offboarding-evidence-v1','caseId',c.id,'organisationId',c.tenant_id,
  'completedAt',stamp,'requesterId',c.requester_id,'approverId',c.approver_id,'executorId',p_actor,
  'policyApproval',c.policy->>'approvalReference','clientNoticeReference',c.policy->>'clientNoticeReference',
  'supportHandoverReference',c.policy->>'supportHandoverReference','recoveryBoundaryReference',c.policy->>'recoveryBoundaryReference',
  'deliveryReference',c.client_delivery_reference,'tablesDeleted',counts,'storageObjectsDeleted',jsonb_array_length(c.storage_inventory),
  'authDeleted',(select count(*) from jsonb_array_elements(c.auth_inventory) a where (a->>'delete')::boolean),
  'sharedAuthRetained',(select count(*) from jsonb_array_elements(c.auth_inventory) a where not(a->>'delete')::boolean),
  'evidenceRetainUntil',c.evidence_retain_until,'irreversible',true);
 update public.levytate_tenant_offboarding_cases set status='completed',completed_at=stamp,updated_at=stamp,revision=revision+1,
  deletion_evidence=evidence,encrypted_package=null,recipient_public_key='',auth_inventory=null,storage_inventory=null,
  request_hash='',snapshot_hash=null,manifest=null where id=c.id;
 -- The encrypted export and command snapshots are not retained as audit data.
 delete from public.levytate_tenant_offboarding_commands where case_id=c.id;
 insert into public.levytate_tenant_offboarding_events(case_id,actor_id,action,revision) values(c.id,p_actor,'disposal_completed',c.revision+1);
 return evidence;
end; $$;

-- Expired evidence is erased only after a second person's explicit approval.
-- This does not promise to erase recipients' downloaded copies or platform
-- backups; those boundaries must be recorded in the approved notice/policy.
create function public.levytate_offboarding_erase_evidence(p_actor uuid,p_case uuid,p_reference text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.levytate_tenant_offboarding_cases%rowtype;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into c from public.levytate_tenant_offboarding_cases where id=p_case for update;
 if not found or c.status not in('completed','cancelled') or c.legal_hold or c.evidence_retain_until>clock_timestamp()
  or p_actor=c.requester_id or length(btrim(p_reference)) not between 5 and 500 then raise exception using errcode='PT409',message='Evidence retention or independent erasure approval blocks removal';end if;
 delete from public.levytate_tenant_offboarding_commands where case_id=c.id;
 delete from public.levytate_tenant_offboarding_events where case_id=c.id;
 delete from public.levytate_tenant_offboarding_cases where id=c.id;
 return jsonb_build_object('caseId',p_case,'erased',true,'erasureReference',p_reference,'erasedAt',clock_timestamp());
end; $$;

-- Revoke every new/replaced helper before exposing only the closed entry points.
create function public.levytate_offboarding_receipt(p_actor uuid,p_request uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare receipt public.levytate_tenant_offboarding_commands%rowtype;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into receipt from public.levytate_tenant_offboarding_commands where request_id=p_request;
 if not found then return jsonb_build_object('result',null);end if;
 if receipt.actor_id<>p_actor or receipt.payload<>p_command then raise exception using errcode='PT409',message='Request key already used';end if;
 return jsonb_build_object('result',receipt.result);
end; $$;
revoke all on function public.levytate_offboarding_receipt(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_offboarding_receipt(uuid,uuid,jsonb) to service_role;

revoke all on function public.levytate_offboarding_internal_delete(uuid),
 public.levytate_offboarding_lock_identities(uuid),
 public.levytate_offboarding_foreign_boundary(),
 public.levytate_offboarding_freeze(),public.levytate_offboarding_identity_freeze(),
 public.levytate_offboarding_assert_inventory(),public.levytate_offboarding_auth_inventory(uuid),
 public.levytate_offboarding_storage_inventory(uuid),public.levytate_offboarding_data(uuid),
 public.levytate_offboarding_due(uuid),public.levytate_offboarding_foreign_links(uuid),
 public.levytate_reject_assessment_immutable_change(),public.levytate_reject_pastoral_append_only_mutation(),
 public.levytate_reject_otj_append_only_mutation(),public.levytate_reject_application_workflow_event_mutation(),
 public.levytate_reject_lift_append_only_mutation(),public.levytate_guard_lift_manager_observation_revision()
 from public,anon,authenticated,service_role;
revoke all on function public.levytate_offboarding_status(uuid,uuid),public.levytate_offboarding_command(uuid,jsonb),
 public.levytate_offboarding_snapshot(uuid,uuid),public.levytate_offboarding_download(uuid,uuid),
 public.levytate_offboarding_disposal_plan(uuid,uuid),public.levytate_offboarding_finish_delete(uuid,uuid),
 public.levytate_offboarding_erase_evidence(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.levytate_offboarding_status(uuid,uuid),public.levytate_offboarding_command(uuid,jsonb),
 public.levytate_offboarding_snapshot(uuid,uuid),public.levytate_offboarding_download(uuid,uuid),
 public.levytate_offboarding_disposal_plan(uuid,uuid),public.levytate_offboarding_finish_delete(uuid,uuid),
 public.levytate_offboarding_erase_evidence(uuid,uuid,text) to service_role;
