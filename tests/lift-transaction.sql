-- Disposable local database only. All fictional fixtures roll back.
begin;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.levytate_organisations(id,name,slug) values('91000000-0000-4000-a000-000000000001','Synthetic Lift','synthetic-lift-transaction');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values
 ('91000000-0000-4000-a000-000000000002','91000000-0000-4000-a000-000000000001','lead-lift@example.invalid','Apprenticeship Lead','Employer',true),
 ('91000000-0000-4000-a000-000000000003','91000000-0000-4000-a000-000000000001','employee-lift@example.invalid','Employee','Employer',true);
insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,department,platform_role,status,start_date) values
 ('91000000-0000-4000-a000-000000000001','lift-employee','LIFT1','Fictional Lift Employee','employee-lift@example.invalid','Synthetic engineer','Synthetic','Employee','Active','2026-01-01');
insert into public.levytate_organisation_capabilities(organisation_id,lift_enabled) values('91000000-0000-4000-a000-000000000001',true);
do $$
declare
 org uuid:='91000000-0000-4000-a000-000000000001';lead uuid:='91000000-0000-4000-a000-000000000002';emp uuid:='91000000-0000-4000-a000-000000000003';
 campaign uuid:=gen_random_uuid();participant uuid:=gen_random_uuid();assessment uuid:=gen_random_uuid();revision uuid:=gen_random_uuid();
 interpretation uuid:=gen_random_uuid();opportunity uuid:=gen_random_uuid();candidate uuid;proof uuid:=gen_random_uuid();
 command jsonb;writes jsonb;result jsonb;n integer;
