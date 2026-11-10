-- Local review candidate27. All Intelligence/Autopilot writes, action derivation,
-- history and receipts commit together. No hosted authority or capability change.
alter table public.levytate_intelligence_signals add column revision integer not null default 0 check(revision>=0), add column source_hash text;
create table public.levytate_intelligence_workspaces(
 organisation_id uuid not null references public.levytate_organisations(id),family text not null check(family in('progress-review-v1','operations-autopilot-v1')),
 revision integer not null default 0 check(revision>=0),reconciled_at timestamptz,primary key(organisation_id,family));
create table public.levytate_intelligence_command_receipts(
 organisation_id uuid not null references public.levytate_organisations(id),actor_user_id uuid not null references public.levytate_users(id),request_id uuid not null,
 command jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(organisation_id,actor_user_id,request_id));
alter table public.levytate_intelligence_workspaces enable row level security;
alter table public.levytate_intelligence_command_receipts enable row level security;
revoke all on public.levytate_intelligence_workspaces,public.levytate_intelligence_command_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_intelligence_workspaces,public.levytate_intelligence_command_receipts to service_role;
revoke insert,update,delete,truncate on public.levytate_intelligence_signals,public.levytate_intelligence_signal_events from service_role;

-- Internal source fingerprint excludes derived signals/audit so a refresh does
-- not invalidate itself. The caller holds the existing catalogue/People/Operations
-- and tenant-freeze locks, shared by every reviewed source command, before use.
create function public.levytate_intelligence_source_hash(p_org uuid) returns text
language plpgsql volatile security definer set search_path=pg_catalog,public as $$
declare t text; part jsonb; parts jsonb:='{}';
begin
 foreach t in array array['levytate_employees','levytate_applications','levytate_learner_records','levytate_learner_reviews','levytate_learner_progress_updates',
 'levytate_learner_assessment_readiness','levytate_learner_achievements','levytate_operational_actions','levytate_organisation_capabilities',
 'levytate_otj_plans','levytate_otj_plan_versions','levytate_otj_learning_priorities','levytate_otj_activities','levytate_otj_activity_confirmations'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r where organisation_id=$1',t) into part using p_org;
  parts:=parts||jsonb_build_object(t,part);
 end loop;
 return encode(sha256(convert_to(parts::text,'UTF8')),'hex');
end $$;
revoke all on function public.levytate_intelligence_source_hash(uuid) from public,anon,authenticated,service_role;

create function public.levytate_apply_intelligence_command(p_organisation_id uuid,p_actor_user_id uuid,p_family text,p_command jsonb,
 p_prepare boolean default false,p_source_hash text default null,p_workspace_revision integer default null,p_rows jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 actor public.levytate_users; state public.levytate_intelligence_workspaces; receipt public.levytate_intelligence_command_receipts;
 prior public.levytate_intelligence_signals; proposed public.levytate_intelligence_signals; signal public.levytate_intelligence_signals;
 learner public.levytate_learner_records; employee public.levytate_employees; manager public.levytate_employees; application public.levytate_applications;
 action text:=p_command->>'action'; v_request_id uuid; command jsonb; now_at timestamptz; v_source_hash text; result jsonb; confirmation jsonb; row_json jsonb; evidence jsonb;
 row_ids text[]:=array[]::text[]; allowed text[]; key text; event_type text; action_id text; action_result jsonb; source_version timestamptz;
 owner_type text; owner_id text; title text; due_date date; action_type text; metadata jsonb; existing_action public.levytate_operational_actions; occurrence text; reused boolean:=false;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then raise exception using errcode='PT403',message='Server credential required';end if;
 if p_organisation_id is null or p_actor_user_id is null or p_prepare is null or p_family not in('progress-review-v1','operations-autopilot-v1') or p_family is null
  or jsonb_typeof(p_command) is distinct from 'object' or length(p_command::text)>8192 or action is null
  or (p_family='progress-review-v1' and action not in('analyse','acknowledge','dismiss','accept'))
  or (p_family='operations-autopilot-v1' and action not in('refresh','dismiss','create_action')) then raise exception using errcode='PT422',message='Invalid Intelligence command';end if;
 if jsonb_typeof(p_command->'idempotencyKey') is distinct from 'string' or p_command->>'idempotencyKey' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception using errcode='PT422',message='Request identity required';end if;
 v_request_id:=(p_command->>'idempotencyKey')::uuid;
 allowed:=case when action in('analyse','refresh') then array['action','idempotencyKey'] when action='create_action' then array['action','idempotencyKey','signalId','expectedRevision','title','ownerType','dueDate','communicationDraft'] when action='dismiss' then array['action','idempotencyKey','signalId','expectedRevision','reason'] else array['action','idempotencyKey','signalId','expectedRevision'] end;
 if exists(select 1 from jsonb_object_keys(p_command) k where not k=any(allowed)) then raise exception using errcode='PT422',message='Unsupported Intelligence field';end if;
 if action not in('analyse','refresh') and (jsonb_typeof(p_command->'signalId') is distinct from 'string' or length(p_command->>'signalId') not between 1 and 160
  or jsonb_typeof(p_command->'expectedRevision') is distinct from 'number' or p_command->>'expectedRevision' !~ '^[0-9]+$') then raise exception using errcode='PT422',message='Signal revision required';end if;
 -- Same lock order as source Operations/Learning Time commands. The freeze lock
 -- serialises other reviewed tenant writes; no source row is written by analysis.
 perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
 perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
 if not found then raise exception using errcode='PT403',message='Workspace inactive';end if;
 select * into actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
 if actor.id is null or actor.role not in('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Current organisation authority required';end if;
 perform pg_advisory_xact_lock(hashtextextended('levytate-operations:'||p_organisation_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||p_organisation_id::text,0));
 if exists(select 1 from public.levytate_tenant_offboarding_cases where tenant_id=p_organisation_id and status in('approved','exported','deleting')) then raise exception using errcode='PT409',message='Tenant data is frozen';end if;
 command:=jsonb_build_object('family',p_family,'request',p_command);
 select * into receipt from public.levytate_intelligence_command_receipts where organisation_id=p_organisation_id and actor_user_id=p_actor_user_id and request_id=v_request_id;
 if found then
  if receipt.command is distinct from command then raise exception using errcode='PT409',message='Original request differs';end if;
  return jsonb_build_object('receipt',receipt.result);
 end if;
 select * into state from public.levytate_intelligence_workspaces where organisation_id=p_organisation_id and family=p_family;
 v_source_hash:=public.levytate_intelligence_source_hash(p_organisation_id);
 if p_prepare then return jsonb_build_object('sourceHash',v_source_hash,'revision',coalesce(state.revision,0),'signals',coalesce((select jsonb_agg(to_jsonb(s) order by id) from public.levytate_intelligence_signals s where s.organisation_id=p_organisation_id and s.analyser_version=p_family),'[]'::jsonb));end if;
 now_at:=clock_timestamp();
 if action in('analyse','refresh') then
  if p_source_hash is distinct from v_source_hash or p_workspace_revision is distinct from coalesce(state.revision,0) then raise exception using errcode='PT409',message='Source evidence or decisions changed; refresh analysis';end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>1000 then raise exception using errcode='PT422',message='Bounded analysis result required';end if;
  for row_json in select value from jsonb_array_elements(p_rows) loop
   if jsonb_typeof(row_json) is distinct from 'object' or length(row_json::text)>65536 then raise exception using errcode='PT422',message='Invalid analysed signal';end if;
   proposed:=jsonb_populate_record(null::public.levytate_intelligence_signals,row_json);
   if proposed.organisation_id is distinct from p_organisation_id or proposed.analyser_version is distinct from p_family or nullif(proposed.id,'') is null or length(proposed.id)>160 or proposed.id=any(row_ids)
    or proposed.status not in('new','acknowledged','accepted','dismissed','resolved') or proposed.status is null then raise exception using errcode='PT422',message='Invalid signal scope';end if;
   if p_family='progress-review-v1' and (proposed.entity_type<>'learner' or proposed.entity_id is distinct from proposed.learner_record_id) then raise exception using errcode='PT403',message='Learner signal identity required';end if;
   row_ids:=array_append(row_ids,proposed.id);
   select * into prior from public.levytate_intelligence_signals where organisation_id=p_organisation_id and id=proposed.id;
   if prior.id is not null and (prior.analyser_version<>p_family or prior.entity_type<>proposed.entity_type or prior.entity_id<>proposed.entity_id or prior.learner_record_id is distinct from proposed.learner_record_id) then raise exception using errcode='PT403',message='Immutable signal identity';end if;
   if prior.id is null and proposed.status<>'new' then raise exception using errcode='PT422',message='New signal cannot invent a decision';end if;
   if prior.id is not null and proposed.status not in(prior.status,'resolved') and not(proposed.status='new' and (prior.status='resolved' or (p_family='operations-autopilot-v1' and prior.fingerprint<>proposed.fingerprint))) then raise exception using errcode='PT409',message='Analysis cannot overwrite a human decision';end if;
   if proposed.entity_type='application' then
    if p_family<>'operations-autopilot-v1' or not exists(select 1 from public.levytate_applications a where a.organisation_id=p_organisation_id and a.id=proposed.entity_id) then raise exception using errcode='PT403',message='Application evidence outside tenant';end if;
   elsif proposed.entity_type='operational_action' then
    if p_family<>'operations-autopilot-v1' or not exists(select 1 from public.levytate_operational_actions o where o.organisation_id=p_organisation_id and o.id=proposed.entity_id and o.learner_record_id is not distinct from proposed.learner_record_id) then raise exception using errcode='PT403',message='Operational evidence outside tenant';end if;
   elsif proposed.learner_record_id is null or not exists(select 1 from public.levytate_learner_records l where l.organisation_id=p_organisation_id and l.id=proposed.learner_record_id and l.record_status='Active') then raise exception using errcode='PT403',message='Learner evidence outside tenant';end if;
   if jsonb_typeof(proposed.evidence) is distinct from 'array' or jsonb_array_length(proposed.evidence) not between 1 and 100 then raise exception using errcode='PT422',message='Recorded evidence required';end if;
   for evidence in select value from jsonb_array_elements(proposed.evidence) loop
    if not case evidence->>'sourceType'
     when 'application' then exists(select 1 from public.levytate_applications where organisation_id=p_organisation_id and id=evidence->>'sourceId' and id=proposed.entity_id)
     when 'operational_action' then exists(select 1 from public.levytate_operational_actions where organisation_id=p_organisation_id and id=evidence->>'sourceId' and (learner_record_id=proposed.learner_record_id or application_id=proposed.entity_id))
     when 'learning_time' then exists(select 1 from public.levytate_learner_records where organisation_id=p_organisation_id and id=evidence->>'sourceId' and id=proposed.learner_record_id)
     when 'progress_update' then exists(select 1 from public.levytate_learner_progress_updates where organisation_id=p_organisation_id and id=evidence->>'sourceId' and learner_record_id=proposed.learner_record_id)
     when 'provider_review' then exists(select 1 from public.levytate_learner_reviews where organisation_id=p_organisation_id and id=evidence->>'sourceId' and learner_record_id=proposed.learner_record_id and review_type='provider_review')
     when 'manager_check_in' then exists(select 1 from public.levytate_learner_reviews where organisation_id=p_organisation_id and id=evidence->>'sourceId' and learner_record_id=proposed.learner_record_id and review_type='manager_check_in')
     when 'l_and_d_check_in' then exists(select 1 from public.levytate_learner_reviews where organisation_id=p_organisation_id and id=evidence->>'sourceId' and learner_record_id=proposed.learner_record_id and review_type='l_and_d_check_in')
     when 'learner_review' then exists(select 1 from public.levytate_learner_reviews where organisation_id=p_organisation_id and id=evidence->>'sourceId' and learner_record_id=proposed.learner_record_id)
     else false end then raise exception using errcode='PT403',message='Signal evidence outside current source';end if;
   end loop;
   proposed.revision:=coalesce(prior.revision,0)+1;proposed.source_hash:=v_source_hash;
   proposed.created_at:=coalesce(prior.created_at,now_at);proposed.updated_at:=now_at;proposed.last_evaluated_at:=now_at;proposed.detected_at:=coalesce(prior.detected_at,now_at);
   if proposed.linked_operational_action_id is not null and not exists(select 1 from public.levytate_operational_actions o where o.organisation_id=p_organisation_id and o.id=proposed.linked_operational_action_id and (o.learner_record_id=proposed.learner_record_id or o.application_id=proposed.entity_id or (proposed.entity_type='operational_action' and o.id=proposed.entity_id))) then raise exception using errcode='PT403',message='Linked action outside signal source';end if;
   proposed.linked_operational_action_id:=coalesce(prior.linked_operational_action_id,proposed.linked_operational_action_id);
   proposed.acknowledged_by:=coalesce(prior.acknowledged_by,'');proposed.acknowledged_at:=prior.acknowledged_at;
   proposed.dismissed_by:=case when proposed.status='new' then '' else coalesce(prior.dismissed_by,'') end;proposed.dismissed_at:=case when proposed.status='new' then null else prior.dismissed_at end;proposed.dismissal_reason:=case when proposed.status='new' then '' else coalesce(prior.dismissal_reason,'') end;
   proposed.resolved_at:=case when proposed.status='resolved' then coalesce(prior.resolved_at,now_at) else null end;
   proposed.signal_key:=coalesce(proposed.signal_key,'');proposed.lane:=coalesce(proposed.lane,'');proposed.autopilot_priority:=coalesce(proposed.autopilot_priority,'');proposed.deterministic_payload:=coalesce(proposed.deterministic_payload,'{}');proposed.communication_draft:=coalesce(proposed.communication_draft,'');proposed.suggested_action_type:=coalesce(proposed.suggested_action_type,'');
   if prior.id is null then insert into public.levytate_intelligence_signals select proposed.*;
   else
    update public.levytate_intelligence_signals set linked_operational_action_id=proposed.linked_operational_action_id,fingerprint=proposed.fingerprint,category=proposed.category,signal_type=proposed.signal_type,title=proposed.title,summary=proposed.summary,evidence=proposed.evidence,confidence=proposed.confidence,priority=proposed.priority,recommended_action=proposed.recommended_action,suggested_owner_type=proposed.suggested_owner_type,suggested_due_date=proposed.suggested_due_date,status=proposed.status,model_identifier=proposed.model_identifier,last_evaluated_at=now_at,resolved_at=proposed.resolved_at,dismissed_by=proposed.dismissed_by,dismissed_at=proposed.dismissed_at,dismissal_reason=proposed.dismissal_reason,updated_at=now_at,revision=proposed.revision,source_hash=v_source_hash,lane=proposed.lane,autopilot_priority=proposed.autopilot_priority,deterministic_payload=proposed.deterministic_payload,ai_interpretation=proposed.ai_interpretation,communication_draft=proposed.communication_draft,suggested_action_type=proposed.suggested_action_type where organisation_id=p_organisation_id and id=proposed.id;
   end if;
   event_type:=case when prior.id is null then 'detected' when proposed.status='resolved' and prior.status<>'resolved' then 'resolved' when proposed.fingerprint<>prior.fingerprint then 'regenerated' else 'updated' end;
   insert into public.levytate_intelligence_signal_events(organisation_id,id,signal_id,event_type,previous_status,new_status,actor_user_id,actor_name,summary,metadata)
    values(p_organisation_id,gen_random_uuid()::text,proposed.id,event_type,coalesce(prior.status,''),proposed.status,actor.id::text,actor.email,'Signal evidence reconciled atomically.',jsonb_build_object('revision',proposed.revision,'requestId',v_request_id));
  end loop;
  if exists(select 1 from public.levytate_intelligence_signals where organisation_id=p_organisation_id and analyser_version=p_family and not id=any(row_ids)) then raise exception using errcode='PT409',message='Analysis omitted existing evidence';end if;
 else
  select * into signal from public.levytate_intelligence_signals where organisation_id=p_organisation_id and id=p_command->>'signalId' and analyser_version=p_family for update;
  if signal.id is null then raise exception using errcode='PT404',message='Signal unavailable';end if;
  if signal.revision<>(p_command->>'expectedRevision')::integer or signal.source_hash is distinct from v_source_hash or signal.status in('dismissed','resolved') then raise exception using errcode='PT409',message='Signal or source changed; refresh';end if;
  if signal.status='accepted' or (signal.status='acknowledged' and action='acknowledge') then raise exception using errcode='PT409',message='Signal decision already recorded';end if;
  if action='dismiss' and (jsonb_typeof(p_command->'reason') is distinct from 'string' or length(btrim(p_command->>'reason')) not between 1 and 4000 or (p_family='progress-review-v1' and p_command->>'reason' not in('Already resolved','Incorrect interpretation','No action required','Planned intervention already exists','Other'))) then raise exception using errcode='PT422',message='Explicit dismissal reason required';end if;
  if action in('accept','create_action') then
   if signal.confidence='Low' then raise exception using errcode='PT409',message='Low confidence evidence cannot create an action';end if;
   if signal.linked_operational_action_id is not null then
    select * into existing_action from public.levytate_operational_actions where organisation_id=p_organisation_id and id=signal.linked_operational_action_id and status in('open','acknowledged','in_progress');
   end if;
   if signal.learner_record_id is not null then
    select * into learner from public.levytate_learner_records where organisation_id=p_organisation_id and id=signal.learner_record_id and record_status='Active';
    select * into employee from public.levytate_employees where organisation_id=p_organisation_id and id=learner.employee_id and status='Active';source_version:=learner.updated_at;
   elsif p_family='operations-autopilot-v1' and (signal.entity_type='application' or existing_action.id is not null) then
    select * into application from public.levytate_applications where organisation_id=p_organisation_id and id=case when signal.entity_type='application' then signal.entity_id else existing_action.application_id end;
    select * into employee from public.levytate_employees where organisation_id=p_organisation_id and id=application.employee_id and status='Active';source_version:=application.updated_at;
   end if;
   if employee.id is null then raise exception using errcode='PT403',message='Active same-tenant source required';end if;
   owner_type:=case when action='accept' then coalesce(nullif(signal.suggested_owner_type,''),'Apprenticeship Lead') else p_command->>'ownerType' end;
   title:=case when action='accept' then signal.title else btrim(p_command->>'title') end;
   due_date:=case when action='accept' then signal.suggested_due_date else nullif(p_command->>'dueDate','')::date end;
   action_type:=case when action='accept' then 'address_progress_exception' else signal.suggested_action_type end;
   if owner_type is null or owner_type not in('Employee','Line Manager','Apprenticeship Lead','HR','Provider','Shared') or title is null or length(title) not between 1 and 300 or (action='create_action' and ((existing_action.id is null and action_type not in('record_provider_review','record_l_and_d_check_in','record_manager_check_in','review_application','confirm_provider')) or jsonb_typeof(p_command->'communicationDraft') is distinct from 'string' or length(p_command->>'communicationDraft')>4000)) then raise exception using errcode='PT422',message='Invalid proposed action';end if;
   owner_id:='';
   if owner_type='Apprenticeship Lead' then owner_id:=actor.id::text;
   elsif owner_type='Line Manager' then
    select * into manager from public.levytate_employees where organisation_id=p_organisation_id and id=employee.manager_id and status='Active' and platform_role='Line Manager';
    select min(id::text) into owner_id from public.levytate_users where organisation_id=p_organisation_id and active and role='Line Manager' and lower(btrim(email))=lower(btrim(manager.email)) having count(*)=1;
   elsif owner_type='Employee' then select min(id::text) into owner_id from public.levytate_users where organisation_id=p_organisation_id and active and lower(btrim(email))=lower(btrim(employee.email)) having count(*)=1;end if;
   if owner_type in('Employee','Line Manager') and owner_id is null then raise exception using errcode='PT403',message='Unique current action owner required';end if;
   metadata:=jsonb_build_object('sourceCondition',case when action='accept' then 'intelligence_signal_accepted' else 'autopilot_signal_accepted' end,'signalId',signal.id,'signalFingerprint',signal.fingerprint,'communicationDraft',coalesce(p_command->>'communicationDraft',''),'communicationSent',false);
   if action_type='review_application' then
    if application.id is null or owner_type<>'Line Manager' or manager.id is null or manager.id=employee.id or owner_id is null or application.status not in('Submitted to Line Manager','Awaiting Manager Review') or application.current_owner<>'Line Manager' then raise exception using errcode='PT409',message='Current distinct manager review required';end if;
    select o.* into existing_action from public.levytate_operational_actions o where o.organisation_id=p_organisation_id and o.application_id=application.id and o.employee_id=employee.id and o.action_type='review_application' and status in('open','acknowledged','in_progress') order by id limit 1;
    with history as(select id,status,created_at,lag(status)over(order by created_at,id)prior_status from public.levytate_application_history where organisation_id=p_organisation_id and application_id=application.id)
     select id into occurrence from history where status in('Submitted to Line Manager','Awaiting Manager Review') and coalesce(prior_status,'') not in('Submitted to Line Manager','Awaiting Manager Review') order by created_at desc,id desc limit 1;
    metadata:=metadata||jsonb_build_object('sourceCondition','manager_review_required','occurrenceId',occurrence);
   elsif signal.linked_operational_action_id is not null then select * into existing_action from public.levytate_operational_actions where organisation_id=p_organisation_id and id=signal.linked_operational_action_id and employee_id=employee.id and status in('open','acknowledged','in_progress');end if;
   if existing_action.id is not null then
    if existing_action.employee_id<>employee.id or existing_action.owner_type<>owner_type or (action_type='review_application' and existing_action.owner_user_id<>owner_id) then raise exception using errcode='PT409',message='Existing action authority changed';end if;
    action_id:=existing_action.id;reused:=true;
   else
    action_id:='action-'||signal.id||'-'||(signal.revision+1)::text;
    action_result:=public.levytate_apply_operational_action(p_organisation_id,p_actor_user_id,action_id,0,'create',jsonb_build_object(
     'organisation_id',p_organisation_id,'id',action_id,'learner_record_id',learner.id,'application_id',coalesce(application.id,learner.application_id,''),'employee_id',employee.id,
     'source_type',case when action='accept' then 'progress_exception' when signal.entity_type='application' then 'application_workflow' else 'review_due' end,
     'source_key',case when action='accept' then 'intelligence:'||signal.fingerprint else 'autopilot:'||signal.signal_key end,'action_type',action_type,'title',title,'description',coalesce(nullif(signal.recommended_action,''),signal.summary),
     'priority',signal.priority,'priority_rank',case signal.priority when 'Critical' then 0 when 'High' then 1 when 'Medium' then 2 else 3 end,'status','open','owner_type',owner_type,'owner_user_id',coalesce(owner_id,''),'owner_display_name',case when owner_id=actor.id::text then actor.email else owner_type end,
     'due_date',due_date,'source_url','/levytate/app?module=Operations','metadata',metadata,'version',1),source_version,'Human-approved Intelligence action.');
    action_id:=action_result->>'id';
   end if;
  end if;
  update public.levytate_intelligence_signals set status=case action when 'dismiss' then 'dismissed' when 'acknowledge' then 'acknowledged' else 'accepted' end,
   revision=revision+1,updated_at=now_at,linked_operational_action_id=coalesce(action_id,linked_operational_action_id),
   acknowledged_by=case when action='acknowledge' then actor.id::text else acknowledged_by end,acknowledged_at=case when action='acknowledge' then now_at else acknowledged_at end,
   dismissed_by=case when action='dismiss' then actor.id::text else dismissed_by end,dismissed_at=case when action='dismiss' then now_at else dismissed_at end,dismissal_reason=case when action='dismiss' then p_command->>'reason' else dismissal_reason end,
   lane=case when action='create_action' then case when owner_type='Provider' then 'waiting_externally' else 'ready_to_action' end else lane end,
   source_hash=public.levytate_intelligence_source_hash(p_organisation_id)
   where organisation_id=p_organisation_id and id=signal.id returning * into proposed;
  insert into public.levytate_intelligence_signal_events(organisation_id,id,signal_id,event_type,previous_status,new_status,actor_user_id,actor_name,summary,metadata)
   values(p_organisation_id,gen_random_uuid()::text,signal.id,proposed.status,signal.status,proposed.status,actor.id::text,actor.email,'Human signal decision committed atomically.',jsonb_build_object('revision',proposed.revision,'requestId',v_request_id));
 end if;
 insert into public.levytate_intelligence_workspaces(organisation_id,family,revision,reconciled_at)values(p_organisation_id,p_family,coalesce(state.revision,0)+1,case when action in('analyse','refresh') then now_at else state.reconciled_at end)
 on conflict(organisation_id,family)do update set revision=excluded.revision,reconciled_at=excluded.reconciled_at returning * into state;
 confirmation:=jsonb_build_object('idempotencyKey',v_request_id,'action',action,'organisationId',p_organisation_id,'userEmail',actor.email,'role',actor.role,'signalId',case when action in('analyse','refresh') then null else proposed.id end,'revision',case when action in('analyse','refresh') then state.revision else proposed.revision end);
 result:=jsonb_build_object('signals',coalesce((select jsonb_agg(to_jsonb(s) order by id) from public.levytate_intelligence_signals s where s.organisation_id=p_organisation_id and s.analyser_version=p_family),'[]'::jsonb),
 'state',to_jsonb(state),'learnerCount',(select count(*) from public.levytate_learner_records where organisation_id=p_organisation_id and record_status='Active'),'signal',case when action in('analyse','refresh') then null else to_jsonb(proposed) end,'confirmation',confirmation,'operationalActionId',action_id,'reused',reused);
 insert into public.levytate_audit_events(organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata) values(p_organisation_id,actor.email,actor.role,'intelligence',coalesce(proposed.id,p_family),'intelligence.'||action,'Signal state, history and receipt committed atomically.',jsonb_build_object('requestId',v_request_id,'revision',state.revision));
 insert into public.levytate_intelligence_command_receipts(organisation_id,actor_user_id,request_id,command,result)values(p_organisation_id,p_actor_user_id,v_request_id,command,result);
 return jsonb_build_object('receipt',result);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow or not_null_violation or check_violation then raise exception using errcode='PT422',message='Invalid Intelligence field';
end $$;
revoke all on function public.levytate_apply_intelligence_command(uuid,uuid,text,jsonb,boolean,text,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_intelligence_command(uuid,uuid,text,jsonb,boolean,text,integer,jsonb) to service_role;

-- Keep new records inside the fail-closed tenant export/freeze/disposal inventory.
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
('levytate_intelligence_workspaces','learners'),
('levytate_intelligence_command_receipts','learners'),
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
create trigger levytate_offboarding_freeze before insert or update or delete on public.levytate_intelligence_workspaces for each row execute function public.levytate_offboarding_freeze();
create trigger levytate_offboarding_foreign_boundary before insert or update or delete on public.levytate_intelligence_workspaces for each row execute function public.levytate_offboarding_foreign_boundary();
create trigger levytate_offboarding_freeze before insert or update or delete on public.levytate_intelligence_command_receipts for each row execute function public.levytate_offboarding_freeze();
create trigger levytate_offboarding_foreign_boundary before insert or update or delete on public.levytate_intelligence_command_receipts for each row execute function public.levytate_offboarding_foreign_boundary();

-- Required core workflow compatibility; no business-data probe.
create or replace function public.levytate_required_client_contracts() returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('version','20261110090943','available',
  coalesce((select bool_and(coalesce(has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE'),false)
   and not coalesce(has_function_privilege('anon',to_regprocedure(signature),'EXECUTE'),true)
   and not coalesce(has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'),true))
   from unnest(array[
    'public.levytate_apply_application_command(uuid,uuid,text,text,integer,text,jsonb)',
    'public.levytate_apply_learner_command(uuid,uuid,text,text,text,jsonb,integer,jsonb,jsonb,boolean)',
    'public.levytate_start_pre_enrolment(uuid,uuid,text,integer,text,jsonb)',
    'public.levytate_personal_programme_choices(uuid,jsonb)',
    'public.levytate_reactivation_command(uuid,jsonb)',
    'public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)',
    'public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean)',
    'public.levytate_apply_intelligence_command(uuid,uuid,text,jsonb,boolean,text,integer,jsonb)'
   ]) signature),false)
  and exists(select 1 from pg_index where indexrelid=to_regclass('public.levytate_applications_one_active_employee') and indisvalid and indisunique)
  and exists(select 1 from pg_class where oid=to_regclass('public.levytate_tenant_reactivation_requests') and relrowsecurity)
  and (select count(*)=3 from information_schema.columns where table_schema='public' and table_name='levytate_employee_development_profiles'
    and column_name in('saved_programme_ids','compared_programme_ids','discovery_revision'))
  and (select bool_and(coalesce(p.prosecdef and p.prokind='f'
    and encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=expected.source_sha256,false))
   from (values
    ('public.levytate_submit_otj_activity(uuid,uuid,uuid,text,integer)','f4bfbb3ef74b4fec3525dd4fbbc28075e3ef4c2e7c4f9cb18f92f3c6f48a8357'),
    ('public.levytate_transition_otj_activity(uuid,uuid,uuid,text,text,text,integer)','468400319d6b640b4f3d0172ddee42bbc5f9534337e3af025df801b6b7efef8d'),
    ('public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean)','294cb04cecb25b3a195d4cb0c808a7f8af0eb12ab2418d620ff292545f4ce645')
   ) expected(signature,source_sha256)
   left join pg_proc p on p.oid=to_regprocedure(expected.signature))
  and (select bool_and(coalesce(to_regprocedure(signature) is not null
    and not has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE')
    and not has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
    and not has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'),false))
   from unnest(array[
    'public.levytate_submit_otj_activity(uuid,uuid,uuid,text,integer)',
    'public.levytate_transition_otj_activity(uuid,uuid,uuid,text,text,text,integer)',
    'public.levytate_publish_otj_plan(uuid,uuid,uuid)',
    'public.levytate_record_otj_confirmation(uuid,uuid,uuid,text,integer,text,text,text,date,text,text)',
    'public.levytate_assert_learning_time_period(uuid,text,uuid,date)',
    'public.levytate_guard_learning_time_candidate()',
    'public.levytate_intelligence_source_hash(uuid)'
   ]) signature)
  and (select bool_and(coalesce(to_regclass(relation) is not null
    and has_table_privilege('service_role',to_regclass(relation),'SELECT')
    and not has_table_privilege('service_role',to_regclass(relation),'INSERT,UPDATE,DELETE,TRUNCATE')
    and not has_any_column_privilege('service_role',to_regclass(relation),'INSERT,UPDATE')
    and not has_table_privilege('anon',to_regclass(relation),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    and not has_any_column_privilege('anon',to_regclass(relation),'SELECT,INSERT,UPDATE')
    and not has_table_privilege('authenticated',to_regclass(relation),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    and not has_any_column_privilege('authenticated',to_regclass(relation),'SELECT,INSERT,UPDATE'),false))
   from unnest(array[
    'public.levytate_otj_plans','public.levytate_otj_plan_versions','public.levytate_otj_learning_priorities',
    'public.levytate_otj_activities','public.levytate_otj_activity_confirmations',
    'public.levytate_otj_activity_events','public.levytate_otj_command_receipts',
    'public.levytate_intelligence_signals','public.levytate_intelligence_signal_events','public.levytate_intelligence_workspaces','public.levytate_intelligence_command_receipts'
   ]) relation));
$$;
revoke all on function public.levytate_required_client_contracts() from public,anon,authenticated,service_role;
grant execute on function public.levytate_required_client_contracts() to service_role;
