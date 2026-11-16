-- Local-only candidate; enables no capability and changes no prior migration bytes.
-- Manager personal evidence follows the same owner-only permissions as Employee.
-- Existing Lead/Admin oversight, period guards, atomic receipts and grants remain.

create or replace function public.levytate_submit_otj_activity(
  p_organisation_id uuid, p_activity_id uuid, p_actor_user_id uuid,
  p_idempotency_key text, p_expected_lock_version integer
) returns setof public.levytate_otj_activities
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_activity public.levytate_otj_activities%rowtype; v_actor public.levytate_users%rowtype; v_previous text;
begin
  if exists (select 1 from public.levytate_otj_activity_events where organisation_id = p_organisation_id and activity_id = p_activity_id and idempotency_key = p_idempotency_key) then
    return query select * from public.levytate_otj_activities where organisation_id = p_organisation_id and id = p_activity_id; return;
  end if;
  select * into v_actor from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
  select * into v_activity from public.levytate_otj_activities where id = p_activity_id and organisation_id = p_organisation_id for update;
  if v_actor.id is null or v_actor.role not in ('Employee','Line Manager') or v_activity.id is null or v_activity.created_by_user_id <> p_actor_user_id then raise exception 'Only the activity owner may submit it'; end if;
  if v_activity.status not in ('draft','needs_information') then raise exception 'Activity is not available for submission'; end if;
  if v_activity.lock_version <> p_expected_lock_version then raise exception 'Activity changed; refresh before trying again'; end if;
  if v_activity.deterministic_outcome = 'likely_ineligible' then raise exception 'Likely ineligible activity must be saved as a non-counted learning note'; end if;
  v_previous := v_activity.status;
  update public.levytate_otj_activities set status = 'submitted', submitted_at = coalesce(submitted_at, timezone('utc', now())),
    lock_version = lock_version + 1, updated_at = timezone('utc', now()) where id = p_activity_id returning * into v_activity;
  insert into public.levytate_otj_activity_events(organisation_id, activity_id, event_type, actor_user_id, actor_role, previous_state, new_state, safe_summary, idempotency_key)
    values (p_organisation_id, p_activity_id, case when v_previous = 'draft' then 'submitted' else 'employee_resubmitted' end,
      p_actor_user_id, v_actor.role, v_previous, 'submitted',
      'Candidate learning activity submitted for employer check.', p_idempotency_key);
  return next v_activity;
end;
$$;

