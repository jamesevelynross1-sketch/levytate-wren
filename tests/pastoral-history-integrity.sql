-- Disposable local schema-only PostgreSQL test. Fictional rows roll back.
-- Ciphertext fixtures test database atomicity, not encryption or live activation.
\set ON_ERROR_STOP on
begin;
set local request.jwt.claims='{"role":"service_role"}';
set local request.jwt.claim.role='service_role';
do $$begin
 if inet_server_addr() is not null and inet_server_addr() not in ('127.0.0.1'::inet,'::1'::inet) then raise exception 'Local only';end if;
 if to_regclass('public.levytate_pastoral_support_actions') is not null then raise exception 'Use the 037-only test baseline, never 038';end if;
end $$;
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.reject(sql text,state text,label text) returns void language plpgsql as $$declare denied boolean:=false;begin begin execute sql;exception when others then if SQLSTATE<>state then raise exception 'FAIL: % expected % got %: %',label,state,SQLSTATE,SQLERRM;end if;denied:=true;end;perform pg_temp.check_result(denied,label);end;$$;
insert into public.levytate_organisations(id,name,slug,status) values
 ('ac000000-0000-4000-8000-000000000001','Synthetic private A','private-a','Active'),
 ('ac000000-0000-4000-8000-000000000002','Synthetic private B','private-b','Active');
insert into public.levytate_employees(id,organisation_id,name,email,platform_role,status,employee_number,start_date) values
 ('private-a','ac000000-0000-4000-8000-000000000001','Synthetic adult A','private-a@example.test','Employee','Active','PRIVATE-A','2026-01-01'),
 ('private-b','ac000000-0000-4000-8000-000000000002','Synthetic adult B','private-b@example.test','Employee','Active','PRIVATE-B','2026-01-01');
insert into public.levytate_users(id,organisation_id,email,role,active,access_level) values
 ('ac100000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','private-a@example.test','Employee',true,'beta_user'),
 ('ac100000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000002','private-b@example.test','Employee',true,'beta_user'),
 ('ac100000-0000-4000-8000-000000000003','ac000000-0000-4000-8000-000000000001','approver@example.test','Apprenticeship Lead',true,'beta_user');
insert into public.levytate_organisation_capabilities(organisation_id,pastoral_support_enabled) values
 ('ac000000-0000-4000-8000-000000000001',true),('ac000000-0000-4000-8000-000000000002',true);
insert into public.levytate_pastoral_access_eligibility(organisation_id,employee_id,owner_user_id,age_assurance_status,active,approved_by,approved_at,expires_at) values
 ('ac000000-0000-4000-8000-000000000001','private-a','ac100000-0000-4000-8000-000000000001','adult',true,'ac100000-0000-4000-8000-000000000003',now(),now()+interval '1 day');
create function pg_temp.command(body jsonb) returns jsonb language sql as $$select public.levytate_pastoral_history_command('ac000000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','private-a',body);$$;
create function pg_temp.preference(version integer,saving boolean) returns jsonb language sql as $$select jsonb_build_object('action','preference','request_hmac',repeat(case when saving then 'a' else 'b' end,64),'expected_version',version,'save_history',saving,'retention_days',30);$$;
create function pg_temp.exchange(key text,conversation uuid default null,seq integer default 0,new_id uuid default 'ac200000-0000-4000-8000-000000000001') returns jsonb language sql as $$select jsonb_build_object(
 'action','exchange','request_hmac',repeat('c',64),'client_message_id',key,'conversation_id',conversation,'new_conversation_id',new_id,'expected_sequence',seq,'expected_preference_version',1,'policy_version','pastoral-support-v1','messages',
 jsonb_build_array(jsonb_build_object('ciphertext',repeat('a',32),'nonce',repeat('b',16),'authenticationTag',repeat('c',22),'keyVersion','synthetic-v1'),jsonb_build_object('ciphertext',repeat('d',32),'nonce',repeat('e',16),'authenticationTag',repeat('f',22),'keyVersion','synthetic-v1')));$$;
create function pg_temp.probe(key text) returns jsonb language sql as $$select jsonb_build_object('action','probe_exchange','request_hmac',repeat('c',64),'client_message_id',key,'conversation_id',null);$$;
create function pg_temp.deletion(conversation uuid) returns jsonb language sql as $$select jsonb_build_object('action','delete','request_hmac',repeat('d',64),'conversation_id',conversation);$$;
create function pg_temp.fail_history_audit() returns trigger language plpgsql as $$begin
 if current_setting('levytate.test.fail_history_audit',true)='on' then raise exception using errcode='55000',message='Synthetic history audit outage';end if;return new;end;$$;
