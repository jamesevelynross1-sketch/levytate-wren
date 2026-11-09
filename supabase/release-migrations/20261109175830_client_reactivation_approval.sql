-- LOCAL CANDIDATE ONLY. Reactivation permits controlled onboarding, never the
-- reuse of previous sessions, invitation credentials or external bindings.
create table public.levytate_tenant_reactivation_requests(
 id uuid primary key,organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
 requester_id uuid not null,approver_id uuid,status text not null default 'requested' check(status in('requested','approved','cancelled')),
 suspension_updated_at timestamptz not null,request_evidence jsonb not null,approval_reference text,
 requested_at timestamptz not null default now(),completed_at timestamptz
);
create unique index levytate_tenant_reactivation_pending_idx on public.levytate_tenant_reactivation_requests(organisation_id) where status='requested';
alter table public.levytate_tenant_reactivation_requests enable row level security;
revoke all on public.levytate_tenant_reactivation_requests from public,anon,authenticated,service_role;
create trigger levytate_offboarding_freeze before insert or update or delete on public.levytate_tenant_reactivation_requests
 for each row execute function public.levytate_offboarding_freeze();
create trigger levytate_offboarding_foreign_boundary before insert or update or delete on public.levytate_tenant_reactivation_requests
 for each row execute function public.levytate_offboarding_foreign_boundary();

