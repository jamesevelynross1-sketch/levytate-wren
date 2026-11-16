-- Exclusive fresh LOCAL27 review DB. Fictional rows; every assertion rolls back.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.expect_denied(query text,expected_code text,label text) returns void language plpgsql as $$declare denied boolean:=false;begin begin execute query;exception when others then if sqlstate<>expected_code then raise;end if;denied:=true;end;perform pg_temp.check_result(denied,label);end;$$;
create function pg_temp.fail_intelligence_event() returns trigger language plpgsql as $$begin if current_setting('test.intelligence_event_failure',true)='true' then raise exception using errcode='PT503',message='Synthetic history failure';end if;return new;end;$$;
create trigger test_intelligence_event_failure before insert on public.levytate_intelligence_signal_events for each row execute function pg_temp.fail_intelligence_event();
do $$
declare
 org uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); lead uuid:=gen_random_uuid(); second_lead uuid:=gen_random_uuid(); employee_actor uuid:=gen_random_uuid(); foreign_lead uuid:=gen_random_uuid();
 person text:='intelligence-person-'||gen_random_uuid(); learner_id text:='intelligence-learner-'||gen_random_uuid();review_id text:='intelligence-review-'||gen_random_uuid();
 command jsonb; refresh_command jsonb; before_prepare jsonb; prepared jsonb; result jsonb; retried jsonb; rows jsonb; template jsonb; invalid jsonb; auto_template jsonb; accepted_action text; before_counts jsonb; after_counts jsonb; denied boolean; seen_at timestamptz;
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
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb,true)',org,lead,'progress-review-v1','null'),'PT422','null command denied');
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb,true)',org,lead,'unknown-family',refresh_command),'PT422','unknown analyser family denied');
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb,true)',org,lead,'operations-autopilot-v1',refresh_command),'PT422','action cannot cross analyser family');
 for invalid in select value from jsonb_array_elements(jsonb_build_array(
   template||jsonb_build_object('organisation_id',other_org),
   template||jsonb_build_object('status','accepted'),
   template||jsonb_build_object('entity_type',null),
   template||jsonb_build_object('evidence','[]'::jsonb),
   template||jsonb_build_object('evidence','null'::jsonb))) loop
  perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb,false,%L,0,%L::jsonb)',org,lead,'progress-review-v1',refresh_command,prepared->>'sourceHash',jsonb_build_array(invalid)),'PT422','invalid signal scope, invented decision or missing evidence rejected');
 end loop;
 for invalid in select value from jsonb_array_elements(jsonb_build_array(
   template||jsonb_build_object('learner_record_id','absent-learner','entity_id','absent-learner'),
   template||jsonb_build_object('evidence',jsonb_build_array(jsonb_build_object('sourceType','provider_review','sourceId','absent-review'))),
   template||jsonb_build_object('evidence',jsonb_build_array(jsonb_build_object('sourceType','manager_check_in','sourceId',review_id))),
   template||jsonb_build_object('evidence',jsonb_build_array(jsonb_build_object('sourceType',null,'sourceId',review_id))),
   template||jsonb_build_object('linked_operational_action_id','absent-action'))) loop
  perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb,false,%L,0,%L::jsonb)',org,lead,'progress-review-v1',refresh_command,prepared->>'sourceHash',jsonb_build_array(invalid)),'PT403','orphan, mismatched or null evidence cannot become an authorised signal');
 end loop;
 perform pg_temp.check_result(not exists(select 1 from public.levytate_intelligence_signals where organisation_id=org) and not exists(select 1 from public.levytate_intelligence_command_receipts where organisation_id=org),'invalid analysis leaves no partial signals or receipts');
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
 -- Actual Autopilot actions share the same atomic boundary and Operations writer.
 auto_template:=template||jsonb_build_object('id','auto-one','fingerprint','auto-one','signal_key','auto-review-one','analyser_version','operations-autopilot-v1','lane','needs_your_decision','autopilot_priority','this_week','suggested_action_type','record_provider_review');
 refresh_command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,true);
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,jsonb_build_array(auto_template));
 perform pg_temp.check_result(result->'receipt'->'signals'->0->>'revision'='1','Autopilot persists verified source evidence');
 command:=jsonb_build_object('action','create_action','signalId','auto-one','expectedRevision',1,'idempotencyKey',gen_random_uuid(),'title','Synthetic provider review task','ownerType','Apprenticeship Lead','dueDate',current_date+1,'communicationDraft','Synthetic draft only');
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb)',org,lead,'operations-autopilot-v1',command||'{"ownerType":"Platform Admin"}'),'PT422','Autopilot cannot invent an action owner role');
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb)',org,lead,'operations-autopilot-v1',command||'{"dueDate":"not-a-date"}'),'PT422','Autopilot invalid due date rejected atomically');
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);
 accepted_action:=result->'receipt'->>'operationalActionId';
 perform pg_temp.check_result(result->'receipt'->'signal'->>'status'='accepted' and result->'receipt'->>'reused'='false' and exists(select 1 from public.levytate_operational_actions where organisation_id=org and id=accepted_action and action_type='record_provider_review' and metadata->>'communicationSent'='false'),'Autopilot human approval creates one genuine unsent operational action');
 retried:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);
 perform pg_temp.check_result(retried=result,'Autopilot exact acceptance retry returns original snapshot');
 refresh_command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,true);
 auto_template:=auto_template||jsonb_build_object('id','auto-two','fingerprint','auto-two','signal_key','auto-review-two','linked_operational_action_id',accepted_action);
 rows:=(prepared->'signals')||jsonb_build_array(auto_template);
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,rows);
 command:=command||jsonb_build_object('signalId','auto-two','idempotencyKey',gen_random_uuid());
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);
 perform pg_temp.check_result(result->'receipt'->>'operationalActionId'=accepted_action and result->'receipt'->>'reused'='true' and (select count(*)=2 from public.levytate_operational_actions where organisation_id=org),'Autopilot reuses an authorised source-linked task without duplicate action');
 refresh_command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,true);
 auto_template:=auto_template||jsonb_build_object('id','auto-low','fingerprint','auto-low','signal_key','auto-low','confidence','Low','linked_operational_action_id',null);
 rows:=(prepared->'signals')||jsonb_build_array(auto_template);
 perform public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,rows);
 command:=command||jsonb_build_object('signalId','auto-low','idempotencyKey',gen_random_uuid());
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb)',org,lead,'operations-autopilot-v1',command),'PT409','low-confidence interpretation cannot create an action');
 command:=jsonb_build_object('action','dismiss','signalId','auto-low','expectedRevision',1,'idempotencyKey',gen_random_uuid(),'reason','Synthetic human decision');
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);
 perform pg_temp.check_result(result->'receipt'->'signal'->>'status'='dismissed' and result->'receipt'->'signal'->>'dismissed_by'=lead::text,'Autopilot dismissal is attributable and durable');
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb)',org,lead,'operations-autopilot-v1',command||jsonb_build_object('expectedRevision',2,'idempotencyKey',gen_random_uuid())),'PT409','terminal dismissal cannot be overwritten by a new command');
 -- actionSignal intentionally identifies its exact Operations source; learner
 -- identity is resolved from that authoritative action rather than browser input.
 refresh_command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,true);
 auto_template:=auto_template||jsonb_build_object('id','auto-existing-action','fingerprint','auto-existing-action','signal_key','auto-existing-action','confidence','High','entity_type','operational_action','entity_id',accepted_action,'learner_record_id',null,'linked_operational_action_id',accepted_action,'suggested_action_type','','evidence',jsonb_build_array(jsonb_build_object('sourceType','operational_action','sourceId',accepted_action,'sourceDate',current_date,'label','Existing operational action')));
 select id into accepted_action from public.levytate_operational_actions where organisation_id=org and action_type='address_progress_exception';
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb,false,%L,%s,%L::jsonb)',org,lead,'operations-autopilot-v1',refresh_command,prepared->>'sourceHash',prepared->>'revision',(prepared->'signals')||jsonb_build_array(auto_template||jsonb_build_object('linked_operational_action_id',accepted_action))),'PT403','same-tenant linked action cannot differ from the exact source entity');
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb,false,%L,%s,%L::jsonb)',org,lead,'operations-autopilot-v1',refresh_command,prepared->>'sourceHash',prepared->>'revision',(prepared->'signals')||jsonb_build_array(auto_template||jsonb_build_object('evidence',jsonb_build_array(jsonb_build_object('sourceType','operational_action','sourceId',accepted_action))))),'PT403','same-tenant evidence cannot substitute another task');
 accepted_action:=auto_template->>'linked_operational_action_id';
 rows:=(prepared->'signals')||jsonb_build_array(auto_template);
 perform public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,rows);
 command:=jsonb_build_object('action','create_action','signalId','auto-existing-action','expectedRevision',1,'idempotencyKey',gen_random_uuid(),'title','Review existing synthetic task','ownerType','Apprenticeship Lead','dueDate',current_date+1,'communicationDraft','Synthetic draft only');
 update public.levytate_users set active=false where id=lead;
 perform pg_temp.expect_denied(format('select public.levytate_apply_intelligence_command(%L,%L,%L,%L::jsonb)',org,second_lead,'operations-autopilot-v1',command),'PT403','existing task reuse cannot preserve a revoked task owner');
 update public.levytate_users set active=true where id=lead;
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);
 perform pg_temp.check_result(result->'receipt'->>'operationalActionId'=accepted_action and result->'receipt'->>'reused'='true','actual operational-action entity shape resolves its current learner and reuses the existing task');
 update public.levytate_learner_records set record_status='Archived' where organisation_id=org and id=learner_id;
 update public.levytate_employees set status='Inactive' where organisation_id=org and id=person;
 refresh_command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,true);
 perform pg_temp.check_result(prepared->'eligibleActionIds'='[]' and prepared->'eligibleLearnerIds'='[]','inactive archived sources are absent from captured Autopilot input');
 select jsonb_agg(value||'{"status":"resolved"}') into rows from jsonb_array_elements(prepared->'signals');
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,rows);
 perform pg_temp.check_result(not exists(select 1 from jsonb_array_elements(result->'receipt'->'signals') s where s->>'status'<>'resolved'),'inactive-source Autopilot history resolves without blocking the workspace');
 refresh_command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,true);
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',refresh_command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,prepared->'signals');
 perform pg_temp.check_result(result->'receipt'->>'learnerCount'='0' and jsonb_array_length(result->'receipt'->'signals')=4,'repeated empty refresh keeps all resolved Autopilot history and truthful active count');
 perform pg_temp.check_result(not exists(select 1 from public.levytate_intelligence_signals where organisation_id=other_org) and not exists(select 1 from public.levytate_intelligence_command_receipts where organisation_id=other_org),'other tenant remains unchanged');
 perform pg_temp.check_result((select count(*)=0 from auth.users) and (select count(*)=0 from storage.objects),'no Auth identities or uploaded bytes created by schema tests');
 perform public.levytate_offboarding_assert_inventory();
 perform pg_temp.check_result(true,'new state and receipt tables retain complete disposal inventory and freeze coverage');
end $$;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()='{"version":"20261110093655","available":true}'::jsonb,'actual service readiness requires current atomic Intelligence contract');
reset role;
select pg_temp.check_result((select bool_and(relrowsecurity) from pg_class where oid in('public.levytate_intelligence_workspaces'::regclass,'public.levytate_intelligence_command_receipts'::regclass)),'new state and receipt tables enforce RLS');
select pg_temp.check_result(not has_function_privilege('anon','public.levytate_apply_intelligence_command(uuid,uuid,text,jsonb,boolean,text,integer,jsonb)','execute') and not has_function_privilege('authenticated','public.levytate_apply_intelligence_command(uuid,uuid,text,jsonb,boolean,text,integer,jsonb)','execute'),'browser roles cannot call atomic command');
select pg_temp.check_result(not has_table_privilege('service_role','public.levytate_intelligence_signals','insert,update,delete,truncate') and not has_any_column_privilege('service_role','public.levytate_intelligence_signals','insert,update') and not has_table_privilege('service_role','public.levytate_intelligence_signal_events','insert,update,delete,truncate'),'no direct service writer bypass remains');
rollback;
