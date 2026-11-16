-- LOCAL REVIEW CANDIDATE ONLY. Not authorised for hosted execution.
-- Applies after the approved convergence OR the canonical shared history.
-- Existing duplicate active records stop this migration; none are deleted.
alter table public.levytate_applications
  add column revision integer not null default 0 check (revision >= 0),
  add column information_return_owner text check (information_return_owner in ('Line Manager', 'Apprenticeship Lead', 'Employer Admin'));

create unique index levytate_applications_one_active_employee
  on public.levytate_applications (organisation_id, employee_id)
  where status in ('Draft', 'Submitted to Line Manager', 'Awaiting Manager Review',
    'More information requested', 'Approved by Line Manager',
    'Submitted to Apprenticeship Lead', 'Awaiting Final Approval', 'Approved for Enrolment');

create table public.levytate_application_command_receipts (
  organisation_id uuid not null references public.levytate_organisations(id),
  application_id text not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  actor_user_id uuid not null references public.levytate_users(id),
  command jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (organisation_id, application_id, idempotency_key),
  foreign key (organisation_id, application_id) references public.levytate_applications(organisation_id, id)
);
alter table public.levytate_application_command_receipts enable row level security;
alter table public.levytate_application_command_receipts force row level security;
revoke all on public.levytate_application_command_receipts from public, anon, authenticated, service_role;
grant select on public.levytate_application_command_receipts to service_role;
create policy application_receipts_service_read on public.levytate_application_command_receipts for select to service_role using (true);