create function public.levytate_reactivation_status(p_actor uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.levytate_offboarding_actor(p_actor);
 return coalesce((select jsonb_agg(to_jsonb(r) order by requested_at desc) from public.levytate_tenant_reactivation_requests r),'[]');
end; $$;

create function public.levytate_reactivation_command(p_actor uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.levytate_tenant_reactivation_requests%rowtype;o public.levytate_organisations%rowtype;
 receipt public.levytate_audit_events%rowtype;actor public.levytate_users%rowtype;
 action text:=p_command->>'action';request_id uuid:=(p_command->>'requestId')::uuid;case_id uuid:=(p_command->>'reactivationId')::uuid;
 tenant uuid;ref text;allowed text[];stamp timestamptz;result jsonb;
begin
 perform public.levytate_offboarding_actor(p_actor);
 select * into actor from public.levytate_users where id=p_actor;
 if request_id is null or case_id is null or jsonb_typeof(p_command) is distinct from 'object' then raise exception using errcode='PT422',message='Reactivation request required';end if;
 allowed:=array['action','requestId','reactivationId'];
 if action='request_reactivation' then allowed:=allowed||array['organisationId','approvalReference','clientNoticeReference','supportHandoverReference','recoveryBoundaryReference'];
 elsif action='approve_reactivation' then allowed:=allowed||array['approvalReference'];
 elsif action<>'cancel_reactivation' then raise exception using errcode='PT422',message='Supported reactivation action required';end if;
 if exists(select 1 from jsonb_object_keys(p_command) k where not(k=any(allowed))) then raise exception using errcode='PT422',message='Unsupported reactivation fields';end if;
 perform pg_advisory_xact_lock(hashtextextended('reactivation-request:'||request_id::text,0));
 select * into receipt from public.levytate_audit_events where id=request_id;
 if found then
  if receipt.action='client_workspace.'||action and receipt.metadata->>'actorId'=p_actor::text and receipt.metadata->'command'=p_command then return receipt.metadata->'result';end if;
  raise exception using errcode='PT409',message='Request key already used';end if;
 select * into r from public.levytate_tenant_reactivation_requests where id=case_id;
 tenant:=coalesce(r.organisation_id,(p_command->>'organisationId')::uuid);
 if tenant is null then raise exception using errcode='PT404',message='Reactivation request not found';end if;
 perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||tenant::text,0));
 select * into r from public.levytate_tenant_reactivation_requests where id=case_id for update;
 perform 1 from public.levytate_users where organisation_id=tenant order by id for update;
 select * into o from public.levytate_organisations where id=tenant for update;
 if not found or o.status<>'Suspended' or o.workspace_template<>'levytate-client-v1'
  or exists(select 1 from public.levytate_users where organisation_id=tenant and role='Platform Admin') then
  raise exception using errcode='PT409',message='Only an intact suspended client may be reactivated';end if;
 if exists(select 1 from public.levytate_tenant_offboarding_cases where tenant_id=tenant and (status<>'cancelled' or legal_hold)) then
  raise exception using errcode='PT409',message='Cancel unfinished offboarding and independently release holds before reactivation; deletion is terminal';end if;
 if action='request_reactivation' then
  if r.id is not null then raise exception using errcode='PT409',message='Reactivation key already used';end if;
  foreach ref in array array['approvalReference','clientNoticeReference','supportHandoverReference','recoveryBoundaryReference'] loop
   if coalesce(length(btrim(p_command->>ref)),0) not between 5 and 500 then raise exception using errcode='PT422',message='Explicit reactivation, notice, support and recovery references required';end if;
  end loop;
  insert into public.levytate_tenant_reactivation_requests(id,organisation_id,requester_id,suspension_updated_at,request_evidence)
   values(case_id,tenant,p_actor,o.updated_at,p_command-array['action','requestId','reactivationId','organisationId']) returning * into r;
 elsif action='approve_reactivation' then
  if r.id is null or r.status<>'requested' or p_actor=r.requester_id then raise exception using errcode='PT403',message='A different current Platform Admin must approve reactivation';end if;
  perform public.levytate_offboarding_actor(r.requester_id);
  if o.updated_at is distinct from r.suspension_updated_at or coalesce(length(btrim(p_command->>'approvalReference')),0) not between 5 and 500 then
   raise exception using errcode='PT409',message='Suspension changed or approval evidence missing';end if;
  stamp:=clock_timestamp();
  -- Preserve role/tenant and retired-subject history. Every account still needs
  -- a new individually approved invitation and genuine identity binding.
  update public.levytate_users set active=false,auth_subject=null,auth_bound_at=null,auth_binding_status='pending',
   invitation_status='revoked',invitation_generation=invitation_generation+1,invitation_expires_at=null,
   invitation_request_reference=null,updated_at=stamp where organisation_id=tenant;
  update public.levytate_provider_access_invites set revoked_at=stamp where organisation_id=tenant and revoked_at is null;
  update public.levytate_service_request_invitations set status='cancelled',updated_at=stamp where organisation_id=tenant and status not in('cancelled','declined','deadline_passed');
  update public.levytate_external_identities set status='revoked',updated_at=stamp where organisation_id=tenant and status<>'revoked';
  update public.levytate_external_tenant_connections set status='inactive',updated_at=stamp where organisation_id=tenant and status<>'inactive';
  update public.levytate_prospect_access set access_status='revoked',revoked_at=stamp,revoked_by=actor.email,
   revocation_reason='Reactivation requires a new controlled individual invitation' where organisation_id=tenant and access_status<>'revoked';
  update public.levytate_organisations set status='Active',updated_at=stamp where id=tenant;
  update public.levytate_tenant_reactivation_requests set status='approved',approver_id=p_actor,
   approval_reference=p_command->>'approvalReference',completed_at=stamp where id=case_id returning * into r;
 else
  if r.id is null or r.status<>'requested' then raise exception using errcode='PT409',message='Only a pending request may be cancelled';end if;
  update public.levytate_tenant_reactivation_requests set status='cancelled',completed_at=clock_timestamp() where id=case_id returning * into r;
 end if;
 result:=jsonb_build_object('id',r.id,'organisationId',tenant,'status',r.status,'requesterId',r.requester_id,'approverId',r.approver_id,
  'newIndividualInvitationsRequired',true,'priorExternalBindingsRestored',false,'priorSessionsRestored',false,
  'references',r.request_evidence,'approvalReference',r.approval_reference,'completedAt',r.completed_at);
 insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
  values(request_id,tenant,actor.email,actor.role,'client_workspace',tenant::text,'client_workspace.'||action,
   'Recorded independent reactivation step; previous credentials and external invitations remain revoked.',
   jsonb_build_object('actorId',p_actor,'command',p_command,'result',result));
 return result;
exception when invalid_text_representation then raise exception using errcode='PT422',message='Valid reactivation identifiers required';
end; $$;
revoke all on function public.levytate_reactivation_status(uuid),public.levytate_reactivation_command(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_reactivation_status(uuid),public.levytate_reactivation_command(uuid,jsonb) to service_role;

create or replace function public.levytate_tenant_data_inventory() returns table(table_name text,data_class text)
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
('levytate_tenant_reactivation_requests','audit'),
('levytate_audit_events','audit'),
('levytate_early_access_terms_acceptances','audit'),
('levytate_external_connector_events','audit')
$$;
