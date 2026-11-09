-- LOCAL REVIEW CANDIDATE ONLY. No hosted execution is authorised.
-- Managers retain a personal employee journey, separately from direct-report review.
-- Existing catalogue, current-manager, workflow-version, CAS, receipt and audit
-- contracts remain unchanged. A manager cannot draft for or declare for a report,
-- approve themselves, or bypass the one-active-application constraint.
-- No tables, grants to browser roles, historical migrations or data are changed.

create or replace function public.levytate_apply_application_command(
  p_organisation_id uuid, p_actor_user_id uuid, p_application_id text,
  p_action text, p_expected_revision integer, p_idempotency_key text,
  p_fields jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_employee public.levytate_employees%rowtype;
  v_app public.levytate_applications%rowtype;
  v_instance public.levytate_application_workflow_instances%rowtype;
  v_version public.levytate_application_workflow_versions%rowtype;
  v_receipt public.levytate_application_command_receipts%rowtype;
  v_command jsonb := jsonb_build_object('action',p_action,'revision',p_expected_revision,'fields',p_fields);
  v_result jsonb;
  v_employee_id text;
  v_standard_id text;
  v_status text;
  v_owner text;
  v_note text := btrim(coalesce(p_fields->>'note',''));
  v_step jsonb;
  v_next jsonb;
  v_step_index integer;
  v_old_lock integer;
  v_new boolean;
  v_own boolean;
  v_saved boolean := false;
  v_event_action text := p_action;
  v_now timestamptz := clock_timestamp();
begin
  if p_organisation_id is null or p_actor_user_id is null or p_application_id is null or p_idempotency_key is null or p_action is null
    or p_application_id !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{1,127}$'
    or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,128}$'
    or p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_fields) is distinct from 'object'
    or length(v_note) > 2000
    or p_action not in ('save_draft','save_and_submit','submit','approve','continue','decline','request_information','resubmit','withdraw')
  then raise exception using errcode='PT422', message='Invalid application command'; end if;
  if exists (select 1 from jsonb_each(p_fields) f where
    (f.key<>'expectedLockVersion' and jsonb_typeof(f.value)<>'string')
    or (f.key='expectedLockVersion' and (jsonb_typeof(f.value)<>'number' or f.value::text !~ '^[0-9]{1,9}$')))
  then raise exception using errcode='PT422',message='Application command fields have invalid types'; end if;
  if exists (select 1 from jsonb_object_keys(p_fields) k where k not in
    ('employeeId','apprenticeshipStandardId','reason','careerGoal','supportRequired','note','expectedLockVersion'))
  then raise exception using errcode='PT422', message='Application state and history are server owned'; end if;
  -- Catalogue writers take this same transaction lock before their row locks.
  -- Serialise eligibility reads with provider/programme archival and selection.
  perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
  select * into v_actor from public.levytate_users where id=p_actor_user_id and organisation_id=p_organisation_id and active for share;
  if not found or v_actor.role not in ('Employee','Line Manager','Apprenticeship Lead','Employer Admin') then
    raise exception using errcode='PT403',message='Active employer membership required';
  end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  select employee_id into v_employee_id from public.levytate_applications where organisation_id=p_organisation_id and id=p_application_id;
  v_employee_id := coalesce(v_employee_id,p_fields->>'employeeId');
  -- One lock order for create, edit and decisions, including current hierarchy.
  select * into v_employee from public.levytate_employees where organisation_id=p_organisation_id and id=v_employee_id and status='Active' for update;
  if not found then raise exception using errcode='PT403',message='Active employee in this workspace required'; end if;
  v_own := lower(btrim(v_employee.email))=lower(btrim(v_actor.email));
  if (select count(*) from public.levytate_employees where organisation_id=p_organisation_id and status='Active'
      and lower(btrim(email))=lower(btrim(v_actor.email)))>1 then
    raise exception using errcode='PT403',message='Ambiguous employee identity'; end if;
  if v_actor.role='Employee' and not v_own then raise exception using errcode='PT403',message='Application access denied'; end if;
  if v_actor.role='Line Manager' and not v_own and not exists (
    select 1 from public.levytate_employees m where m.organisation_id=p_organisation_id and m.id=v_employee.manager_id
      and m.status='Active' and m.platform_role='Line Manager' and m.id<>v_employee.id and lower(btrim(m.email))=lower(btrim(v_actor.email))
  ) then raise exception using errcode='PT403',message='Only the current direct manager may act'; end if;
  select * into v_app from public.levytate_applications where organisation_id=p_organisation_id and id=p_application_id for update;
  v_new := not found;
  select * into v_receipt from public.levytate_application_command_receipts
    where organisation_id=p_organisation_id and application_id=p_application_id and idempotency_key=p_idempotency_key;
  if found then
    if v_receipt.actor_user_id<>p_actor_user_id or v_receipt.command<>v_command then raise exception using errcode='PT409',message='Idempotency key already used for another command'; end if;
    return v_receipt.result;
  end if;
  if (v_new and p_expected_revision<>0) or (not v_new and v_app.revision<>p_expected_revision) then
    raise exception using errcode='PT409',message='Application changed; refresh before trying again';
  end if;
  select * into v_instance from public.levytate_application_workflow_instances
    where organisation_id=p_organisation_id and application_id=p_application_id for update;
  if p_fields ? 'employeeId' and p_fields->>'employeeId'<>v_employee_id then raise exception using errcode='PT403',message='Application employee is immutable'; end if;

  if p_action in ('save_draft','save_and_submit') then
    if v_actor.role in ('Employee','Line Manager') and not v_own then raise exception using errcode='PT403',message='Draft editing is not permitted'; end if;
    if p_action='save_and_submit' and (v_actor.role not in ('Employee','Line Manager') or not v_own) then raise exception using errcode='PT403',message='Only the employee may submit'; end if;
    if not v_new and (v_app.status not in ('Draft','More information requested') or
      (v_app.status='More information requested' and (v_actor.role not in ('Employee','Line Manager') or not v_own))) then
      raise exception using errcode='PT409',message='Submitted answers are locked until information is requested';
    end if;
    v_standard_id := nullif(btrim(p_fields->>'apprenticeshipStandardId'),'');
    if v_standard_id is null or length(coalesce(p_fields->>'reason',''))>8000 or length(coalesce(p_fields->>'careerGoal',''))>8000
      or length(coalesce(p_fields->>'supportRequired',''))>8000 then raise exception using errcode='PT422',message='Valid programme and bounded application answers required'; end if;
    if not v_new and v_instance.id is not null and v_app.apprenticeship_standard_id<>v_standard_id then raise exception using errcode='PT409',message='Submitted programme is immutable'; end if;
    if not exists (select 1 from public.levytate_role_pathway_mappings r where r.organisation_id=p_organisation_id
      and r.role_id=v_employee.role_id and r.apprenticeship_standard_id=v_standard_id) then
      raise exception using errcode='PT422',message='Programme must be mapped to the employee role';
    end if;
    if not exists (select 1 from public.levytate_organisation_programmes s
      join public.levytate_provider_programmes p on p.id=s.programme_id and p.provider_id=s.provider_id
      join public.levytate_organisations catalog on catalog.id=p.organisation_id and catalog.slug='levytate-internal'
      join public.levytate_providers provider on provider.organisation_id=p.organisation_id and provider.provider_id=p.provider_id and provider.status='Active' and provider.verification_status='verified'
      join public.levytate_organisation_providers r on r.organisation_id=s.organisation_id and r.provider_id=s.provider_id and r.status='Active'
      where s.organisation_id=p_organisation_id and s.status='Active' and p.status='Active' and p.record_status='Active'
      and p.verification_status in ('Verified from provider website','Provider confirmed','LevyTate reviewed')
      and (p.linked_standard_id=v_standard_id or p.linked_standard_ids ? v_standard_id)) then
      raise exception using errcode='PT422',message='Choose an active programme published by the employer';
    end if;
    if v_new then
      insert into public.levytate_applications (organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner,reason,career_goal,support_required,manager_note,submitted_at,updated_at)
        values (p_organisation_id,p_application_id,v_employee_id,v_standard_id,'Draft','Employee',coalesce(p_fields->>'reason',''),coalesce(p_fields->>'careerGoal',''),coalesce(p_fields->>'supportRequired',''),'',v_now,v_now)
        returning * into v_app;
    else
      update public.levytate_applications set apprenticeship_standard_id=v_standard_id,
        reason=coalesce(p_fields->>'reason',''),career_goal=coalesce(p_fields->>'careerGoal',''),support_required=coalesce(p_fields->>'supportRequired','')
        where organisation_id=p_organisation_id and id=p_application_id returning * into v_app;
    end if;
    v_saved := true;
  elsif v_new then raise exception using errcode='PT404',message='Application not found';
  end if;

  v_status := v_app.status; v_owner := v_app.current_owner;
  if p_action='save_draft' then v_note := 'Application draft saved.';
  elsif p_action='withdraw' then
    if not v_own or v_actor.role not in ('Employee','Line Manager') or v_instance.id is not null or v_app.status not in ('Draft','Submitted to Line Manager','Awaiting Manager Review','More information requested','Approved by Line Manager','Submitted to Apprenticeship Lead','Awaiting Final Approval') then
      raise exception using errcode='PT403',message='This application cannot be withdrawn by this actor'; end if;
    v_status := 'Withdrawn'; v_owner := 'Completed';
  else
    if p_action='save_and_submit' then v_event_action := case when v_app.status='More information requested' then 'resubmit' else 'submit' end; end if;
    if v_event_action in ('submit','resubmit') then
      if v_actor.role not in ('Employee','Line Manager') or not v_own or (v_event_action='submit' and v_app.status<>'Draft')
        or (v_event_action='resubmit' and v_app.status<>'More information requested') then
        raise exception using errcode='PT403',message='Only the employee may submit the current draft or requested information'; end if;
      if nullif(btrim(v_app.reason),'') is null or nullif(btrim(v_app.career_goal),'') is null then
        raise exception using errcode='PT422',message='Reason and career goal are required before submission'; end if;
      if not exists (select 1 from public.levytate_role_pathway_mappings r where r.organisation_id=p_organisation_id
        and r.role_id=v_employee.role_id and r.apprenticeship_standard_id=v_app.apprenticeship_standard_id) then
        raise exception using errcode='PT422',message='Programme is no longer mapped to the employee role'; end if;
      if not exists (select 1 from public.levytate_organisation_programmes s
        join public.levytate_provider_programmes p on p.id=s.programme_id and p.provider_id=s.provider_id
        join public.levytate_organisations catalog on catalog.id=p.organisation_id and catalog.slug='levytate-internal'
        join public.levytate_providers provider on provider.organisation_id=p.organisation_id and provider.provider_id=p.provider_id and provider.status='Active' and provider.verification_status='verified'
        join public.levytate_organisation_providers r on r.organisation_id=s.organisation_id and r.provider_id=s.provider_id and r.status='Active'
        where s.organisation_id=p_organisation_id and s.status='Active' and p.status='Active' and p.record_status='Active'
          and p.verification_status in ('Verified from provider website','Provider confirmed','LevyTate reviewed')
          and (p.linked_standard_id=v_app.apprenticeship_standard_id or p.linked_standard_ids ? v_app.apprenticeship_standard_id)) then
        raise exception using errcode='PT422',message='Programme or provider is no longer available'; end if;
      if v_event_action='submit' and v_instance.id is null then
        select ver.* into v_version from public.levytate_application_workflows w
          join public.levytate_application_workflow_versions ver on ver.id=w.published_version_id and ver.organisation_id=w.organisation_id
          join public.levytate_organisation_capabilities cap on cap.organisation_id=w.organisation_id and cap.application_workflows_enabled
          where w.organisation_id=p_organisation_id and ver.status='published';
        if found then
          v_next := v_version.steps->1;
          insert into public.levytate_application_workflow_instances (organisation_id,application_id,workflow_version_id,current_step_id,state,lock_version,last_progressed_at)
            values(p_organisation_id,p_application_id,v_version.id,v_next->>'id','active',0,v_now) returning * into v_instance;
          v_step := v_version.steps->0;
        end if;
      end if;
    else
      if v_own then raise exception using errcode='PT403',message='Self approval and self review are prohibited'; end if;
      if v_note='' then raise exception using errcode='PT422',message='A decision note is required'; end if;
    end if;

    if v_instance.id is not null then
      if v_version.id is null then select * into v_version from public.levytate_application_workflow_versions where id=v_instance.workflow_version_id and organisation_id=p_organisation_id; end if;
      v_old_lock:=v_instance.lock_version;
      if v_event_action<>'submit' then
        if nullif(p_fields->>'expectedLockVersion','') is null or (p_fields->>'expectedLockVersion')::integer<>v_old_lock then raise exception using errcode='PT409',message='Workflow changed; refresh before trying again'; end if;
        select value,ordinality::integer-1 into v_step,v_step_index from jsonb_array_elements(v_version.steps) with ordinality where value->>'id'=v_instance.current_step_id;
      end if;
      if v_step is null or v_instance.state in ('declined','ready_for_provider') then raise exception using errcode='PT409',message='Workflow does not permit another decision'; end if;
      if v_event_action='resubmit' then
        if v_instance.state<>'needs_information' or v_instance.return_step_id is null then raise exception using errcode='PT409',message='No information request is pending'; end if;
        v_instance.current_step_id:=v_instance.return_step_id; v_instance.return_step_id:=null; v_instance.state:='active';
      elsif v_event_action='submit' then
        null; -- submission already chose and pinned the next step above
      else
        if v_instance.state<>'active' or v_step->>'responsibleRole'<>v_actor.role then raise exception using errcode='PT403',message='Actor does not own the current workflow step'; end if;
        if v_event_action='request_information' then
          if v_step->>'type' not in ('role_review','role_approval') then raise exception using errcode='PT403',message='Information requests require a decision step'; end if;
          v_instance.state:='needs_information'; v_instance.return_step_id:=v_instance.current_step_id;
        elsif v_event_action='decline' and coalesce((v_step->>'allowDecline')::boolean,false) then v_instance.state:='declined';
        elsif (v_event_action='continue' and v_step->>'type'='role_review') or (v_event_action='approve' and v_step->>'type'='role_approval') then
          v_next:=v_version.steps->(v_step_index+1);
          if v_next is null then raise exception using errcode='PT409',message='Workflow has no next step'; end if;
          v_instance.current_step_id:=v_next->>'id'; v_instance.state:=case when v_next->>'type'='provider_handoff' then 'ready_for_provider' else 'active' end;
        else raise exception using errcode='PT403',message='Action is not allowed at this step'; end if;
      end if;
      update public.levytate_application_workflow_instances set state=v_instance.state,current_step_id=v_instance.current_step_id,
        return_step_id=v_instance.return_step_id,lock_version=lock_version+1,last_progressed_at=v_now,updated_at=v_now
        where id=v_instance.id returning * into v_instance;
      insert into public.levytate_application_workflow_events(organisation_id,application_id,workflow_version_id,step_id,action,actor_user_id,actor_role,note,idempotency_key,from_lock_version,to_lock_version)
        values(p_organisation_id,p_application_id,v_version.id,v_step->>'id',v_event_action,p_actor_user_id,v_actor.role,v_note,p_idempotency_key,v_old_lock,v_instance.lock_version);
      select value into v_next from jsonb_array_elements(v_version.steps) where value->>'id'=v_instance.current_step_id;
      v_owner:=case when v_instance.state='needs_information' then 'Employee' when v_instance.state='declined' then 'Completed' else v_next->>'responsibleRole' end;
      v_status:=case when v_instance.state='needs_information' then 'More information requested'
        when v_instance.state='declined' then case when v_step->>'responsibleRole'='Line Manager' then 'Declined by Line Manager' else 'Declined by Apprenticeship Lead' end
        when v_instance.state='ready_for_provider' then 'Approved for Enrolment'
        when v_owner='Line Manager' then 'Awaiting Manager Review' else 'Awaiting Final Approval' end;
    else
      -- Never downgrade a post-publication, unpinned application into fallback.
      if v_event_action not in ('submit','resubmit') and exists (
        select 1 from public.levytate_organisation_capabilities c join public.levytate_application_workflow_versions v on v.organisation_id=c.organisation_id
        where c.organisation_id=p_organisation_id and c.application_workflows_enabled and v.published_at is not null
          and v.published_at<=coalesce((select min(h.created_at) from public.levytate_application_history h where h.organisation_id=p_organisation_id and h.application_id=p_application_id and h.status<>'Draft'),v_app.submitted_at)
      ) then raise exception using errcode='PT409',message='Published workflow must be pinned before a decision'; end if;
      if v_event_action='submit' then v_status:='Awaiting Manager Review';v_owner:='Line Manager';
      elsif v_event_action='resubmit' then
        v_owner:=coalesce(v_app.information_return_owner,'Line Manager');
        v_status:=case when v_owner='Line Manager' then 'Awaiting Manager Review' else 'Awaiting Final Approval' end;
      else
        if not ((v_app.status in ('Submitted to Line Manager','Awaiting Manager Review') and v_app.current_owner='Line Manager' and v_actor.role='Line Manager')
          or (v_app.status in ('Approved by Line Manager','Submitted to Apprenticeship Lead','Awaiting Final Approval') and v_app.current_owner='Apprenticeship Lead' and v_actor.role='Apprenticeship Lead')) then
          raise exception using errcode='PT403',message='Actor does not own the current approval step'; end if;
        if v_event_action='request_information' then v_owner:='Employee';v_status:='More information requested';
        elsif v_event_action='decline' then v_owner:='Completed';v_status:=case when v_actor.role='Line Manager' then 'Declined by Line Manager' else 'Declined by Apprenticeship Lead' end;
        elsif v_event_action='approve' then
          v_owner:=case when v_actor.role='Line Manager' then 'Apprenticeship Lead' else 'Provider Partner' end;
          v_status:=case when v_actor.role='Line Manager' then 'Awaiting Final Approval' else 'Approved for Enrolment' end;
        else raise exception using errcode='PT403',message='Action is not allowed at this step'; end if;
      end if;
    end if;
  end if;
  if v_owner='Line Manager' and not exists (select 1 from public.levytate_employees manager
    join public.levytate_users member on member.organisation_id=manager.organisation_id and lower(btrim(member.email))=lower(btrim(manager.email))
    where manager.organisation_id=p_organisation_id and manager.id=v_employee.manager_id and manager.id<>v_employee.id
      and manager.status='Active' and manager.platform_role='Line Manager' and member.active and member.role='Line Manager') then
    raise exception using errcode='PT422',message='An active current line manager account is required before submission'; end if;
  update public.levytate_applications set status=v_status,current_owner=v_owner,revision=revision+1,updated_at=v_now,
    information_return_owner=case when v_event_action='request_information' then v_actor.role when v_event_action='resubmit' then null else information_return_owner end,
    manager_note=case when v_event_action in ('approve','continue','decline','request_information') then v_note else manager_note end,
    submitted_at=case when v_event_action='submit' then v_now else submitted_at end
    where organisation_id=p_organisation_id and id=p_application_id returning * into v_app;
  insert into public.levytate_application_history(organisation_id,id,application_id,status,owner,note,created_at)
    values(p_organisation_id,'history-'||gen_random_uuid(),p_application_id,v_status,v_owner,coalesce(nullif(v_note,''),'Application '||v_event_action||'.'),v_now);
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata,created_at)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'application',p_application_id,'application.'||p_action,'Application command persisted.',jsonb_build_object('revision',v_app.revision,'idempotencyKey',p_idempotency_key),v_now);
  v_result:=jsonb_build_object('application',to_jsonb(v_app),'instance',case when v_instance.id is null then null else to_jsonb(v_instance) end);
  insert into public.levytate_application_command_receipts(organisation_id,application_id,idempotency_key,actor_user_id,command,result)
    values(p_organisation_id,p_application_id,p_idempotency_key,p_actor_user_id,v_command,v_result);
  return v_result;
