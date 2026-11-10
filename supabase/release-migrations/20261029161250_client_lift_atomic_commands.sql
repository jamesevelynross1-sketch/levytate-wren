-- Local-only candidate. Does not enable Lift or change any approved bootstrap.
create table public.levytate_lift_workspace_revisions (
 organisation_id uuid primary key references public.levytate_organisations(id),
 revision integer not null default 0 check(revision>=0)
);
create table public.levytate_lift_command_receipts (
 organisation_id uuid not null references public.levytate_organisations(id),
 actor_user_id uuid not null references public.levytate_users(id),
 request_id text not null,
 command jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(organisation_id,actor_user_id,request_id)
);
alter table public.levytate_lift_workspace_revisions enable row level security;
alter table public.levytate_lift_command_receipts enable row level security;
revoke all on public.levytate_lift_workspace_revisions,public.levytate_lift_command_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_lift_workspace_revisions,public.levytate_lift_command_receipts to service_role;

create function public.levytate_apply_lift_command(p_organisation_id uuid,p_actor_user_id uuid,p_command jsonb,p_probe boolean,p_writes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_actor public.levytate_users; v_employee public.levytate_employees;
 v_assessment public.levytate_lift_assessments; v_observation public.levytate_lift_manager_observations;
 v_proof public.levytate_lift_proof_records; v_opportunity public.levytate_lift_opportunities;
 v_receipt public.levytate_lift_command_receipts;
 v_action text:=p_command->>'action'; v_request text:=p_command->>'idempotencyKey';
 v_revision integer; v_expected integer; v_campaign uuid; v_participant uuid; v_subject text;
 v_write jsonb; v_row jsonb; v_old jsonb; v_key jsonb; v_table text; v_kind text;
 v_allowed text[]; v_columns text; v_select text; v_sets text; v_count integer;
 v_baseline public.levytate_lift_evidence_records; v_outcome public.levytate_lift_evidence_records;
 v_before_state text; v_after_state text; v_result jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then raise exception using errcode='PT403',message='Server credential required';end if;
 if p_organisation_id is null or p_actor_user_id is null or p_probe is null
  or jsonb_typeof(p_command) is distinct from 'object' or jsonb_typeof(p_writes) is distinct from 'array'
  or v_action is null or v_action not in ('invite_people','save_assessment','submit_assessment','save_team_context','save_manager_perspective','submit_manager_perspective','add_manager_perspective_addendum','record_employee_context','record_decision','record_proof')
  or v_request is null or v_request !~ '^[A-Za-z0-9:_-]{8,128}$'
  or jsonb_typeof(p_command->'expectedWorkspaceRevision') is distinct from 'number'
  or (p_command->>'expectedWorkspaceRevision') !~ '^[0-9]{1,9}$'
  or jsonb_array_length(p_writes)>6000 then raise exception using errcode='PT422',message='Invalid Lift command'; end if;
 v_expected:=(p_command->>'expectedWorkspaceRevision')::integer;
 -- Shared People/catalogue lock order protects manager assignment during the command.
 perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
 select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
 if not found or v_actor.role not in ('Employee','Line Manager','Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Active employer membership required'; end if;
 perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
 if not found then raise exception using errcode='PT403',message='Workspace inactive'; end if;
 perform 1 from public.levytate_organisation_capabilities where organisation_id=p_organisation_id and lift_enabled for share;
 if not found then raise exception using errcode='PT404',message='Lift disabled'; end if;
 insert into public.levytate_lift_workspace_revisions(organisation_id) values(p_organisation_id) on conflict do nothing;
 select revision into v_revision from public.levytate_lift_workspace_revisions where organisation_id=p_organisation_id for update;
 select * into v_receipt from public.levytate_lift_command_receipts where organisation_id=p_organisation_id and actor_user_id=p_actor_user_id and request_id=v_request;
 if found then
  if v_receipt.command<>p_command then raise exception using errcode='PT409',message='Retry key conflicts'; end if;
  return v_receipt.result;
 end if;
 if p_probe then return null; end if;
 if v_revision<>v_expected then raise exception using errcode='PT409',message='Lift workspace changed'; end if;
 if jsonb_array_length(p_writes)=0 then raise exception using errcode='PT409',message='No current evidence to change'; end if;
 if (select count(*) from public.levytate_employees where organisation_id=p_organisation_id and status='Active' and lower(btrim(email))=lower(btrim(v_actor.email)))<>1 then
  if v_actor.role in ('Employee','Line Manager') or v_action in ('save_assessment','submit_assessment','record_employee_context') then raise exception using errcode='PT403',message='Unique active employee required'; end if;
 else
  select * into v_employee from public.levytate_employees where organisation_id=p_organisation_id and status='Active' and lower(btrim(email))=lower(btrim(v_actor.email)) for share;
 end if;
 if v_action in ('invite_people','record_decision','record_proof') and v_actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Lead permission required'; end if;
 if v_action in ('save_team_context','save_manager_perspective','submit_manager_perspective','add_manager_perspective_addendum') and (v_actor.role<>'Line Manager' or v_employee.platform_role<>'Line Manager') then raise exception using errcode='PT403',message='Current manager required'; end if;
 if v_action in ('save_assessment','submit_assessment') then
  select * into v_assessment from public.levytate_lift_assessments where organisation_id=p_organisation_id and id=(p_command->>'assessmentId')::uuid and employee_id=v_employee.id for update;
  if not found then raise exception using errcode='PT403',message='Own assessment required'; end if;
  if v_assessment.status<>'draft' or (p_command->>'expectedRevision')::integer is distinct from v_assessment.current_revision then raise exception using errcode='PT409',message='Assessment immutable or stale'; end if;
  v_campaign:=v_assessment.campaign_id;v_participant:=v_assessment.participant_id;v_subject:=v_assessment.employee_id;
  select * into v_observation from public.levytate_lift_manager_observations where organisation_id=p_organisation_id and participant_id=v_participant and status in ('draft','submitted','released');
 elsif v_action in ('save_manager_perspective','submit_manager_perspective','add_manager_perspective_addendum') then
  perform 1 from public.levytate_employees where organisation_id=p_organisation_id and id=p_command->>'employeeId' and status='Active' and manager_id=v_employee.id and id<>v_employee.id for share;
  if not found then raise exception using errcode='PT403',message='Current direct report required'; end if;
  select * into v_observation from public.levytate_lift_manager_observations where organisation_id=p_organisation_id and employee_id=p_command->>'employeeId' and manager_employee_id=v_employee.id and status in ('draft','submitted','released') order by created_at desc,id limit 1 for update;
  if not found then raise exception using errcode='PT404',message='Observation unavailable'; end if;
  if (v_action='add_manager_perspective_addendum' and v_observation.status<>'released') or (v_action<>'add_manager_perspective_addendum' and (v_observation.status<>'draft' or (p_command->>'expectedRevision')::integer is distinct from v_observation.current_revision)) then raise exception using errcode='PT409',message='Observation immutable or stale'; end if;
  v_campaign:=v_observation.campaign_id;v_participant:=v_observation.participant_id;v_subject:=v_observation.employee_id;
  select * into v_assessment from public.levytate_lift_assessments where organisation_id=p_organisation_id and participant_id=v_participant;
 elsif v_action='record_employee_context' then
  select * into v_observation from public.levytate_lift_manager_observations where organisation_id=p_organisation_id and id=(p_command->>'managerObservationId')::uuid and employee_id=v_employee.id and status='released';
  if not found then raise exception using errcode='PT403',message='Own released observation required'; end if;
  v_campaign:=v_observation.campaign_id;v_subject:=v_employee.id;
 elsif v_action in ('record_decision','record_proof') then
  select * into v_opportunity from public.levytate_lift_opportunities where organisation_id=p_organisation_id and id=(p_command->>'opportunityId')::uuid;
  if not found then raise exception using errcode='PT404',message='Opportunity unavailable'; end if;
  v_campaign:=v_opportunity.campaign_id;
  if (select count(distinct contributor_employee_id) from public.levytate_lift_opportunity_route_members where organisation_id=p_organisation_id and opportunity_id=v_opportunity.id)<5 then raise exception using errcode='PT403',message='Aggregate privacy threshold not met'; end if;
  select * into v_proof from public.levytate_lift_proof_records where organisation_id=p_organisation_id and opportunity_id=v_opportunity.id;
  if v_action='record_proof' and coalesce(v_proof.revision,0) is distinct from (p_command->>'expectedRevision')::integer then raise exception using errcode='PT409',message='Proof changed'; end if;
 end if;

 for v_write in select value from jsonb_array_elements(p_writes) loop
  v_table:=v_write->>'table';v_kind:=v_write->>'kind';v_row:=v_write->'row';v_key:=v_write->'key';v_old:=null;
  if jsonb_typeof(v_write) is distinct from 'object' or jsonb_typeof(v_row) is distinct from 'object' or jsonb_typeof(v_key) is distinct from 'object' or v_kind is null or v_kind not in ('insert','update') then raise exception using errcode='PT422',message='Invalid Lift write'; end if;
  v_allowed:=case v_action
   when 'invite_people' then array['campaigns','participants','assessments','assessment_revisions','manager_observations','manager_observation_revisions']
   when 'save_assessment' then array['assessments','assessment_revisions']
   when 'submit_assessment' then array['assessments','assessment_revisions','participants','evidence_records','interpretations','opportunity_candidates','opportunities','opportunity_route_members','opportunity_evidence','manager_observations']
   when 'save_team_context' then array['team_context_revisions']
   when 'save_manager_perspective' then array['manager_observation_revisions']
   when 'submit_manager_perspective' then array['manager_observations','manager_observation_revisions','evidence_records','opportunity_candidates','opportunities','opportunity_route_members','opportunity_evidence']
   when 'add_manager_perspective_addendum' then array['manager_observations','manager_observation_revisions']
   when 'record_employee_context' then array['employee_observation_contexts']
   when 'record_decision' then array['decisions','decision_assumptions']
   when 'record_proof' then array['proof_records','proof_events','evidence_records'] end;
  if v_table is null or not (v_table=any(select 'levytate_lift_'||x from unnest(v_allowed) x)) then raise exception using errcode='PT403',message='Lift table not allowed'; end if;
  if exists(select 1 from jsonb_object_keys(v_row) k where not exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name=k)) then raise exception using errcode='PT422',message='Unknown Lift column'; end if;
  if v_kind='update' then
   if (select count(*) from jsonb_object_keys(v_key))<>1 or not v_key?'id' then raise exception using errcode='PT422',message='Invalid Lift row key'; end if;
   execute format('select to_jsonb(t) from public.%I t where organisation_id=$1 and id=$2::uuid for update',v_table) into v_old using p_organisation_id,v_key->>'id';
   if v_old is null then raise exception using errcode='PT409',message='Lift row changed'; end if;
   v_allowed:=case v_table
    when 'levytate_lift_assessments' then case when v_action='save_assessment' then array['current_question_index','updated_at'] else array['status','active_submission_revision','submitted_at','updated_at'] end
    when 'levytate_lift_assessment_revisions' then case when v_action='save_assessment' then array['answers','updated_at'] else array['status','submitted_at','updated_at'] end
    when 'levytate_lift_participants' then array['status','submitted_at']
    when 'levytate_lift_manager_observations' then array['status','active_submission_revision','current_revision','submitted_at','released_at','updated_at']
    when 'levytate_lift_manager_observation_revisions' then case when v_action='save_manager_perspective' then array['workflow_group_key','observed_work','observation_recency','opportunity_to_observe','support_degree','capability_observations','concrete_examples','suitable_opportunity','intended_outcome','condition_time','condition_tools','condition_access','condition_supervision','condition_suitable_work','updated_at'] else array['status','submitted_at','updated_at'] end
    when 'levytate_lift_proof_records' then array['state','baseline_evidence_id','outcome_evidence_id','agreed_scope','responsible_owner','intended_measure','reviewed_by_user_id','verification','other_relevant_changes','limitations','follow_up_at','revision'] else array[]::text[] end;
   if exists(select 1 from jsonb_object_keys(v_row) k where not k=any(v_allowed)) then raise exception using errcode='PT403',message='Immutable Lift field'; end if;
   if v_table in ('levytate_lift_assessments','levytate_lift_assessment_revisions') and (v_old->>'status'<>'draft' or (case when v_table='levytate_lift_assessments' then v_old->>'id' else v_old->>'assessment_id' end)<>v_assessment.id::text) then raise exception using errcode='PT403',message='Wrong or submitted assessment'; end if;
   if v_table='levytate_lift_assessment_revisions' and (v_old->>'revision_number')::integer is distinct from v_assessment.current_revision then raise exception using errcode='PT409',message='Current assessment revision required';end if;
   if v_table='levytate_lift_participants' and v_old->>'id'<>v_participant::text then raise exception using errcode='PT403',message='Wrong participant'; end if;
   if v_table in ('levytate_lift_manager_observations','levytate_lift_manager_observation_revisions') and ((case when v_table='levytate_lift_manager_observations' then v_old->>'id' else v_old->>'observation_id' end) is distinct from v_observation.id::text or (v_table='levytate_lift_manager_observation_revisions' and v_old->>'status'<>'draft')) then raise exception using errcode='PT403',message='Wrong or submitted observation'; end if;
   if v_table='levytate_lift_manager_observation_revisions' and (v_old->>'revision_number')::integer is distinct from v_observation.current_revision then raise exception using errcode='PT409',message='Current observation revision required';end if;
   if v_table='levytate_lift_proof_records' and v_old->>'id' is distinct from v_proof.id::text then raise exception using errcode='PT403',message='Wrong proof'; end if;
  else
   if v_row->>'organisation_id' is distinct from p_organisation_id::text then raise exception using errcode='PT403',message='Cross-tenant Lift write'; end if;
   if v_table in ('levytate_lift_campaigns','levytate_lift_participants','levytate_lift_assessments','levytate_lift_assessment_revisions','levytate_lift_manager_observations') and v_action<>'invite_people' then raise exception using errcode='PT403',message='Invitation owns identity rows';end if;
   if v_table='levytate_lift_manager_observation_revisions' and v_action not in ('invite_people','add_manager_perspective_addendum') then raise exception using errcode='PT403',message='Existing draft revision required';end if;
   if v_table='levytate_lift_proof_records' and v_proof.id is not null then raise exception using errcode='PT409',message='Existing proof must be advanced';end if;
   if v_action='invite_people' then
    if (v_table='levytate_lift_campaigns' and v_row->>'status' is distinct from 'open') or (v_table='levytate_lift_participants' and coalesce(v_row->>'status','invited')<>'invited') or (v_table not in ('levytate_lift_campaigns','levytate_lift_participants') and coalesce(v_row->>'status','draft')<>'draft') or nullif(v_row->>'active_submission_revision','') is not null or nullif(v_row->>'submitted_at','') is not null then raise exception using errcode='PT422',message='Invitations cannot fabricate completed evidence';end if;
    if v_table='levytate_lift_campaigns' then
     if v_campaign is not null then raise exception using errcode='PT422',message='One campaign required'; end if;v_campaign:=(v_row->>'id')::uuid;
     if not exists(select 1 from public.levytate_lift_framework_versions where framework_key=v_row->>'framework_key' and questionnaire_version=v_row->>'questionnaire_version' and interpretation_version=v_row->>'interpretation_version' and status in ('pilot','active')) then raise exception using errcode='PT422',message='Published framework required'; end if;
    elsif v_row?'campaign_id' and v_row->>'campaign_id' is distinct from v_campaign::text then raise exception using errcode='PT403',message='Wrong campaign'; end if;
    if v_row?'employee_id' then
     if not coalesce((p_command->'employeeIds') ? (v_row->>'employee_id'),false) or not exists(select 1 from public.levytate_employees where organisation_id=p_organisation_id and id=v_row->>'employee_id' and status='Active') then raise exception using errcode='PT403',message='Active selected employee required'; end if;
     if nullif(v_row->>'manager_employee_id','') is not null and not exists(select 1 from public.levytate_employees e join public.levytate_employees m on m.organisation_id=e.organisation_id and m.id=e.manager_id where e.organisation_id=p_organisation_id and e.id=v_row->>'employee_id' and m.id=v_row->>'manager_employee_id' and m.status='Active' and m.platform_role='Line Manager' and e.id<>m.id) then raise exception using errcode='PT403',message='Current manager required'; end if;
    end if;
   elsif v_row?'campaign_id' and v_row->>'campaign_id' is distinct from v_campaign::text then raise exception using errcode='PT403',message='Wrong campaign'; end if;
   if v_table='levytate_lift_team_context_revisions' and (v_row->>'manager_employee_id' is distinct from v_employee.id or (v_row->>'revision_number')::integer<>(select coalesce(max(revision_number),0)+1 from public.levytate_lift_team_context_revisions where organisation_id=p_organisation_id and manager_employee_id=v_employee.id)) then raise exception using errcode='PT409',message='Current team revision required'; end if;
   if v_table='levytate_lift_employee_observation_contexts' and (v_row->>'observation_id' is distinct from v_observation.id::text or v_row->>'employee_id' is distinct from v_employee.id) then raise exception using errcode='PT403',message='Own released context required'; end if;
   if v_table='levytate_lift_manager_observation_revisions' and v_action='add_manager_perspective_addendum' and (v_row->>'observation_id' is distinct from v_observation.id::text or v_row->>'revision_kind'<>'addendum' or (v_row->>'revision_number')::integer<>v_observation.current_revision+1 or (v_row->>'clarifies_revision_number')::integer is distinct from v_observation.active_submission_revision) then raise exception using errcode='PT409',message='Current addendum required'; end if;
   if v_table in ('levytate_lift_assessments','levytate_lift_manager_observations') and not exists(select 1 from public.levytate_lift_participants p where p.organisation_id=p_organisation_id and p.id=(v_row->>'participant_id')::uuid and p.employee_id=v_row->>'employee_id' and p.campaign_id=v_campaign) then raise exception using errcode='PT403',message='Identity must match invited participant';end if;
   if v_table='levytate_lift_assessment_revisions' and not exists(select 1 from public.levytate_lift_assessments a where a.organisation_id=p_organisation_id and a.id=(v_row->>'assessment_id')::uuid and a.campaign_id=v_campaign and a.status='draft') then raise exception using errcode='PT403',message='Revision must match draft invitation';end if;
   if v_table='levytate_lift_manager_observation_revisions' and v_action='invite_people' and not exists(select 1 from public.levytate_lift_manager_observations o where o.organisation_id=p_organisation_id and o.id=(v_row->>'observation_id')::uuid and o.campaign_id=v_campaign and o.status='draft') then raise exception using errcode='PT403',message='Revision must match invited observation';end if;
   if v_table in ('levytate_lift_decisions','levytate_lift_proof_records','levytate_lift_proof_events') and v_row->>'opportunity_id' is distinct from v_opportunity.id::text then raise exception using errcode='PT403',message='Wrong opportunity'; end if;
   if v_table='levytate_lift_decisions' and (v_row->>'decision_version')::integer is distinct from (select coalesce(max(decision_version),0)+1 from public.levytate_lift_decisions where organisation_id=p_organisation_id and opportunity_id=v_opportunity.id) then raise exception using errcode='PT409',message='Decision revision changed';end if;
   if v_table='levytate_lift_decision_assumptions' and not exists(select 1 from jsonb_array_elements(p_writes) w where w->>'table'='levytate_lift_decisions' and w->>'kind'='insert' and w->'row'->>'id'=v_row->>'decision_id' and w->'row'->>'opportunity_id'=v_opportunity.id::text) then raise exception using errcode='PT403',message='Assumption belongs to current decision';end if;
   if v_table='levytate_lift_evidence_records' then
    if v_action='record_proof' then
     if v_row->>'source_type' not in ('operational_baseline','measured_outcome') or v_row->>'source_record_id' is distinct from v_opportunity.id::text or v_row->>'permissions'<>'authorised_employer' or v_row->>'employee_id' is not null or (v_row->>'quantity_value')::numeric<0 then raise exception using errcode='PT422',message='Invalid operational evidence'; end if;
     if nullif(v_row->>'recorded_at','') is null or (v_row->>'recorded_at')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception using errcode='PT422',message='Recorded evidence cannot be future dated';end if;
    elsif v_row->>'employee_id' is distinct from v_subject or v_row->>'source_type' not in ('employee_task','employee_report','manager_observation','workplace_condition') or v_row->>'permissions' not in ('private_employee','released_pair','aggregate_only') then raise exception using errcode='PT403',message='Wrong evidence subject'; end if;
   end if;
   if v_table='levytate_lift_interpretations' and v_row->>'participant_id' is distinct from v_participant::text then raise exception using errcode='PT403',message='Wrong interpretation subject'; end if;
   if v_table='levytate_lift_opportunity_candidates' and v_row->>'employee_id' is distinct from v_subject then raise exception using errcode='PT403',message='Wrong candidate subject'; end if;
   if v_table='levytate_lift_opportunity_candidates' and not exists(select 1 from public.levytate_lift_interpretations i where i.organisation_id=p_organisation_id and i.id=(v_row->>'interpretation_id')::uuid and i.participant_id=v_participant and i.campaign_id=v_campaign) then raise exception using errcode='PT403',message='Wrong candidate interpretation';end if;
   if v_table='levytate_lift_opportunity_route_members' and not exists(select 1 from public.levytate_lift_opportunities o join public.levytate_lift_opportunity_candidates c on c.organisation_id=o.organisation_id and c.campaign_id=o.campaign_id where o.organisation_id=p_organisation_id and o.id=(v_row->>'opportunity_id')::uuid and c.id=(v_row->>'candidate_id')::uuid and c.employee_id=v_row->>'contributor_employee_id' and o.campaign_id=v_campaign) then raise exception using errcode='PT403',message='Invalid aggregate membership';end if;
   if v_table='levytate_lift_opportunity_evidence' and not exists(select 1 from public.levytate_lift_opportunities o join public.levytate_lift_evidence_records e on e.organisation_id=o.organisation_id and e.campaign_id=o.campaign_id where o.organisation_id=p_organisation_id and o.id=(v_row->>'opportunity_id')::uuid and e.id=(v_row->>'evidence_id')::uuid and o.campaign_id=v_campaign) then raise exception using errcode='PT403',message='Invalid aggregate evidence';end if;
   if v_table='levytate_lift_proof_events' and (v_row->>'proof_record_id' is distinct from (select id::text from public.levytate_lift_proof_records where organisation_id=p_organisation_id and opportunity_id=v_opportunity.id) or v_row->>'idempotency_key' is distinct from v_request or v_row->>'previous_state' is distinct from v_proof.state) then raise exception using errcode='PT422',message='Proof history must match current transition';end if;
  end if;
  if v_row?'created_by' then v_row:=jsonb_set(v_row,'{created_by}',to_jsonb(p_actor_user_id)); end if;
  if v_row?'recorded_by' then v_row:=jsonb_set(v_row,'{recorded_by}',to_jsonb(p_actor_user_id)); end if;
  if v_row?'actor_user_id' then v_row:=jsonb_set(v_row,'{actor_user_id}',to_jsonb(p_actor_user_id)); end if;
  if v_row->>'reviewed_by_user_id' is not null then v_row:=jsonb_set(v_row,'{reviewed_by_user_id}',to_jsonb(p_actor_user_id)); end if;
  select string_agg(format('%I',k),','),string_agg(format('r.%I',k),','),string_agg(format('%I=r.%I',k,k),',') into v_columns,v_select,v_sets from jsonb_object_keys(v_row) k;
  if v_kind='insert' then execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) r',v_table,v_columns,v_select,v_table) using v_row;
  else execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.organisation_id=$2 and t.id=$3::uuid',v_table,v_sets,v_table) using v_row,p_organisation_id,v_key->>'id';end if;
  get diagnostics v_count=row_count;if v_count<>1 then raise exception using errcode='PT409',message='Lift write not confirmed'; end if;
 end loop;

 -- Every command must include its domain result, not only derived/event rows.
 if not exists(select 1 from jsonb_array_elements(p_writes) w where w->>'table'='levytate_lift_'||case v_action when 'invite_people' then 'campaigns' when 'save_assessment' then 'assessment_revisions' when 'submit_assessment' then 'interpretations' when 'save_team_context' then 'team_context_revisions' when 'save_manager_perspective' then 'manager_observation_revisions' when 'submit_manager_perspective' then 'manager_observation_revisions' when 'add_manager_perspective_addendum' then 'manager_observation_revisions' when 'record_employee_context' then 'employee_observation_contexts' when 'record_decision' then 'decisions' when 'record_proof' then 'proof_records' end) then raise exception using errcode='PT422',message='Required Lift evidence missing';end if;
 if v_action='invite_people' then
  if jsonb_typeof(p_command->'employeeIds') is distinct from 'array' or jsonb_array_length(p_command->'employeeIds') not between 1 and 500 or (select count(*) from public.levytate_lift_participants where organisation_id=p_organisation_id and campaign_id=v_campaign)<>jsonb_array_length(p_command->'employeeIds') or (select count(*) from public.levytate_lift_assessments a join public.levytate_lift_assessment_revisions r on r.organisation_id=a.organisation_id and r.assessment_id=a.id and r.revision_number=1 where a.organisation_id=p_organisation_id and a.campaign_id=v_campaign)<>jsonb_array_length(p_command->'employeeIds') then raise exception using errcode='PT422',message='Incomplete invitation';end if;
 end if;
 if v_action='submit_assessment' and not exists(select 1 from public.levytate_lift_assessments a join public.levytate_lift_assessment_revisions r on r.organisation_id=a.organisation_id and r.assessment_id=a.id and r.revision_number=a.active_submission_revision join public.levytate_lift_participants p on p.organisation_id=a.organisation_id and p.id=a.participant_id where a.organisation_id=p_organisation_id and a.id=v_assessment.id and a.status='submitted' and r.status='submitted' and p.status='submitted' and (select count(*) from jsonb_each(r.answers) e where jsonb_typeof(e.value)='string' and length(btrim(e.value#>>'{}'))>0)>=30) then raise exception using errcode='PT422',message='Incomplete assessment submission';end if;
 if v_action='submit_manager_perspective' and not exists(select 1 from public.levytate_lift_manager_observations o join public.levytate_lift_manager_observation_revisions r on r.organisation_id=o.organisation_id and r.observation_id=o.id and r.revision_number=o.active_submission_revision where o.organisation_id=p_organisation_id and o.id=v_observation.id and o.status in ('submitted','released') and r.status='submitted' and (nullif(btrim(r.observed_work),'') is not null or r.opportunity_to_observe='not_enough')) then raise exception using errcode='PT422',message='Incomplete manager submission';end if;
 if exists(select 1 from jsonb_array_elements(p_writes) w where w->>'table'='levytate_lift_opportunities' and (select count(distinct m.contributor_employee_id) from public.levytate_lift_opportunity_route_members m where m.organisation_id=p_organisation_id and m.opportunity_id=(w->'row'->>'id')::uuid)<5) then raise exception using errcode='PT403',message='Aggregate minimum population required';end if;
 if v_observation.id is not null and exists(select 1 from public.levytate_lift_manager_observations where organisation_id=p_organisation_id and id=v_observation.id and status='released') and not exists(select 1 from public.levytate_lift_assessments a where a.organisation_id=p_organisation_id and a.participant_id=v_observation.participant_id and a.status='submitted' and a.active_submission_revision is not null) then raise exception using errcode='PT403',message='Independent submissions required for release';end if;
 if v_action='record_proof' then
  v_before_state:=coalesce(v_proof.state,v_opportunity.state);
  select * into v_proof from public.levytate_lift_proof_records where organisation_id=p_organisation_id and opportunity_id=v_opportunity.id;
  v_after_state:=v_proof.state;
  select * into v_baseline from public.levytate_lift_evidence_records where organisation_id=p_organisation_id and id=v_proof.baseline_evidence_id;
  select * into v_outcome from public.levytate_lift_evidence_records where organisation_id=p_organisation_id and id=v_proof.outcome_evidence_id;
  if v_proof.revision<>(p_command->>'expectedRevision')::integer+1 or (v_baseline.id is not null and (v_baseline.source_type<>'operational_baseline' or v_baseline.source_record_id<>v_opportunity.id)) or (v_outcome.id is not null and (v_outcome.source_type<>'measured_outcome' or v_outcome.source_record_id<>v_opportunity.id)) then raise exception using errcode='PT422',message='Wrong proof evidence';end if;
  if v_after_state='change_tested' and (v_before_state not in ('work_context_confirmed','change_tested','paused') or v_baseline.id is null or nullif(btrim(v_proof.responsible_owner),'') is null or nullif(btrim(v_proof.agreed_scope),'') is null or nullif(btrim(v_proof.intended_measure),'') is null or not exists(select 1 from public.levytate_lift_decisions where organisation_id=p_organisation_id and opportunity_id=v_opportunity.id and status='selected')) then raise exception using errcode='PT409',message='Decision and baseline required before test';end if;
  if v_after_state='outcome_evidenced' and (v_before_state not in ('change_tested','outcome_evidenced','no_improvement') or v_baseline.quantity_value is null or v_outcome.quantity_value is null or v_baseline.quantity_unit is distinct from v_outcome.quantity_unit or v_baseline.quantity_population is distinct from v_outcome.quantity_population or v_proof.reviewed_by_user_id is null or v_proof.verification='not_reviewed' or v_outcome.recorded_at<v_baseline.recorded_at) then raise exception using errcode='PT409',message='Test and comparable reviewed outcome required';end if;
  if v_after_state in ('signal_identified','work_context_confirmed') and v_before_state in ('change_tested','outcome_evidenced','no_improvement') then raise exception using errcode='PT409',message='Proof reversal denied';end if;
  if not exists(select 1 from public.levytate_lift_proof_events where organisation_id=p_organisation_id and proof_record_id=v_proof.id and actor_user_id=p_actor_user_id and idempotency_key=v_request and new_state=v_after_state) then raise exception using errcode='PT422',message='Proof history required';end if;
 end if;
 update public.levytate_lift_workspace_revisions set revision=revision+1 where organisation_id=p_organisation_id returning jsonb_build_object('revision',revision) into v_result;
 insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
 values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'lift',v_request,'lift.'||v_action,'Lift evidence committed atomically.',jsonb_build_object('actorId',p_actor_user_id,'revision',v_revision+1));
 insert into public.levytate_lift_command_receipts(organisation_id,actor_user_id,request_id,command,result) values(p_organisation_id,p_actor_user_id,v_request,p_command,v_result);
 return v_result;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then raise exception using errcode='PT422',message='Invalid Lift field type';
end $$;
revoke all on function public.levytate_apply_lift_command(uuid,uuid,jsonb,boolean,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_lift_command(uuid,uuid,jsonb,boolean,jsonb) to service_role;
do $$ declare t text;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'levytate_lift_%' loop
  execute format('revoke insert,update,delete,truncate on public.%I from service_role',t);
 end loop;
end $$;