create or replace function public.levytate_transition_otj_activity(
  p_organisation_id uuid, p_activity_id uuid, p_actor_user_id uuid,
  p_action text, p_safe_summary text, p_idempotency_key text, p_expected_lock_version integer
) returns setof public.levytate_otj_activities
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_activity public.levytate_otj_activities%rowtype; v_actor public.levytate_users%rowtype; v_next text; v_event text; v_previous text; v_existing_event text; v_existing_summary text;
begin
  select event_type, safe_summary into v_existing_event, v_existing_summary
    from public.levytate_otj_activity_events
    where organisation_id = p_organisation_id and activity_id = p_activity_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_event is distinct from (case p_action
      when 'withdraw' then 'withdrawn'
      when 'request_information' then 'information_requested'
      when 'employer_check' then 'employer_checked'
      when 'mark_not_counted' then 'marked_not_counted'
      else null end)
      or v_existing_summary is distinct from left(coalesce(p_safe_summary,''),1000)
    then raise exception 'Conflicting learning-time idempotency key'; end if;
    return query select * from public.levytate_otj_activities where organisation_id = p_organisation_id and id = p_activity_id; return;
  end if;
  select * into v_actor from public.levytate_users where id = p_actor_user_id and organisation_id = p_organisation_id and active = true;
  select * into v_activity from public.levytate_otj_activities where id = p_activity_id and organisation_id = p_organisation_id for update;
  if v_actor.id is null or v_activity.id is null then raise exception 'Actor or activity is unavailable'; end if;
  if v_activity.lock_version <> p_expected_lock_version then raise exception 'Activity changed; refresh before trying again'; end if;
  v_previous := v_activity.status;
  if p_action = 'withdraw' and v_actor.role in ('Employee','Line Manager') and v_activity.created_by_user_id = p_actor_user_id and v_activity.status in ('submitted','needs_information') then v_next := 'withdrawn'; v_event := 'withdrawn';
  elsif p_action = 'request_information' and v_actor.role in ('Apprenticeship Lead','Employer Admin') and v_activity.status = 'submitted' then v_next := 'needs_information'; v_event := 'information_requested';
  elsif p_action = 'employer_check' and v_actor.role in ('Apprenticeship Lead','Employer Admin') and v_activity.status = 'submitted' then v_next := 'employer_checked'; v_event := 'employer_checked';
  elsif p_action = 'mark_not_counted' and v_actor.role in ('Apprenticeship Lead','Employer Admin') and v_activity.status in ('submitted','needs_information','employer_checked') then v_next := 'not_counted'; v_event := 'marked_not_counted';
  else raise exception 'The requested learning-time transition is not permitted'; end if;
  update public.levytate_otj_activities set status = v_next, lock_version = lock_version + 1, updated_at = timezone('utc', now())
    where id = p_activity_id returning * into v_activity;
  insert into public.levytate_otj_activity_events(organisation_id, activity_id, event_type, actor_user_id, actor_role, previous_state, new_state, safe_summary, idempotency_key)
    values (p_organisation_id, p_activity_id, v_event, p_actor_user_id, v_actor.role, v_previous, v_next, left(coalesce(p_safe_summary,''),1000), p_idempotency_key);
  return next v_activity;
end;
$$;

