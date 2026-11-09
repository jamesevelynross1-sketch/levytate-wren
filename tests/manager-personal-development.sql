-- Fictional, LOCAL, rollback-only server contract checks. Not Auth/browser evidence.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_test(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end; $$;
create function pg_temp.denied(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin begin execute statement;exception when others then get stacked diagnostics actual=returned_sqlstate;end;
 perform pg_temp.check_test(actual=expected,label||coalesce(' ['||actual||']',' [not denied]'));end; $$;
create function pg_temp.actor(who text) returns uuid language sql immutable as $$
 select ('62000000-0000-4000-8000-'||case who when 'manager' then '000000000001' when 'senior' then '000000000002' when 'report' then '000000000003' when 'lead' then '000000000004' when 'foreign' then '000000000005' end)::uuid; $$;
create function pg_temp.app(who text,app text,action text,revision integer,key text,fields jsonb default '{}') returns jsonb language sql as $$
 select public.levytate_apply_application_command('61000000-0000-4000-8000-000000000001',pg_temp.actor(who),app,action,revision,key,fields); $$;
create function pg_temp.answers(employee text default 'manager',extra jsonb default '{}') returns jsonb language sql immutable as $$
 select jsonb_build_object('employeeId','manager-dev-'||employee,'apprenticeshipStandardId','manager-dev-standard','reason','Synthetic personal development','careerGoal','Synthetic own learning','supportRequired','')||extra; $$;
insert into public.levytate_organisations(id,name,slug,status) values
 ('61000000-0000-4000-8000-000000000001','Synthetic manager development','manager-dev-a','Active'),
 ('61000000-0000-4000-8000-000000000002','Synthetic other workspace','manager-dev-b','Active');
insert into public.levytate_organisations(id,name,slug,status) select '61000000-0000-4000-8000-000000000003','Synthetic catalogue','levytate-internal','Active' where not exists(select 1 from public.levytate_organisations where slug='levytate-internal');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active) select pg_temp.actor(who),case when who='foreign' then '61000000-0000-4000-8000-000000000002' else '61000000-0000-4000-8000-000000000001' end::uuid,'manager-dev-'||who||'@example.test',role,'beta_user',true from (values ('manager','Line Manager'),('senior','Line Manager'),('report','Employee'),('lead','Apprenticeship Lead'),('foreign','Line Manager')) a(who,role);
insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values ('manager-dev-standard','Synthetic standard','manager-dev-standard','Approved for delivery',4,'Synthetic');
insert into public.levytate_roles(organisation_id,id,title,career_level,status) values ('61000000-0000-4000-8000-000000000001','manager-dev-role','Synthetic role','Experienced','Active');
insert into public.levytate_role_pathway_mappings(organisation_id,id,role_id,apprenticeship_standard_id,recommendation_type) values ('61000000-0000-4000-8000-000000000001','manager-dev-map','manager-dev-role','manager-dev-standard','Primary');
insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,start_date,role_id,manager_id) select '61000000-0000-4000-8000-000000000001','manager-dev-'||who,who,'Synthetic '||who,'manager-dev-'||who||'@example.test',role,current_date,'manager-dev-role',manager from (values ('manager','Line Manager','manager-dev-senior'),('senior','Line Manager',''),('report','Employee','manager-dev-manager')) a(who,role,manager);
insert into public.levytate_providers(organisation_id,provider_id,provider_name,provider_type,status,verification_status,last_verified,source_urls) select id,'manager-dev-provider','Synthetic provider','Independent training provider','Active','verified',current_date,'["https://example.test/provider"]' from public.levytate_organisations where slug='levytate-internal';
insert into public.levytate_provider_programmes(organisation_id,id,provider_id,programme_name,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,status,record_status,verification_status,source_url) select id,'manager-dev-programme','manager-dev-provider','Synthetic programme','manager-dev-standard','manager-dev-standard','["manager-dev-standard"]','Active','Active','LevyTate reviewed','https://example.test/programme' from public.levytate_organisations where slug='levytate-internal';
insert into public.levytate_organisation_providers(organisation_id,provider_id,status) values ('61000000-0000-4000-8000-000000000001','manager-dev-provider','Active');
insert into public.levytate_organisation_programmes(organisation_id,programme_id,provider_id,status) values ('61000000-0000-4000-8000-000000000001','manager-dev-programme','manager-dev-provider','Active');
set local role service_role;
select pg_temp.check_test(pg_temp.app('manager','manager-dev-own','save_draft',0,'manager-draft-1',pg_temp.answers())->'application'->>'status'='Draft','manager creates their own draft');
select pg_temp.check_test(pg_temp.app('manager','manager-dev-own','save_draft',0,'manager-draft-1',pg_temp.answers())->'application'->>'revision'='1','same draft retry returns durable receipt');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-own','save_draft',0,'manager-draft-1',pg_temp.answers('manager','{"reason":"Changed"}'))$q$,'PT409','changed payload cannot reuse draft key');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-report','save_draft',0,'manager-report-draft',pg_temp.answers('report'))$q$,'PT403','manager cannot draft for direct report');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-second','save_draft',0,'manager-second-draft',pg_temp.answers())$q$,'PT409','manager cannot create a second active application');
select pg_temp.denied($q$select pg_temp.app('foreign','manager-dev-own','submit',1,'manager-foreign-submit')$q$,'PT403','foreign tenant actor cannot submit manager application');
select pg_temp.denied($q$select pg_temp.app('senior','manager-dev-own','submit',1,'manager-senior-submit')$q$,'PT403','current reviewer cannot submit manager personal draft');
reset role;
savepoint missing_manager;
update public.levytate_employees set manager_id='' where organisation_id='61000000-0000-4000-8000-000000000001' and id='manager-dev-manager';
set local role service_role;
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-own','submit',1,'manager-no-reviewer')$q$,'PT422','personal submission requires a distinct current manager');
rollback to savepoint missing_manager;
set local role service_role;
select pg_temp.check_test(pg_temp.app('manager','manager-dev-own','submit',1,'manager-submit-1')->'application'->>'status'='Awaiting Manager Review','manager submits to their own current manager');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-own','approve',2,'manager-self-approve','{"note":"Synthetic self approval"}')$q$,'PT403','manager cannot approve themselves');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-own','request_information',2,'manager-self-information','{"note":"Synthetic self request"}')$q$,'PT403','manager cannot review themselves');
select pg_temp.check_test(pg_temp.app('senior','manager-dev-own','request_information',2,'manager-information-1','{"note":"Synthetic clarification"}')->'application'->>'status'='More information requested','current independent manager requests information');
select pg_temp.check_test(pg_temp.app('manager','manager-dev-own','save_and_submit',3,'manager-resubmit-1',pg_temp.answers('manager','{"reason":"Synthetic clarified reason"}'))->'application'->>'status'='Awaiting Manager Review','own manager edits and resubmits requested information');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-own','withdraw',3,'manager-stale-withdraw')$q$,'PT409','stale own withdrawal cannot overwrite decision');
select pg_temp.check_test(pg_temp.app('manager','manager-dev-own','withdraw',4,'manager-withdraw-1')->'application'->>'status'='Withdrawn','own manager withdraws an unpinned active application');
select pg_temp.check_test((select count(*)=5 from public.levytate_application_history where organisation_id='61000000-0000-4000-8000-000000000001' and application_id='manager-dev-own'),'accepted commands each append history once');
reset role;
-- Published workflow remains pinned and uses its CAS lock and independent reviews.
insert into public.levytate_organisation_capabilities(organisation_id,application_workflows_enabled) values ('61000000-0000-4000-8000-000000000001',true) on conflict(organisation_id) do update set application_workflows_enabled=true;
insert into public.levytate_application_workflows(id,organisation_id) values ('63000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001');
insert into public.levytate_application_workflow_versions(id,organisation_id,workflow_id,version_number,status,published_at,steps) values ('63000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001',1,'published',clock_timestamp(),'[{"id":"employee-submit","label":"Personal submission","type":"employee_submission","responsibleRole":"Employee","allowDecline":false},{"id":"manager-approve","label":"Manager approval","type":"role_approval","responsibleRole":"Line Manager","allowDecline":true},{"id":"lead-approve","label":"Lead approval","type":"role_approval","responsibleRole":"Apprenticeship Lead","allowDecline":true},{"id":"provider-handoff","label":"Provider handoff","type":"provider_handoff","responsibleRole":"Provider Partner","allowDecline":false}]');
update public.levytate_application_workflows set published_version_id='63000000-0000-4000-8000-000000000002' where id='63000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.check_test(pg_temp.app('manager','manager-dev-pinned','save_and_submit',0,'manager-pinned-submit',pg_temp.answers())->'instance'->>'workflow_version_id'='63000000-0000-4000-8000-000000000002','manager submission pins the current published version');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-pinned','approve',1,'manager-pinned-self','{"note":"Synthetic self approval","expectedLockVersion":1}')$q$,'PT403','pinned workflow does not permit manager self approval');
select pg_temp.denied($q$select pg_temp.app('senior','manager-dev-pinned','request_information',1,'manager-pinned-stale','{"note":"Synthetic information request","expectedLockVersion":0}')$q$,'PT409','pinned workflow preserves exact lock version');
select pg_temp.check_test(pg_temp.app('senior','manager-dev-pinned','request_information',1,'manager-pinned-request','{"note":"Synthetic information request","expectedLockVersion":1}')->'instance'->>'state'='needs_information','independent manager requests pinned workflow information');
select pg_temp.check_test(pg_temp.app('manager','manager-dev-pinned','save_and_submit',2,'manager-pinned-resubmit',pg_temp.answers('manager','{"expectedLockVersion":2}'))->'instance'->>'current_step_id'='manager-approve','own manager resubmission returns to the pinned review step');
select pg_temp.denied($q$select pg_temp.app('manager','manager-dev-pinned','withdraw',3,'manager-pinned-withdraw')$q$,'PT403','existing pinned workflow withdrawal restriction is preserved');
select pg_temp.check_test(pg_temp.app('senior','manager-dev-pinned','approve',3,'manager-pinned-review','{"note":"Synthetic independent approval","expectedLockVersion":3}')->'application'->>'status'='Awaiting Final Approval','independent current manager advances to Lead');
select pg_temp.check_test(pg_temp.app('lead','manager-dev-pinned','approve',4,'manager-pinned-lead','{"note":"Synthetic final approval","expectedLockVersion":4}')->'application'->>'status'='Approved for Enrolment','Lead final approval remains separately required');
reset role;
insert into public.levytate_learner_records(organisation_id,id,employee_id,lifecycle_status,employment_route,record_status) values ('61000000-0000-4000-8000-000000000001','manager-dev-own-learner','manager-dev-manager','pre_enrolment','existing_employee_upskill','Active'),('61000000-0000-4000-8000-000000000001','manager-dev-report-learner','manager-dev-report','pre_enrolment','existing_employee_upskill','Active');
create function pg_temp.declare(who text,learner text,revision integer,key text,verification text default 'employee_confirmed') returns jsonb language sql as $$
 select public.levytate_apply_learner_command('61000000-0000-4000-8000-000000000001',pg_temp.actor(who),'manager-dev-'||learner||'-learner','employee_declaration',key,'{"confirmed":true}',revision,
 jsonb_build_array(jsonb_build_object('table','levytate_learner_eligibility_declarations','row',jsonb_build_object('organisation_id','61000000-0000-4000-8000-000000000001','id','manager-dev-'||learner||'-declaration','learner_record_id','manager-dev-'||learner||'-learner','declaration_type','england_working_hours','declaration_wording','I confirm that I expect to spend at least 50% of my working hours in England over the duration of the apprenticeship.','declaration_version','2026-07-operational-4a','confirmed',true,'confirmed_by_employee',case learner when 'own' then 'manager-dev-manager' else 'manager-dev-report' end,'expected_england_working_hours_percentage',100,'verification_status',verification,'verified_by','')),
 jsonb_build_object('table','levytate_learner_lifecycle_events','row',jsonb_build_object('organisation_id','61000000-0000-4000-8000-000000000001','id','manager-dev-'||learner||'-event','learner_record_id','manager-dev-'||learner||'-learner','event_type','verification','summary','Synthetic personal declaration','actor_user_id','forged','actor_name','forged','source','forged'))),'{"confirmed":true}',false); $$;
