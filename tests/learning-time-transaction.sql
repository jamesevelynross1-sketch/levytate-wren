-- Fictional local fixture, always rolled back; not hosted acceptance.
begin;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.levytate_organisations(id,name,slug) values('92000000-0000-4000-a000-000000000001','Synthetic Learning Time','synthetic-learning-time');
insert into public.levytate_organisations(id,name,slug) select '92000000-0000-4000-a000-000000000004','Synthetic catalogue','levytate-internal' where not exists(select 1 from public.levytate_organisations where slug='levytate-internal');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values
 ('92000000-0000-4000-a000-000000000002','92000000-0000-4000-a000-000000000001','lead-otj@example.invalid','Apprenticeship Lead','Employer',true),
 ('92000000-0000-4000-a000-000000000003','92000000-0000-4000-a000-000000000001','employee-otj@example.invalid','Employee','Employer',true);
insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,department,platform_role,status,start_date) values('92000000-0000-4000-a000-000000000001','otj-employee','OTJ1','Fictional Learner','employee-otj@example.invalid','Synthetic engineer','Synthetic','Employee','Active','2025-01-01');
insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values('SYNTHETIC','Fictional learning standard','STOTJTEST','Approved for delivery',4,'Synthetic test');
insert into public.levytate_providers(organisation_id,provider_id,provider_name,provider_type,status,verification_status,last_verified,source_urls) select id,'synthetic-provider','Fictional Learning Time provider','Independent training provider','Active','verified',current_date,'["https://example.invalid/otj-provider"]'::jsonb from public.levytate_organisations where slug='levytate-internal';
insert into public.levytate_provider_programmes(organisation_id,id,provider_id,programme_name,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,status,record_status,verification_status,source_url) select id,'synthetic-otj-programme','synthetic-provider','Fictional learning programme','SYNTHETIC','SYNTHETIC','["SYNTHETIC"]'::jsonb,'Active','Active','LevyTate reviewed','https://example.invalid/otj-programme' from public.levytate_organisations where slug='levytate-internal';
insert into public.levytate_learner_records(organisation_id,id,employee_id,programme_id,provider_id,lifecycle_status,record_status) values('92000000-0000-4000-a000-000000000001','otj-learner','otj-employee','synthetic-otj-programme','synthetic-provider','enrolled','Active');
insert into public.levytate_organisation_capabilities(organisation_id,off_the_job_assistant_enabled) values('92000000-0000-4000-a000-000000000001',true);
do $$
declare org uuid:='92000000-0000-4000-a000-000000000001';lead uuid:='92000000-0000-4000-a000-000000000002';emp uuid:='92000000-0000-4000-a000-000000000003';input jsonb;data jsonb;version jsonb;activity jsonb;replayed jsonb;
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
 activity:=public.levytate_apply_learning_time_command(org,emp,'submit_activity',jsonb_build_object('idempotencyKey','synthetic-submit','activityId',activity->>'id','lockVersion',0),'{}');
 if activity->>'status'<>'submitted' then raise exception 'Submission failed';end if;
 activity:=public.levytate_apply_learning_time_command(org,lead,'transition_activity',jsonb_build_object('idempotencyKey','synthetic-check','activityId',activity->>'id','lockVersion',1,'action','employer_check','note','Synthetic checked evidence'),'{}');
 if activity->>'status'<>'employer_checked' then raise exception 'Employer check failed';end if;
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
 if has_table_privilege('service_role','public.levytate_otj_activities','insert') or has_function_privilege('service_role','public.levytate_submit_otj_activity(uuid,uuid,uuid,text,integer)','execute') or has_function_privilege('authenticated','public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean)','execute') then raise exception 'Unsafe privilege';end if;
 raise notice 'Learning Time local transaction checks passed';
end $$;
rollback;