create trigger synthetic_history_audit_failure before insert on public.levytate_pastoral_audit_events for each row execute function pg_temp.fail_history_audit();
select set_config('levytate.test.fail_history_audit','on',true);
select pg_temp.reject($q$select pg_temp.command(pg_temp.preference(0,true))$q$,'55000','preference audit failure aborts consent change');
select pg_temp.check_result(not exists(select 1 from public.levytate_pastoral_preferences) and not exists(select 1 from public.levytate_pastoral_history_receipts),'failed preference has no receipt or persisted consent');
select set_config('levytate.test.fail_history_audit','off',true);
select pg_temp.check_result(pg_temp.command(pg_temp.preference(0,true))->>'preferenceVersion'='1','first explicit consent records version one');
select pg_temp.check_result((pg_temp.command(pg_temp.preference(0,true))->>'replayed')::boolean,'lost consent response replays exact receipt');
select pg_temp.check_result((select count(*)=1 from public.levytate_pastoral_audit_events where entity_type='preference'),'exact consent retry does not duplicate audit');
select pg_temp.reject($q$select pg_temp.command(pg_temp.preference(0,false))$q$,'PT409','changed stale consent cannot reuse prior receipt');
select set_config('levytate.test.fail_history_audit','on',true);
select pg_temp.reject($q$select pg_temp.command(pg_temp.exchange('failed-message'))$q$,'55000','conversation creation audit failure aborts all writes');
select pg_temp.check_result(not exists(select 1 from public.levytate_pastoral_conversations) and not exists(select 1 from public.levytate_pastoral_messages) and not exists(select 1 from public.levytate_pastoral_history_receipts where action='exchange'),'failed new exchange leaves no orphan conversation, ciphertext or receipt');
select set_config('levytate.test.fail_history_audit','off',true);
select pg_temp.check_result(pg_temp.command(pg_temp.exchange('first-message'))->>'sequence'='2','encrypted pair commits with one sequence advance');
select pg_temp.check_result((select count(*)=2 from public.levytate_pastoral_messages) and (select count(*)=2 from public.levytate_pastoral_audit_events where entity_type='conversation'),'new conversation and pair have exactly two minimal audit events');
select pg_temp.check_result((pg_temp.command(pg_temp.exchange('first-message',null,0,'ac200000-0000-4000-8000-000000000002'))->>'replayed')::boolean,'new-conversation lost response reuses original ID and exchange');
select pg_temp.check_result((select count(*)=1 from public.levytate_pastoral_conversations) and (select count(*)=2 from public.levytate_pastoral_messages),'retry never creates a second conversation or message pair');
select pg_temp.reject($q$select pg_temp.command(pg_temp.probe('first-message')||jsonb_build_object('request_hmac',repeat('e',64)))$q$,'PT409','changed original message binding rejects retry');
select pg_temp.reject($q$select pg_temp.command(pg_temp.exchange('stale-message','ac200000-0000-4000-8000-000000000001',0))$q$,'PT409','stale assistant context cannot append out of sequence');
select set_config('levytate.test.fail_history_audit','on',true);
select pg_temp.reject($q$select pg_temp.command(pg_temp.exchange('append-failed','ac200000-0000-4000-8000-000000000001',2))$q$,'55000','append audit failure aborts both messages and counter');
select pg_temp.check_result((select count(*)=2 from public.levytate_pastoral_messages) and (select last_sequence_number=2 from public.levytate_pastoral_conversations),'failed append preserves exact prior exchange');
select set_config('levytate.test.fail_history_audit','off',true);
select pg_temp.command(pg_temp.preference(1,false));
select pg_temp.reject($q$select pg_temp.command(pg_temp.exchange('disabled-message','ac200000-0000-4000-8000-000000000001',2))$q$,'PT409','history-off consent blocks in-flight persistence');
select pg_temp.reject($q$select pg_temp.command(pg_temp.probe('first-message'))$q$,'PT409','history-off prevents retry decryption');
select pg_temp.command(pg_temp.preference(2,true));
select pg_temp.reject($q$select pg_temp.command(pg_temp.exchange('stale-consent','ac200000-0000-4000-8000-000000000001',2))$q$,'PT409','consent off then on still invalidates the earlier in-flight turn');
update public.levytate_organisation_capabilities set pastoral_support_enabled=false where organisation_id='ac000000-0000-4000-8000-000000000001';
select pg_temp.reject($q$select pg_temp.command(pg_temp.probe('first-message'))$q$,'PT403','disabled tenant cannot replay retained ciphertext');
update public.levytate_organisation_capabilities set pastoral_support_enabled=true where organisation_id='ac000000-0000-4000-8000-000000000001';
update public.levytate_pastoral_access_eligibility set expires_at=now()-interval '1 second' where employee_id='private-a';
select pg_temp.reject($q$select pg_temp.command(pg_temp.probe('first-message'))$q$,'PT403','expired adult eligibility prevents replay');
update public.levytate_pastoral_access_eligibility set expires_at=now()+interval '1 day' where employee_id='private-a';
update public.levytate_users set active=false where id='ac100000-0000-4000-8000-000000000001';
select pg_temp.reject($q$select pg_temp.command(pg_temp.probe('first-message'))$q$,'PT403','revoked membership cannot replay receipt');
update public.levytate_users set active=true where id='ac100000-0000-4000-8000-000000000001';
select pg_temp.reject($q$select public.levytate_pastoral_history_command('ac000000-0000-4000-8000-000000000002','ac100000-0000-4000-8000-000000000001','private-a',pg_temp.probe('first-message'))$q$,'PT403','cross-tenant owner cannot probe receipt');
select pg_temp.reject($q$select public.levytate_pastoral_history_command('ac000000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000003','private-a',pg_temp.probe('first-message'))$q$,'PT403','Lead has no private-history override');
select set_config('levytate.test.fail_history_audit','on',true);
select pg_temp.reject($q$select pg_temp.command(pg_temp.deletion('ac200000-0000-4000-8000-000000000001'))$q$,'55000','delete audit failure rolls back ciphertext erasure');
select pg_temp.check_result((select count(*)=1 from public.levytate_pastoral_conversations) and (select count(*)=2 from public.levytate_pastoral_messages),'failed delete leaves conversation and complete pair recoverable');
select set_config('levytate.test.fail_history_audit','off',true);
select pg_temp.check_result((pg_temp.command(pg_temp.deletion('ac200000-0000-4000-8000-000000000001'))->>'deleted')::boolean,'owner deletion removes saved conversation');
select pg_temp.check_result((pg_temp.command(pg_temp.deletion('ac200000-0000-4000-8000-000000000001'))->>'replayed')::boolean,'lost deletion response returns exact tombstone');
select pg_temp.check_result(not exists(select 1 from public.levytate_pastoral_messages) and (select count(*)=1 from public.levytate_pastoral_audit_events where action='conversation.deleted'),'delete cascades ciphertext with one minimal audit event');
select pg_temp.reject($q$select pg_temp.command(pg_temp.exchange('first-message',null,0,'ac200000-0000-4000-8000-000000000003'))$q$,'PT404','old exchange retry cannot resurrect deleted history');
select pg_temp.command(pg_temp.exchange('expires-message',null,0,'ac200000-0000-4000-8000-000000000004')||'{"expected_preference_version":3}');
update public.levytate_pastoral_conversations set created_at=now()-interval '2 days',retention_expires_at=now()-interval '1 day' where id='ac200000-0000-4000-8000-000000000004';
select pg_temp.reject($q$select pg_temp.command(pg_temp.probe('expires-message'))$q$,'PT404','expired conversation never returns saved reply');
select pg_temp.check_result((pg_temp.command(pg_temp.deletion('ac200000-0000-4000-8000-000000000004'))->>'deleted')::boolean,'owner can erase expired ciphertext');
select pg_temp.reject($q$select pg_temp.command(pg_temp.exchange('unknown-field')||'{"plaintext":"must not store"}')$q$,'PT422','closed command rejects extra plaintext fields');
select pg_temp.check_result(not has_table_privilege('service_role','public.levytate_pastoral_messages','INSERT') and not has_table_privilege('service_role','public.levytate_pastoral_conversations','DELETE') and not has_table_privilege('service_role','public.levytate_pastoral_preferences','UPDATE'),'service role cannot bypass atomic private-history writes');
select pg_temp.check_result(not has_function_privilege('anon','public.levytate_pastoral_history_command(uuid,uuid,text,jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.levytate_pastoral_history_command(uuid,uuid,text,jsonb)','EXECUTE'),'browser roles cannot execute private-history command');
select pg_temp.check_result(not has_table_privilege('service_role','public.levytate_pastoral_history_receipts','SELECT') and not has_table_privilege('authenticated','public.levytate_pastoral_history_receipts','SELECT'),'receipt metadata requires current actor-bound RPC');
set constraints all immediate;
rollback;
