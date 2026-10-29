-- LOCAL REVIEW ONLY. Application server builds bounded, action-specific plans;
-- this service-only boundary independently checks authority and final invariants.
alter table public.levytate_learner_records add column mutation_revision integer not null default 0 check(mutation_revision>=0);
create unique index levytate_learner_eligibility_one_record on public.levytate_learner_eligibility_declarations(organisation_id,learner_record_id);
create unique index levytate_learner_one_active_break on public.levytate_learner_breaks_in_learning(organisation_id,learner_record_id) where status='active';
create unique index levytate_enrolments_one_application on public.levytate_enrolments(organisation_id,application_id);
create table public.levytate_learner_command_receipts(
  organisation_id uuid not null references public.levytate_organisations(id),
  learner_record_id text not null,
  request_id text not null,
  actor_user_id uuid not null references public.levytate_users(id),
  command_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(organisation_id,learner_record_id,request_id),
  foreign key(organisation_id,learner_record_id) references public.levytate_learner_records(organisation_id,id)
);
alter table public.levytate_learner_command_receipts enable row level security;
alter table public.levytate_learner_command_receipts force row level security;
revoke all on public.levytate_learner_command_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_learner_command_receipts to service_role;
create policy learner_receipts_read on public.levytate_learner_command_receipts for select to service_role using(true);

