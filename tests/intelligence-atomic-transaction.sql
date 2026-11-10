-- Exclusive fresh LOCAL27 review DB. Fictional rows; every assertion rolls back.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.fail_intelligence_event() returns trigger language plpgsql as $$begin if current_setting('test.intelligence_event_failure',true)='true' then raise exception using errcode='PT503',message='Synthetic history failure';end if;return new;end;$$;
create trigger test_intelligence_event_failure before insert on public.levytate_intelligence_signal_events for each row execute function pg_temp.fail_intelligence_event();
do $$
declare
 org uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); lead uuid:=gen_random_uuid(); second_lead uuid:=gen_random_uuid(); employee_actor uuid:=gen_random_uuid(); foreign_lead uuid:=gen_random_uuid();
 person text:='intelligence-person-'||gen_random_uuid(); learner_id text:='intelligence-learner-'||gen_random_uuid();review_id text:='intelligence-review-'||gen_random_uuid();
 command jsonb; refresh_command jsonb; before_prepare jsonb; prepared jsonb; result jsonb; retried jsonb; rows jsonb; template jsonb; before_counts jsonb; after_counts jsonb; denied boolean; seen_at timestamptz;
begin
 if inet_server_addr() not in('127.0.0.1'::inet,'::1'::inet) then raise exception 'Loopback required';end if;
 insert into public.levytate_organisations(id,name,slug,status) values(org,'Synthetic Intelligence acceptance',org::text,'Active'),(other_org,'Synthetic isolated employer',other_org::text,'Active');
 insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_binding_status,auth_subject) values
 (lead,org,'lead-'||org||'@example.test','Apprenticeship Lead',true,'beta_user','bound',gen_random_uuid()),
 (second_lead,org,'second-'||org||'@example.test','Employer Admin',true,'beta_user','bound',gen_random_uuid()),
 (employee_actor,org,'employee-'||org||'@example.test','Employee',true,'beta_user','bound',gen_random_uuid()),
 (foreign_lead,other_org,'lead-'||other_org||'@example.test','Apprenticeship Lead',true,'beta_user','bound',gen_random_uuid());
 insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date)values(org,person,person,'Synthetic employee','employee-'||org||'@example.test','Employee','Active',current_date);
 insert into public.levytate_learner_records(organisation_id,id,employee_id,lifecycle_status,employment_route,record_status) values(org,learner_id,person,'enrolled','existing_employee_upskill','Active');
 insert into public.levytate_learner_reviews(organisation_id,id,learner_record_id,review_type,review_date,summary)values(org,review_id,learner_id,'provider_review',current_date,'Synthetic repeated manager support requirement');
 insert into public.levytate_intelligence_signals(organisation_id,id,fingerprint,entity_type,entity_id,learner_record_id,category,signal_type,title,summary,evidence,confidence,priority,recommended_action,suggested_owner_type,analyser_version)
 values(org,'signal-one','fingerprint-one','learner',learner_id,learner_id,'risk','manager_support_required','Synthetic support evidence','Synthetic only',jsonb_build_array(jsonb_build_object('sourceType','provider_review','sourceId',review_id,'sourceDate',current_date,'label','Recorded review')),'High','High','Review recorded support','Apprenticeship Lead','progress-review-v1') returning to_jsonb(levytate_intelligence_signals.*) into template;
 delete from public.levytate_intelligence_signals where organisation_id=org;
 perform pg_temp.check_result(not exists(select 1 from public.levytate_intelligence_workspaces where organisation_id=org),'empty employer has no fabricated analysis timestamp');
 refresh_command:=jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',refresh_command,true);
 perform pg_temp.check_result(prepared->'signals'='[]' and prepared->>'revision'='0' and length(prepared->>'sourceHash')=64,'prepare is read-only and captures exact empty source baseline');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,foreign_lead,'progress-review-v1',refresh_command,true);exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'cross-tenant actor cannot prepare source evidence');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,employee_actor,'progress-review-v1',refresh_command,true);exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'Employee cannot analyse organisation evidence');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',refresh_command||'{"actorEmail":"forged"}',true);exception when sqlstate 'PT422' then denied:=true;end;
 perform pg_temp.check_result(denied,'forged actor and unsupported fields rejected');
 rows:=jsonb_build_array(template);
 result:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,rows);
 perform pg_temp.check_result(result->'receipt'->'state'->>'revision'='1' and result->'receipt'->'state'->>'reconciled_at' is not null and result->'receipt'->'signals'->0->>'revision'='1','analysis records signal revision and genuine reconciliation timestamp');
 perform pg_temp.check_result((select count(*)=1 from public.levytate_intelligence_signal_events where organisation_id=org) and (select count(*)=1 from public.levytate_intelligence_command_receipts where organisation_id=org),'signal history and exact receipt committed together');
 retried:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',refresh_command,true);
 perform pg_temp.check_result(retried=result,'exact lost analysis reply returns original receipt without rerun');
 command:=jsonb_build_object('action','acknowledge','signalId','signal-one','expectedRevision',1,'idempotencyKey',gen_random_uuid());
 perform set_config('test.intelligence_event_failure','true',true);
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command);exception when sqlstate 'PT503' then denied:=true;end;
 perform set_config('test.intelligence_event_failure','false',true);
 perform pg_temp.check_result(denied and (select status='new' and revision=1 from public.levytate_intelligence_signals where organisation_id=org and id='signal-one') and (select count(*)=1 from public.levytate_intelligence_command_receipts where organisation_id=org),'history failure rolls back state and receipt');
 before_prepare:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid()),true);
 result:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command);
 perform pg_temp.check_result(result->'receipt'->'signal'->>'status'='acknowledged' and result->'receipt'->'signal'->>'revision'='2','human acknowledge commits revision and history');
 retried:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command);
 perform pg_temp.check_result(result=retried and (select count(*)=2 from public.levytate_intelligence_command_receipts where organisation_id=org),'exact acknowledgement replay creates no second receipt');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command||'{"action":"accept"}');exception when sqlstate 'PT409' then denied:=true;end;
 perform pg_temp.check_result(denied,'same key with changed action denied');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,second_lead,'progress-review-v1',command);exception when sqlstate 'PT409' then denied:=true;end;
 perform pg_temp.check_result(denied,'another actor cannot claim the old revision receipt');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid()),false,before_prepare->>'sourceHash',(before_prepare->>'revision')::integer,rows);exception when sqlstate 'PT409' then denied:=true;end;
 perform pg_temp.check_result(denied and (select status='acknowledged' from public.levytate_intelligence_signals where organisation_id=org and id='signal-one'),'stale reconciliation cannot overwrite a human decision');
 command:=jsonb_build_object('action','accept','signalId','signal-one','expectedRevision',2,'idempotencyKey',gen_random_uuid());
 perform set_config('test.intelligence_event_failure','true',true);
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command);exception when sqlstate 'PT503' then denied:=true;end;
 perform set_config('test.intelligence_event_failure','false',true);
 perform pg_temp.check_result(denied and not exists(select 1 from public.levytate_operational_actions where organisation_id=org) and not exists(select 1 from public.levytate_operational_action_events where organisation_id=org) and not exists(select 1 from public.levytate_operational_action_receipts where organisation_id=org),'late signal-history failure rolls back accepted action, action history and receipt');
 result:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command);
 perform pg_temp.check_result(result->'receipt'->'signal'->>'status'='accepted' and result->'receipt'->'signal'->>'revision'='3' and length(result->'receipt'->>'operationalActionId')>0,'explicit human acceptance creates a linked action atomically');
 perform pg_temp.check_result((select count(*)=1 from public.levytate_operational_actions where organisation_id=org) and (select count(*)=1 from public.levytate_operational_action_events where organisation_id=org) and (select count(*)=1 from public.levytate_operational_action_receipts where organisation_id=org),'accepted action has one attributable history event and atomic Operations receipt');
 retried:=public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command);
 perform pg_temp.check_result(result=retried and (select count(*)=1 from public.levytate_operational_actions where organisation_id=org),'lost acceptance reply replays exact result without duplicate action');
 update public.levytate_users set active=false where id=lead;
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,lead,'progress-review-v1',command);exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'revoked requester cannot read an old successful receipt');
 update public.levytate_users set active=true where id=lead;
 -- Zero-signal analysis is still a real recorded check, not default all-clear.
 refresh_command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,true);
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,'[]');
 perform pg_temp.check_result(result->'receipt'->'signals'='[]' and result->'receipt'->'state'->>'reconciled_at' is not null,'zero-result Autopilot refresh records actual checked time');
 perform pg_temp.check_result(not exists(select 1 from public.levytate_intelligence_signals where organisation_id=other_org) and not exists(select 1 from public.levytate_intelligence_command_receipts where organisation_id=other_org),'other tenant remains unchanged');
 perform pg_temp.check_result((select count(*)=0 from auth.users) and (select count(*)=0 from storage.objects),'no Auth identities or uploaded bytes created by schema tests');
 perform public.levytate_offboarding_assert_inventory();
 perform pg_temp.check_result(true,'new state and receipt tables retain complete disposal inventory and freeze coverage');
end $$;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()='{"version":"20261110090943","available":true}'::jsonb,'actual service readiness requires current atomic Intelligence contract');
reset role;
select pg_temp.check_result((select bool_and(relrowsecurity) from pg_class where oid in('public.levytate_intelligence_workspaces'::regclass,'public.levytate_intelligence_command_receipts'::regclass)),'new state and receipt tables enforce RLS');
select pg_temp.check_result(not has_function_privilege('anon','public.levytate_apply_intelligence_command(uuid,uuid,text,jsonb,boolean,text,integer,jsonb)','execute') and not has_function_privilege('authenticated','public.levytate_apply_intelligence_command(uuid,uuid,text,jsonb,boolean,text,integer,jsonb)','execute'),'browser roles cannot call atomic command');
select pg_temp.check_result(not has_table_privilege('service_role','public.levytate_intelligence_signals','insert,update,delete,truncate') and not has_any_column_privilege('service_role','public.levytate_intelligence_signals','insert,update') and not has_table_privilege('service_role','public.levytate_intelligence_signal_events','insert,update,delete,truncate'),'no direct service writer bypass remains');
rollback;
