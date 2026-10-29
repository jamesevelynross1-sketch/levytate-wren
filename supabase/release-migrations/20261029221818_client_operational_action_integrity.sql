-- Local-only candidate: action state, attributable history and audit share one transaction.
alter table public.levytate_operational_action_events drop constraint levytate_operational_action_events_type_check;
alter table public.levytate_operational_action_events add constraint levytate_operational_action_events_type_check check(event_type in
 ('detected','priority_changed','owner_changed','due_date_changed','acknowledged','started','completed','dismissed','cancelled','regenerated','source_refreshed'));
create table public.levytate_operational_action_receipts(
 organisation_id uuid not null,action_id text not null,expected_version integer not null,actor_user_id uuid not null references public.levytate_users(id),
 command jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(organisation_id,action_id,expected_version,actor_user_id),
 foreign key(organisation_id,action_id) references public.levytate_operational_actions(organisation_id,id)
);
alter table public.levytate_operational_action_receipts enable row level security;
revoke all on public.levytate_operational_action_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_operational_action_receipts to service_role;

create function public.levytate_apply_operational_action(
 p_organisation_id uuid,p_actor_user_id uuid,p_action_id text,p_expected_version integer,p_operation text,p_changes jsonb,p_source_version timestamptz default null,p_summary text default ''
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 actor public.levytate_users;before_row public.levytate_operational_actions;after_row public.levytate_operational_actions;
 employee public.levytate_employees;manager public.levytate_employees;learner public.levytate_learner_records;application public.levytate_applications;
 owner public.levytate_users;receipt public.levytate_operational_action_receipts;
 proposed jsonb;changes jsonb:=p_changes;command jsonb;allowed text[];cols text;sets text;k text;event_type text;event_types text[]:=array[]::text[];
 source_version timestamptz;now_at timestamptz:=clock_timestamp();target text;source_required boolean;existing_id text;review_occurrence text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then raise exception using errcode='PT403',message='Server credential required';end if;
 if p_organisation_id is null or p_actor_user_id is null or nullif(p_action_id,'') is null or length(p_action_id)>160 or p_expected_version is null or p_expected_version<0
  or p_operation is null or p_operation not in ('create','sync','transition','source_resolve','owner','due','clear') or jsonb_typeof(p_changes) is distinct from 'object' or length(p_changes::text)>32768 or p_summary is null or length(p_summary)>4000 then raise exception using errcode='PT422',message='Invalid Operations command';end if;
 perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
 perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;if not found then raise exception using errcode='PT403',message='Workspace inactive';end if;
 select * into actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
 if actor.id is null or actor.role not in ('Apprenticeship Lead','Employer Admin','Line Manager') then raise exception using errcode='PT403',message='Operations authority required';end if;
 -- Serialise source detection as well as updates. No silent duplicate cleanup.
 perform pg_advisory_xact_lock(hashtextextended('levytate-operations:'||p_organisation_id::text,0));
 select * into before_row from public.levytate_operational_actions where organisation_id=p_organisation_id and id=p_action_id;
 if p_operation='create' then
  if p_expected_version<>0 then raise exception using errcode='PT409',message='New action required';end if;
  allowed:=array['organisation_id','id','learner_record_id','application_id','employee_id','source_type','source_key','action_type','title','description','priority','priority_rank','status','owner_type','owner_user_id','owner_display_name','due_date','detected_at','source_url','metadata','version'];
  if changes->>'organisation_id' is distinct from p_organisation_id::text or changes->>'id' is distinct from p_action_id or changes->>'status' is distinct from 'open' or changes->>'version' is distinct from '1' then raise exception using errcode='PT422',message='Invalid initial action';end if;
  proposed:=changes;
 else
  if before_row.id is null then raise exception using errcode='PT404',message='Action unavailable';end if;
  allowed:=case p_operation
   when 'sync' then array['priority','priority_rank','owner_type','owner_user_id','owner_display_name','due_date','metadata','title','description','source_url','action_type']
   when 'owner' then array['owner_type','owner_user_id','owner_display_name','metadata']
   when 'due' then array['due_date','metadata'] when 'clear' then array['metadata']
   else array['status','acknowledged_at','acknowledged_by','started_at','started_by','completed_at','completed_by','completion_method','completion_note','dismissed_at','dismissed_by','dismissal_reason','metadata'] end;
  proposed:=to_jsonb(before_row)||changes;
 end if;
 for k in select jsonb_object_keys(changes) loop
  if not k=any(allowed) then raise exception using errcode='PT422',message='Unknown or immutable action field';end if;
  if k='metadata' then if jsonb_typeof(changes->k) is distinct from 'object' then raise exception using errcode='PT422',message='Action metadata must be an object';end if;
  elsif k in ('priority_rank','version') then if jsonb_typeof(changes->k) is distinct from 'number' or changes->>k !~ '^[0-9]+$' then raise exception using errcode='PT422',message='Integer action field required';end if;
  elsif k in ('learner_record_id','due_date','detected_at','acknowledged_at','started_at','completed_at','dismissed_at') and changes->k='null'::jsonb then null;
  elsif jsonb_typeof(changes->k) is distinct from 'string' then raise exception using errcode='PT422',message='Text action field required';end if;
 end loop;
 if nullif(proposed->>'employee_id','') is null or nullif(proposed->>'source_key','') is null or nullif(proposed->>'title','') is null or jsonb_typeof(proposed->'metadata'->'sourceCondition') is distinct from 'string' or nullif(proposed->'metadata'->>'sourceCondition','') is null then raise exception using errcode='PT422',message='Action identity, source condition and title required';end if;
 select * into employee from public.levytate_employees where organisation_id=p_organisation_id and id=proposed->>'employee_id' and status='Active' for update;
 if employee.id is null then raise exception using errcode='PT403',message='Active same-tenant employee required';end if;
 select * into manager from public.levytate_employees where organisation_id=p_organisation_id and id=employee.manager_id and status='Active' and platform_role='Line Manager';
 if nullif(proposed->>'learner_record_id','') is not null then
  select * into learner from public.levytate_learner_records where organisation_id=p_organisation_id and id=proposed->>'learner_record_id' and employee_id=employee.id and record_status='Active' for update;
  if learner.id is null or coalesce(proposed->>'application_id','') is distinct from coalesce(learner.application_id,'') then raise exception using errcode='PT403',message='Learner identity mismatch';end if;
  source_version:=learner.updated_at;
 elsif proposed->>'action_type'<>'review_application' then raise exception using errcode='PT422',message='Learner source required';end if;
 if proposed->>'action_type'='review_application' then
  select * into application from public.levytate_applications where organisation_id=p_organisation_id and id=proposed->>'application_id' and employee_id=employee.id for update;
  if application.id is null then raise exception using errcode='PT403',message='Application identity mismatch';end if;
  source_version:=application.updated_at;
 end if;
 if actor.role='Line Manager' and (manager.id is null or lower(btrim(manager.email))<>lower(btrim(actor.email)) or employee.id=manager.id or not
  ((proposed->>'owner_type'='Line Manager' and proposed->>'action_type' in ('review_application','confirm_probation','record_manager_check_in','obtain_manager_readiness_confirmation') and coalesce(proposed->>'owner_user_id','') in ('',actor.id::text))
   or (proposed->>'owner_type'='Shared' and coalesce(proposed->>'owner_user_id','')='' and proposed->>'action_type'='address_progress_exception' and proposed->'metadata'->>'sourceCondition'='support_intervention:manager_check_in'))
 ) then raise exception using errcode='PT403',message='Current direct-report action required';end if;
 if actor.role='Line Manager' and (p_operation in ('owner','due','clear') or (p_operation='transition' and proposed->>'status' not in ('acknowledged','in_progress'))) then raise exception using errcode='PT403',message='Manager action not authorised';end if;
 if nullif(proposed->>'owner_user_id','') is not null then
  select * into owner from public.levytate_users where organisation_id=p_organisation_id and id=(proposed->>'owner_user_id')::uuid and active;
  if owner.id is null or (proposed->>'owner_type'='Line Manager' and (owner.role<>'Line Manager' or lower(btrim(owner.email)) is distinct from lower(btrim(manager.email))))
   or (proposed->>'owner_type'='Employee' and lower(btrim(owner.email))<>lower(btrim(employee.email)))
   or (proposed->>'owner_type'='Apprenticeship Lead' and owner.role not in ('Apprenticeship Lead','Employer Admin'))
   or (proposed->>'owner_type'='HR' and not exists(select 1 from public.levytate_employees e where e.organisation_id=p_organisation_id and e.status='Active' and lower(btrim(e.email))=lower(btrim(owner.email)) and e.department~*'^(hr|people)'))
   or (proposed->>'owner_type' in ('Shared','Provider')) then raise exception using errcode='PT403',message='Action owner is outside current authority';end if;
 end if;
 -- Receipt lookup happens after current tenant, People and hierarchy checks.
 -- Timestamps are server-authored, not part of retry identity.
 command:=jsonb_build_object('operation',p_operation,'changes',changes-array['detected_at','acknowledged_at','started_at','completed_at','dismissed_at']);
 for k in select unnest(array['ownershipOverride','dueDateOverride','cancellation']) loop
  if command->'changes'->'metadata' ? k then command:=jsonb_set(command,array['changes','metadata',k],(command->'changes'->'metadata'->k)-array['assignedAt','setAt','cancelledAt']);end if;
 end loop;
 select * into receipt from public.levytate_operational_action_receipts where organisation_id=p_organisation_id and action_id=p_action_id and expected_version=p_expected_version and actor_user_id=p_actor_user_id;
 if found then if receipt.command<>command then raise exception using errcode='PT409',message='Action retry payload differs';end if;return receipt.result;end if;
 source_required:=p_operation in ('create','sync','source_resolve','due','clear') or (p_operation='transition' and proposed->>'status'='completed');
 if source_required and (p_source_version is null or source_version is distinct from p_source_version) then raise exception using errcode='PT409',message='Source evidence changed; refresh';end if;
 if p_operation='create' then
  if before_row.id is not null then raise exception using errcode='PT409',message='Action identity already exists';end if;
  select id into existing_id from public.levytate_operational_actions where organisation_id=p_organisation_id and source_key=proposed->>'source_key' and status in ('open','acknowledged','in_progress');
  if existing_id is not null then return (select to_jsonb(t) from public.levytate_operational_actions t where organisation_id=p_organisation_id and id=existing_id and employee_id=employee.id and application_id=proposed->>'application_id');end if;
  if nullif(proposed->'metadata'->>'priorActionId','') is not null and not exists(select 1 from public.levytate_operational_actions where organisation_id=p_organisation_id and id=proposed->'metadata'->>'priorActionId' and employee_id=employee.id and status in ('completed','dismissed','cancelled')) then raise exception using errcode='PT403',message='Prior action is outside terminal source scope';end if;
  changes:=changes||jsonb_build_object('detected_at',now_at);
 else
  select * into before_row from public.levytate_operational_actions where organisation_id=p_organisation_id and id=p_action_id for update;
  if before_row.version<>p_expected_version then raise exception using errcode='PT409',message='Action revision changed';end if;
  if p_operation='clear' then
   if before_row.status<>'dismissed' or ((changes->'metadata')-'conditionClearedAt') is distinct from (before_row.metadata-'conditionClearedAt') or nullif(changes->'metadata'->>'conditionClearedAt','') is null then raise exception using errcode='PT409',message='Only a dismissed source may be cleared';end if;
  elsif before_row.status in ('completed','dismissed','cancelled') then raise exception using errcode='PT409',message='Terminal action is immutable';end if;
  if p_operation in ('transition','source_resolve') then
   target:=changes->>'status';
   if target is null or target=before_row.status or target not in ('acknowledged','in_progress','completed','dismissed','cancelled') or (target='acknowledged' and before_row.status<>'open') then raise exception using errcode='PT409',message='Invalid action transition';end if;
   if before_row.action_type='review_application' and target in ('completed','dismissed','cancelled') and p_operation<>'source_resolve' then raise exception using errcode='PT403',message='Application approval workflow controls resolution';end if;
   if target in ('dismissed','cancelled') and p_operation<>'source_resolve' and before_row.priority='Critical' and coalesce(before_row.metadata->>'sourceCondition',before_row.source_key)~'(eligibility_not_eligible|hr_declined|probation_not_passed|lifecycle_inconsistent)' then raise exception using errcode='PT403',message='Critical compliance blocker cannot be hidden';end if;
   if target='completed' and p_operation='transition' and (changes->>'completion_method' is distinct from 'user_completed' or length(btrim(coalesce(changes->>'completion_note','')))<12) then raise exception using errcode='PT422',message='Explicit completion evidence required';end if;
   if target='dismissed' and (changes->>'completion_method' is distinct from 'dismissed' or length(btrim(coalesce(changes->>'dismissal_reason','')))<12) then raise exception using errcode='PT422',message='Dismissal evidence required';end if;
   if target='cancelled' and length(btrim(coalesce(changes->>'completion_note','')))<12 then raise exception using errcode='PT422',message='Cancellation evidence required';end if;
   if target in ('acknowledged','in_progress') and changes ?| array['completed_at','completed_by','completion_method','completion_note','dismissed_at','dismissed_by','dismissal_reason'] then raise exception using errcode='PT403',message='Unrelated terminal evidence denied';end if;
   if p_operation='source_resolve' and (target not in ('completed','cancelled') or (target='completed' and changes->>'completion_method' is distinct from 'source_condition_resolved')) then raise exception using errcode='PT422',message='Source resolution method required';end if;
   if target='acknowledged' then changes:=changes||jsonb_build_object('acknowledged_at',now_at,'acknowledged_by',actor.id::text);
   elsif target='in_progress' then changes:=changes||jsonb_build_object('started_at',now_at,'started_by',actor.id::text);
   elsif target='dismissed' then changes:=changes||jsonb_build_object('dismissed_at',now_at,'dismissed_by',actor.id::text);
   else changes:=changes||jsonb_build_object('completed_at',now_at,'completed_by',actor.id::text);end if;
  end if;
  if changes ? 'metadata' and (changes->'metadata'->>'sourceCondition' is distinct from before_row.metadata->>'sourceCondition' or changes->'metadata'->>'priorActionId' is distinct from before_row.metadata->>'priorActionId') then raise exception using errcode='PT403',message='Immutable source metadata';end if;
  allowed:=case p_operation when 'owner' then array['ownershipOverride'] when 'due' then array['dueDateOverride'] when 'sync' then array['dueDateOverride'] when 'clear' then array['conditionClearedAt'] when 'transition' then array['managerStartNote','dismissalKind','dismissalSuppressesUntilConditionClears','cancellation'] else array[]::text[] end;
  if changes ? 'metadata' and ((changes->'metadata')-allowed) is distinct from (before_row.metadata-allowed) then raise exception using errcode='PT403',message='Metadata outside operation scope';end if;
  changes:=changes||jsonb_build_object('version',before_row.version+1);
 end if;
 if proposed->>'action_type'='review_application' then
  with history as (select id,status,created_at,lag(status) over(order by created_at,id) prior_status from public.levytate_application_history where organisation_id=p_organisation_id and application_id=application.id)
  select id into review_occurrence from history where status in ('Submitted to Line Manager','Awaiting Manager Review') and coalesce(prior_status,'') not in ('Submitted to Line Manager','Awaiting Manager Review') order by created_at desc,id desc limit 1;
  if p_operation in ('create','sync') and (application.status not in ('Submitted to Line Manager','Awaiting Manager Review') or application.current_owner<>'Line Manager' or manager.id is null or proposed->>'owner_type'<>'Line Manager' or owner.id is null or (review_occurrence is not null and proposed->'metadata'->>'occurrenceId' is distinct from review_occurrence)) then raise exception using errcode='PT409',message='Current manager review occurrence required';end if;
  if p_operation='source_resolve' and application.status in ('Submitted to Line Manager','Awaiting Manager Review') and application.current_owner='Line Manager' and (review_occurrence is null or proposed->'metadata'->>'occurrenceId'=review_occurrence) then raise exception using errcode='PT409',message='Application still needs its current manager review';end if;
 end if;
 select string_agg(format('%I',key),','),string_agg(format('%I=x.%I',key,key),',') into cols,sets from jsonb_object_keys(changes) key;
 if p_operation='create' then execute format('insert into public.levytate_operational_actions(%s) select %s from jsonb_populate_record(null::public.levytate_operational_actions,$1) returning *',cols,cols) into after_row using changes;
 else execute format('update public.levytate_operational_actions t set %s from jsonb_populate_record(null::public.levytate_operational_actions,$1) x where t.organisation_id=$2 and t.id=$3 returning t.*',sets) into after_row using changes,p_organisation_id,p_action_id;end if;
 if p_operation='create' then event_types:=array['detected'];if after_row.metadata ? 'priorActionId' then event_types:=event_types||'regenerated';end if;
 else
  if after_row.status<>before_row.status then event_types:=event_types||(case after_row.status when 'in_progress' then 'started' else after_row.status end);end if;
  if after_row.priority<>before_row.priority or after_row.priority_rank<>before_row.priority_rank then event_types:=event_types||'priority_changed';end if;
  if (after_row.owner_type,after_row.owner_user_id,after_row.owner_display_name) is distinct from (before_row.owner_type,before_row.owner_user_id,before_row.owner_display_name) then event_types:=event_types||'owner_changed';end if;
  if after_row.due_date is distinct from before_row.due_date then event_types:=event_types||'due_date_changed';end if;
  if cardinality(event_types)=0 then event_types:=array['source_refreshed'];end if;
 end if;
 foreach event_type in array event_types loop
  insert into public.levytate_operational_action_events(organisation_id,id,operational_action_id,event_type,previous_status,new_status,actor_user_id,actor_name,event_date,summary,metadata)
   values(p_organisation_id,p_action_id||':'||after_row.version::text||':'||event_type,p_action_id,event_type,coalesce(before_row.status,''),after_row.status,actor.id::text,actor.email,now_at,coalesce(nullif(p_summary,''),'Operations state committed.'),jsonb_build_object('operation',p_operation,'sourceVersion',p_source_version));
 end loop;
 insert into public.levytate_audit_events(organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata) values(p_organisation_id,actor.email,actor.role,'operational_action',p_action_id,'operations.'||p_operation,'Operations state and history committed atomically.',jsonb_build_object('version',after_row.version));
 insert into public.levytate_operational_action_receipts(organisation_id,action_id,expected_version,actor_user_id,command,result) values(p_organisation_id,p_action_id,p_expected_version,p_actor_user_id,command,to_jsonb(after_row));
 return to_jsonb(after_row);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow or not_null_violation or check_violation then raise exception using errcode='PT422',message='Invalid Operations field';
end $$;
revoke all on function public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text) to service_role;
revoke insert,update,delete,truncate on public.levytate_operational_actions,public.levytate_operational_action_events from service_role;
