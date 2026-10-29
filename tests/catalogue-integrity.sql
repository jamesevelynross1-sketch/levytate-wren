-- Run only against a disposable local database containing the staged migration.
-- Every fictional row and temporary assertion is rolled back.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if inet_server_addr() is not null and inet_server_addr() not in ('127.0.0.1'::inet,'::1'::inet) then
    raise exception 'Catalogue acceptance SQL is local-only'; end if;
end; $$;
create function pg_temp.check_result(p_ok boolean,p_label text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAIL: %',p_label; end if; raise notice 'PASS: %',p_label; end; $$;
create function pg_temp.reject(p_sql text,p_state text,p_label text) returns void language plpgsql as $$
declare v_rejected boolean:=false;
begin
  begin execute p_sql; set constraints all immediate;
  exception when others then
    if SQLSTATE<>p_state then raise exception 'FAIL: % expected %, got % (%)',p_label,p_state,SQLSTATE,SQLERRM; end if;
    v_rejected:=true;
  end;
  set constraints all deferred;
  perform pg_temp.check_result(v_rejected,p_label);
end; $$;

insert into public.levytate_organisations(id,name,slug,status) values
 ('ca000000-0000-0000-0000-000000000001','Fictional canonical','levytate-internal','Active'),
 ('ca000000-0000-0000-0000-000000000002','Fictional A','catalogue-fictional-a','Active'),
 ('ca000000-0000-0000-0000-000000000003','Fictional B','catalogue-fictional-b','Active');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values
 ('ca100000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000002','catalogue-a@example.invalid','Apprenticeship Lead','beta_user',true),
 ('ca100000-0000-0000-0000-000000000003','ca000000-0000-0000-0000-000000000003','catalogue-b@example.invalid','Apprenticeship Lead','beta_user',true);
insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values('catalogue-standard','Fictional standard','STTEST','Approved for delivery',4,'Test');
insert into public.levytate_providers(organisation_id,provider_id,provider_name,provider_type,status,verification_status,last_verified,source_urls) values
 ('ca000000-0000-0000-0000-000000000001','catalogue-provider','Fictional provider','Independent training provider','Active','verified','2026-10-29','["https://example.invalid/source"]'),
 ('ca000000-0000-0000-0000-000000000001','unverified-provider','Fictional unverified','Independent training provider','Active','needs_verification',null,'[]');
insert into public.levytate_provider_programmes(organisation_id,id,provider_id,programme_name,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,status,record_status,verification_status,source_url) values
 ('ca000000-0000-0000-0000-000000000001','catalogue-programme','catalogue-provider','Fictional programme','catalogue-standard','catalogue-standard','["catalogue-standard"]','Active','Active','LevyTate reviewed','https://example.invalid/programme');
set constraints all immediate;
set constraints all deferred;

select public.levytate_save_role('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002',
 '{"id":"catalogue-role","title":"Original role","department":"Data","career_level":"Experienced","skills_tags":[],"progression":[],"status":"Active"}',
 '[{"id":"catalogue-map","apprenticeship_standard_id":"catalogue-standard","recommendation_type":"Primary","priority":1}]');
set constraints all immediate;
set constraints all deferred;
select pg_temp.check_result((select count(*)=1 from public.levytate_role_pathway_mappings where role_id='catalogue-role'),'role and mapping committed together');
select pg_temp.reject($q$select public.levytate_save_role('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002',
 '{"id":"catalogue-role","title":"Would replace original","department":"Data","career_level":"Experienced","skills_tags":[],"progression":[],"status":"Active"}',
 '[{"id":"new-map","apprenticeship_standard_id":"missing-standard","recommendation_type":"Primary","priority":1}]')$q$,'PT422','invalid replacement rolls back role and mappings');
select pg_temp.check_result((select title='Original role' from public.levytate_roles where id='catalogue-role') and (select count(*)=1 from public.levytate_role_pathway_mappings where id='catalogue-map'),'failed mapping replacement retains original record');
select pg_temp.reject($q$select public.levytate_save_role('ca000000-0000-0000-0000-000000000003','ca100000-0000-0000-0000-000000000002','{}','[]')$q$,'PT403','cross-tenant role actor denied');
select pg_temp.reject($q$select public.levytate_save_role('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002',
 '{"id":"catalogue-role","title":"Test","department":"Data","career_level":"Experienced","skills_tags":[],"progression":[],"status":null}',
 '[{"id":"new-map","apprenticeship_standard_id":"catalogue-standard","recommendation_type":"Primary","priority":1}]')$q$,'PT422','null status fails closed');
select pg_temp.reject($q$select public.levytate_save_role('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002',
 '{"id":"catalogue-role","title":"Test","department":"Data","career_level":"Experienced","skills_tags":[],"progression":[],"status":"Active"}',
 '[{"id":"new-map","apprenticeship_standard_id":"catalogue-standard","recommendation_type":"Primary","priority":"1"}]')$q$,'PT422','string priority is not coerced');
select pg_temp.reject($q$select public.levytate_save_role('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002',
 '{"id":"catalogue-role","title":"Test","department":"Data","career_level":"Experienced","skills_tags":[],"progression":[],"status":"Active"}',
 '[{"id":"new-map","apprenticeship_standard_id":"catalogue-standard","recommendation_type":"Primary","priority":1.5}]')$q$,'PT422','fractional priority is rejected');
select pg_temp.reject($q$select public.levytate_save_role('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002',
 '{"id":"catalogue-role","title":"Test","department":"Data","career_level":"Experienced","skills_tags":[{"unexpected":"object"}],"progression":[],"status":"Active"}',
 '[{"id":"new-map","apprenticeship_standard_id":"catalogue-standard","recommendation_type":"Primary","priority":1}]')$q$,'PT422','arbitrary objects cannot be stored as skill tags');

select public.levytate_select_catalogue('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002','programme','catalogue-programme','catalogue-provider','Active');
select public.levytate_select_catalogue('ca000000-0000-0000-0000-000000000003','ca100000-0000-0000-0000-000000000003','programme','catalogue-programme','catalogue-provider','Active');
set constraints all immediate;
set constraints all deferred;
select pg_temp.check_result((select count(*)=2 from public.levytate_organisation_providers where provider_id='catalogue-provider' and status='Active'),'programme selection atomically selects provider in both tenants');
select public.levytate_select_catalogue('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002','provider','catalogue-provider','catalogue-provider','Inactive');
set constraints all immediate;
set constraints all deferred;
select pg_temp.check_result((select status='Inactive' from public.levytate_organisation_programmes where organisation_id='ca000000-0000-0000-0000-000000000002' and programme_id='catalogue-programme'),'provider deactivation cascades in the same transaction');
select pg_temp.check_result((select status='Active' from public.levytate_organisation_programmes where organisation_id='ca000000-0000-0000-0000-000000000003' and programme_id='catalogue-programme'),'cascade does not touch the other tenant');
select pg_temp.reject($q$select public.levytate_select_catalogue('ca000000-0000-0000-0000-000000000003','ca100000-0000-0000-0000-000000000002','provider','catalogue-provider','catalogue-provider','Inactive')$q$,'PT403','cross-tenant selection actor denied');
select pg_temp.reject($q$select public.levytate_select_catalogue('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002','programme','catalogue-programme','unverified-provider','Active')$q$,'PT422','mismatched programme provider rejected');
select pg_temp.reject($q$select public.levytate_select_catalogue('ca000000-0000-0000-0000-000000000002','ca100000-0000-0000-0000-000000000002','provider','unverified-provider','unverified-provider','Active')$q$,'PT422','unverified provider cannot be selected');
select pg_temp.reject($q$update public.levytate_provider_programmes set record_status='Archived' where id='catalogue-programme'$q$,'PT409','active selection prevents global programme archival');
select pg_temp.reject($q$delete from public.levytate_provider_programmes where id='catalogue-programme'$q$,'PT409','historical selections prevent programme deletion');
select pg_temp.reject($q$update public.levytate_providers set verification_status='needs_verification' where provider_id='catalogue-provider'$q$,'PT409','active selections prevent silently removing verification');
select pg_temp.reject($q$insert into public.levytate_provider_relationships(organisation_id,id,category,preferred_provider_id,status,review_date,last_used_date) values('ca000000-0000-0000-0000-000000000002','bad-relationship','Digital','foreign-provider','Preferred','2026-10-29','2026-10-29')$q$,'PT422','foreign relationship provider denied');
select pg_temp.reject($q$delete from public.levytate_apprenticeship_standards where id='catalogue-standard'$q$,'PT409','referenced official standard cannot be deleted');
select pg_temp.reject($q$update public.levytate_providers set organisation_id='ca000000-0000-0000-0000-000000000003' where provider_id='catalogue-provider'$q$,'PT403','canonical records cannot be rebound to a tenant');
select pg_temp.check_result(not has_function_privilege('anon','public.levytate_save_role(uuid,uuid,jsonb,jsonb)','execute') and not has_function_privilege('authenticated','public.levytate_select_catalogue(uuid,uuid,text,text,text,text)','execute'),'browser roles cannot invoke catalogue write functions');
select pg_temp.check_result(has_function_privilege('service_role','public.levytate_save_role(uuid,uuid,jsonb,jsonb)','execute') and has_function_privilege('service_role','public.levytate_select_catalogue(uuid,uuid,text,text,text,text)','execute'),'only service role is granted catalogue RPC execution');
select pg_temp.check_result((select count(*)=4 from public.levytate_audit_events where organisation_id in ('ca000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000003') and action in ('role.saved','catalogue.selection_saved')),'failed commands do not create success audit events');
rollback;