begin
 command:=jsonb_build_object('action','invite_people','idempotencyKey','synthetic-invite-1','expectedWorkspaceRevision',0,'employeeIds',jsonb_build_array('lift-employee'));
 writes:=jsonb_build_array(
  jsonb_build_object('table','levytate_lift_campaigns','kind','insert','key',jsonb_build_object('id',campaign),'row',jsonb_build_object('id',campaign,'organisation_id',org,'title','Synthetic campaign','business_objective','Prove persistence only','status','open','created_by',lead,'framework_key','lift-workforce-v1','questionnaire_version','lift-workforce-questionnaire-v1.1','interpretation_version','lift-workforce-rules-v1.1')),
  jsonb_build_object('table','levytate_lift_participants','kind','insert','key',jsonb_build_object('id',participant),'row',jsonb_build_object('id',participant,'organisation_id',org,'campaign_id',campaign,'employee_id','lift-employee','employee_name_snapshot','Fictional Lift Employee')),
  jsonb_build_object('table','levytate_lift_assessments','kind','insert','key',jsonb_build_object('id',assessment),'row',jsonb_build_object('id',assessment,'organisation_id',org,'campaign_id',campaign,'participant_id',participant,'employee_id','lift-employee','framework_key','lift-workforce-v1','questionnaire_version','lift-workforce-questionnaire-v1.1','interpretation_version','lift-workforce-rules-v1.1')),
  jsonb_build_object('table','levytate_lift_assessment_revisions','kind','insert','key',jsonb_build_object('id',revision),'row',jsonb_build_object('id',revision,'organisation_id',org,'assessment_id',assessment,'revision_number',1,'created_by',lead))
 );
 result:=public.levytate_apply_lift_command(org,lead,command,false,writes);
 if result->>'revision'<>'1' then raise exception 'Invitation failed';end if;
 if public.levytate_apply_lift_command(org,lead,command,true,'[]')<>result then raise exception 'Retry result changed';end if;
 if (select count(*) from public.levytate_audit_events where organisation_id=org)<>1 then raise exception 'Duplicate audit';end if;
 begin perform public.levytate_apply_lift_command(org,lead,command||'{"title":"different"}',false,writes);raise exception 'Payload conflict allowed';exception when sqlstate 'PT409' then null;end;
 begin perform public.levytate_apply_lift_command(org,emp,command,false,writes);raise exception 'Employee invitation allowed';exception when sqlstate 'PT409' or sqlstate 'PT403' then null;end;
 command:=jsonb_build_object('action','save_assessment','idempotencyKey','synthetic-save-1','expectedWorkspaceRevision',1,'assessmentId',assessment,'expectedRevision',1);
 writes:=jsonb_build_array(jsonb_build_object('table','levytate_lift_assessment_revisions','kind','update','key',jsonb_build_object('id',revision),'row',jsonb_build_object('answers',jsonb_build_object('check_01','synthetic'))),jsonb_build_object('table','levytate_lift_assessments','kind','update','key',jsonb_build_object('id',assessment),'row',jsonb_build_object('current_question_index',1)));
 result:=public.levytate_apply_lift_command(org,emp,command,false,writes);
 if result->>'revision'<>'2' or (select answers->>'check_01' from public.levytate_lift_assessment_revisions where id=revision)<>'synthetic' then raise exception 'Save failed';end if;
 begin perform public.levytate_apply_lift_command(org,emp,command||'{"idempotencyKey":"synthetic-stale"}',false,writes);raise exception 'Stale save allowed';exception when sqlstate 'PT409' then null;end;
 command:=command||'{"expectedWorkspaceRevision":2,"idempotencyKey":"synthetic-forged"}';
 begin perform public.levytate_apply_lift_command(org,emp,command,jsonb_build_array() is null,writes||jsonb_build_array(jsonb_build_object('table','levytate_lift_assessments','kind','update','key',jsonb_build_object('id',assessment),'row',jsonb_build_object('employee_id','someone-else'))));raise exception 'Identity rewrite allowed';exception when sqlstate 'PT403' then null;end;
 if (select r.revision from public.levytate_lift_workspace_revisions r where organisation_id=org)<>2 then raise exception 'Partial transaction committed';end if;
 -- A synthetic aggregate is fixture setup, not manufactured employee assessment evidence.
 insert into public.levytate_lift_interpretations(id,organisation_id,campaign_id,participant_id,interpretation_version,evidence_reference_ids,findings_snapshot,status,created_by) values(interpretation,org,campaign,participant,'lift-workforce-rules-v1.1','[]','{}','provisional',lead);
 insert into public.levytate_lift_opportunities(id,organisation_id,campaign_id,framework_key,questionnaire_version,interpretation_version,grouping_version,workflow_group_key,grouping_key,grouping_criteria,contributor_count,title,capability_ids,work_that_could_improve,named_constraint,outcome_worth_pursuing,relationship_type,decision_question,state) values(opportunity,org,campaign,'lift-workforce-v1','lift-workforce-questionnaire-v1.1','lift-workforce-rules-v1.1','lift-opportunity-grouping-v1','other_reviewed','synthetic-only','{}',5,'Synthetic aggregate','[]','Synthetic','Synthetic','Synthetic','supported','Synthetic?','work_context_confirmed');
 for n in 1..5 loop
  candidate:=gen_random_uuid();
  insert into public.levytate_lift_opportunity_candidates(id,organisation_id,campaign_id,interpretation_id,employee_id,framework_key,questionnaire_version,interpretation_version,workflow_group_key,title,capability_ids,work_that_could_improve,named_constraint,outcome_worth_pursuing,relationship_type,decision_question) values(candidate,org,campaign,interpretation,'synthetic-contributor-'||n,'lift-workforce-v1','lift-workforce-questionnaire-v1.1','lift-workforce-rules-v1.1','other_reviewed','Synthetic candidate','[]','Synthetic','Synthetic','Synthetic','supported','Synthetic?');
  insert into public.levytate_lift_opportunity_route_members(organisation_id,opportunity_id,candidate_id,contributor_employee_id,grouping_criteria) values(org,opportunity,candidate,'synthetic-contributor-'||n,'{}');
 end loop;
 command:=jsonb_build_object('action','record_proof','idempotencyKey','synthetic-first-proof','expectedWorkspaceRevision',2,'opportunityId',opportunity,'expectedRevision',0);
 writes:=jsonb_build_array(jsonb_build_object('table','levytate_lift_proof_records','kind','insert','key',jsonb_build_object('id',proof),'row',jsonb_build_object('id',proof,'organisation_id',org,'opportunity_id',opportunity,'state','work_context_confirmed','revision',1)),jsonb_build_object('table','levytate_lift_proof_events','kind','insert','key',jsonb_build_object('id',gen_random_uuid()),'row',jsonb_build_object('id',gen_random_uuid(),'organisation_id',org,'proof_record_id',proof,'opportunity_id',opportunity,'previous_state',null,'new_state','work_context_confirmed','actor_user_id',lead,'idempotency_key','synthetic-first-proof')));
 result:=public.levytate_apply_lift_command(org,lead,command,false,writes);
 if result->>'revision'<>'3' or not exists(select 1 from public.levytate_lift_proof_events where organisation_id=org and proof_record_id=proof and previous_state is null) then raise exception 'First proof transition failed';end if;
 command:=jsonb_build_object('action','record_proof','idempotencyKey','synthetic-bypass-proof','expectedWorkspaceRevision',3,'opportunityId',opportunity,'expectedRevision',1);
 writes:=jsonb_build_array(jsonb_build_object('table','levytate_lift_proof_records','kind','update','key',jsonb_build_object('id',proof),'row',jsonb_build_object('state','outcome_evidenced','revision',2)));
 begin perform public.levytate_apply_lift_command(org,lead,command,false,writes);raise exception 'Proof skip allowed';exception when sqlstate 'PT409' then null;end;
 update public.levytate_organisation_capabilities set lift_enabled=false where organisation_id=org;
 begin perform public.levytate_apply_lift_command(org,emp,command,false,writes);raise exception 'Disabled capability allowed';exception when sqlstate 'PT404' then null;end;
 if has_function_privilege('authenticated','public.levytate_apply_lift_command(uuid,uuid,jsonb,boolean,jsonb)','execute') or has_table_privilege('service_role','public.levytate_lift_assessments','update') then raise exception 'Unsafe privileges';end if;
 raise notice 'Lift local transaction checks passed';
end $$;
rollback;
