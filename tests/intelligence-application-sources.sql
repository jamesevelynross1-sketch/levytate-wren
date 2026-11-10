-- Real atomic Autopilot application/Operations source paths, rollback-only local fixtures.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_result(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
do $$
declare org uuid:=gen_random_uuid();lead uuid:=gen_random_uuid();manager uuid:=gen_random_uuid();person text:='autopilot-person-'||gen_random_uuid();manager_person text:='autopilot-manager-'||gen_random_uuid();standard text:='AUTOPILOT-'||gen_random_uuid();application text:='autopilot-application-'||gen_random_uuid();template jsonb;prepared jsonb;command jsonb;result jsonb;accepted_action text;denied boolean;
begin
 insert into public.levytate_organisations(id,name,slug,status)values(org,'Synthetic Autopilot application',org::text,'Active');
 insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_binding_status)values(lead,org,lead||'@example.test','Apprenticeship Lead',true,'beta_user','pending'),(manager,org,manager||'@example.test','Line Manager',true,'beta_user','pending');
 insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date,manager_id)values(org,manager_person,manager_person,'Synthetic manager',manager||'@example.test','Line Manager','Active',current_date,''),(org,person,person,'Synthetic applicant',person||'@example.test','Employee','Active',current_date,manager_person);
 insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route)values(standard,'Synthetic standard',standard,'Approved for delivery',4,'Synthetic');
 insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner)values(org,application,person,standard,'Awaiting Manager Review','Line Manager');
 insert into public.levytate_application_history(organisation_id,id,application_id,status,owner)values(org,'synthetic-occurrence',application,'Awaiting Manager Review','Line Manager');
 insert into public.levytate_intelligence_signals(organisation_id,id,fingerprint,signal_key,entity_type,entity_id,category,signal_type,title,summary,evidence,confidence,priority,recommended_action,suggested_owner_type,suggested_action_type,analyser_version,lane,autopilot_priority)
 values(org,'app-signal','app-signal','app-signal','application',application,'applications','application_awaiting_manager','Review synthetic application','Recorded application state',jsonb_build_array(jsonb_build_object('sourceType','application','sourceId',application,'sourceDate',current_date,'label','Application state')),'High','High','Current manager must review','Line Manager','review_application','operations-autopilot-v1','ready_to_action','this_week')returning to_jsonb(levytate_intelligence_signals.*)into template;
 delete from public.levytate_intelligence_signals where organisation_id=org;
 command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command,true);
 perform pg_temp.check_result(prepared->'eligibleApplicationIds'=jsonb_build_array(application),'current application appears in captured canonical source set');
 perform public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,jsonb_build_array(template));
 command:=jsonb_build_object('action','create_action','signalId','app-signal','expectedRevision',1,'idempotencyKey',gen_random_uuid(),'title','Review synthetic application','ownerType','Line Manager','dueDate',current_date,'communicationDraft','Draft only');
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);accepted_action:=result->'receipt'->>'operationalActionId';
 perform pg_temp.check_result(exists(select 1 from public.levytate_operational_actions where organisation_id=org and id=accepted_action and employee_id=person and application_id=application and learner_record_id is null and owner_user_id=manager::text and metadata->>'occurrenceId'='synthetic-occurrence'),'application signal creates exact current distinct-manager task with authoritative occurrence');
 perform pg_temp.check_result(public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command)=result,'application task lost response retries exact original receipt');
 command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command,true);
 template:=template||jsonb_build_object('id','action-signal','fingerprint','action-signal','signal_key','action-signal','entity_type','operational_action','entity_id',accepted_action,'linked_operational_action_id',accepted_action,'suggested_action_type','','evidence',jsonb_build_array(jsonb_build_object('sourceType','operational_action','sourceId',accepted_action,'sourceDate',current_date,'label','Recorded task')));
 perform public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,(prepared->'signals')||jsonb_build_array(template));
 command:=jsonb_build_object('action','create_action','signalId','action-signal','expectedRevision',1,'idempotencyKey',gen_random_uuid(),'title','Review existing synthetic task','ownerType','Line Manager','dueDate',current_date,'communicationDraft','Draft only');
 result:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);
 perform pg_temp.check_result(result->'receipt'->>'reused'='true' and result->'receipt'->>'operationalActionId'=accepted_action and (select count(*)=1 from public.levytate_operational_actions where organisation_id=org),'operational-action source without learner resolves exact application and reuses current manager task');
 update public.levytate_employees set manager_id='' where organisation_id=org and id=person;
 command:=jsonb_build_object('action','refresh','idempotencyKey',gen_random_uuid());prepared:=public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command,true);
 template:=template||jsonb_build_object('id','changed-manager-signal','fingerprint','changed-manager-signal','signal_key','changed-manager-signal');
 perform public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,(prepared->'signals')||jsonb_build_array(template));
 command:=jsonb_build_object('action','create_action','signalId','changed-manager-signal','expectedRevision',1,'idempotencyKey',gen_random_uuid(),'title','Review existing synthetic task','ownerType','Line Manager','dueDate',current_date,'communicationDraft','Draft only');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,lead,'operations-autopilot-v1',command);exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'old manager task cannot be reused after current reporting relation is removed');
 perform pg_temp.check_result((select count(*)=1 from public.levytate_operational_actions where organisation_id=org),'failed changed-manager reuse adds no duplicate task');
end $$;
rollback;
