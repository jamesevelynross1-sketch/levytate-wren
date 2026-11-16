-- Synthetic, rollback-only checks. Run in the dedicated LOCAL PG17 verifier DB.
-- This exercises SQL invariants, not actual Auth/Storage API disposal or login.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_test(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end; $$;
create function pg_temp.denied(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin
 begin execute statement;exception when others then get stacked diagnostics actual=returned_sqlstate;end;
 perform pg_temp.check_test(actual=expected,label||coalesce(' ['||actual||']',' [not denied]'));
end; $$;
insert into public.levytate_organisations(id,name,slug,workspace_template,status) values
 ('20000000-0000-4000-8000-000000000001','Synthetic operator','off-test-platform','levytate-client-v1','Active'),
 ('20000000-0000-4000-8000-000000000002','Synthetic offboard','off-test-a','levytate-client-v1','Suspended'),
 ('20000000-0000-4000-8000-000000000003','Synthetic unaffected','off-test-b','levytate-client-v1','Active');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at,display_name) values
 ('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','off-admin-a@example.test','Platform Admin','beta_user',true,'22000000-0000-4000-8000-000000000001','bound',now(),'Synthetic administrator A'),
 ('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','off-admin-b@example.test','Platform Admin','beta_user',true,'22000000-0000-4000-8000-000000000002','bound',now(),'Synthetic administrator B'),
 ('21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','off-member-a@example.test','Apprenticeship Lead','beta_user',false,null,'pending',null,'Synthetic member A'),
 ('21000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003','off-member-b@example.test','Apprenticeship Lead','beta_user',true,'22000000-0000-4000-8000-000000000004','bound',now(),'Synthetic member B');
insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
 values('23000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','off-member-a@example.test','Apprenticeship Lead','client_workspace','test','synthetic','Synthetic audit','{}');

create temporary table off_state(policy jsonb,request jsonb,snapshot jsonb);
insert into public.levytate_provider_memberships(id,provider_id,email,role,active,created_by)
 values('26000000-0000-4000-8000-000000000001','synthetic-provider','off-provider@example.test','Provider User',false,'21000000-0000-4000-8000-000000000003');
insert into off_state(policy) select jsonb_build_object('version','levytate-offboarding-v1','approvalReference','synthetic-policy','clientNoticeReference','synthetic-notice',
 'supportHandoverReference','synthetic-handover','recoveryBoundaryReference','synthetic-no-restore','dataOwnerUserId','21000000-0000-4000-8000-000000000001',
 'serviceOwnerUserId','21000000-0000-4000-8000-000000000002','evidenceRetainUntil',now()+interval '30 days','schedules',
 (select jsonb_agg(jsonb_build_object('dataClass',k,'retainUntil',now()-interval '1 day','action','delete','approvalReference','synthetic-due')) from unnest(array['identity','people','applications','learners','finance','catalogue','files','assessments','lift','support','audit']) k));
update off_state set request=jsonb_build_object('action','request','caseId','24000000-0000-4000-8000-000000000001','requestId','25000000-0000-4000-8000-000000000001',
 'organisationId','20000000-0000-4000-8000-000000000002','purpose','delete','policy',policy,'recipientPublicKey',repeat('synthetic-public-key-',10),'exportExpiresAt',now()+interval '1 day');

select pg_temp.check_test(not has_table_privilege('service_role','public.levytate_tenant_offboarding_cases','UPDATE'),'service cannot write approvals directly');
select pg_temp.check_test(not has_function_privilege('anon','public.levytate_offboarding_command(uuid,jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.levytate_offboarding_snapshot(uuid,uuid)','EXECUTE'),'browser roles cannot call lifecycle RPCs');
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000004',(select request from off_state))$q$,'PT403','employer cannot manage offboarding');
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001',request) from off_state;
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001',request) from off_state;
select pg_temp.check_test((select count(*)=1 from public.levytate_tenant_offboarding_events),'request replay is one durable event');
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001',(select request||'{"purpose":"export"}' from off_state))$q$,'PT409','changed request cannot reuse receipt');
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001','{"action":"approve","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000002","expectedRevision":1,"approvalReference":"synthetic-second"}')$q$,'PT403','requester cannot self-approve');
create function pg_temp.offboarding_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit outage';end; $$;
create trigger offboarding_test_audit_failure before insert on public.levytate_tenant_offboarding_events for each row execute function pg_temp.offboarding_fail_audit();
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000002','{"action":"approve","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000002","expectedRevision":1,"approvalReference":"synthetic-second"}')$q$,'P0001','audit outage aborts approval');
select pg_temp.check_test((select status='requested' and revision=1 and approver_id is null from public.levytate_tenant_offboarding_cases where id='24000000-0000-4000-8000-000000000001'),'failed approval leaves no partial status or receipt');
drop trigger offboarding_test_audit_failure on public.levytate_tenant_offboarding_events;
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000002','{"action":"approve","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000002","expectedRevision":1,"approvalReference":"synthetic-second"}');
select pg_temp.denied($q$update public.levytate_users set display_name='Changed' where id='21000000-0000-4000-8000-000000000003'$q$,'PT409','approved tenant data is frozen');
update public.levytate_users set display_name='Unaffected change' where id='21000000-0000-4000-8000-000000000004';
select pg_temp.check_test((select display_name='Unaffected change' from public.levytate_users where id='21000000-0000-4000-8000-000000000004'),'second tenant remains writable');
create table public.levytate_unreviewed_off_test(organisation_id uuid);
select pg_temp.denied($q$select public.levytate_offboarding_snapshot('21000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001')$q$,'PT409','new tenant table stops export');
drop table public.levytate_unreviewed_off_test;
update off_state set snapshot=public.levytate_offboarding_snapshot('21000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001');
select pg_temp.check_test((select snapshot->'tables'->'levytate_users'->0->>'email'='off-member-a@example.test' and jsonb_array_length(snapshot->'tables'->'levytate_users')=1 from off_state),'snapshot is one tenant only');
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001',jsonb_build_object('action','record_export','caseId','24000000-0000-4000-8000-000000000001','requestId','25000000-0000-4000-8000-000000000003','expectedRevision',2,
 'snapshotHash',snapshot->>'snapshotHash','storageInventory',snapshot->'storageObjects','manifest',jsonb_build_object('organisationId',snapshot->>'organisationId','tables','[]'::jsonb,'storage','[]'::jsonb),
 'envelope',jsonb_build_object('version','levytate-encrypted-export-v1','expiresAt',snapshot->>'expiresAt'))) from off_state;
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001','{"action":"begin_delete","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000004","expectedRevision":3}')$q$,'PT409','unconfirmed delivery blocks deletion');
select pg_temp.check_test(public.levytate_offboarding_download('21000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001')->>'version'='levytate-encrypted-export-v1','authorised encrypted delivery records issue');
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001','{"action":"record_delivery","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000004","expectedRevision":3,"reference":"synthetic-delivery"}');
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001','{"action":"hold","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000005","expectedRevision":4,"active":true,"reference":"synthetic-legal-hold"}');
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000002','{"action":"begin_delete","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000006","expectedRevision":5}')$q$,'PT409','legal hold blocks irreversible work');
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001','{"action":"hold","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000006","expectedRevision":5,"active":false,"reference":"synthetic-release"}')$q$,'PT403','same person cannot release hold');
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000002','{"action":"hold","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000006","expectedRevision":5,"active":false,"reference":"synthetic-release"}');
select pg_temp.denied($q$insert into public.levytate_provider_memberships(id,provider_id,email,role,active,created_by)
 values('26000000-0000-4000-8000-000000000002','synthetic-provider','off-provider-new@example.test','Provider User',false,'21000000-0000-4000-8000-000000000003')$q$,'PT409','approval blocks a new global ownership reference');
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000002','{"action":"begin_delete","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000007","expectedRevision":6}')$q$,'PT409','external reference blocks disposal before any provider deletion');
delete from public.levytate_provider_memberships where id='26000000-0000-4000-8000-000000000001';
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000002','{"action":"begin_delete","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000007","expectedRevision":6}');
select pg_temp.denied($q$select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001','{"action":"cancel","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000008","expectedRevision":7}')$q$,'PT409','cannot pretend to cancel irreversible disposal');
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000001','{"action":"hold","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000008","expectedRevision":7,"active":true,"reference":"synthetic-late-hold"}');
select pg_temp.denied($q$select public.levytate_offboarding_disposal_plan('21000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001')$q$,'PT409','late legal hold pauses remaining provider work');
select public.levytate_offboarding_command('21000000-0000-4000-8000-000000000002','{"action":"hold","caseId":"24000000-0000-4000-8000-000000000001","requestId":"25000000-0000-4000-8000-000000000009","expectedRevision":8,"active":false,"reference":"synthetic-late-release"}');
select public.levytate_offboarding_finish_delete('21000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001');
select pg_temp.check_test(not exists(select 1 from public.levytate_organisations where id='20000000-0000-4000-8000-000000000002'),'approved tenant is removed');
select pg_temp.check_test(not exists(select 1 from public.levytate_users where organisation_id='20000000-0000-4000-8000-000000000002'),'scoped membership is removed');
select pg_temp.check_test((select count(*)=1 from public.levytate_organisations where id='20000000-0000-4000-8000-000000000003') and (select display_name='Unaffected change' from public.levytate_users where id='21000000-0000-4000-8000-000000000004'),'second tenant survives disposal unchanged');
select pg_temp.check_test(public.levytate_offboarding_finish_delete('21000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001')->>'irreversible'='true','completion retry returns original evidence');
select pg_temp.check_test((select encrypted_package is null and auth_inventory is null and manifest is null from public.levytate_tenant_offboarding_cases where id='24000000-0000-4000-8000-000000000001'),'content removed from retained minimal evidence');
select pg_temp.denied($q$select public.levytate_offboarding_erase_evidence('21000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','synthetic-evidence-erasure')$q$,'PT409','approved evidence retention is enforced');
rollback;
