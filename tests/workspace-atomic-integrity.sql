-- Disposable localhost database only; every synthetic record is rolled back.
\set ON_ERROR_STOP on
begin;
set local request.jwt.claims='{"role":"service_role"}';
set local request.jwt.claim.role='service_role';
do $$begin if inet_server_addr() is not null and inet_server_addr() not in ('127.0.0.1'::inet,'::1'::inet) then raise exception 'Local only';end if;end;$$;
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.reject(sql text,state text,label text) returns void language plpgsql as $$declare denied boolean:=false;begin begin execute sql;set constraints all immediate;exception when others then if SQLSTATE<>state then raise exception 'FAIL: % expected % got %: %',label,state,SQLSTATE,SQLERRM;end if;denied:=true;end;set constraints all deferred;perform pg_temp.check_result(denied,label);end;$$;
insert into public.levytate_organisations(id,name,slug,status) values
 ('ab000000-0000-4000-8000-000000000001','Synthetic internal','levytate-internal','Active'),
 ('ab000000-0000-4000-8000-000000000002','Synthetic A','atomic-a','Active'),
 ('ab000000-0000-4000-8000-000000000003','Synthetic B','atomic-b','Active');
insert into public.levytate_users(id,organisation_id,email,role,active,access_level) values
 ('ab100000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','platform@example.test','Platform Admin',true,'beta_admin'),
 ('ab100000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000002','lead-a@example.test','Apprenticeship Lead',true,'beta_user'),
 ('ab100000-0000-4000-8000-000000000003','ab000000-0000-4000-8000-000000000003','lead-b@example.test','Apprenticeship Lead',true,'beta_user');
