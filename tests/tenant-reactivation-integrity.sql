-- Fictional LOCAL rollback-only approval/revocation checks, not hosted acceptance.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_test(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end; $$;
create function pg_temp.denied(statement text,expected text,label text) returns void language plpgsql as $$
declare actual text;
begin begin execute statement;exception when others then get stacked diagnostics actual=returned_sqlstate;end;
 perform pg_temp.check_test(actual=expected,label||coalesce(' ['||actual||']',' [not denied]'));end; $$;
insert into public.levytate_organisations(id,name,slug,workspace_template,status) values
 ('51000000-0000-4000-8000-000000000001','Synthetic operator','reactivate-operator','levytate-client-v1','Active'),
 ('51000000-0000-4000-8000-000000000002','Synthetic suspended','reactivate-employer','levytate-client-v1','Suspended'),
 ('51000000-0000-4000-8000-000000000003','Synthetic unaffected','reactivate-unaffected','levytate-client-v1','Active');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at,invitation_status,invitation_generation) values
 ('52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','reactivate-admin-a@example.test','Platform Admin','beta_user',true,'53000000-0000-4000-8000-000000000001','bound',now(),'consumed',2),
 ('52000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','reactivate-admin-b@example.test','Platform Admin','beta_user',true,'53000000-0000-4000-8000-000000000002','bound',now(),'consumed',2),
 ('52000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000002','reactivate-member@example.test','Employee','beta_user',false,'53000000-0000-4000-8000-000000000003','bound',now(),'revoked',7),
 ('52000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000003','reactivate-unaffected@example.test','Apprenticeship Lead','beta_user',true,'53000000-0000-4000-8000-000000000004','bound',now(),'consumed',4);
create temporary table react_state(request jsonb,approval jsonb);
insert into react_state values
 ('{"action":"request_reactivation","requestId":"54000000-0000-4000-8000-000000000001","reactivationId":"55000000-0000-4000-8000-000000000001","organisationId":"51000000-0000-4000-8000-000000000002","approvalReference":"synthetic-request","clientNoticeReference":"synthetic-notice","supportHandoverReference":"synthetic-support","recoveryBoundaryReference":"synthetic-recovery"}',
  '{"action":"approve_reactivation","requestId":"54000000-0000-4000-8000-000000000002","reactivationId":"55000000-0000-4000-8000-000000000001","approvalReference":"synthetic-independent-approval"}');
select pg_temp.check_test(not has_table_privilege('service_role','public.levytate_tenant_reactivation_requests','UPDATE')
 and not has_function_privilege('authenticated','public.levytate_reactivation_command(uuid,jsonb)','EXECUTE'),'no direct approval write or browser RPC grant');
select public.levytate_offboarding_assert_inventory();
select pg_temp.denied($q$select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000004',(select request from react_state))$q$,'PT403','employer cannot request reactivation');
select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000001',request) from react_state;
select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000001',request) from react_state;
select pg_temp.check_test((select count(*)=1 from public.levytate_tenant_reactivation_requests),'request retry creates one approval record');
select pg_temp.denied($q$select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000001',(select approval from react_state))$q$,'PT403','requester cannot approve reactivation');
savepoint stale_requester;
update public.levytate_users set active=false where id='52000000-0000-4000-8000-000000000001';
select pg_temp.denied($q$select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000002',(select approval from react_state))$q$,'PT403','revoked requester invalidates pending approval');
rollback to savepoint stale_requester;
savepoint changed_suspension;
-- updated_at is a transaction timestamp in the foundation trigger. Seed an
-- older reviewed fingerprint inside this rollback transaction; actual separate
-- HTTP transaction races are checked independently in the native drill.
update public.levytate_tenant_reactivation_requests set suspension_updated_at=suspension_updated_at-interval '1 second' where id='55000000-0000-4000-8000-000000000001';
select pg_temp.denied($q$select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000002',(select approval from react_state))$q$,'PT409','stale reviewed suspension fingerprint blocks activation');
rollback to savepoint changed_suspension;
create function pg_temp.reactivation_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit outage';end; $$;
create trigger reactivation_test_audit_failure before insert on public.levytate_audit_events for each row execute function pg_temp.reactivation_fail_audit();
select pg_temp.denied($q$select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000002',(select approval from react_state))$q$,'P0001','audit failure rolls back activation');
select pg_temp.check_test((select status='Suspended' from public.levytate_organisations where id='51000000-0000-4000-8000-000000000002') and (select invitation_generation=7 from public.levytate_users where id='52000000-0000-4000-8000-000000000003'),'failed audit leaves organisation and membership unchanged');
drop trigger reactivation_test_audit_failure on public.levytate_audit_events;
select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000002',approval) from react_state;
select pg_temp.check_test((select status='Active' from public.levytate_organisations where id='51000000-0000-4000-8000-000000000002'),'independent current approval reactivates intact organisation');
select pg_temp.check_test((select not active and auth_subject is null and auth_binding_status='pending' and invitation_status='revoked' and invitation_generation=8 and role='Employee' and organisation_id='51000000-0000-4000-8000-000000000002' from public.levytate_users where id='52000000-0000-4000-8000-000000000003'),'old membership stays revoked with new generation and unchanged role/tenant');
select pg_temp.check_test(exists(select 1 from public.levytate_retired_auth_bindings where user_id='52000000-0000-4000-8000-000000000003' and auth_subject='53000000-0000-4000-8000-000000000003'),'retired identity binding survives reactivation');
select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000002',approval) from react_state;
select pg_temp.check_test((select invitation_generation=8 from public.levytate_users where id='52000000-0000-4000-8000-000000000003'),'approval retry does not change generation again');
select pg_temp.check_test((select active and invitation_generation=4 from public.levytate_users where id='52000000-0000-4000-8000-000000000004'),'other tenant access remains unchanged');
select pg_temp.denied($q$select public.levytate_reactivation_command('52000000-0000-4000-8000-000000000002',(select approval||'{"approvalReference":"changed-approval"}' from react_state))$q$,'PT409','approval receipt rejects changed payload');
rollback;