set local role service_role;
select pg_temp.denied($q$select pg_temp.declare('manager','report',0,'manager-report-declare')$q$,'PT403','manager cannot make a direct report declaration');
select pg_temp.denied($q$select pg_temp.declare('senior','own',0,'manager-senior-declare')$q$,'PT403','current reviewer cannot declare for manager learner');
select pg_temp.denied($q$select pg_temp.declare('foreign','own',0,'manager-foreign-declare')$q$,'PT403','foreign tenant actor cannot declare');
select pg_temp.denied($q$select pg_temp.declare('manager','own',0,'manager-self-verify','employer_verified')$q$,'PT403','own manager cannot self-verify employer eligibility');
reset role;
select pg_temp.denied($q$insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,start_date,role_id,manager_id) values ('61000000-0000-4000-8000-000000000001','manager-dev-duplicate','duplicate','Synthetic duplicate','MANAGER-DEV-MANAGER@EXAMPLE.TEST','Line Manager',current_date,'manager-dev-role','manager-dev-senior')$q$,'23505','normalised People uniqueness prevents ambiguous identity');
set local role service_role;
select pg_temp.check_test(pg_temp.declare('manager','own',0,'manager-own-declare')->>'confirmed'='true','own manager learner declaration commits');
select pg_temp.check_test(pg_temp.declare('manager','own',0,'manager-own-declare')->>'confirmed'='true','own manager declaration retry replays');
select pg_temp.check_test((select verification_status='employee_confirmed' and verified_by='' from public.levytate_learner_eligibility_declarations where organisation_id='61000000-0000-4000-8000-000000000001' and id='manager-dev-own-declaration'),'own declaration still requires independent employer verification');
select pg_temp.check_test((select actor_user_id=pg_temp.actor('manager')::text and source='levytate_server' from public.levytate_learner_lifecycle_events where organisation_id='61000000-0000-4000-8000-000000000001' and id='manager-dev-own-event'),'declaration event actor is authoritative');
select pg_temp.check_test(not has_function_privilege('authenticated','public.levytate_apply_application_command(uuid,uuid,text,text,integer,text,jsonb)','EXECUTE') and not has_function_privilege('anon','public.levytate_apply_learner_command(uuid,uuid,text,text,text,jsonb,integer,jsonb,jsonb,boolean)','EXECUTE'),'personal permissions never expose browser RPC grants');
rollback;
