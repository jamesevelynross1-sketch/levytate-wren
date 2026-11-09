-- Fictional local-only PG17 checks. Always rolled back; no Auth delivery.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.denied(statement text,expected text,label text) returns void language plpgsql as $$declare actual text;begin begin execute statement;exception when others then get stacked diagnostics actual=returned_sqlstate;end;perform pg_temp.check_result(actual=expected,label);end;$$;
insert into public.levytate_organisations(id,name,slug,status) values
 ('61000000-0000-4000-8000-000000000001','Fictional review tenant','personal-review-test','Active'),
 ('61000000-0000-4000-8000-000000000002','Fictional separate tenant','personal-review-other','Active');
insert into public.levytate_users(id,organisation_id,email,role,active,auth_binding_status,auth_subject,access_level) values
 ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','review-person@example.test','Employee',true,'bound','63000000-0000-4000-8000-000000000001','beta_user'),
 ('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','review-manager@example.test','Line Manager',true,'bound','63000000-0000-4000-8000-000000000002','beta_user'),
 ('62000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000001','review-other-person@example.test','Employee',true,'bound','63000000-0000-4000-8000-000000000003','beta_user'),
 ('62000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000002','review-cross@example.test','Employee',true,'bound','63000000-0000-4000-8000-000000000004','beta_user');
insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date,manager_id) values
 ('61000000-0000-4000-8000-000000000001','review-person','RP','Fictional Person','review-person@example.test','Employee','Active',current_date,'review-manager'),
 ('61000000-0000-4000-8000-000000000001','review-manager','RM','Fictional Manager','review-manager@example.test','Line Manager','Active',current_date,'');
insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values('PERSONAL-REVIEW','Fictional development standard','STPR','Approved for delivery',4,'Synthetic');
insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner) values('61000000-0000-4000-8000-000000000001','personal-review-app','review-person','PERSONAL-REVIEW','Awaiting Manager Review','Line Manager');
insert into public.levytate_application_history(organisation_id,id,application_id,status,owner) values('61000000-0000-4000-8000-000000000001','review-occurrence','personal-review-app','Awaiting Manager Review','Line Manager');
create temporary table review_command(payload jsonb,result jsonb);
insert into review_command(payload) values('{"organisation_id":"61000000-0000-4000-8000-000000000001","id":"personal-review-action","learner_record_id":null,"application_id":"personal-review-app","employee_id":"review-person","source_type":"application_workflow","source_key":"personal-review-app:manager-review:review-occurrence","action_type":"review_application","title":"Review application","description":"Fictional committed application","priority":"High","priority_rank":1,"status":"open","owner_type":"Line Manager","owner_user_id":"62000000-0000-4000-8000-000000000002","owner_display_name":"Fictional Manager","due_date":null,"source_url":"/levytate/app?module=Approvals","metadata":{"sourceCondition":"manager_review_required","occurrenceId":"review-occurrence"},"version":1}');
create function pg_temp.command(actor uuid,operation text,changes jsonb,revision integer default 0) returns jsonb language sql as $$select public.levytate_apply_operational_action('61000000-0000-4000-8000-000000000001',actor,'personal-review-action',revision,operation,changes,(select updated_at from public.levytate_applications where id='personal-review-app'));$$;
update review_command set result=pg_temp.command('62000000-0000-4000-8000-000000000001','create',payload);
select pg_temp.check_result((select result->>'status'='open' and result->>'owner_user_id'='62000000-0000-4000-8000-000000000002' from review_command),'own Employee submission derives current manager review');
select pg_temp.check_result((select pg_temp.command('62000000-0000-4000-8000-000000000001','create',payload)=result from review_command),'lost-response retry returns original result');
select pg_temp.check_result((select count(*)=1 from public.levytate_operational_actions) and (select count(*)=1 from public.levytate_operational_action_events) and (select count(*)=1 from public.levytate_audit_events),'retry preserves one task, event and audit');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000003','create',payload) from review_command$q$,'PT403','another employee cannot derive someone else review');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000004','create',payload) from review_command$q$,'PT403','cross-tenant actor denied');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','transition','{"status":"acknowledged"}',1)$q$,'PT403','employee cannot acknowledge manager task');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','owner','{"owner_type":"Employee"}',1)$q$,'PT403','employee cannot reassign task');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','due','{"due_date":"2030-01-01"}',1)$q$,'PT403','employee cannot override deadline');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','source_resolve','{"status":"completed","completion_method":"source_condition_resolved"}',1)$q$,'PT409','active manager approval cannot be bypassed');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','sync','{"owner_user_id":"62000000-0000-4000-8000-000000000003"}',1)$q$,'PT403','forged owner denied');
savepoint unbound;
update public.levytate_users set auth_subject=null,auth_binding_status='pending' where id='62000000-0000-4000-8000-000000000001';
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','create',payload) from review_command$q$,'PT403','revoked binding cannot replay receipt');
rollback to savepoint unbound;
savepoint forged_source;
delete from public.levytate_operational_action_receipts;
delete from public.levytate_operational_action_events;
delete from public.levytate_operational_actions;
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','create',payload||'{"source_key":"forged-source"}') from review_command$q$,'PT403','forged source key denied');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','create',jsonb_set(payload,'{metadata,occurrenceId}','"forged-occurrence"')) from review_command$q$,'PT403','forged history occurrence denied');
update public.levytate_users set role='Line Manager' where id='62000000-0000-4000-8000-000000000001';
update public.levytate_employees set platform_role='Line Manager' where id='review-person';
select pg_temp.check_result((select pg_temp.command('62000000-0000-4000-8000-000000000001','create',payload)->>'owner_user_id'='62000000-0000-4000-8000-000000000002' from review_command),'own Line Manager development derives review for distinct manager');
select pg_temp.denied($q$select pg_temp.command('62000000-0000-4000-8000-000000000001','transition','{"status":"acknowledged"}',1)$q$,'PT403','Line Manager cannot acknowledge own review');
rollback to savepoint forged_source;
update public.levytate_applications set status='Awaiting Final Approval',current_owner='Apprenticeship Lead' where id='personal-review-app';
select pg_temp.check_result(pg_temp.command('62000000-0000-4000-8000-000000000001','source_resolve','{"status":"completed","completion_method":"source_condition_resolved"}',1)->>'status'='completed','authoritative workflow transition permits derived resolution');
select pg_temp.check_result(not has_function_privilege('authenticated','public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)','execute') and not has_table_privilege('service_role','public.levytate_operational_actions','update'),'browser and direct service-role writes remain denied');
rollback;
