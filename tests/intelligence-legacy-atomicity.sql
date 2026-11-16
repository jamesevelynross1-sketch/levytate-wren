-- Reproduce the old HTTP multi-write contract on an empty LOCAL26 schema.
-- Fictional rollback only; observed defects are asserted, not hidden.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
do $$
declare org uuid:=gen_random_uuid(); person text:='intelligence-legacy-'||gen_random_uuid(); learner text:=person; denied boolean:=false;
begin
 if inet_server_addr() not in('127.0.0.1'::inet,'::1'::inet) then raise exception 'Loopback required';end if;
 insert into public.levytate_organisations(id,name,slug,status) values(org,'Synthetic Intelligence defect',org::text,'Active');
 insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date) values(org,person,person,'Synthetic learner','synthetic-'||org||'@example.test','Employee','Active',current_date);
 insert into public.levytate_learner_records(organisation_id,id,employee_id,lifecycle_status,employment_route,record_status)values(org,learner,person,'enrolled','existing_employee_upskill','Active');
 insert into public.levytate_intelligence_signals(organisation_id,id,fingerprint,entity_type,entity_id,learner_record_id,category,signal_type,title,summary,evidence,confidence,priority,analyser_version)
 values(org,'signal-legacy',org::text,'learner',learner,learner,'risk','progress_deterioration','Synthetic recorded evidence','Synthetic only','[{"sourceId":"fictional"}]','High','High','progress-review-v1');
 perform set_config('role','service_role',true);
 -- The current service writes the signal in a separate HTTP request first.
 update public.levytate_intelligence_signals set status='acknowledged' where organisation_id=org and id='signal-legacy';
 begin
  insert into public.levytate_intelligence_signal_events(organisation_id,id,signal_id,event_type) values(org,'synthetic-failure','signal-legacy','invalid_injected_event');
 exception when check_violation then denied:=true;end;
 perform pg_temp.check_result(denied and (select status='acknowledged' from public.levytate_intelligence_signals where organisation_id=org and id='signal-legacy') and not exists(select 1 from public.levytate_intelligence_signal_events where organisation_id=org),'REPRODUCED: failed event leaves acknowledged state without history');
 denied:=false;
 begin insert into public.levytate_operational_actions(organisation_id,id) values(org,'action-signal-legacy');
 exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.check_result(denied,'REPRODUCED: legacy accepted-action direct insert is denied42501');
 denied:=false;
 begin insert into public.levytate_operational_action_events(organisation_id,id) values(org,'event-signal-legacy');
 exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.check_result(denied,'REPRODUCED: legacy accepted-action history direct insert is denied42501');
 -- A stale analyser upsert can overwrite a human decision under today's ACLs.
 update public.levytate_intelligence_signals set status='dismissed',dismissal_reason='No action required' where organisation_id=org and id='signal-legacy';
 update public.levytate_intelligence_signals set status='new',dismissal_reason='' where organisation_id=org and id='signal-legacy';
 perform pg_temp.check_result((select status='new' and dismissal_reason='' from public.levytate_intelligence_signals where organisation_id=org and id='signal-legacy'),'REPRODUCED: service writer can overwrite human decision without revision check');
 perform set_config('role','none',true);
end $$;
rollback;