-- A service-only RPC is the sole application write boundary. Actor/ownership,
-- answers, progression, projection, receipt and audit commit in one transaction.
create function public.levytate_apply_application_command(
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
    if v_actor.role='Line Manager' or (v_actor.role='Employee' and not v_own) then raise exception using errcode='PT403',message='Draft editing is not permitted'; end if;
    if p_action='save_and_submit' and (v_actor.role<>'Employee' or not v_own) then raise exception using errcode='PT403',message='Only the employee may submit'; end if;
    if not v_new and (v_app.status not in ('Draft','More information requested') or
      (v_app.status='More information requested' and (v_actor.role<>'Employee' or not v_own))) then
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
    if not v_own or v_actor.role<>'Employee' or v_instance.id is not null or v_app.status not in ('Draft','Submitted to Line Manager','Awaiting Manager Review','More information requested','Approved by Line Manager','Submitted to Apprenticeship Lead','Awaiting Final Approval') then
      raise exception using errcode='PT403',message='This application cannot be withdrawn by this actor'; end if;
    v_status := 'Withdrawn'; v_owner := 'Completed';
  else
    if p_action='save_and_submit' then v_event_action := case when v_app.status='More information requested' then 'resubmit' else 'submit' end; end if;
    if v_event_action in ('submit','resubmit') then
      if v_actor.role<>'Employee' or not v_own or (v_event_action='submit' and v_app.status<>'Draft')
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
revoke insert,update,delete on public.levytate_applications,public.levytate_application_history from service_role;
revoke execute on function public.levytate_start_application_workflow(uuid,text,uuid,text) from service_role;
revoke execute on function public.levytate_transition_application_workflow(uuid,text,uuid,text,text,text,integer) from service_role;

create unique index levytate_learner_records_one_active_employee
  on public.levytate_learner_records(organisation_id,employee_id)
  where record_status='Active' and lifecycle_status not in ('withdrawn','achieved','completed_without_achievement');

create function public.levytate_start_pre_enrolment(
  p_organisation_id uuid,p_actor_user_id uuid,p_application_id text,p_expected_revision integer,
  p_idempotency_key text,p_input jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_app public.levytate_applications%rowtype;
  v_record public.levytate_learner_records%rowtype;
  v_receipt public.levytate_application_command_receipts%rowtype;
  v_command jsonb:=jsonb_build_object('action','start_pre_enrolment','revision',p_expected_revision,'fields',p_input);
  v_employee_id text;
  v_now timestamptz:=clock_timestamp();
begin
  if p_organisation_id is null or p_actor_user_id is null or p_application_id is null or p_idempotency_key is null
    or p_application_id !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{1,127}$'
    or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,128}$' or p_expected_revision is null or p_expected_revision<0
    or jsonb_typeof(p_input) is distinct from 'object' then
    raise exception using errcode='PT422',message='Invalid pre-enrolment command'; end if;
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in
      ('employeeId','programmeId','providerId','employmentRoute','expectedStartDate','expectedEndDate')) then
    raise exception using errcode='PT422',message='Invalid pre-enrolment command'; end if;
  if not (p_input ?& array['employeeId','programmeId','providerId','employmentRoute','expectedStartDate','expectedEndDate'])
    or exists(select 1 from jsonb_each(p_input) f where jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>128)
    or p_input->>'expectedStartDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or p_input->>'expectedEndDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode='PT422',message='Pre-enrolment fields have invalid types'; end if;
  select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
  if not found or v_actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Pre-enrolment requires an active authorised employer account'; end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  select employee_id into v_employee_id from public.levytate_applications where organisation_id=p_organisation_id and id=p_application_id;
  perform 1 from public.levytate_employees where organisation_id=p_organisation_id and id=v_employee_id and status='Active' for update;
  if not found then raise exception using errcode='PT403',message='Active application employee required'; end if;
  select * into v_app from public.levytate_applications where organisation_id=p_organisation_id and id=p_application_id for update;
  select * into v_receipt from public.levytate_application_command_receipts where organisation_id=p_organisation_id and application_id=p_application_id and idempotency_key=p_idempotency_key;
  if found then
    if v_receipt.actor_user_id<>p_actor_user_id or v_receipt.command<>v_command then raise exception using errcode='PT409',message='Idempotency key was already used'; end if;
    return v_receipt.result;
  end if;
  if v_app.revision<>p_expected_revision then raise exception using errcode='PT409',message='Application changed; refresh before handoff'; end if;
  if v_app.status<>'Approved for Enrolment' or v_app.current_owner<>'Provider Partner' or p_input->>'employeeId' is distinct from v_app.employee_id then
    raise exception using errcode='PT403',message='Final-approved matching application required'; end if;
  if exists(select 1 from public.levytate_application_workflow_instances where organisation_id=p_organisation_id and application_id=p_application_id and state<>'ready_for_provider') then
    raise exception using errcode='PT403',message='The pinned approval workflow is not complete'; end if;
  if not exists (select 1 from public.levytate_organisation_programmes s
    join public.levytate_provider_programmes p on p.id=s.programme_id and p.provider_id=s.provider_id
    join public.levytate_organisations catalog on catalog.id=p.organisation_id and catalog.slug='levytate-internal'
    join public.levytate_providers provider on provider.organisation_id=p.organisation_id and provider.provider_id=p.provider_id and provider.status='Active' and provider.verification_status='verified'
    join public.levytate_organisation_providers r on r.organisation_id=s.organisation_id and r.provider_id=s.provider_id and r.status='Active'
    where s.organisation_id=p_organisation_id and s.programme_id=p_input->>'programmeId' and s.provider_id=p_input->>'providerId'
      and s.status='Active' and p.status='Active' and p.record_status='Active'
      and p.verification_status in ('Verified from provider website','Provider confirmed','LevyTate reviewed')
      and (p.linked_standard_id=v_app.apprenticeship_standard_id or p.linked_standard_ids ? v_app.apprenticeship_standard_id)) then
    raise exception using errcode='PT422',message='Selected programme/provider must match the approved application'; end if;
  if p_input->>'employmentRoute' not in ('not_confirmed','existing_employee_upskill','recruited_as_apprentice')
    or nullif(p_input->>'expectedStartDate','') is null or nullif(p_input->>'expectedEndDate','') is null
    or (p_input->>'expectedEndDate')::date<=(p_input->>'expectedStartDate')::date then
    raise exception using errcode='PT422',message='Valid employment route and planned dates required'; end if;
  insert into public.levytate_learner_records(organisation_id,id,employee_id,application_id,programme_id,provider_id,lifecycle_status,employment_route,
      expected_start_date,expected_end_date,created_by,updated_by,record_status,demonstration_record)
    values(p_organisation_id,'learner-'||gen_random_uuid(),v_app.employee_id,p_application_id,p_input->>'programmeId',p_input->>'providerId','pre_enrolment',
      p_input->>'employmentRoute',(p_input->>'expectedStartDate')::date,(p_input->>'expectedEndDate')::date,v_actor.email,v_actor.email,'Active',false) returning * into v_record;
  insert into public.levytate_learner_lifecycle_events(organisation_id,id,learner_record_id,event_type,previous_status,new_status,event_date,actor_user_id,actor_name,source,summary,metadata)
    values(p_organisation_id,'event-'||gen_random_uuid(),v_record.id,'learner_record_created','','pre_enrolment',v_now,v_actor.id::text,v_actor.email,
      'levytate_server','Final-approved application handed to pre-enrolment.',jsonb_build_object('applicationId',p_application_id,'applicationRevision',v_app.revision));
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'learner',v_record.id,'learner.pre_enrolment_started','Approved application handed to pre-enrolment.',jsonb_build_object('applicationId',p_application_id,'idempotencyKey',p_idempotency_key));
  insert into public.levytate_application_command_receipts(organisation_id,application_id,idempotency_key,actor_user_id,command,result)
    values(p_organisation_id,p_application_id,p_idempotency_key,p_actor_user_id,v_command,to_jsonb(v_record));
  return to_jsonb(v_record);
exception when unique_violation then raise exception using errcode='PT409',message='A learner already exists for this application or employee; open the existing record';
end;
$$;
revoke all on function public.levytate_start_pre_enrolment(uuid,uuid,text,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_start_pre_enrolment(uuid,uuid,text,integer,text,jsonb) to service_role;