create or replace function public.levytate_apply_learning_time_command(p_organisation_id uuid,p_actor_user_id uuid,p_action text,p_input jsonb,p_row jsonb default '{}',p_probe boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
<<command_scope>>
declare
 actor public.levytate_users;learner public.levytate_learner_records;activity public.levytate_otj_activities;plan public.levytate_otj_plans;version public.levytate_otj_plan_versions;requirement public.levytate_standard_otj_requirements;receipt public.levytate_otj_command_receipts;
 request_id text:=p_input->>'idempotencyKey';command jsonb:=jsonb_build_object('action',p_action,'input',p_input);result jsonb;row_data jsonb;subject text;table_name text;cols text;vals text;sets text;next_version integer;own_employee_ids text[];own_employee_id text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then raise exception using errcode='PT403',message='Server credential required';end if;
 if p_organisation_id is null or p_actor_user_id is null or p_probe is null or p_action is null or p_action not in ('save_activity','submit_activity','transition_activity','record_confirmation','create_plan_draft','publish_plan','add_priority') or jsonb_typeof(p_input) is distinct from 'object' or jsonb_typeof(p_row) is distinct from 'object' or request_id is null or request_id !~ '^[A-Za-z0-9:_-]{8,128}$' then raise exception using errcode='PT422',message='Invalid Learning Time command';end if;
 perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
 select * into actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
 if not found or actor.role not in ('Employee','Line Manager','Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Active authorised membership required';end if;
 perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;if not found then raise exception using errcode='PT403',message='Workspace inactive';end if;
 perform 1 from public.levytate_organisation_capabilities where organisation_id=p_organisation_id and off_the_job_assistant_enabled for share;if not found then raise exception using errcode='PT404',message='Learning Time disabled';end if;
 if actor.role in ('Employee','Line Manager') and p_action not in ('save_activity','submit_activity','transition_activity') then raise exception using errcode='PT403',message='Employer oversight required';end if;
 if p_action in ('save_activity','submit_activity') and actor.role not in ('Employee','Line Manager') then raise exception using errcode='PT403',message='Employee evidence must be individual';end if;
 -- Resolve one current People identity before receipt lookup or resource access.
 if actor.role in ('Employee','Line Manager') then
  perform 1 from public.levytate_employees e where e.organisation_id=p_organisation_id and e.status='Active' and lower(btrim(e.email))=lower(btrim(actor.email)) for share;
  select array_agg(e.id) into own_employee_ids from public.levytate_employees e where e.organisation_id=p_organisation_id and e.status='Active' and lower(btrim(e.email))=lower(btrim(actor.email));
  if coalesce(cardinality(own_employee_ids),0)<>1 then raise exception using errcode='PT403',message='Unique active employee identity required';end if;
  own_employee_id:=own_employee_ids[1];
 end if;
 if p_action='transition_activity' then
  if p_input->>'action' is null or p_input->>'action' not in ('withdraw','request_information','employer_check','mark_not_counted') then raise exception using errcode='PT422',message='Known activity transition required';end if;
  if (actor.role in ('Employee','Line Manager') and p_input->>'action'<>'withdraw') or (actor.role in ('Apprenticeship Lead','Employer Admin') and p_input->>'action'='withdraw') then raise exception using errcode='PT403',message='Role cannot perform activity transition';end if;
 end if;
 -- Actor-level lock makes lost-response retries atomic even across resource kinds.
 perform pg_advisory_xact_lock(hashtextextended('levytate-otj-command:'||p_organisation_id::text||':'||p_actor_user_id::text,0));
 select * into receipt from public.levytate_otj_command_receipts r where r.organisation_id=p_organisation_id and r.actor_user_id=p_actor_user_id and r.request_id=command_scope.request_id;
 if found then
  if receipt.command<>command then raise exception using errcode='PT409',message='Retry key conflicts';end if;
  if actor.role in ('Employee','Line Manager') and not exists(select 1 from public.levytate_learner_records l where l.organisation_id=p_organisation_id and l.id=receipt.result->>'learner_record_id' and l.record_status='Active' and l.employee_id=own_employee_id) then raise exception using errcode='PT403',message='Receipt is outside current employee scope';end if;
  return receipt.result;
 end if;
 if p_probe then return null;end if;
 if p_action in ('save_activity','create_plan_draft','add_priority') then subject:=p_input->>'learnerRecordId';
 elsif p_action='publish_plan' then select p.learner_record_id into subject from public.levytate_otj_plan_versions v join public.levytate_otj_plans p on p.organisation_id=v.organisation_id and p.id=v.plan_id where v.organisation_id=p_organisation_id and v.id=(p_input->>'versionId')::uuid;
 else select * into activity from public.levytate_otj_activities where organisation_id=p_organisation_id and id=(p_input->>'activityId')::uuid;subject:=activity.learner_record_id;end if;
 -- A legacy event without this actor's exact command receipt cannot prove a
 -- retry. In particular, another reviewer reusing the key must not receive a
 -- false-success response or a second audit for the first reviewer's event.
 if activity.id is not null and exists(select 1 from public.levytate_otj_activity_events e where e.organisation_id=p_organisation_id and e.activity_id=activity.id and e.idempotency_key=request_id) then raise exception using errcode='PT409',message='Activity event key already belongs to a recorded command';end if;
 select * into learner from public.levytate_learner_records where organisation_id=p_organisation_id and id=subject and record_status='Active' for update;
 if not found then raise exception using errcode='PT404',message='Active learner required';end if;
 if actor.role in ('Employee','Line Manager') and (p_action not in ('save_activity','submit_activity','transition_activity') or learner.employee_id is distinct from own_employee_id) then raise exception using errcode='PT403',message='Own learning record required';end if;
 if p_action in ('save_activity','submit_activity') and actor.role not in ('Employee','Line Manager') then raise exception using errcode='PT403',message='Employee evidence must be individual';end if;
 if p_action in ('create_plan_draft','publish_plan','add_priority','record_confirmation') and actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Employer oversight required';end if;
 if p_action='save_activity' then
  select * into plan from public.levytate_otj_plans where organisation_id=p_organisation_id and learner_record_id=subject and status='published';
  if nullif(p_input->>'activityId','') is not null then
   select * into activity from public.levytate_otj_activities where organisation_id=p_organisation_id and id=(p_input->>'activityId')::uuid for update;
   if activity.id is null or activity.learner_record_id<>subject or activity.created_by_user_id<>p_actor_user_id or activity.status not in ('draft','needs_information') then raise exception using errcode='PT403',message='Own editable activity required';end if;
   if jsonb_typeof(p_input->'lockVersion') is distinct from 'number' or (p_input->>'lockVersion') !~ '^[0-9]{1,9}$' or (p_input->>'lockVersion')::integer<>activity.lock_version then raise exception using errcode='PT409',message='Activity changed';end if;
  end if;
  select * into version from public.levytate_otj_plan_versions where organisation_id=p_organisation_id and id=coalesce(activity.plan_version_id,plan.current_published_version_id) and status in ('published','superseded');
  if version.id is null or p_row->>'plan_version_id' is distinct from version.id::text then raise exception using errcode='PT409',message='Pinned published plan required';end if;
  if exists(select 1 from jsonb_object_keys(p_row) k where k not in ('organisation_id','learner_record_id','plan_version_id','activity_date','started_at','ended_at','break_minutes','duration_minutes','timezone','category','title','description','what_was_new','standard_relevance','reflection','working_hours_basis','compensation_note','separate_from_productive_work','ksb_references','evidence_reference','deterministic_outcome','deterministic_reasons','status','created_by_user_id','created_by_email','submitted_at','lock_version','updated_at')) then raise exception using errcode='PT422',message='Unsupported activity field';end if;
  row_data:=p_row||jsonb_build_object('id',coalesce(activity.id,gen_random_uuid()),'organisation_id',p_organisation_id,'learner_record_id',subject,'created_by_user_id',p_actor_user_id,'created_by_email',actor.email,'status',case when p_input->>'saveAsNonCounted'='true' then 'not_counted' else coalesce(activity.status,'draft') end,'lock_version',case when activity.id is null then 0 else activity.lock_version+1 end,'submitted_at',case when p_input->>'saveAsNonCounted'='true' then now() else activity.submitted_at end,'updated_at',now());
  if activity.id is null then
   select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into cols,vals from jsonb_object_keys(row_data) k;
   execute format('insert into public.levytate_otj_activities(%s) select %s from jsonb_populate_record(null::public.levytate_otj_activities,$1) r returning to_jsonb(levytate_otj_activities)',cols,vals) into result using row_data;
  else
   select string_agg(format('%I=r.%I',k,k),',') into sets from jsonb_object_keys(row_data) k;
   execute format('update public.levytate_otj_activities a set %s from jsonb_populate_record(null::public.levytate_otj_activities,$1) r where a.organisation_id=$2 and a.id=$3 returning to_jsonb(a)',sets) into result using row_data,p_organisation_id,activity.id;
  end if;
  insert into public.levytate_otj_activity_events(organisation_id,activity_id,event_type,actor_user_id,actor_role,previous_state,new_state,safe_summary,idempotency_key) values(p_organisation_id,(result->>'id')::uuid,case when result->>'status'='not_counted' then 'marked_not_counted' when activity.id is null then 'draft_created' else 'draft_updated' end,p_actor_user_id,actor.role,activity.status,result->>'status','Individual learning evidence saved atomically.',request_id);
 elsif p_action='create_plan_draft' then
  select * into plan from public.levytate_otj_plans where organisation_id=p_organisation_id and learner_record_id=subject for update;
  if plan.id is null then insert into public.levytate_otj_plans(organisation_id,learner_record_id,status,created_by) values(p_organisation_id,subject,'draft',p_actor_user_id) returning * into plan;end if;
  if exists(select 1 from public.levytate_otj_plan_versions where organisation_id=p_organisation_id and plan_id=plan.id and status='draft') then raise exception using errcode='PT409',message='Draft plan already exists';end if;
  select coalesce(max(version_number),0)+1 into next_version from public.levytate_otj_plan_versions where organisation_id=p_organisation_id and plan_id=plan.id;
  if p_row->>'provider_id' is distinct from learner.provider_id then raise exception using errcode='PT422',message='Plan provider must match learner';end if;
  if not exists(select 1 from public.levytate_provider_programmes p join public.levytate_organisations o on o.id=p.organisation_id and o.slug='levytate-internal' where p.id=learner.programme_id and p.provider_id=learner.provider_id and coalesce(nullif(p.linked_standard_id,''),p.apprenticeship_standard_id)=p_row->>'standard_id') then raise exception using errcode='PT422',message='Plan standard must match the learner programme';end if;
  if (p_row->>'source_date')::date>current_date or (p_row->>'practical_period_start_date')::date<(p_row->>'original_apprenticeship_start_date')::date then raise exception using errcode='PT422',message='Invalid training-plan evidence date';end if;
  if p_row->>'policy_regime'='standard_minimum' then
   select * into requirement from public.levytate_standard_otj_requirements where id=(p_row->>'standard_requirement_id')::uuid and standard_id=p_row->>'standard_id' and standard_version=p_row->>'standard_version' and source_status='verified';
   if requirement.id is null or requirement.minimum_minutes is distinct from (p_row->>'published_standard_minimum_minutes')::integer or (p_row->>'prior_learning_reduction_minutes')::integer>requirement.minimum_minutes then raise exception using errcode='PT422',message='Verified exact standard requirement required';end if;
  end if;
  if exists(select 1 from jsonb_object_keys(p_row) k where k not in ('policy_regime','original_apprenticeship_start_date','practical_period_start_date','practical_period_end_date','standard_id','standard_version','standard_requirement_id','published_standard_minimum_minutes','legacy_indicative_minimum_minutes','prior_learning_reduction_minutes','individual_minimum_minutes','planned_delivery_minutes','provider_id','training_plan_reference','source_type','source_date','inactivity_attention_days','notes')) then raise exception using errcode='PT422',message='Unsupported plan field';end if;
  row_data:=p_row||jsonb_build_object('organisation_id',p_organisation_id,'plan_id',plan.id,'version_number',next_version,'status','draft','created_by',p_actor_user_id);
  select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into cols,vals from jsonb_object_keys(row_data) k;
  execute format('insert into public.levytate_otj_plan_versions(%s) select %s from jsonb_populate_record(null::public.levytate_otj_plan_versions,$1) r returning to_jsonb(levytate_otj_plan_versions)',cols,vals) into result using row_data;
 elsif p_action='add_priority' then
  if exists(select 1 from jsonb_object_keys(p_row) k where k not in ('plan_version_id','label','description','ksb_references','source_type','source_reference','target_date')) then raise exception using errcode='PT422',message='Unsupported priority field';end if;
  if not exists(select 1 from public.levytate_otj_plan_versions v join public.levytate_otj_plans p on p.organisation_id=v.organisation_id and p.id=v.plan_id where v.organisation_id=p_organisation_id and v.id=(p_row->>'plan_version_id')::uuid and p.learner_record_id=subject and v.status in ('draft','published')) then raise exception using errcode='PT403',message='Current plan for the same learner required';end if;
  row_data:=p_row||jsonb_build_object('organisation_id',p_organisation_id,'learner_record_id',subject,'status','active','created_by',p_actor_user_id);
  select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into cols,vals from jsonb_object_keys(row_data) k;
  execute format('insert into public.levytate_otj_learning_priorities(%s) select %s from jsonb_populate_record(null::public.levytate_otj_learning_priorities,$1) r returning to_jsonb(levytate_otj_learning_priorities)',cols,vals) into result using row_data;
 elsif p_action='publish_plan' then select to_jsonb(x) into result from public.levytate_publish_otj_plan(p_organisation_id,(p_input->>'versionId')::uuid,p_actor_user_id) x;
 elsif p_action='submit_activity' then
  if jsonb_typeof(p_input->'lockVersion') is distinct from 'number' or (p_input->>'lockVersion') !~ '^[0-9]{1,9}$' then raise exception using errcode='PT422',message='Activity revision required';end if;
  if activity.created_by_user_id<>p_actor_user_id then raise exception using errcode='PT403',message='Own activity required';end if;
  if activity.status not in ('draft','needs_information') or activity.lock_version<>(p_input->>'lockVersion')::integer then raise exception using errcode='PT409',message='Current editable activity required';end if;
  select to_jsonb(x) into result from public.levytate_submit_otj_activity(p_organisation_id,activity.id,p_actor_user_id,request_id,(p_input->>'lockVersion')::integer) x;
 elsif p_action='transition_activity' then
  if p_input->>'action' is null or p_input->>'action' not in ('withdraw','request_information','employer_check','mark_not_counted') or jsonb_typeof(p_input->'lockVersion') is distinct from 'number' or (p_input->>'lockVersion') !~ '^[0-9]{1,9}$' then raise exception using errcode='PT422',message='Activity transition and revision required';end if;
  select to_jsonb(x) into result from public.levytate_transition_otj_activity(p_organisation_id,activity.id,p_actor_user_id,p_input->>'action',p_input->>'note',request_id,(p_input->>'lockVersion')::integer) x;
 else
  if jsonb_typeof(p_input->'confirmedMinutes') is distinct from 'number' or (p_input->>'confirmedMinutes') !~ '^[0-9]{1,9}$' or (p_input->>'sourceDate')::date>current_date then raise exception using errcode='PT422',message='Valid provider confirmation evidence required';end if;
  -- Recheck the actual activity interval even if the learner or break changed after submission.
  perform public.levytate_assert_learning_time_period(p_organisation_id,subject,activity.plan_version_id,activity.activity_date);
  if (p_input->>'sourceDate')::date<activity.activity_date then raise exception using errcode='PT422',message='Provider evidence cannot predate the activity';end if;
  select to_jsonb(x) into result from public.levytate_record_otj_confirmation(p_organisation_id,activity.id,p_actor_user_id,p_input->>'outcome',(p_input->>'confirmedMinutes')::integer,p_input->>'sourceType',p_input->>'providerId',p_input->>'sourceReference',(p_input->>'sourceDate')::date,p_input->>'note',request_id) x;
 end if;
 if result is null then raise exception using errcode='PT409',message='Learning Time write not confirmed';end if;
 insert into public.levytate_audit_events(organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata) values(p_organisation_id,actor.email,actor.role,'learning_time',subject,'learning_time.'||p_action,'Learning Time evidence committed atomically.',jsonb_build_object('requestId',request_id,'actorId',p_actor_user_id));
 insert into public.levytate_otj_command_receipts(organisation_id,actor_user_id,request_id,command,result) values(p_organisation_id,p_actor_user_id,request_id,command,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then raise exception using errcode='PT422',message='Invalid Learning Time field';
 when raise_exception then raise exception using errcode='PT409',message='Learning Time state or evidence no longer permits this change';
end $$;
revoke all on function public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean) to service_role;
revoke execute on function public.levytate_publish_otj_plan(uuid,uuid,uuid),public.levytate_submit_otj_activity(uuid,uuid,uuid,text,integer),public.levytate_transition_otj_activity(uuid,uuid,uuid,text,text,text,integer),public.levytate_record_otj_confirmation(uuid,uuid,uuid,text,integer,text,text,text,date,text,text) from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate on public.levytate_otj_plans,public.levytate_otj_plan_versions,public.levytate_otj_learning_priorities,public.levytate_otj_activities,public.levytate_otj_activity_confirmations,public.levytate_otj_activity_events from service_role;

