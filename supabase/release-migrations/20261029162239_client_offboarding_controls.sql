-- Local isolated candidate. No hosted execution or real tenant disposal authorised.
-- Public RPCs are service-only; direct case/approval writes are not granted.
create table public.levytate_tenant_offboarding_cases(
 id uuid primary key, tenant_id uuid not null, requester_id uuid not null, approver_id uuid,
 purpose text not null check(purpose in ('export','delete')), status text not null default 'requested'
 check(status in ('requested','approved','exported','deleting','completed','cancelled')),
 policy jsonb not null, recipient_public_key text not null, export_expires_at timestamptz not null,
 request_hash text not null, revision integer not null default 1, legal_hold boolean not null default false,
 hold_actor_id uuid, hold_reference text, approval_reference text, client_delivery_reference text,
 encrypted_package jsonb, manifest jsonb, snapshot_hash text, storage_inventory jsonb,
 deletion_evidence jsonb not null default '{}'::jsonb, evidence_retain_until timestamptz not null,
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
create function public.levytate_tenant_data_inventory() returns table(table_name text,data_class text)
language sql immutable set search_path=pg_catalog as $$ values
('levytate_users','identity'),
('levytate_organisation_capabilities','identity'),
('levytate_prospect_access','identity'),
('levytate_external_identities','identity'),
('levytate_external_tenant_connections','identity'),
('levytate_provider_access_invites','identity'),
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
('levytate_intelligence_signals','learners'),
('levytate_intelligence_signal_events','learners'),
('levytate_otj_plans','learners'),
('levytate_otj_plan_versions','learners'),
('levytate_otj_learning_priorities','learners'),
('levytate_otj_activities','learners'),
('levytate_otj_activity_confirmations','learners'),
('levytate_otj_activity_events','learners'),
('levytate_finance_balances','finance'),
('levytate_finance_imports','finance'),
('levytate_finance_transactions','finance'),
('levytate_finance_command_receipts','finance'),
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
 where u.id=p_actor and u.active and u.role='Platform Admin' and o.status='Active' for share of u,o;
 if not found then raise exception using errcode='PT403',message='Active platform administrator required'; end if;
end; $$;
revoke all on function public.levytate_offboarding_actor(uuid) from public,anon,authenticated,service_role;

create function public.levytate_offboarding_status(p_actor uuid,p_case uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.levytate_offboarding_actor(p_actor);
 -- Expiry prevents new delivery immediately. Erasure of expired encrypted bytes
 -- is idempotent and also happens on each administration read.
 update public.levytate_tenant_offboarding_cases set encrypted_package=null
 where export_expires_at<=clock_timestamp() and encrypted_package is not null;
 return coalesce((select jsonb_agg(to_jsonb(c)-array['recipient_public_key','encrypted_package','storage_inventory','deletion_evidence'] order by created_at desc)
 from public.levytate_tenant_offboarding_cases c where p_case is null or c.id=p_case),'[]'::jsonb);
end; $$;
revoke all on function public.levytate_offboarding_status(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.levytate_offboarding_status(uuid,uuid) to service_role;

create function public.levytate_offboarding_command(p_actor uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_case public.levytate_tenant_offboarding_cases%rowtype; v_id uuid; v_action text; v_policy jsonb;
 v_hash text;v_class text;v_now timestamptz:=clock_timestamp();v_result jsonb;
begin
 perform public.levytate_offboarding_actor(p_actor);
 if jsonb_typeof(p_command)<>'object' then raise exception using errcode='PT422',message='Lifecycle command required';end if;
 v_id:=(p_command->>'caseId')::uuid;v_action:=p_command->>'action';
 if v_id is null or v_action is null then raise exception using errcode='PT422',message='Case and action required';end if;
 perform pg_advisory_xact_lock(hashtextextended('levytate-offboarding:'||v_id::text,0));
 select * into v_case from public.levytate_tenant_offboarding_cases where id=v_id for update;
 if v_action='request' then
  v_hash:=md5(p_command::text);
  if found then
   if v_case.requester_id=p_actor and v_case.request_hash=v_hash then return jsonb_build_object('id',v_case.id,'status',v_case.status,'revision',v_case.revision);end if;
   raise exception using errcode='PT409',message='Request key is already used';end if;
  v_policy:=p_command->'policy';
  if p_command->>'purpose' not in ('export','delete') or jsonb_typeof(v_policy) is distinct from 'object'
   or v_policy->>'version' is distinct from 'levytate-offboarding-v1' or jsonb_typeof(v_policy->'schedules') is distinct from 'array'
   or jsonb_array_length(v_policy->'schedules')<>11 then raise exception using errcode='PT422',message='Explicit approved policy required';end if;
  foreach v_class in array array['identity','people','applications','learners','finance','catalogue','files','assessments','lift','support','audit'] loop
   if (select count(*) from jsonb_array_elements(v_policy->'schedules') x where x->>'dataClass'=v_class
    and x->>'action' in ('delete','retain') and length(btrim(x->>'approvalReference')) between 5 and 500
    and (x->>'retainUntil')::timestamptz is not null)<>1 then raise exception using errcode='PT422',message='Every class needs a reviewed schedule';end if;
  end loop;
  foreach v_class in array array['approvalReference','clientNoticeReference','supportHandoverReference','recoveryBoundaryReference'] loop
   if coalesce(length(btrim(v_policy->>v_class)),0) not between 5 and 500 then raise exception using errcode='PT422',message='Client notice and ownership evidence required';end if;
  end loop;
  if (v_policy->>'evidenceRetainUntil')::timestamptz<=v_now or (p_command->>'exportExpiresAt')::timestamptz<=v_now
   or coalesce(length(p_command->>'recipientPublicKey'),0) not between 100 and 16000 then raise exception using errcode='PT422',message='Explicit unexpired export and evidence schedule required';end if;
  perform 1 from public.levytate_users where id=(v_policy->>'dataOwnerUserId')::uuid and active and role='Platform Admin';
  if not found then raise exception using errcode='PT422',message='Active named data owner required';end if;
  perform 1 from public.levytate_users where id=(v_policy->>'serviceOwnerUserId')::uuid and active and role='Platform Admin';
  if not found then raise exception using errcode='PT422',message='Active named service owner required';end if;
  perform 1 from public.levytate_organisations o where o.id=(p_command->>'organisationId')::uuid and o.status='Suspended' and o.workspace_template='levytate-client-v1'
    and not exists(select 1 from public.levytate_users u where u.id=p_actor and u.organisation_id=o.id) for share;
  if not found then raise exception using errcode='PT409',message='Suspend the client workspace before offboarding';end if;
  insert into public.levytate_tenant_offboarding_cases(id,tenant_id,requester_id,purpose,policy,recipient_public_key,export_expires_at,request_hash,evidence_retain_until)
   values(v_id,(p_command->>'organisationId')::uuid,p_actor,p_command->>'purpose',v_policy,p_command->>'recipientPublicKey',(p_command->>'exportExpiresAt')::timestamptz,v_hash,(v_policy->>'evidenceRetainUntil')::timestamptz)
   returning * into v_case;
 else
  if not found then raise exception using errcode='PT404',message='Lifecycle case not found';end if;
  if (p_command->>'expectedRevision')::integer is distinct from v_case.revision then raise exception using errcode='PT409',message='Lifecycle case changed; refresh';end if;
  if v_action='approve' then
   if v_case.status<>'requested' or p_actor=v_case.requester_id or coalesce(length(btrim(p_command->>'approvalReference')),0) not between 5 and 500 then
    raise exception using errcode='PT403',message='Independent approval and evidence required';end if;
   update public.levytate_tenant_offboarding_cases set status='approved',approver_id=p_actor,approval_reference=p_command->>'approvalReference',approved_at=v_now where id=v_id;
  elsif v_action='hold' then
   if jsonb_typeof(p_command->'active') is distinct from 'boolean' or coalesce(length(btrim(p_command->>'reference')),0) not between 5 and 500 or v_case.status in ('deleting','completed','cancelled') then
    raise exception using errcode='PT409',message='Hold requires evidence before irreversible execution';end if;
   if not (p_command->>'active')::boolean and (not v_case.legal_hold or v_case.hold_actor_id=p_actor) then raise exception using errcode='PT403',message='A different authorised person must release a hold';end if;
   update public.levytate_tenant_offboarding_cases set legal_hold=(p_command->>'active')::boolean,hold_actor_id=case when (p_command->>'active')::boolean then p_actor else hold_actor_id end,hold_reference=p_command->>'reference' where id=v_id;
  elsif v_action='cancel' then
   if v_case.status in ('deleting','completed') then raise exception using errcode='PT409',message='Irreversible work has started';end if;
   update public.levytate_tenant_offboarding_cases set status='cancelled',encrypted_package=null where id=v_id;
  elsif v_action='record_export' then
   if v_case.status not in ('approved','exported') or v_case.export_expires_at<=v_now or p_actor not in(v_case.requester_id,v_case.approver_id)
    or jsonb_typeof(p_command->'envelope') is distinct from 'object' or jsonb_typeof(p_command->'manifest') is distinct from 'object'
    or p_command->'manifest'->>'organisationId' is distinct from v_case.tenant_id::text or p_command->'envelope'->>'version' is distinct from 'levytate-encrypted-export-v1'
    or (p_command->'envelope'->>'expiresAt')::timestamptz is distinct from v_case.export_expires_at then raise exception using errcode='PT409',message='Approved export could not be reconciled';end if;
   update public.levytate_tenant_offboarding_cases set status='exported',encrypted_package=p_command->'envelope',manifest=p_command->'manifest',
    snapshot_hash=p_command->>'snapshotHash',storage_inventory=p_command->'storageInventory',exported_at=v_now where id=v_id;
  elsif v_action='record_delivery' then
   if v_case.status<>'exported' or coalesce(length(btrim(p_command->>'reference')),0) not between 5 and 500 then raise exception using errcode='PT422',message='Approved client delivery evidence required';end if;
   update public.levytate_tenant_offboarding_cases set client_delivery_reference=p_command->>'reference' where id=v_id;
  else raise exception using errcode='PT422',message='Supported lifecycle command required';
  end if;
  update public.levytate_tenant_offboarding_cases set revision=revision+1,updated_at=v_now where id=v_id returning * into v_case;
 end if;
 insert into public.levytate_tenant_offboarding_events(case_id,actor_id,action,revision) values(v_id,p_actor,v_action,v_case.revision);
 return jsonb_build_object('id',v_case.id,'status',v_case.status,'revision',v_case.revision);
end; $$;
revoke all on function public.levytate_offboarding_command(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_offboarding_command(uuid,jsonb) to service_role;

create function public.levytate_offboarding_snapshot(p_actor uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_case public.levytate_tenant_offboarding_cases%rowtype;v_sql text;v_table record;v_snapshot jsonb;v_objects jsonb;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into v_case from public.levytate_tenant_offboarding_cases where id=p_case for share;
 if not found or v_case.status not in ('approved','exported') or v_case.export_expires_at<=clock_timestamp() or p_actor not in(v_case.requester_id,v_case.approver_id) then
 raise exception using errcode='PT403',message='Approved export required';end if;
 perform 1 from public.levytate_organisations where id=v_case.tenant_id and status='Suspended' for share;
 if not found then raise exception using errcode='PT409',message='Export requires a suspended tenant';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='organisation_id' and not a.attisdropped
  where n.nspname='public' and c.relkind='r' and not exists(select 1 from public.levytate_tenant_data_inventory() i where i.table_name=c.relname)) then
  raise exception using errcode='PT409',message='Tenant inventory changed; independent review required';end if;
 v_sql:='';
 for v_table in select i.table_name from public.levytate_tenant_data_inventory() i where to_regclass('public.'||i.table_name) is not null order by i.table_name loop
  if v_sql<>'' then v_sql:=v_sql||' union all ';end if;
  v_sql:=v_sql||format('select %L as k,(select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where organisation_id=$1) as v',v_table.table_name,v_table.table_name);
 end loop;
 v_sql:='select jsonb_build_object(''organisation'',(select to_jsonb(o) from public.levytate_organisations o where id=$1),''tables'',(select jsonb_object_agg(k,v) from ('||v_sql||') scoped))';
 execute v_sql into v_snapshot using v_case.tenant_id;
 -- Registered bytes are scoped independently; ambiguous shared object ownership
 -- blocks export rather than copying another tenant's object.
 if exists(select 1 from public.levytate_file_assets a join public.levytate_file_assets b on b.bucket_name=a.bucket_name and b.object_path=a.object_path
  where a.organisation_id=v_case.tenant_id and b.organisation_id<>v_case.tenant_id) then raise exception using errcode='PT409',message='Storage ownership is ambiguous';end if;
 if exists(select 1 from public.levytate_file_assets a left join storage.objects o on o.bucket_id=a.bucket_name and o.name=a.object_path
  where a.organisation_id=v_case.tenant_id and o.id is null) then raise exception using errcode='PT409',message='Registered Storage object is missing';end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',a.bucket_name,'path',a.object_path,'size',(o.metadata->>'size')::bigint) order by a.bucket_name,a.object_path),'[]'::jsonb)
 into v_objects from public.levytate_file_assets a join storage.objects o on o.bucket_id=a.bucket_name and o.name=a.object_path where a.organisation_id=v_case.tenant_id;
 return v_snapshot||jsonb_build_object('organisationId',v_case.tenant_id,'snapshotId',v_case.id,'generatedAt',v_case.approved_at,
  'storageObjects',v_objects,'recipientPublicKey',v_case.recipient_public_key,'expiresAt',v_case.export_expires_at,'revision',v_case.revision);
end; $$;
revoke all on function public.levytate_offboarding_snapshot(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.levytate_offboarding_snapshot(uuid,uuid) to service_role;

create function public.levytate_offboarding_download(p_actor uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_case public.levytate_tenant_offboarding_cases%rowtype;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into v_case from public.levytate_tenant_offboarding_cases where id=p_case for update;
 if not found or v_case.status<>'exported' or v_case.encrypted_package is null or v_case.export_expires_at<=clock_timestamp()
 or p_actor not in(v_case.requester_id,v_case.approver_id) then raise exception using errcode='PT403',message='Export delivery is unavailable';end if;
 update public.levytate_tenant_offboarding_cases set issued_at=clock_timestamp() where id=p_case;
 insert into public.levytate_tenant_offboarding_events(case_id,actor_id,action,revision) values(p_case,p_actor,'encrypted_package_issued',v_case.revision);
 return v_case.encrypted_package;
end; $$;
revoke all on function public.levytate_offboarding_download(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.levytate_offboarding_download(uuid,uuid) to service_role;
