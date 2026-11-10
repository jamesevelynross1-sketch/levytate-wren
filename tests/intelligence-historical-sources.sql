-- Dedicated local rollback tests: inactive sources retain exact historical evidence.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
do $$
declare org uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); employee text:='history-person-'||gen_random_uuid(); learner text:='history-learner-'||gen_random_uuid(); review text:='history-review-'||gen_random_uuid(); template jsonb; command jsonb; prepared jsonb; result jsonb; rows jsonb; denied boolean;
begin
 insert into public.levytate_organisations(id,name,slug,status)values(org,'Synthetic retained evidence',org::text,'Active');
 insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_binding_status)values(actor,org,actor||'@example.test','Apprenticeship Lead',true,'beta_user','pending');
 insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date)values(org,employee,employee,'Synthetic employee',employee||'@example.test','Employee','Active',current_date);
 insert into public.levytate_learner_records(organisation_id,id,employee_id,lifecycle_status,employment_route,record_status)values(org,learner,employee,'enrolled','existing_employee_upskill','Active');
 insert into public.levytate_learner_reviews(organisation_id,id,learner_record_id,review_type,review_date,summary)values(org,review,learner,'provider_review',current_date,'Synthetic review');
 insert into public.levytate_intelligence_signals(organisation_id,id,fingerprint,entity_type,entity_id,learner_record_id,category,signal_type,title,summary,evidence,confidence,priority,recommended_action,suggested_owner_type,analyser_version)
 values(org,'historic-one','historic-one','learner',learner,learner,'risk','manager_support_required','Retained title','Retained summary',jsonb_build_array(jsonb_build_object('sourceType','provider_review','sourceId',review,'sourceDate',current_date,'label','Recorded review')),'High','High','Review evidence','Apprenticeship Lead','progress-review-v1')returning to_jsonb(levytate_intelligence_signals.*)into template;
 delete from public.levytate_intelligence_signals where organisation_id=org;
 command:=jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,true);
 result:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,jsonb_build_array(template));
 update public.levytate_learner_records set record_status='Archived' where organisation_id=org and id=learner;
 command:=jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,true);
 rows:=jsonb_build_array(prepared->'signals'->0||'{"status":"resolved"}');
 result:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,rows);
 perform pg_temp.check_result(result->'receipt'->'signals'->0->>'status'='resolved' and result->'receipt'->'signals'->0->'evidence'=template->'evidence','archived learner resolves prior signal while retaining exact evidence');
 perform pg_temp.check_result(prepared->'eligibleLearnerIds'='[]' and result->'receipt'->>'learnerCount'='0','archived learner absent from captured eligible set and analysed count');
 command:=jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,true);
 result:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,prepared->'signals');
 perform pg_temp.check_result(result->'receipt'->'signals'->0->>'status'='resolved','subsequent empty refresh retains already resolved history');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',jsonb_build_object('action','accept','signalId','historic-one','expectedRevision',3,'idempotencyKey',gen_random_uuid()));exception when sqlstate 'PT409' then denied:=true;end;
 perform pg_temp.check_result(denied,'resolved archived evidence never permits a new action');
 command:=jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid());
 prepared:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,true);
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,jsonb_build_array((prepared->'signals'->0)||'{"evidence":[]}'));exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'resolution cannot rewrite historical source evidence');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,jsonb_build_array((prepared->'signals'->0)||'{"fingerprint":"rewritten"}'));exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'resolution cannot replace the historical fingerprint');
 denied:=false;begin perform public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,jsonb_build_array((prepared->'signals'->0)||'{"status":"new"}'));exception when sqlstate 'PT403' then denied:=true;end;
 perform pg_temp.check_result(denied,'archived learner cannot be reopened as newly actionable evidence');
 update public.levytate_learner_records set record_status='Active' where organisation_id=org and id=learner;
 update public.levytate_employees set status='Inactive' where organisation_id=org and id=employee;
 command:=jsonb_build_object('action','analyse','idempotencyKey',gen_random_uuid());prepared:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,true);
 perform pg_temp.check_result(prepared->'eligibleLearnerIds'='[]','inactive employee excludes otherwise active learner');
 result:=public.levytate_apply_intelligence_command(org,actor,'progress-review-v1',command,false,prepared->>'sourceHash',(prepared->>'revision')::integer,prepared->'signals');
 perform pg_temp.check_result(result->'receipt'->'signals'->0->'evidence'=template->'evidence','inactive employee retains prior exact historical evidence');
end $$;
rollback;