exception when unique_violation then
  raise exception using errcode='PT409',message='An active application already exists; refresh to continue it';
end;
$$;
revoke all on function public.levytate_apply_application_command(uuid,uuid,text,text,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_application_command(uuid,uuid,text,text,integer,text,jsonb) to service_role;

create or replace function public.levytate_apply_learner_command(
  p_organisation_id uuid,p_actor_user_id uuid,p_learner_id text,p_action text,p_request_id text,p_command jsonb,
  p_expected_revision integer,p_writes jsonb,p_result jsonb,p_probe boolean default false
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_employee public.levytate_employees%rowtype;
  v_before public.levytate_learner_records%rowtype;
  v_after public.levytate_learner_records%rowtype;
  v_app public.levytate_applications%rowtype;
  v_receipt public.levytate_learner_command_receipts%rowtype;
  v_hash text;
  v_write jsonb;
  v_row jsonb;
  v_old jsonb;
  v_table text;
  v_columns text;
  v_updates text;
  v_allowed text[];
  v_target text;
  v_required text[];
  v_readiness public.levytate_learner_assessment_readiness%rowtype;
  v_progress public.levytate_learner_progress_updates%rowtype;
  v_review public.levytate_learner_reviews%rowtype;
  v_break jsonb;
  v_old_break jsonb;
  v_now timestamptz:=clock_timestamp();
  v_enrolment text;
begin
  if p_organisation_id is null or p_actor_user_id is null or p_learner_id is null or p_action is null or p_request_id is null or p_command is null or p_probe is null
    or p_request_id !~ '^[A-Za-z0-9:_-]{8,128}$' or jsonb_typeof(p_command) not in ('array','object') or length(p_command::text)>65536
    or p_action not in ('pre_enrolment','enrol','review','progress','break_start','break_update','break_return','break_cancel','assessment_update','assessment_prepare','assessment_confirm','assessment_start','manager_checkin','employee_declaration','withdrawal','achievement','completion_without_achievement') then
    raise exception using errcode='PT422',message='Invalid learner command'; end if;
  select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
  if not found then raise exception using errcode='PT403',message='Active employer membership required'; end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  -- Same lock as catalogue selection/archive; take before employee/learner locks.
  perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
  select e.* into v_employee from public.levytate_employees e join public.levytate_learner_records r on r.organisation_id=e.organisation_id and r.employee_id=e.id
    where r.organisation_id=p_organisation_id and r.id=p_learner_id and e.status='Active' for update of e;
  if not found then raise exception using errcode='PT404',message='Active learner employee not found'; end if;
  select * into v_before from public.levytate_learner_records where organisation_id=p_organisation_id and id=p_learner_id and record_status='Active' for update;
  if not found then raise exception using errcode='PT404',message='Active learner not found'; end if;
  if p_action='employee_declaration' then
    if v_actor.role not in ('Employee','Line Manager') or lower(btrim(v_actor.email))<>lower(btrim(v_employee.email)) then raise exception using errcode='PT403',message='Only the employee may make their declaration'; end if;
    if (select count(*) from public.levytate_employees where organisation_id=p_organisation_id and status='Active' and lower(btrim(email))=lower(btrim(v_actor.email)))<>1 then raise exception using errcode='PT403',message='Ambiguous employee identity'; end if;
  elsif p_action='manager_checkin' then
    if v_actor.role<>'Line Manager' or lower(btrim(v_actor.email))=lower(btrim(v_employee.email)) or not exists(
      select 1 from public.levytate_employees m where m.organisation_id=p_organisation_id and m.id=v_employee.manager_id and m.status='Active'
        and m.platform_role='Line Manager' and lower(btrim(m.email))=lower(btrim(v_actor.email))) then raise exception using errcode='PT403',message='Only the current direct manager may record this check-in'; end if;
  elsif v_actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Employer learner manager required'; end if;
  v_hash:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'input',p_command)::text,'UTF8')),'hex');
  select * into v_receipt from public.levytate_learner_command_receipts where organisation_id=p_organisation_id and learner_record_id=p_learner_id and request_id=p_request_id;
  if found then
    if v_receipt.actor_user_id<>p_actor_user_id or v_receipt.command_hash<>v_hash then raise exception using errcode='PT409',message='Learner request key already used for different input'; end if;
    return v_receipt.result;
  end if;
  if p_probe then return null; end if;
  if p_expected_revision is null or p_expected_revision<>v_before.mutation_revision then raise exception using errcode='PT409',message='Learner evidence changed; refresh'; end if;
  if jsonb_typeof(p_writes) is distinct from 'array' or jsonb_typeof(p_result) is distinct from 'object' or length(p_result::text)>65536 or length(p_writes::text)>262144 then raise exception using errcode='PT422',message='Invalid learner write plan'; end if;
  if jsonb_array_length(p_writes) not between 1 and 40 then raise exception using errcode='PT422',message='Learner plan is empty or too large'; end if;
  v_target:=case p_action when 'enrol' then 'enrolled' when 'break_start' then 'break_in_learning' when 'break_return' then 'enrolled'
    when 'assessment_prepare' then 'assessment_preparation' when 'assessment_start' then 'in_assessment'
    when 'withdrawal' then 'withdrawn' when 'achievement' then 'achieved' when 'completion_without_achievement' then 'completed_without_achievement' else v_before.lifecycle_status end;
  if p_action='break_cancel' then
    select (reason_notes::jsonb)->>'previousLifecycleStatus' into v_target from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active';
  end if;
  if (p_action in ('pre_enrolment','enrol','employee_declaration') and v_before.lifecycle_status<>'pre_enrolment')
    or (p_action in ('progress','assessment_update') and v_before.lifecycle_status not in ('enrolled','assessment_preparation','in_assessment'))
    or (p_action in ('review','manager_checkin') and v_before.lifecycle_status not in ('enrolled','assessment_preparation','in_assessment','break_in_learning'))
    or (p_action='break_start' and v_before.lifecycle_status not in ('enrolled','assessment_preparation'))
    or (p_action in ('break_update','break_return','break_cancel') and v_before.lifecycle_status<>'break_in_learning')
    or (p_action='assessment_prepare' and v_before.lifecycle_status<>'enrolled')
    or (p_action='withdrawal' and v_before.lifecycle_status not in ('pre_enrolment','enrolled','assessment_preparation','in_assessment','break_in_learning'))
    or (p_action in ('achievement','completion_without_achievement') and v_before.lifecycle_status<>'in_assessment')
    or (p_action in ('assessment_confirm','assessment_start') and v_before.lifecycle_status<>'assessment_preparation') then raise exception using errcode='PT409',message='Learner action is not valid at this journey step'; end if;
  v_allowed:=array['levytate_learner_lifecycle_events'];
  if p_action in ('pre_enrolment','enrol','break_start','break_return','break_cancel','assessment_prepare','assessment_start','withdrawal','achievement','completion_without_achievement') then v_allowed:=v_allowed||'levytate_learner_records'::text; end if;
  if p_action='pre_enrolment' then v_allowed:=v_allowed||array['levytate_learner_eligibility_declarations','levytate_learner_pre_enrolment_checks','levytate_learner_operational_actions']; end if;
  if p_action='employee_declaration' then v_allowed:=v_allowed||'levytate_learner_eligibility_declarations'::text; end if;
  if p_action in ('review','manager_checkin','enrol') then v_allowed:=v_allowed||'levytate_learner_reviews'::text; end if;
  if p_action in ('progress','enrol') then v_allowed:=v_allowed||'levytate_learner_progress_updates'::text; end if;
  if p_action in ('break_start','break_update','break_return','break_cancel') then v_allowed:=v_allowed||'levytate_learner_breaks_in_learning'::text; end if;
  if p_action like 'assessment_%' then v_allowed:=v_allowed||'levytate_learner_assessment_readiness'::text; end if;
  if p_action='withdrawal' then v_allowed:=v_allowed||array['levytate_learner_withdrawals','levytate_learner_breaks_in_learning']; end if;
  if p_action in ('achievement','completion_without_achievement') then v_allowed:=v_allowed||array['levytate_learner_achievements','levytate_learner_assessment_readiness']; end if;
  v_required:=case
    when p_action in ('review','manager_checkin') then array['levytate_learner_reviews']
    when p_action='progress' then array['levytate_learner_progress_updates']
    when p_action='employee_declaration' then array['levytate_learner_eligibility_declarations']
    when p_action='enrol' then array['levytate_learner_records','levytate_learner_progress_updates','levytate_learner_reviews']
    when p_action in ('break_start','break_return','break_cancel') then array['levytate_learner_records','levytate_learner_breaks_in_learning']
    when p_action='break_update' then array['levytate_learner_breaks_in_learning']
    when p_action in ('assessment_prepare','assessment_start') then array['levytate_learner_records','levytate_learner_assessment_readiness']
    when p_action like 'assessment_%' then array['levytate_learner_assessment_readiness'] else array[]::text[] end;
  if p_action='withdrawal' then v_required:=array['levytate_learner_records','levytate_learner_withdrawals']; end if;
  if p_action in ('achievement','completion_without_achievement') then v_required:=array['levytate_learner_records','levytate_learner_achievements','levytate_learner_assessment_readiness']; end if;
  if exists(select 1 from unnest(v_required) t where (select count(*) from jsonb_array_elements(p_writes) w where w->>'table'=t)<>1)
    or (p_action='pre_enrolment' and not exists(select 1 from jsonb_array_elements(p_writes) w where w->>'table'<>'levytate_learner_lifecycle_events'))
    or exists(select 1 from jsonb_array_elements(p_writes) w group by w->>'table',w->'row'->>'id' having count(*)>1) then
    raise exception using errcode='PT422',message='Exactly one required domain record must accompany learner evidence'; end if;
  if not exists(select 1 from jsonb_array_elements(p_writes) w where w->>'table'='levytate_learner_lifecycle_events') then raise exception using errcode='PT422',message='Lifecycle evidence is required'; end if;
  for v_write in select * from jsonb_array_elements(p_writes) loop
    v_table:=v_write->>'table'; v_row:=v_write->'row';
    if v_table is null or not(v_table=any(v_allowed)) or jsonb_typeof(v_row) is distinct from 'object'
      or v_row->>'organisation_id' is distinct from p_organisation_id::text or nullif(v_row->>'id','') is null then raise exception using errcode='PT403',message='Out-of-scope learner write'; end if;
    if v_table='levytate_learner_records' then
      if v_row->>'id'<>p_learner_id or v_row->>'employee_id' is distinct from v_before.employee_id or v_row->>'application_id' is distinct from v_before.application_id
        or v_row->>'enrolment_id' is distinct from v_before.enrolment_id or v_row->>'record_status' is distinct from v_before.record_status
        or (v_row->>'demonstration_record')::boolean is distinct from v_before.demonstration_record or v_row ? 'mutation_revision' then raise exception using errcode='PT403',message='Immutable learner identity cannot change'; end if;
      if v_row->>'lifecycle_status' is distinct from v_target then raise exception using errcode='PT403',message='Learner lifecycle transition is not authorised'; end if;
      if p_action<>'pre_enrolment' and (v_row->>'programme_id' is distinct from v_before.programme_id or v_row->>'provider_id' is distinct from v_before.provider_id
        or v_row->>'employment_route' is distinct from v_before.employment_route
        or (v_row->>'actual_start_date')::date is distinct from v_before.actual_start_date
        or (v_row->>'expected_start_date')::date is distinct from v_before.expected_start_date
        or (p_action not in ('withdrawal','achievement','completion_without_achievement') and (v_row->>'actual_end_date')::date is distinct from v_before.actual_end_date)
        or (p_action<>'break_return' and (v_row->>'expected_end_date')::date is distinct from v_before.expected_end_date)) then
        raise exception using errcode='PT403',message='This command cannot alter programme or journey dates'; end if;
    elsif v_row->>'learner_record_id' is distinct from p_learner_id then raise exception using errcode='PT403',message='Learner child record belongs to another learner'; end if;
    v_old:=null;
    execute format('select to_jsonb(t) from public.%I t where organisation_id=$1 and id=$2',v_table) into v_old using p_organisation_id,v_row->>'id';
    if v_old is not null and v_table<>'levytate_learner_records' and v_old->>'learner_record_id'<>p_learner_id then raise exception using errcode='PT403',message='Existing child identity belongs to another learner'; end if;
    if v_old is not null and v_table in ('levytate_learner_reviews','levytate_learner_progress_updates','levytate_learner_lifecycle_events','levytate_learner_withdrawals','levytate_learner_achievements') then raise exception using errcode='PT409',message='Recorded evidence is immutable'; end if;
    if v_table='levytate_learner_eligibility_declarations' then
      if p_action='employee_declaration' then
        if v_row->>'confirmed' is distinct from 'true' or v_row->>'confirmed_by_employee' is distinct from v_employee.id
          or v_row->>'verification_status' is distinct from 'employee_confirmed' or coalesce(v_row->>'verified_by','')<>'' or v_row->>'verified_at' is not null then raise exception using errcode='PT403',message='Employee cannot verify their own declaration'; end if;
        if v_row->>'declaration_type' is distinct from 'england_working_hours' or v_row->>'declaration_version' is distinct from '2026-07-operational-4a'
          or v_row->>'declaration_wording' is distinct from 'I confirm that I expect to spend at least 50% of my working hours in England over the duration of the apprenticeship.'
          or jsonb_typeof(v_row->'expected_england_working_hours_percentage') is distinct from 'number'
          or (v_row->>'expected_england_working_hours_percentage')::numeric not between 50 and 100 then raise exception using errcode='PT422',message='An explicit eligible employee declaration is required'; end if;
        v_row:=v_row||jsonb_build_object('confirmed_at',v_now,'updated_at',v_now);
      elsif (v_row->'confirmed') is distinct from coalesce(v_old->'confirmed','false'::jsonb)
        or coalesce(v_row->>'confirmed_by_employee','')<>coalesce(v_old->>'confirmed_by_employee','')
        or (v_row->>'confirmed_at')::timestamptz is distinct from (v_old->>'confirmed_at')::timestamptz
        or v_row->'expected_england_working_hours_percentage' is distinct from coalesce(v_old->'expected_england_working_hours_percentage','null'::jsonb)
        or (v_old is not null and (v_row->>'declaration_wording' is distinct from v_old->>'declaration_wording' or v_row->>'declaration_version' is distinct from v_old->>'declaration_version')) then raise exception using errcode='PT403',message='Employer cannot fabricate the employee declaration'; end if;
      if p_action='pre_enrolment' then
        if v_row->>'verification_status'='employer_verified' and (v_old->>'confirmed' is distinct from 'true' or (v_old->>'expected_england_working_hours_percentage')::numeric<50) then raise exception using errcode='PT422',message='Employee confirmation must precede employer verification'; end if;
        v_row:=v_row||jsonb_build_object('verified_by',v_actor.email,'verified_at',v_now);
      end if;
    end if;
    if v_table='levytate_learner_reviews' then
      if v_row->>'reviewer_user_id' is distinct from v_actor.id::text or (p_action='manager_checkin' and v_row->>'review_type' is distinct from 'manager_check_in') then raise exception using errcode='PT403',message='Review actor is not authoritative'; end if;
      if nullif(btrim(v_row->>'reviewer_name'),'') is null or (v_row->>'review_date')::date<v_before.actual_start_date
        or (p_action<>'enrol' and (v_row->>'review_date')::date>current_date+7)
        or (v_row->>'next_review_date')::date<(v_row->>'review_date')::date
        or (v_row->>'review_type'='provider_review' and v_row->>'provider_id' is distinct from v_before.provider_id)
        or (v_before.lifecycle_status='break_in_learning' and v_row->>'review_type' not in ('manager_check_in','l_and_d_check_in')) then raise exception using errcode='PT422',message='Review evidence must match the learner journey'; end if;
    end if;
    if v_table='levytate_learner_progress_updates' then
      if jsonb_typeof(v_row->'target_progress_percentage') is distinct from 'number' or jsonb_typeof(v_row->'actual_progress_percentage') is distinct from 'number'
        or (v_row->>'variance_percentage')::numeric is distinct from round((v_row->>'actual_progress_percentage')::numeric-(v_row->>'target_progress_percentage')::numeric,2)
        or (v_row->>'update_date')::date<v_before.actual_start_date or (v_row->>'update_date')::date>current_date+7 or (p_action='enrol' and nullif(btrim(v_row->>'summary'),'') is null) then raise exception using errcode='PT422',message='Progress evidence is inconsistent'; end if;
      v_row:=v_row||jsonb_build_object('updated_by',v_actor.email);
    end if;
    if v_table='levytate_learner_breaks_in_learning' then
      -- The existing application serializer stores these fields as a versioned
      -- object in reason_notes, not as separate historical table columns.
      v_break:=(v_row->>'reason_notes')::jsonb;
      v_old_break:=case when v_old is null then null else (v_old->>'reason_notes')::jsonb end;
      if jsonb_typeof(v_break) is distinct from 'object' or v_break->'schemaVersion' is distinct from '1'::jsonb
        or v_break->>'previousLifecycleStatus' is null or v_break->>'previousLifecycleStatus' not in ('enrolled','assessment_preparation') then raise exception using errcode='PT422',message='Versioned break operational evidence is required'; end if;
      if (p_action='break_start' and (v_old is not null or v_break->>'previousLifecycleStatus' is distinct from v_before.lifecycle_status))
        or (p_action<>'break_start' and (v_old is null or v_old->>'status' is distinct from 'active' or v_break->>'previousLifecycleStatus' is distinct from v_old_break->>'previousLifecycleStatus'))
        or v_row->>'status' is distinct from (case p_action when 'break_return' then 'returned' when 'break_cancel' then 'cancelled' when 'withdrawal' then 'converted_to_withdrawal' else 'active' end) then raise exception using errcode='PT409',message='Break transition does not match the current record'; end if;
      if nullif(v_break->>'effectiveLifecycleDate','') is null or (v_break->>'effectiveLifecycleDate')::date>current_date+7
        or (v_row->>'start_date')::date<v_before.actual_start_date or (v_row->>'start_date')::date>current_date+7
        or (v_row->>'expected_return_date')::date<(v_row->>'start_date')::date
        or jsonb_typeof(v_break->'expectedReturnUnknown') is distinct from 'boolean'
        or (v_break->>'expectedReturnUnknown'='true' and (nullif(v_break->>'reviewDate','') is null or v_row->>'expected_return_date' is not null or (v_break->>'reviewDate')::date<(v_row->>'start_date')::date))
        or (v_break->>'expectedReturnUnknown' is distinct from 'true' and v_row->>'expected_return_date' is null) then raise exception using errcode='PT422',message='Break dates and return plan are required'; end if;
      if p_action='break_return' and (v_break->'programmeStillValidConfirmed' is distinct from 'true'::jsonb or v_break->'providerReturnConfirmed' is distinct from 'true'::jsonb
        or v_break->'managerReturnConfirmed' is distinct from 'true'::jsonb or v_break->'learnerReturnConfirmed' is distinct from 'true'::jsonb
        or nullif(btrim(v_break->>'returnConfirmationNote'),'') is null or v_row->>'actual_return_date' is null
        or (v_row->>'actual_return_date')::date<(v_row->>'start_date')::date) then raise exception using errcode='PT422',message='All return arrangements and an actual return date are required'; end if;
      if p_action='break_cancel' and nullif(btrim(v_break->>'cancellationReason'),'') is null then raise exception using errcode='PT422',message='Break cancellation reason required'; end if;
    end if;
    if v_table='levytate_learner_assessment_readiness' then
      if v_row->>'assessment_status' is distinct from (case p_action when 'assessment_prepare' then 'preparing' when 'assessment_confirm' then 'readiness_confirmed' when 'assessment_start' then 'in_assessment' when 'achievement' then 'completed' when 'completion_without_achievement' then 'unsuccessful' else coalesce(v_old->>'assessment_status','not_started') end)
        or (p_action='assessment_start' and v_old->>'assessment_status' is distinct from 'readiness_confirmed')
        or (p_action in ('achievement','completion_without_achievement') and v_old->>'assessment_status' is distinct from 'in_assessment') then raise exception using errcode='PT403',message='Assessment state requires its own authorised transition'; end if;
      if p_action='assessment_confirm' then v_row:=v_row||jsonb_build_object('readiness_confirmed_by',v_actor.email,'readiness_confirmed_at',v_now); end if;
    end if;
    if v_table in ('levytate_learner_withdrawals','levytate_learner_achievements') then
      v_row:=v_row||jsonb_build_object('recorded_by',v_actor.email,'recorded_at',v_now);
      if v_table='levytate_learner_withdrawals' and (nullif(btrim(v_row->>'reason_category'),'') is null or nullif(btrim(v_row->>'reason_notes'),'') is null
        or nullif(btrim(v_row->>'initiated_by'),'') is null or v_row->>'effective_date' is null
        or (v_row->>'provider_notified'='true' and v_row->>'provider_notified_date' is null) or (v_row->>'employee_notified'='true' and v_row->>'employee_notified_date' is null)) then raise exception using errcode='PT422',message='Withdrawal evidence and notification dates required'; end if;
      if v_table='levytate_learner_achievements' and (nullif(btrim(v_row->>'result_notes'),'') is null or v_row->>'actual_achievement_date' is null
        or (p_action='achievement' and (nullif(btrim(v_row->>'grade'),'') is null or nullif(btrim(v_row->>'grade_type'),'') is null))
        or (p_action='completion_without_achievement' and (v_row->>'grade' is distinct from 'Not achieved' or v_row->>'certificate_received' is distinct from 'false'))
        or (v_row->>'certificate_received'='true' and (v_row->>'certificate_received_date' is null or (v_row->>'certificate_received_date')::date<(v_row->>'actual_achievement_date')::date))) then raise exception using errcode='PT422',message='Confirmed outcome evidence required'; end if;
    end if;
    if v_table='levytate_learner_lifecycle_events' then v_row:=v_row||jsonb_build_object('actor_user_id',v_actor.id::text,'actor_name',v_actor.email,'source','levytate_server'); end if;
    if exists(select 1 from jsonb_object_keys(v_row) k where not exists(select 1 from pg_attribute a where a.attrelid=('public.'||v_table)::regclass and a.attname=k and a.attnum>0 and not a.attisdropped)) then raise exception using errcode='PT422',message='Unknown learner field'; end if;
    select string_agg(format('%I',k),','),string_agg(format('%I=excluded.%I',k,k),',') filter(where k not in ('organisation_id','id','created_at','created_by'))
      into v_columns,v_updates from jsonb_object_keys(v_row) k;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict(organisation_id,id) do update set %s',v_table,v_columns,v_columns,v_table,v_updates) using v_row;
  end loop;
  select * into v_after from public.levytate_learner_records where organisation_id=p_organisation_id and id=p_learner_id;
  if v_after.lifecycle_status is distinct from v_target then raise exception using errcode='PT422',message='Required lifecycle change missing'; end if;
  if p_action in ('pre_enrolment','enrol') then
    select * into v_app from public.levytate_applications where organisation_id=p_organisation_id and id=v_after.application_id for update;
    if not found or v_app.employee_id<>v_after.employee_id or v_app.status<>'Approved for Enrolment' or v_app.current_owner<>'Provider Partner' then raise exception using errcode='PT403',message='Final-approved matching application required'; end if;
    if not exists(select 1 from public.levytate_organisation_programmes s
      join public.levytate_provider_programmes p on p.id=s.programme_id and p.provider_id=s.provider_id
      join public.levytate_organisations o on o.id=p.organisation_id and o.slug='levytate-internal'
      join public.levytate_providers provider on provider.organisation_id=p.organisation_id and provider.provider_id=p.provider_id and provider.status='Active' and provider.verification_status='verified'
      join public.levytate_organisation_providers selected on selected.organisation_id=s.organisation_id and selected.provider_id=s.provider_id and selected.status='Active'
      where s.organisation_id=p_organisation_id and s.programme_id=v_after.programme_id and s.provider_id=v_after.provider_id and s.status='Active'
        and p.status='Active' and p.record_status='Active' and p.verification_status in ('Verified from provider website','Provider confirmed','LevyTate reviewed')
        and (p.linked_standard_id=v_app.apprenticeship_standard_id or p.linked_standard_ids ? v_app.apprenticeship_standard_id)) then raise exception using errcode='PT422',message='Programme/provider no longer match approved employer selection'; end if;
    if v_after.expected_end_date is not null and coalesce(v_after.actual_start_date,v_after.expected_start_date)>=v_after.expected_end_date then raise exception using errcode='PT422',message='End date must follow start date'; end if;
  end if;
  if p_action='enrol' then
    if v_after.employment_route='not_confirmed' or v_after.actual_start_date is null or v_after.expected_end_date is null
      or not exists(select 1 from public.levytate_learner_eligibility_declarations where organisation_id=p_organisation_id and learner_record_id=p_learner_id and confirmed and verification_status='employer_verified')
      or not exists(select 1 from public.levytate_learner_pre_enrolment_checks where organisation_id=p_organisation_id and learner_record_id=p_learner_id and probation_status in ('passed','not_required') and hr_approval_status='approved')
      or not exists(select 1 from jsonb_array_elements(p_writes) w where w->>'table'='levytate_learner_progress_updates')
      or not exists(select 1 from jsonb_array_elements(p_writes) w where w->>'table'='levytate_learner_reviews' and w->'row'->>'status'='scheduled' and w->'row'->>'review_type'='provider_review') then raise exception using errcode='PT422',message='Readiness, explicit initial progress and first provider review are required'; end if;
    v_enrolment:='enrolment-'||gen_random_uuid();
    insert into public.levytate_enrolments(organisation_id,id,application_id,employee_id,provider_id,apprenticeship_standard_id,status,start_date,notes)
      values(p_organisation_id,v_enrolment,v_app.id,v_after.employee_id,v_after.provider_id,v_app.apprenticeship_standard_id,'Live learner',v_after.actual_start_date,'Confirmed through learner readiness and initial evidence.');
    update public.levytate_learner_records set enrolment_id=v_enrolment where organisation_id=p_organisation_id and id=p_learner_id;
    update public.levytate_applications set status='Completed',current_owner='Completed',revision=revision+1 where organisation_id=p_organisation_id and id=v_app.id;
    insert into public.levytate_application_history(organisation_id,id,application_id,status,owner,note,created_at)
      values(p_organisation_id,'history-'||gen_random_uuid(),v_app.id,'Completed','Completed','Enrolment completed with initial progress and review evidence.',v_now);
  end if;
  if p_action in ('break_start','break_update') and not exists(select 1 from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active') then raise exception using errcode='PT422',message='Active break record required'; end if;
  if p_action in ('break_return','break_cancel') and exists(select 1 from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active') then raise exception using errcode='PT422',message='Break must close atomically'; end if;
  if p_action in ('assessment_prepare','assessment_confirm','assessment_start') and exists(select 1 from public.levytate_operational_actions where organisation_id=p_organisation_id and learner_record_id=p_learner_id and priority='Critical' and status in ('open','acknowledged','in_progress') and source_type<>'assessment_readiness') then raise exception using errcode='PT409',message='Critical operational blockers remain'; end if;
  if p_action in ('assessment_confirm','assessment_start') then
    select * into v_readiness from public.levytate_learner_assessment_readiness where organisation_id=p_organisation_id and learner_record_id=p_learner_id;
    if not found or v_readiness.readiness_confirmed_at is null or v_readiness.assessment_model='not_confirmed'
      or coalesce(v_readiness.expected_assessment_readiness_date,v_readiness.gateway_date) is null
      or (v_readiness.assessment_model='end_point_assessment' and v_readiness.gateway_date is null)
      or (v_readiness.assessment_model in ('end_point_assessment','other') and btrim(v_readiness.assessment_organisation)='')
      or exists(select 1 from unnest(array['provider','learner','line_manager','employer']) t where v_readiness.confirmations->t->>'status' is distinct from 'confirmed')
      or not exists(select 1 from public.levytate_learner_progress_updates where organisation_id=p_organisation_id and learner_record_id=p_learner_id)
      or not exists(select 1 from public.levytate_learner_reviews where organisation_id=p_organisation_id and learner_record_id=p_learner_id and review_type='provider_review' and status in ('completed','action_required'))
      or exists(select 1 from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active') then raise exception using errcode='PT422',message='Current evidence and all assessment readiness confirmations are required'; end if;
    select * into v_progress from public.levytate_learner_progress_updates where organisation_id=p_organisation_id and learner_record_id=p_learner_id order by update_date desc,created_at desc,id desc limit 1;
    select * into v_review from public.levytate_learner_reviews where organisation_id=p_organisation_id and learner_record_id=p_learner_id and review_type='provider_review' and status in ('completed','action_required') order by review_date desc,created_at desc,id desc limit 1;
    -- Match the existing learner progress policy; planned reviews are not evidence.
    if v_progress.update_date<current_date-60 or v_review.next_review_date<current_date then raise exception using errcode='PT409',message='Refresh overdue progress or provider review evidence before assessment'; end if;
  end if;
  if p_action in ('withdrawal','achievement','completion_without_achievement') then
    if v_after.actual_end_date is null or v_after.actual_end_date<v_after.actual_start_date or v_after.actual_end_date>current_date+7
      or exists(select 1 from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active') then raise exception using errcode='PT422',message='A valid outcome date and closure of any active break are required'; end if;
    if p_action='withdrawal' and not exists(select 1 from public.levytate_learner_withdrawals where organisation_id=p_organisation_id and learner_record_id=p_learner_id and effective_date=v_after.actual_end_date and withdrawal_date=v_after.actual_end_date) then raise exception using errcode='PT422',message='Withdrawal and learner dates must match'; end if;
    if p_action<>'withdrawal' and not exists(select 1 from public.levytate_learner_achievements a join public.levytate_learner_assessment_readiness r using(organisation_id,learner_record_id)
      where a.organisation_id=p_organisation_id and a.learner_record_id=p_learner_id and a.actual_achievement_date=v_after.actual_end_date and r.assessment_start_date<=v_after.actual_end_date) then raise exception using errcode='PT422',message='Outcome must follow the recorded assessment start'; end if;
    if v_after.enrolment_id<>'' then
      update public.levytate_enrolments set status=case when p_action='withdrawal' then 'Cancelled' else 'Completed' end
        where organisation_id=p_organisation_id and id=v_after.enrolment_id and application_id=v_after.application_id and employee_id=v_after.employee_id;
      if not found then raise exception using errcode='PT409',message='Matching enrolment record is missing'; end if;
    elsif p_action='withdrawal' and v_before.lifecycle_status='pre_enrolment' then
      update public.levytate_applications set status='Cancelled',current_owner='Completed',revision=revision+1
        where organisation_id=p_organisation_id and id=v_after.application_id and employee_id=v_after.employee_id and status='Approved for Enrolment';
      if not found then raise exception using errcode='PT409',message='Matching approved application is missing'; end if;
      insert into public.levytate_application_history(organisation_id,id,application_id,status,owner,note,created_at)
        values(p_organisation_id,'history-'||gen_random_uuid(),v_after.application_id,'Cancelled','Completed','Pre-enrolment withdrawn with learner evidence.',v_now);
    end if;
  end if;
  update public.levytate_learner_records set mutation_revision=mutation_revision+1,updated_at=v_now,updated_by=v_actor.email where organisation_id=p_organisation_id and id=p_learner_id;
  insert into public.levytate_learner_command_receipts(organisation_id,learner_record_id,request_id,actor_user_id,command_hash,result) values(p_organisation_id,p_learner_id,p_request_id,p_actor_user_id,v_hash,p_result);
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'learner',p_learner_id,'learner.'||p_action,'Learner evidence committed atomically.',jsonb_build_object('requestId',p_request_id,'revision',v_before.mutation_revision+1));
  return p_result;
exception when invalid_datetime_format or datetime_field_overflow or check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range then raise exception using errcode='PT422',message='Learner evidence is invalid';
  when unique_violation then raise exception using errcode='PT409',message='Learner evidence already exists';
end; $$;
revoke all on function public.levytate_apply_learner_command(uuid,uuid,text,text,text,jsonb,integer,jsonb,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_learner_command(uuid,uuid,text,text,text,jsonb,integer,jsonb,jsonb,boolean) to service_role;
