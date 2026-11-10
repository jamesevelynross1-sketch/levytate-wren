-- Fictional native-PG17 regression. No hosted work; every mutation rolls back.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.fail_ops_audit() returns trigger language plpgsql as $$begin if current_setting('test.operations.audit_failure',true)='true' then raise exception using errcode='PT503',message='Synthetic audit failure';end if;return new;end;$$;
create trigger test_ops_audit before insert on public.levytate_audit_events for each row execute function pg_temp.fail_ops_audit();
do $$
declare
 org uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); lead uuid:=gen_random_uuid();
 person text:='event-person-'||gen_random_uuid(); manager_person text:='event-manager-'||gen_random_uuid(); app text:='event-app-'||gen_random_uuid(); standard text:='event-standard-'||gen_random_uuid();
 old_action text:='event-old-'||gen_random_uuid(); new_action text:='event-new-'||gen_random_uuid(); first_history text:='event-history-'||gen_random_uuid(); next_history text:='event-history-'||gen_random_uuid();
 payload jsonb; first_result jsonb; result jsonb; replay jsonb; source_at timestamptz; happened_at timestamptz:=clock_timestamp()-interval '3 minutes'; denied boolean; original_definition text;
begin
 if inet_server_addr() not in('127.0.0.1'::inet,'::1'::inet) then raise exception 'Loopback required';end if;
 insert into public.levytate_organisations(id,name,slug,status)values(org,'Synthetic event append',org::text,'Active');
 insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_binding_status,auth_subject)values
 (actor,org,'employee-'||org||'@example.test','Employee',true,'beta_user','bound',gen_random_uuid()),
 (manager,org,'manager-'||org||'@example.test','Line Manager',true,'beta_user','bound',gen_random_uuid()),
 (lead,org,'lead-'||org||'@example.test','Apprenticeship Lead',true,'beta_user','bound',gen_random_uuid());
 insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date,manager_id)values
 (org,person,person,'Synthetic employee','employee-'||org||'@example.test','Employee','Active',current_date,manager_person),
 (org,manager_person,manager_person,'Synthetic manager','manager-'||org||'@example.test','Line Manager','Active',current_date,'');
 insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route)values(standard,'Synthetic standard',standard,'Approved for delivery',4,'Synthetic');
 insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner)values(org,app,person,standard,'Awaiting Manager Review','Line Manager')returning updated_at into source_at;
 insert into public.levytate_application_history(organisation_id,id,application_id,status,owner,created_at)values(org,first_history,app,'Awaiting Manager Review','Line Manager',happened_at);
 payload:=jsonb_build_object('organisation_id',org,'id',old_action,'learner_record_id',null,'application_id',app,'employee_id',person,'source_type','application_workflow','source_key',app||':manager-review:'||first_history,'action_type','review_application','title','Review application','description','Synthetic actual review occurrence','priority','High','priority_rank',1,'status','open','owner_type','Line Manager','owner_user_id',manager,'owner_display_name','Synthetic manager','due_date',null,'source_url','/levytate/app?module=Approvals','metadata',jsonb_build_object('sourceCondition','manager_review_required','occurrenceId',first_history),'version',1);
 first_result:=public.levytate_apply_operational_action(org,actor,old_action,0,'create',payload,source_at);
 perform pg_temp.check_result(first_result->>'status'='open','first personal review source derives normally');
 update public.levytate_applications set status='More information requested',current_owner='Employee' where organisation_id=org and id=app returning updated_at into source_at;
 insert into public.levytate_application_history(organisation_id,id,application_id,status,owner,created_at)values(org,'returned-'||next_history,app,'More information requested','Employee',happened_at+interval '1 minute');
 result:=public.levytate_apply_operational_action(org,actor,old_action,1,'source_resolve','{"status":"completed","completion_method":"source_condition_resolved"}',source_at);
 perform pg_temp.check_result(result->>'status'='completed','legitimate information return closes the previous review occurrence');
 update public.levytate_applications set status='Awaiting Manager Review',current_owner='Line Manager' where organisation_id=org and id=app returning updated_at into source_at;
 insert into public.levytate_application_history(organisation_id,id,application_id,status,owner,created_at)values(org,next_history,app,'Awaiting Manager Review','Line Manager',happened_at+interval '2 minutes');
 payload:=payload||jsonb_build_object('id',new_action,'source_key',app||':manager-review:'||next_history,'metadata',jsonb_build_object('sourceCondition','manager_review_required','occurrenceId',next_history,'priorActionId',old_action));
 result:=public.levytate_apply_operational_action(org,actor,new_action,0,'create',payload,source_at);
 perform pg_temp.check_result(result->>'status'='open' and result->'metadata'->>'priorActionId'=old_action,'second submission creates its distinct current review occurrence');
 perform pg_temp.check_result((select array_agg(event_type order by event_type)=array['detected','regenerated'] from public.levytate_operational_action_events where organisation_id=org and operational_action_id=new_action),'second occurrence atomically records detected and regenerated events');
 replay:=public.levytate_apply_operational_action(org,actor,new_action,0,'create',payload,source_at);
 perform pg_temp.check_result(replay=result and (select count(*)=2 from public.levytate_operational_action_events where organisation_id=org and operational_action_id=new_action),'exact regenerated command retry returns original receipt without duplicate events');
 result:=public.levytate_apply_operational_action(org,lead,new_action,1,'sync','{"priority":"Medium","priority_rank":2}',source_at);
 perform pg_temp.check_result(result->>'version'='2' and (select count(*)=1 from public.levytate_operational_action_events where operational_action_id=new_action and event_type='priority_changed'),'priority change appends a scalar event atomically');
 result:=public.levytate_apply_operational_action(org,lead,new_action,2,'sync','{"owner_display_name":"Synthetic current manager updated"}',source_at);
 perform pg_temp.check_result(result->>'version'='3' and (select count(*)=1 from public.levytate_operational_action_events where operational_action_id=new_action and event_type='owner_changed'),'owner change appends a scalar event atomically');
 result:=public.levytate_apply_operational_action(org,lead,new_action,3,'due',jsonb_build_object('due_date',current_date+1),source_at);
 perform pg_temp.check_result(result->>'version'='4' and (select count(*)=1 from public.levytate_operational_action_events where operational_action_id=new_action and event_type='due_date_changed'),'due date change appends a scalar event atomically');
 replay:=public.levytate_apply_operational_action(org,lead,new_action,3,'due',jsonb_build_object('due_date',current_date+1),source_at);
 perform pg_temp.check_result(replay=result and (select count(*)=5 from public.levytate_operational_action_events where operational_action_id=new_action) and (select count(*)=4 from public.levytate_operational_action_receipts where action_id=new_action) and (select count(*)=4 from public.levytate_audit_events where entity_id=new_action),'all scalar events retain exact receipt and audit deduplication');
 denied:=false;begin perform public.levytate_apply_operational_action(org,actor,new_action,4,'transition','{"status":"acknowledged"}',source_at);exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'event repair does not grant Employee manager-task control');
 denied:=false;begin perform public.levytate_apply_operational_action(org,gen_random_uuid(),new_action,4,'sync','{"priority":"Low","priority_rank":3}',source_at);exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'event repair rejects an unknown or foreign actor');
 update public.levytate_users set active=false where id=lead;
 denied:=false;begin perform public.levytate_apply_operational_action(org,lead,new_action,3,'due',jsonb_build_object('due_date',current_date+1),source_at);exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'revoked actor cannot replay a previously successful receipt');
 update public.levytate_users set active=true where id=lead;
 perform set_config('test.operations.audit_failure','true',true);
 denied:=false;begin perform public.levytate_apply_operational_action(org,lead,new_action,4,'sync','{"priority":"Low","priority_rank":3}',source_at);exception when sqlstate 'PT503' then denied:=true;end;
 perform set_config('test.operations.audit_failure','false',true);
 perform pg_temp.check_result(denied and (select version=4 and priority='Medium' from public.levytate_operational_actions where id=new_action) and (select count(*)=5 from public.levytate_operational_action_events where operational_action_id=new_action) and (select count(*)=4 from public.levytate_operational_action_receipts where action_id=new_action),'audit failure rolls back action version and every generated event and receipt');
 perform pg_temp.check_result(not has_function_privilege('anon','public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)','execute') and not has_function_privilege('authenticated','public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)','execute') and not has_table_privilege('service_role','public.levytate_operational_actions','insert,update,delete'),'browser execution and direct service-role writes remain denied');
 perform pg_temp.check_result(public.levytate_required_client_contracts()='{"version":"20261110093655","available":true}'::jsonb,'complete candidate28 reports its exact repaired release contract');
 select pg_get_functiondef('public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)'::regprocedure) into original_definition;
 execute replace(original_definition,'array_append(event_types,''regenerated'')','event_types||''regenerated''');
 perform pg_temp.check_result(public.levytate_required_client_contracts()->>'available'='false','same-signature restoration of broken event SQL is unavailable');
 execute original_definition;
 perform pg_temp.check_result(public.levytate_required_client_contracts()->>'available'='true','restoring the exact repaired body recovers readiness');
end $$;
rollback;