create function pg_temp.person(id text) returns jsonb language sql as $$select jsonb_build_object('id',id,'employee_number',id,'name','Synthetic person','email',id||'@example.test','job_title','Analyst','role_id','','manager_id','','department','Data','site','','platform_role','Employee','status','Active','start_date','2026-10-01','created_at','2000-01-01T00:00:00Z','updated_at','2000-01-01T00:00:00Z');$$;
select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveEmployee','person',0,pg_temp.person('person'));
set constraints all immediate;set constraints all deferred;
select pg_temp.check_result((select count(*)=1 from public.levytate_employees where id='person') and (select count(*)=1 from public.levytate_audit_events where action='employee.saved' and entity_id='person'),'employee and append-only audit persist together');
select pg_temp.check_result((select created_at>'2026-01-01' from public.levytate_employees where id='person'),'server owns timestamps');
select pg_temp.check_result((public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveEmployee','person',0,pg_temp.person('person')||'{"updated_at":"2099-01-01T00:00:00Z"}') ->>'replayed')::boolean,'lost response replays original receipt despite client clock changes');
select pg_temp.check_result((select count(*)=1 from public.levytate_audit_events where action='employee.saved' and entity_id='person'),'replay does not duplicate success audit');
select pg_temp.reject($q$select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveEmployee','person',0,pg_temp.person('person')||'{"name":"Changed"}')$q$,'PT409','changed stale write cannot reuse receipt');
select pg_temp.reject($q$select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000003','ab100000-0000-4000-8000-000000000002','saveEmployee','foreign',0,pg_temp.person('foreign'))$q$,'PT403','foreign actor denied');
select pg_temp.reject($q$select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveEmployee','forged',0,pg_temp.person('forged')||'{"organisation_id":"ab000000-0000-4000-8000-000000000003"}')$q$,'PT422','unknown plan tenancy field denied');
create function pg_temp.fail_audit() returns trigger language plpgsql as $$begin if new.entity_id='audit-fails' then raise exception using errcode='55000',message='Synthetic append-only audit outage';end if;return new;end;$$;
create trigger synthetic_audit_failure before insert on public.levytate_audit_events for each row execute function pg_temp.fail_audit();
select pg_temp.reject($q$select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveEmployee','audit-fails',0,pg_temp.person('audit-fails'))$q$,'55000','audit failure aborts employee write');
select pg_temp.check_result(not exists(select 1 from public.levytate_employees where id='audit-fails') and not exists(select 1 from public.levytate_workspace_command_receipts where entity_key='levytate_employees:audit-fails') and not exists(select 1 from public.levytate_workspace_entity_versions where entity_key='levytate_employees:audit-fails'),'failed audit leaves no entity, version or receipt');
drop trigger synthetic_audit_failure on public.levytate_audit_events;
insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_subject,auth_binding_status,invitation_status) values('ab100000-0000-4000-8000-000000000004','ab000000-0000-4000-8000-000000000002','person@example.test','Employee',true,'beta_user','ab200000-0000-4000-8000-000000000004','bound','consumed');
select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','archiveEmployee','person',1,'{"status":"Archived"}');
select pg_temp.check_result((select not active and auth_subject is null and invitation_status='revoked' from public.levytate_users where email='person@example.test'),'archive atomically invalidates linked membership');
select pg_temp.check_result((select metadata->>'revokedMemberships'='1' from public.levytate_audit_events where entity_id='person' and action='employee.archived'),'linked access revocation is recorded in the same append-only audit');
select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','archiveEmployee','person',2,'{"status":"Active"}');
select pg_temp.check_result((select not active and invitation_status='revoked' from public.levytate_users where email='person@example.test'),'People restoration never revives an old invitation or session');
insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values('atomic-standard','Synthetic standard','STTEST','Approved for delivery',4,'Test');
select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveRole','atomic-role',0,'{"role":{"id":"atomic-role","title":"Synthetic role","department":"Data","career_level":"Experienced","skills_tags":[],"progression":[],"status":"Active"},"mappings":[{"id":"atomic-map","apprenticeship_standard_id":"atomic-standard","recommendation_type":"Primary","priority":1}]}');
select pg_temp.reject($q$select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','archiveRole','atomic-role',0,'{"status":"Archived"}')$q$,'PT409','role save invalidates stale archive revision');
update public.levytate_roles set title='Independent newer edit' where id='atomic-role';
select pg_temp.reject($q$select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveRole','atomic-role',1,'{"role":{"id":"atomic-role","title":"Stale edit","department":"Data","career_level":"Experienced","skills_tags":[],"progression":[],"status":"Active"},"mappings":[{"id":"atomic-map","apprenticeship_standard_id":"atomic-standard","recommendation_type":"Primary","priority":1}]}')$q$,'PT409','direct or existing RPC role update invalidates stale save');
select pg_temp.check_result(not has_table_privilege('service_role','public.levytate_audit_events','UPDATE') and not has_table_privilege('service_role','public.levytate_workspace_command_receipts','UPDATE') and not has_function_privilege('authenticated','public.levytate_workspace_command(uuid,uuid,text,text,bigint,jsonb)','EXECUTE'),'browser RPC and audit/receipt updates remain denied');
-- Challenge every additional row-plan family against the real PostgreSQL schema.
create function pg_temp.command(action text,id text,record jsonb,entity_table text,canonical boolean default false) returns jsonb language sql as $$
 select public.levytate_workspace_command(
  case when canonical then 'ab000000-0000-4000-8000-000000000001'::uuid else 'ab000000-0000-4000-8000-000000000002'::uuid end,
  case when canonical then 'ab100000-0000-4000-8000-000000000001'::uuid else 'ab100000-0000-4000-8000-000000000002'::uuid end,
  action,id,coalesce((select revision from public.levytate_workspace_entity_versions where organisation_id=case when canonical then 'ab000000-0000-4000-8000-000000000001'::uuid else 'ab000000-0000-4000-8000-000000000002'::uuid end and entity_key=entity_table||':'||id),0),record);
$$;
select pg_temp.command('saveEmployeeDevelopmentProfile','person','{"employee_id":"person","stage":"role_context","responsibilities":["Synthetic responsibility"],"conversation_profile":{},"recommendation_result":null}','levytate_employee_development_profiles');
select pg_temp.check_result((select responsibilities='["Synthetic responsibility"]'::jsonb from public.levytate_employee_development_profiles where employee_id='person'),'development profile and audit persist');
select pg_temp.reject($q$select pg_temp.command('saveEmployeeDevelopmentProfile','person','{"employee_id":"person","stage":"role_context","responsibilities":[{}]}','levytate_employee_development_profiles')$q$,'PT422','list entries cannot be arbitrary objects');
select pg_temp.reject($q$select pg_temp.command('saveEmployeeDevelopmentProfile','person','{"employee_id":"person","stage":"role_context","conversation_profile":[]}','levytate_employee_development_profiles')$q$,'PT422','conversation profile requires an object');
select pg_temp.command('saveMatchingRequest','match','{"id":"match","role_need":"Synthetic need","linked_standard_id":"atomic-standard","learner_count":1,"status":"Submitted"}','levytate_matching_requests');
select pg_temp.check_result((select apprenticeship_standard_id=linked_standard_id and role_need='Synthetic need' from public.levytate_matching_requests where id='match'),'matching save supplies legacy required standard from the authoritative link');
select pg_temp.command('updateMatchingStatus','match','{"status":"Under Review"}','levytate_matching_requests');
select pg_temp.check_result((select status='Under Review' from public.levytate_matching_requests where id='match'),'matching state mutation persists');
select pg_temp.reject($q$select pg_temp.command('saveMatchingRequest','match','{"id":"match","role_need":"Synthetic need","learner_count":1.5,"status":"Submitted"}','levytate_matching_requests')$q$,'PT422','fractional learner count is not silently rounded');
select pg_temp.command('saveProvider','provider','{"provider_id":"provider","provider_name":"Synthetic provider","provider_type":"Independent training provider","status":"Active","verification_status":"verified","last_verified":"2026-10-29","source_urls":["https://example.test/source"]}','levytate_providers',true);
select pg_temp.check_result((select organisation_id='ab000000-0000-4000-8000-000000000001'::uuid from public.levytate_providers where provider_id='provider'),'provider targets canonical organisation');
select pg_temp.command('saveProviderProgramme','programme','{"id":"programme","provider_id":"provider","programme_name":"Synthetic programme","linked_standard_id":"atomic-standard","linked_standard_ids":["atomic-standard"],"linked_standard_name":"Forged title","level":8,"status":"Active","record_status":"Active","verification_status":"LevyTate reviewed","source_url":"https://example.test/programme"}','levytate_provider_programmes',true);
select pg_temp.check_result((select linked_standard_name='Synthetic standard' and level=4 and apprenticeship_standard_id='atomic-standard' from public.levytate_provider_programmes where id='programme'),'programme re-derives current official title, level and legacy standard');
select pg_temp.command('saveProviderRelationship','relationship','{"id":"relationship","category":"Data","preferred_provider_id":"provider","programme_ids":["programme"],"status":"Preferred","review_date":"2026-10-29","last_used_date":null}','levytate_provider_relationships');
select pg_temp.check_result((select programme_ids='["programme"]'::jsonb from public.levytate_provider_relationships where id='relationship'),'provider relationship persists');
select pg_temp.command('saveOrganisationProgramme','programme','{"provider_id":"provider","status":"Active"}','levytate_organisation_programmes');
select pg_temp.check_result((select status='Active' from public.levytate_organisation_providers where organisation_id='ab000000-0000-4000-8000-000000000002' and provider_id='provider'),'programme selection atomically activates its provider');
select pg_temp.command('saveOrganisationProvider','provider','{"provider_id":"provider","status":"Inactive"}','levytate_organisation_providers');
select pg_temp.check_result((select status='Inactive' from public.levytate_organisation_programmes where organisation_id='ab000000-0000-4000-8000-000000000002' and programme_id='programme'),'provider selection cascade updates programme and versions');
select pg_temp.reject($q$select public.levytate_workspace_command('ab000000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000002','saveOrganisationProgramme','programme',1,'{"provider_id":"provider","status":"Active"}')$q$,'PT409','cascade invalidates stale programme selection');
select pg_temp.command('archiveProviderProgramme','programme','{"status":"Archived"}','levytate_provider_programmes',true);
select pg_temp.check_result((select record_status='Archived' from public.levytate_provider_programmes where id='programme'),'programme archive writes explicit record state');
select pg_temp.reject($q$select pg_temp.command('removeProviderProgramme','programme','{}','levytate_provider_programmes',true)$q$,'PT409','historical references prevent programme deletion');
select pg_temp.command('saveProviderProgramme','removable','{"id":"removable","provider_id":"provider","programme_name":"Synthetic disposable programme","linked_standard_id":"atomic-standard","linked_standard_ids":["atomic-standard"],"status":"Active","record_status":"Active","verification_status":"LevyTate reviewed","source_url":"https://example.test/programme"}','levytate_provider_programmes',true);
select pg_temp.command('removeProviderProgramme','removable','{}','levytate_provider_programmes',true);
select pg_temp.check_result(not exists(select 1 from public.levytate_provider_programmes where id='removable') and exists(select 1 from public.levytate_workspace_entity_versions where entity_key='levytate_provider_programmes:removable'),'unreferenced programme deletion preserves a CAS tombstone');
select pg_temp.command('archiveProvider','provider','{"status":"Archived"}','levytate_providers',true);
select pg_temp.check_result((select status='Archived' from public.levytate_providers where provider_id='provider'),'provider archive persists explicit state');
update public.levytate_users set role='Employer Admin' where id='ab100000-0000-4000-8000-000000000002';
select pg_temp.command('saveProfile','ab000000-0000-4000-8000-000000000002','{"name":"Synthetic renamed","sites":["Test"],"priorities":[]}','levytate_organisations');
select pg_temp.check_result((select name='Synthetic renamed' from public.levytate_organisations where id='ab000000-0000-4000-8000-000000000002'),'employer profile persists with atomic audit');
select pg_temp.command('archiveRole','atomic-role','{"status":"Archived"}','levytate_roles');
select pg_temp.check_result((select status='Archived' from public.levytate_roles where id='atomic-role'),'role archive persists with atomic audit');
set constraints all immediate;
select pg_temp.check_result((select count(*)>=16 from public.levytate_workspace_command_receipts),'all successful command families produce transaction receipts');
rollback;
