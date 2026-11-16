-- Fictional local fixture, always rolled back; not hosted acceptance.
begin;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.levytate_organisations(id,name,slug) values('92000000-0000-4000-a000-000000000001','Synthetic Learning Time','synthetic-learning-time');
insert into public.levytate_organisations(id,name,slug) select '92000000-0000-4000-a000-000000000004','Synthetic catalogue','levytate-internal' where not exists(select 1 from public.levytate_organisations where slug='levytate-internal');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values
 ('92000000-0000-4000-a000-000000000002','92000000-0000-4000-a000-000000000001','lead-otj@example.invalid','Apprenticeship Lead','Employer',true),
 ('92000000-0000-4000-a000-000000000003','92000000-0000-4000-a000-000000000001','employee-otj@example.invalid','Line Manager','Employer',true);
insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,department,platform_role,status,start_date) values('92000000-0000-4000-a000-000000000001','otj-employee','OTJ1','Fictional Learner','employee-otj@example.invalid','Synthetic engineer','Synthetic','Employee','Active','2025-01-01');
insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values('SYNTHETIC','Fictional learning standard','STOTJTEST','Approved for delivery',4,'Synthetic test');
insert into public.levytate_providers(organisation_id,provider_id,provider_name,provider_type,status,verification_status,last_verified,source_urls) select id,'synthetic-provider','Fictional Learning Time provider','Independent training provider','Active','verified',current_date,'["https://example.invalid/otj-provider"]'::jsonb from public.levytate_organisations where slug='levytate-internal';
insert into public.levytate_provider_programmes(organisation_id,id,provider_id,programme_name,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,status,record_status,verification_status,source_url) select id,'synthetic-otj-programme','synthetic-provider','Fictional learning programme','SYNTHETIC','SYNTHETIC','["SYNTHETIC"]'::jsonb,'Active','Active','LevyTate reviewed','https://example.invalid/otj-programme' from public.levytate_organisations where slug='levytate-internal';
insert into public.levytate_learner_records(organisation_id,id,employee_id,programme_id,provider_id,lifecycle_status,record_status) values('92000000-0000-4000-a000-000000000001','otj-learner','otj-employee','synthetic-otj-programme','synthetic-provider','enrolled','Active');
insert into public.levytate_organisation_capabilities(organisation_id,off_the_job_assistant_enabled) values('92000000-0000-4000-a000-000000000001',true);
create function pg_temp.reject_manager_learning_audit() returns trigger language plpgsql as $$begin if new.metadata->>'requestId'='manager-audit-failure' then raise exception 'Synthetic audit rejection';end if;return new;end $$;
create trigger synthetic_manager_learning_audit before insert on public.levytate_audit_events for each row execute function pg_temp.reject_manager_learning_audit();
do $$
declare review_count bigint;org uuid:='92000000-0000-4000-a000-000000000001';lead uuid:='92000000-0000-4000-a000-000000000002';emp uuid:='92000000-0000-4000-a000-000000000003';input jsonb;data jsonb;version jsonb;activity jsonb;replayed jsonb;
begin
 input:='{"idempotencyKey":"synthetic-plan","learnerRecordId":"otj-learner"}';
 data:='{"policy_regime":"legacy_percentage","original_apprenticeship_start_date":"2025-01-01","practical_period_start_date":"2025-01-01","practical_period_end_date":"2028-01-01","standard_id":"SYNTHETIC","standard_version":"1","legacy_indicative_minimum_minutes":12000,"prior_learning_reduction_minutes":0,"individual_minimum_minutes":12000,"planned_delivery_minutes":12000,"provider_id":"synthetic-provider","training_plan_reference":"Synthetic fixture, no regulatory reliance","source_type":"provider_training_plan","source_date":"2026-10-01","inactivity_attention_days":28,"notes":"Fictional-only"}';
 version:=public.levytate_apply_learning_time_command(org,lead,'create_plan_draft',input,data);
 if public.levytate_apply_learning_time_command(org,lead,'create_plan_draft',input,data)<>version then raise exception 'Plan retry mismatch';end if;
 perform public.levytate_apply_learning_time_command(org,lead,'publish_plan',jsonb_build_object('idempotencyKey','synthetic-publish','versionId',version->>'id'),'{}');
 input:='{"idempotencyKey":"synthetic-activity","learnerRecordId":"otj-learner"}';
 data:=jsonb_build_object('plan_version_id',version->>'id','activity_date',current_date-1,'started_at','09:00','ended_at','10:00','break_minutes',0,'duration_minutes',60,'timezone','Europe/London','category','provider_workshop','title','Synthetic workshop','description','Fictional local workflow validation','what_was_new','Synthetic evidence','standard_relevance','Synthetic standard','reflection','Local test only','working_hours_basis','within_normal_working_hours','compensation_note','','separate_from_productive_work',true,'ksb_references','[]'::jsonb,'evidence_reference','synthetic-fixture','deterministic_outcome','likely_eligible','deterministic_reasons','[]'::jsonb);
 activity:=public.levytate_apply_learning_time_command(org,emp,'save_activity',input,data);
 replayed:=public.levytate_apply_learning_time_command(org,emp,'save_activity',input,data);
 if replayed<>activity or (select count(*) from public.levytate_otj_activities where organisation_id=org)<>1 or (select count(*) from public.levytate_otj_activity_events where organisation_id=org)<>1 then raise exception 'Activity retry duplicated evidence';end if;
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input||'{"idempotencyKey":"synthetic-overlap"}',data||'{"started_at":"09:30","ended_at":"10:30"}');raise exception 'Overlap allowed';exception when sqlstate 'PT409' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input||jsonb_build_object('idempotencyKey','synthetic-stale','activityId',activity->>'id','lockVersion',99),data);raise exception 'Stale edit allowed';exception when sqlstate 'PT409' then null;end;


 declare before_counts jsonb;
 begin
  before_counts:=jsonb_build_array((select count(*) from public.levytate_otj_activities where organisation_id=org),(select count(*) from public.levytate_otj_activity_events where organisation_id=org),(select count(*) from public.levytate_otj_command_receipts where organisation_id=org),(select count(*) from public.levytate_audit_events where organisation_id=org));
  begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input||'{"idempotencyKey":"manager-audit-failure"}',data||'{"started_at":"14:00","ended_at":"15:00"}');raise exception 'Audit failure was ignored';exception when sqlstate 'PT409' then null;end;
  if before_counts<>jsonb_build_array((select count(*) from public.levytate_otj_activities where organisation_id=org),(select count(*) from public.levytate_otj_activity_events where organisation_id=org),(select count(*) from public.levytate_otj_command_receipts where organisation_id=org),(select count(*) from public.levytate_audit_events where organisation_id=org)) then raise exception 'Failed audit left partial evidence';end if;
 end;
 raise notice 'PASS: failed audit rolls back activity, event, command receipt and audit together';
 -- Same-tenant direct reports and other tenants never become personal evidence.
 insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,department,platform_role,status,start_date,manager_id) values(org,'otj-report','OTJ3','Fictional report','report-otj@example.invalid','Synthetic engineer','Synthetic','Employee','Active','2025-01-01','otj-employee');
 insert into public.levytate_learner_records(organisation_id,id,employee_id,programme_id,provider_id,lifecycle_status,record_status) values(org,'otj-report-learner','otj-report','synthetic-otj-programme','synthetic-provider','enrolled','Active');
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input||'{"idempotencyKey":"manager-report-write","learnerRecordId":"otj-report-learner"}',data);raise exception 'Manager wrote report evidence';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_learning_time_command('92000000-0000-4000-a000-000000000004',emp,'save_activity',input||'{"idempotencyKey":"manager-other-tenant"}',data);raise exception 'Cross-tenant actor allowed';exception when sqlstate 'PT403' then null;end;
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input||'{"idempotencyKey":"browser-write"}',data);raise exception 'Browser called privileged command';exception when sqlstate 'PT403' then null;end;
 perform set_config('request.jwt.claim.role','service_role',true);
 raise notice 'PASS: report, cross-tenant and browser evidence writes denied';
 activity:=public.levytate_apply_learning_time_command(org,emp,'submit_activity',jsonb_build_object('idempotencyKey','synthetic-submit','activityId',activity->>'id','lockVersion',0),'{}');
 if activity->>'status'<>'submitted' then raise exception 'Submission failed';end if;
 -- Manager owns this evidence, but cannot perform any employer review or setup.
 begin perform public.levytate_apply_learning_time_command(org,emp,'transition_activity',jsonb_build_object('idempotencyKey','manager-self-check','activityId',activity->>'id','lockVersion',1,'action','employer_check','note','Synthetic'),'{}');raise exception 'Manager self-review allowed';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,emp,'transition_activity',jsonb_build_object('idempotencyKey','manager-self-info','activityId',activity->>'id','lockVersion',1,'action','request_information','note','Synthetic'),'{}');raise exception 'Manager self-information request allowed';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,emp,'transition_activity',jsonb_build_object('idempotencyKey','manager-self-not-counted','activityId',activity->>'id','lockVersion',1,'action','mark_not_counted','note','Synthetic'),'{}');raise exception 'Manager self-review not-counted allowed';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,emp,'record_confirmation',jsonb_build_object('idempotencyKey','manager-self-confirm','activityId',activity->>'id'),'{}');raise exception 'Manager self-confirmation allowed';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,emp,'create_plan_draft',jsonb_build_object('idempotencyKey','manager-self-plan','learnerRecordId','otj-learner'),'{}');raise exception 'Manager self-plan allowed';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,emp,'publish_plan',jsonb_build_object('idempotencyKey','manager-self-publish','versionId',version->>'id'),'{}');raise exception 'Manager self-publish allowed';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,emp,'add_priority',jsonb_build_object('idempotencyKey','manager-self-priority','learnerRecordId','otj-learner'),'{}');raise exception 'Manager self-priority allowed';exception when sqlstate 'PT403' then null;end;
 if (select status from public.levytate_otj_activities where id=(activity->>'id')::uuid)<>'submitted' or (select lock_version from public.levytate_otj_activities where id=(activity->>'id')::uuid)<>1 then raise exception 'Denied manager review changed evidence';end if;
 raise notice 'PASS: manager self-check, self-information, self-confirmation, plan, publish and priority denied without mutation';
 -- A second own activity exercises submit/withdraw and exact receipts.
 declare other jsonb; original jsonb; command jsonb;
 begin
  other:=public.levytate_apply_learning_time_command(org,emp,'save_activity',input||'{"idempotencyKey":"manager-withdraw-draft"}',data||'{"started_at":"12:00","ended_at":"13:00"}');
  other:=public.levytate_apply_learning_time_command(org,emp,'submit_activity',jsonb_build_object('idempotencyKey','manager-withdraw-submit','activityId',other->>'id','lockVersion',0),'{}');
  command:=jsonb_build_object('idempotencyKey','manager-withdraw','activityId',other->>'id','lockVersion',1,'action','withdraw','note','Fictional withdrawal');
  original:=public.levytate_apply_learning_time_command(org,emp,'transition_activity',command,'{}');
  if original->>'status'<>'withdrawn' or public.levytate_apply_learning_time_command(org,emp,'transition_activity',command,'{}')<>original then raise exception 'Manager withdrawal or exact retry failed';end if;
  begin perform public.levytate_apply_learning_time_command(org,emp,'transition_activity',command||'{"note":"changed"}','{}');raise exception 'Changed receipt accepted';exception when sqlstate 'PT409' then null;end;
  begin perform public.levytate_apply_learning_time_command(org,emp,'transition_activity',command||'{"idempotencyKey":"stale-withdrawal"}','{}');raise exception 'Stale withdrawal accepted';exception when sqlstate 'PT409' then null;end;
 end;
 raise notice 'PASS: manager own withdrawal, exact retry and conflicting/stale denials';

 activity:=public.levytate_apply_learning_time_command(org,lead,'transition_activity',jsonb_build_object('idempotencyKey','synthetic-check','activityId',activity->>'id','lockVersion',1,'action','employer_check','note','Synthetic checked evidence'),'{}');
 if activity->>'status'<>'employer_checked' then raise exception 'Employer check failed';end if;
 insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values('92000000-0000-4000-a000-000000000005',org,'second-reviewer@example.invalid','Employer Admin','Employer',true);
 select count(*) into review_count from public.levytate_audit_events where organisation_id=org;
 begin
  perform public.levytate_apply_learning_time_command(org,'92000000-0000-4000-a000-000000000005','transition_activity',jsonb_build_object('idempotencyKey','synthetic-check','activityId',activity->>'id','lockVersion',1,'action','employer_check','note','Synthetic checked evidence'),'{}');
  raise exception 'Cross-actor legacy event key falsely acknowledged a review';
 exception when sqlstate 'PT409' then null;end;
 if (select count(*) from public.levytate_audit_events where organisation_id=org)<>review_count or exists(select 1 from public.levytate_otj_command_receipts where organisation_id=org and actor_user_id='92000000-0000-4000-a000-000000000005') then raise exception 'False review left audit or receipt';end if;
 raise notice 'PASS: another reviewer cannot reuse an existing event key to claim a review';

 perform public.levytate_apply_learning_time_command(org,lead,'record_confirmation',jsonb_build_object('idempotencyKey','synthetic-confirm','activityId',activity->>'id','outcome','confirmed','confirmedMinutes',60,'sourceType','provider_report','providerId','synthetic-provider','sourceReference','Synthetic isolated report','sourceDate',current_date,'note','Fictional test only'),'{}');
 if (select count(*) from public.levytate_otj_activity_confirmations where organisation_id=org)<>1 then raise exception 'Confirmation failed';end if;
 -- Evidence eligibility follows its date, not the learner's current screen status.
 update public.levytate_learner_records set lifecycle_status='break_in_learning' where organisation_id=org and id='otj-learner';
 insert into public.levytate_learner_breaks_in_learning(organisation_id,id,learner_record_id,start_date,status) values(org,'synthetic-break','otj-learner',current_date-3,'active');
 perform public.levytate_assert_learning_time_period(org,'otj-learner',(version->>'id')::uuid,current_date-4);
 begin perform public.levytate_assert_learning_time_period(org,'otj-learner',(version->>'id')::uuid,current_date-3);raise exception 'Break start allowed';exception when sqlstate 'PT422' then null;end;
 begin perform public.levytate_apply_learning_time_command(org,lead,'record_confirmation',jsonb_build_object('idempotencyKey','synthetic-invalid-confirm','activityId',activity->>'id','outcome','confirmed','confirmedMinutes',60,'sourceType','provider_report','providerId','synthetic-provider','sourceReference','Synthetic isolated report','sourceDate',current_date),'{}');raise exception 'Confirmation during break allowed';exception when sqlstate 'PT422' then null;end;
 update public.levytate_learner_breaks_in_learning set status='returned',actual_return_date=current_date-1 where organisation_id=org and id='synthetic-break';
 perform public.levytate_assert_learning_time_period(org,'otj-learner',(version->>'id')::uuid,current_date-1);
 update public.levytate_learner_records set lifecycle_status='withdrawn',actual_end_date=current_date-1 where organisation_id=org and id='otj-learner';
 perform public.levytate_assert_learning_time_period(org,'otj-learner',(version->>'id')::uuid,current_date-1);
 begin perform public.levytate_assert_learning_time_period(org,'otj-learner',(version->>'id')::uuid,current_date);raise exception 'Post-withdrawal learning allowed';exception when sqlstate 'PT422' then null;end;
 update public.levytate_learner_records set actual_end_date=null where organisation_id=org and id='otj-learner';
 begin perform public.levytate_assert_learning_time_period(org,'otj-learner',(version->>'id')::uuid,current_date-4);raise exception 'Unknown terminal date allowed';exception when sqlstate 'PT422' then null;end;
 if public.levytate_apply_learning_time_command(org,emp,'save_activity',input,'{}',true)<>replayed then raise exception 'Lost-response probe changed after lifecycle transition';end if;
 -- The current schema prevents normalized duplicates before they can affect
 -- identity resolution; retain that constraint rather than constructing an
 -- impossible fixture by disabling it. The service unit suite covers malformed
 -- ambiguous transport as an additional fail-closed boundary.
 begin
  insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,department,platform_role,status,start_date) values(org,'otj-duplicate','OTJ2','Fictional duplicate',' EMPLOYEE-OTJ@example.invalid ','Synthetic engineer','Synthetic','Employee','Active','2025-01-01');
  raise exception 'Normalized duplicate manager identity allowed';
 exception when unique_violation then null;end;
 update public.levytate_employees set status='Archived' where organisation_id=org and id='otj-employee';
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input,'{}',true);raise exception 'Archived manager receipt exposed';exception when sqlstate 'PT403' then null;end;
 update public.levytate_employees set status='Active' where organisation_id=org and id='otj-employee';
 update public.levytate_users set active=false where id=emp;
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input,'{}',true);raise exception 'Revoked manager receipt exposed';exception when sqlstate 'PT403' then null;end;
 update public.levytate_users set active=true,role='Apprenticeship Lead' where id=emp;
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input,'{}',true);raise exception 'Changed role receipt exposed';exception when sqlstate 'PT403' then null;end;
 update public.levytate_users set role='Line Manager' where id=emp;
 raise notice 'PASS: duplicate identity and archived, revoked and changed-role receipts are denied';

 update public.levytate_users set email='different-employee@example.invalid' where id=emp;
 begin perform public.levytate_apply_learning_time_command(org,emp,'save_activity',input,'{}',true);raise exception 'Reassigned receipt leaked';exception when sqlstate 'PT403' then null;end;
 if has_table_privilege('service_role','public.levytate_otj_activities','insert') or has_function_privilege('service_role','public.levytate_submit_otj_activity(uuid,uuid,uuid,text,integer)','execute') or has_function_privilege('authenticated','public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean)','execute') then raise exception 'Unsafe privilege';end if;
 raise notice 'PASS: manager learning-time transaction suite and unchanged period/security guards';
end $$;
rollback;