create function public.levytate_apply_learner_command(
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
  v_now timestamptz:=clock_timestamp();
  v_enrolment text;
begin
  if p_organisation_id is null or p_actor_user_id is null or p_learner_id is null or p_action is null or p_request_id is null or p_command is null or p_probe is null
    or p_request_id !~ '^[A-Za-z0-9:_-]{8,128}$' or length(p_command::text)>65536
    or p_action not in ('pre_enrolment','enrol','review','progress','break_start','break_update','break_return','break_cancel','assessment_update','assessment_prepare','assessment_confirm','assessment_start','manager_checkin','employee_declaration') then
    raise exception using errcode='PT422',message='Invalid learner command'; end if;
  select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
  if not found then raise exception using errcode='PT403',message='Active employer membership required'; end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  select e.* into v_employee from public.levytate_employees e join public.levytate_learner_records r on r.organisation_id=e.organisation_id and r.employee_id=e.id
    where r.organisation_id=p_organisation_id and r.id=p_learner_id and e.status='Active' for update of e;
  if not found then raise exception using errcode='PT404',message='Active learner employee not found'; end if;
  select * into v_before from public.levytate_learner_records where organisation_id=p_organisation_id and id=p_learner_id and record_status='Active' for update;
  if not found then raise exception using errcode='PT404',message='Active learner not found'; end if;
  if p_action='employee_declaration' then
    if v_actor.role<>'Employee' or lower(btrim(v_actor.email))<>lower(btrim(v_employee.email)) then raise exception using errcode='PT403',message='Only the employee may make their declaration'; end if;
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
  if jsonb_typeof(p_writes) is distinct from 'array' or p_result is null or length(p_writes::text)>262144 then raise exception using errcode='PT422',message='Invalid learner write plan'; end if;
  if jsonb_array_length(p_writes) not between 1 and 40 then raise exception using errcode='PT422',message='Learner plan is empty or too large'; end if;
  v_target:=case p_action when 'enrol' then 'enrolled' when 'break_start' then 'break_in_learning' when 'break_return' then 'enrolled'
    when 'assessment_prepare' then 'assessment_preparation' when 'assessment_start' then 'in_assessment' else v_before.lifecycle_status end;
  if p_action='break_cancel' then
    select previous_lifecycle_status into v_target from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active';
  end if;
  if (p_action in ('pre_enrolment','enrol','employee_declaration') and v_before.lifecycle_status<>'pre_enrolment')
    or (p_action in ('progress','assessment_update') and v_before.lifecycle_status not in ('enrolled','assessment_preparation','in_assessment'))
    or (p_action in ('review','manager_checkin') and v_before.lifecycle_status not in ('enrolled','assessment_preparation','in_assessment','break_in_learning'))
    or (p_action='break_start' and v_before.lifecycle_status not in ('enrolled','assessment_preparation'))
    or (p_action in ('break_update','break_return','break_cancel') and v_before.lifecycle_status<>'break_in_learning')
    or (p_action='assessment_prepare' and v_before.lifecycle_status<>'enrolled')
    or (p_action in ('assessment_confirm','assessment_start') and v_before.lifecycle_status<>'assessment_preparation') then raise exception using errcode='PT409',message='Learner action is not valid at this journey step'; end if;
  v_allowed:=array['levytate_learner_lifecycle_events'];
  if p_action in ('pre_enrolment','enrol','break_start','break_return','break_cancel','assessment_prepare','assessment_start') then v_allowed:=v_allowed||'levytate_learner_records'::text; end if;
  if p_action='pre_enrolment' then v_allowed:=v_allowed||array['levytate_learner_eligibility_declarations','levytate_learner_pre_enrolment_checks','levytate_learner_operational_actions']; end if;
  if p_action='employee_declaration' then v_allowed:=v_allowed||'levytate_learner_eligibility_declarations'::text; end if;
  if p_action in ('review','manager_checkin','enrol') then v_allowed:=v_allowed||'levytate_learner_reviews'::text; end if;
  if p_action in ('progress','enrol') then v_allowed:=v_allowed||'levytate_learner_progress_updates'::text; end if;
  if p_action in ('break_start','break_update','break_return','break_cancel') then v_allowed:=v_allowed||'levytate_learner_breaks_in_learning'::text; end if;
  if p_action like 'assessment_%' then v_allowed:=v_allowed||'levytate_learner_assessment_readiness'::text; end if;
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
    elsif v_row->>'learner_record_id' is distinct from p_learner_id then raise exception using errcode='PT403',message='Learner child record belongs to another learner'; end if;
    v_old:=null;
    execute format('select to_jsonb(t) from public.%I t where organisation_id=$1 and id=$2',v_table) into v_old using p_organisation_id,v_row->>'id';
    if v_old is not null and v_table<>'levytate_learner_records' and v_old->>'learner_record_id'<>p_learner_id then raise exception using errcode='PT403',message='Existing child identity belongs to another learner'; end if;
    if v_old is not null and v_table in ('levytate_learner_reviews','levytate_learner_progress_updates','levytate_learner_lifecycle_events') then raise exception using errcode='PT409',message='Recorded evidence is immutable'; end if;
    if v_table='levytate_learner_eligibility_declarations' then
      if p_action='employee_declaration' then
        if v_row->>'confirmed' is distinct from 'true' or v_row->>'confirmed_by_employee' is distinct from v_employee.id
          or v_row->>'verification_status'<>'employee_confirmed' or coalesce(v_row->>'verified_by','')<>'' then raise exception using errcode='PT403',message='Employee cannot verify their own declaration'; end if;
      elsif (v_row->'confirmed') is distinct from coalesce(v_old->'confirmed','false'::jsonb)
        or coalesce(v_row->>'confirmed_by_employee','')<>coalesce(v_old->>'confirmed_by_employee','')
        or (v_row->>'confirmed_at')::timestamptz is distinct from (v_old->>'confirmed_at')::timestamptz then raise exception using errcode='PT403',message='Employer cannot fabricate the employee declaration'; end if;
    end if;
    if v_table='levytate_learner_reviews' and (v_row->>'reviewer_user_id' is distinct from v_actor.id::text or
      (p_action='manager_checkin' and v_row->>'review_type'<>'manager_check_in')) then raise exception using errcode='PT403',message='Review actor is not authoritative'; end if;
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
      values(p_organisation_id,v_enrolment,v_app.id,v_after.employee_id,v_after.provider_id,v_app.apprenticeship_standard_id,'Enrolled',v_after.actual_start_date,'Confirmed through learner readiness and initial evidence.');
    update public.levytate_learner_records set enrolment_id=v_enrolment where organisation_id=p_organisation_id and id=p_learner_id;
    update public.levytate_applications set status='Completed',current_owner='Completed',revision=revision+1 where organisation_id=p_organisation_id and id=v_app.id;
    insert into public.levytate_application_history(organisation_id,id,application_id,status,owner,note,created_at)
      values(p_organisation_id,'history-'||gen_random_uuid(),v_app.id,'Completed','Completed','Enrolment completed with initial progress and review evidence.',v_now);
  end if;
  if p_action in ('break_start','break_update') and not exists(select 1 from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active') then raise exception using errcode='PT422',message='Active break record required'; end if;
  if p_action in ('break_return','break_cancel') and exists(select 1 from public.levytate_learner_breaks_in_learning where organisation_id=p_organisation_id and learner_record_id=p_learner_id and status='active') then raise exception using errcode='PT422',message='Break must close atomically'; end if;
  if p_action in ('assessment_prepare','assessment_confirm','assessment_start') and exists(select 1 from public.levytate_operational_actions where organisation_id=p_organisation_id and learner_record_id=p_learner_id and priority='Critical' and status in ('open','acknowledged','in_progress') and source_type<>'assessment_readiness') then raise exception using errcode='PT409',message='Critical operational blockers remain'; end if;
  if p_action='assessment_start' and not exists(select 1 from public.levytate_learner_assessment_readiness where organisation_id=p_organisation_id and learner_record_id=p_learner_id and assessment_status='in_assessment' and readiness_confirmed_at is not null and assessment_model<>'not_confirmed') then raise exception using errcode='PT422',message='Confirmed assessment readiness required'; end if;
  update public.levytate_learner_records set mutation_revision=mutation_revision+1,updated_at=v_now,updated_by=v_actor.email where organisation_id=p_organisation_id and id=p_learner_id;
  insert into public.levytate_learner_command_receipts(organisation_id,learner_record_id,request_id,actor_user_id,command_hash,result) values(p_organisation_id,p_learner_id,p_request_id,p_actor_user_id,v_hash,p_result);
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'learner',p_learner_id,'learner.'||p_action,'Learner evidence committed atomically.',jsonb_build_object('requestId',p_request_id,'revision',v_before.mutation_revision+1));
  return p_result;
exception when invalid_datetime_format or datetime_field_overflow or check_violation then raise exception using errcode='PT422',message='Learner evidence is invalid';
  when unique_violation then raise exception using errcode='PT409',message='Learner evidence already exists';
end; $$;
revoke all on function public.levytate_apply_learner_command(uuid,uuid,text,text,text,jsonb,integer,jsonb,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_learner_command(uuid,uuid,text,text,text,jsonb,integer,jsonb,jsonb,boolean) to service_role;
revoke insert,update,delete on public.levytate_learner_records,public.levytate_learner_eligibility_declarations,public.levytate_learner_pre_enrolment_checks,
  public.levytate_learner_reviews,public.levytate_learner_progress_updates,public.levytate_learner_breaks_in_learning,public.levytate_learner_assessment_readiness,
  public.levytate_learner_operational_actions,public.levytate_learner_lifecycle_events,public.levytate_enrolments from service_role;
