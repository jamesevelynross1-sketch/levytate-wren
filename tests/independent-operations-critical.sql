-- Independent real-PG17 challenge of authoritative critical-condition resolution.
-- Fictional rows only; every mutation rolls back. No migration038 or live modules.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.assert_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS %',label;end;$$;
do $$
declare
 org uuid:=gen_random_uuid();lead uuid:=gen_random_uuid();person text:='ops-independent-'||gen_random_uuid();learner_id text:='ops-independent-'||gen_random_uuid();
 reason text;action_type text;action_id text;source_at timestamptz;data jsonb;result jsonb;denied boolean;
begin
 if inet_server_addr() is not null and inet_server_addr() not in ('127.0.0.1'::inet,'::1'::inet) then raise exception 'Loopback database required';end if;
 insert into public.levytate_organisations(id,name,slug,status)values(org,'Synthetic independent Operations',org::text,'Active');
 insert into public.levytate_users(id,organisation_id,email,role,active,access_level)values(lead,org,'lead-'||org||'@example.test','Apprenticeship Lead',true,'beta_user');
 insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date)values(org,person,person,'Synthetic critical-source employee','person-'||org||'@example.test','Employee','Active',current_date);
 insert into public.levytate_learner_records(organisation_id,id,employee_id,lifecycle_status,employment_route,record_status)values(org,learner_id,person,'break_in_learning','existing_employee_upskill','Active');
 insert into public.levytate_learner_eligibility_declarations(organisation_id,id,learner_record_id,declaration_type,declaration_wording,declaration_version,confirmed,confirmed_by_employee,confirmed_at,expected_england_working_hours_percentage,verification_status)values(org,gen_random_uuid(),learner_id,'england_working_hours','Synthetic database regression declaration','2026-07-operational-4a',true,person,now(),100,'not_eligible');
 insert into public.levytate_learner_pre_enrolment_checks(organisation_id,id,learner_record_id,probation_status,hr_approval_status)values(org,gen_random_uuid(),learner_id,'not_passed','declined');
 foreach reason in array array['eligibility_not_eligible','hr_declined','probation_not_passed','lifecycle_inconsistent'] loop
  action_type:=case reason when 'eligibility_not_eligible' then 'verify_england_working_hours' when 'hr_declined' then 'obtain_hr_approval' when 'probation_not_passed' then 'confirm_probation' else 'resolve_lifecycle_inconsistency' end;
  action_id:='critical-'||gen_random_uuid();select updated_at into source_at from public.levytate_learner_records where organisation_id=org and id=learner_id;
  data:=jsonb_build_object('organisation_id',org,'id',action_id,'learner_record_id',learner_id,'application_id','','employee_id',person,'source_type',case when reason='lifecycle_inconsistent' then 'lifecycle_rule' else 'pre_enrolment_readiness' end,'source_key',learner_id||':'||reason,'action_type',action_type,'title','Synthetic unresolved critical condition','description','Fictional regression only','priority','Critical','priority_rank',0,'status','open','owner_type','Apprenticeship Lead','owner_user_id',lead::text,'owner_display_name','Synthetic Lead','source_url','/levytate/app?module=Learners','metadata',jsonb_build_object('sourceCondition',reason),'version',1);
  perform public.levytate_apply_operational_action(org,lead,action_id,0,'create',data,source_at);
  denied:=false;begin perform public.levytate_apply_operational_action(org,lead,action_id,1,'source_resolve','{"status":"completed","completion_method":"source_condition_resolved"}',source_at);exception when sqlstate 'PT409' then denied:=true;end;
  perform pg_temp.assert_result(denied,'current timestamp cannot falsely resolve '||reason);
  denied:=false;begin perform public.levytate_apply_operational_action(org,lead,action_id,1,'transition','{"status":"completed","completion_method":"user_completed","completion_note":"Synthetic manual closure bypass attempt"}',source_at);exception when sqlstate 'PT409' then denied:=true;end;
  perform pg_temp.assert_result(denied,'manual completion cannot hide '||reason);
  denied:=false;begin perform public.levytate_apply_operational_action(org,lead,action_id,1,'transition','{"status":"dismissed","completion_method":"dismissed","dismissal_reason":"Synthetic dismissal bypass attempt"}',source_at);exception when sqlstate 'PT403' then denied:=true;end;
  perform pg_temp.assert_result(denied,'dismissal cannot hide '||reason);
  if reason='eligibility_not_eligible' then update public.levytate_learner_eligibility_declarations set verification_status='employer_verified' where organisation_id=org and learner_record_id=learner_id;
  elsif reason='hr_declined' then update public.levytate_learner_pre_enrolment_checks set hr_approval_status='approved' where organisation_id=org and learner_record_id=learner_id;
  elsif reason='probation_not_passed' then update public.levytate_learner_pre_enrolment_checks set probation_status='passed' where organisation_id=org and learner_record_id=learner_id;
  else update public.levytate_learner_records set lifecycle_status='enrolled' where organisation_id=org and id=learner_id;end if;
  select updated_at into source_at from public.levytate_learner_records where organisation_id=org and id=learner_id;
  result:=public.levytate_apply_operational_action(org,lead,action_id,1,'source_resolve','{"status":"completed","completion_method":"source_condition_resolved"}',source_at);
  perform pg_temp.assert_result(result->>'status'='completed' and result->>'version'='2','authoritative condition change permits resolution for '||reason);
 end loop;
 perform pg_temp.assert_result((select count(*)=8 from public.levytate_operational_action_events where organisation_id=org) and (select count(*)=8 from public.levytate_audit_events where organisation_id=org),'all rejected bypasses leave no event or audit evidence');
end $$;
rollback;
