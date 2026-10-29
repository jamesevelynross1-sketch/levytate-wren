-- Fictional, local-only rollback tests; no email calls or capability activation outside this transaction.
begin;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.levytate_organisations(id,name,slug) values('93000000-0000-4000-a000-000000000001','Synthetic Requests','synthetic-requests');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values
 ('93000000-0000-4000-a000-000000000002','93000000-0000-4000-a000-000000000001','lead-requests@example.invalid','Apprenticeship Lead','Employer',true),
 ('93000000-0000-4000-a000-000000000003','93000000-0000-4000-a000-000000000001','employee-requests@example.invalid','Employee','Employer',true);
insert into public.levytate_organisation_capabilities(organisation_id,requests_enabled) values('93000000-0000-4000-a000-000000000001',true);
do $$
declare org uuid:='93000000-0000-4000-a000-000000000001';lead uuid:='93000000-0000-4000-a000-000000000002';emp uuid:='93000000-0000-4000-a000-000000000003';rid uuid:='93000000-0000-4000-a000-000000000004';member uuid:='93000000-0000-4000-a000-000000000005';invite uuid:='93000000-0000-4000-a000-000000000006';command jsonb;data jsonb;expected jsonb;result jsonb;
begin
 command:=jsonb_build_object('action','create_draft','idempotencyKey','synthetic-request-create','content',jsonb_build_object('title','Synthetic request','requirement','Fictional local test','responseDeadline',current_date+14));
 data:=jsonb_build_object('organisation_id',org,'id',rid,'title','Synthetic request','requirement','Fictional local test','request_mode','need_led','readiness','exploring','learner_volume','{"kind":"not_confirmed"}'::jsonb,'workplace_location','{"kind":"not_confirmed"}'::jsonb,'delivery_preferences','[]'::jsonb,'preferred_start','{"kind":"not_confirmed"}'::jsonb,'departments','[]'::jsonb,'target_roles','[]'::jsonb,'internal_private_context','{}'::jsonb,'status','draft','response_deadline',current_date+14,'current_version',0,'created_by',lead,'created_at',now(),'updated_at',now());
 if public.levytate_apply_request_command(org,'employer',lead,command,'{}','{}',true) is not null then raise exception 'Probe wrote a receipt';end if;
 begin perform public.levytate_apply_request_command(org,'employer',emp,command,jsonb_build_object('requests_insert',jsonb_build_array(data)));raise exception 'Employee wrote a Request';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_request_command(org,'employer',lead,command,jsonb_build_object('requests_insert',jsonb_build_array(data||'{"organisation_id":"93000000-0000-4000-a000-000000000099"}')));raise exception 'Cross-tenant Request accepted';exception when sqlstate 'PT403' then null;end;
 result:=public.levytate_apply_request_command(org,'employer',lead,command,jsonb_build_object('requests_insert',jsonb_build_array(data)));
 if result<>public.levytate_apply_request_command(org,'employer',lead,command,'{}','{}',true) or (select count(*) from public.levytate_audit_events where organisation_id=org)<>1 then raise exception 'Receipt replay mismatch';end if;
 begin perform public.levytate_apply_request_command(org,'employer',lead,command||'{"action":"publish"}','{}','{}',true);raise exception 'Changed command replay accepted';exception when sqlstate 'PT409' then null;end;
 select to_jsonb(r) into data from public.levytate_service_requests r where organisation_id=org and id=rid;
 command:=jsonb_build_object('action','update_draft','idempotencyKey','synthetic-request-update','requestId',rid,'content',jsonb_build_object('title','Updated synthetic request','requirement','Fictional local test','responseDeadline',current_date+14));
 expected:=jsonb_build_object('requests',jsonb_build_array(jsonb_build_object('id',rid,'updated_at',data->'updated_at')));
 begin perform public.levytate_apply_request_command(org,'employer',lead,command,jsonb_build_object('requests_update',jsonb_build_array(data)),'{}');raise exception 'Missing revision accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.levytate_apply_request_command(org,'employer',lead,command,jsonb_build_object('requests_update',jsonb_build_array(data||'{"title":"Updated synthetic request","status":"closed"}')),expected);raise exception 'Draft bypass accepted';exception when sqlstate 'PT409' then null;end;
 perform public.levytate_apply_request_command(org,'employer',lead,command,jsonb_build_object('requests_update',jsonb_build_array(data||'{"title":"Updated synthetic request"}')),expected);
 if (select title from public.levytate_service_requests where organisation_id=org and id=rid)<>'Updated synthetic request' then raise exception 'Draft update failed';end if;
 begin perform public.levytate_apply_request_command(org,'employer',lead,command||'{"idempotencyKey":"synthetic-request-forgery"}',jsonb_build_object('responses_insert',jsonb_build_array(jsonb_build_object('organisation_id',org,'request_id',rid))),jsonb_build_object('requests',(select jsonb_build_array(jsonb_build_object('id',rid,'updated_at',updated_at)) from public.levytate_service_requests where organisation_id=org and id=rid)));raise exception 'Employer authored provider response';exception when sqlstate 'PT403' then null;end;
 select to_jsonb(r) into data from public.levytate_service_requests r where organisation_id=org and id=rid;
 expected:=jsonb_build_object('requests',jsonb_build_array(jsonb_build_object('id',rid,'updated_at',data->'updated_at')));
 perform public.levytate_apply_request_command(org,'employer',lead,jsonb_build_object('action','publish','requestId',rid,'idempotencyKey','synthetic-publish'),jsonb_build_object('requests_update',jsonb_build_array(data||jsonb_build_object('status','open','current_version',1,'published_by',lead,'published_at',now())),'versions_insert',jsonb_build_array(jsonb_build_object('organisation_id',org,'request_id',rid,'version',1,'published_snapshot','{}'::jsonb,'published_by',lead,'published_at',now(),'change_summary','Fictional local publication'))),expected);
 insert into public.levytate_provider_memberships(id,provider_id,email,role,active,auth_subject,auth_binding_status,auth_bound_at) values(member,'synthetic-request-provider','provider-requests@example.invalid','Provider User',true,'93000000-0000-4000-a000-000000000099','bound',now());
 insert into public.levytate_service_request_invitations(organisation_id,id,request_id,provider_id,request_version,status,notification_status,sent_at,response_deadline) values(org,invite,rid,'synthetic-request-provider',1,'sent','accepted',now(),current_date+14);
 command:=jsonb_build_object('action','save_draft','idempotencyKey','synthetic-provider-draft','invitationId',invite,'content',jsonb_build_object('proposedProgramme',jsonb_build_object('kind','not_confirmed')));
 begin perform public.levytate_apply_request_command(org,'provider',member,command-'invitationId','{}','{}',true);raise exception 'Provider probe without invitation accepted';exception when sqlstate 'PT422' then null;end;
 begin perform public.levytate_apply_request_command(org,'provider',member,command||'{"invitationId":"93000000-0000-4000-a000-000000000088"}','{}','{}',true);raise exception 'Foreign invitation accepted';exception when sqlstate 'PT403' then null;end;
 select jsonb_build_object('requests',jsonb_build_array(jsonb_build_object('id',rid,'updated_at',updated_at))) into expected from public.levytate_service_requests where organisation_id=org and id=rid;
 data:=jsonb_build_object('organisation_id',org,'id','93000000-0000-4000-a000-000000000007','request_id',rid,'invitation_id',invite,'provider_id','synthetic-request-provider','provider_membership_id',member,'request_version',1,'status','draft','draft_content',command->'content','current_version',0,'created_at',now(),'updated_at',now());
 begin perform public.levytate_apply_request_command(org,'provider',member,command,jsonb_build_object('responses_insert',jsonb_build_array(data||'{"status":"submitted"}')),expected);raise exception 'Draft forged submission accepted';exception when sqlstate 'PT409' then null;end;
 perform public.levytate_apply_request_command(org,'provider',member,command,jsonb_build_object('responses_insert',jsonb_build_array(data)),expected);
 if (select count(*) from public.levytate_service_request_responses where organisation_id=org and status='draft')<>1 then raise exception 'Provider draft failed';end if;
 if public.levytate_apply_request_command(org,'provider',member,command,'{}','{}',true)->>'committed'<>'true' then raise exception 'Provider receipt failed';end if;
 update public.levytate_provider_memberships set active=false where id=member;
 begin perform public.levytate_apply_request_command(org,'provider',member,command,'{}','{}',true);raise exception 'Revoked provider receipt accepted';exception when sqlstate 'PT403' then null;end;
 update public.levytate_users set active=false where id=lead;
 begin perform public.levytate_apply_request_command(org,'employer',lead,jsonb_build_object('action','publish','requestId',rid,'idempotencyKey','synthetic-publish'),'{}','{}',true);raise exception 'Revoked actor replayed receipt';exception when sqlstate 'PT403' then null;end;
 if has_table_privilege('service_role','public.levytate_service_requests','update') or has_function_privilege('service_role','public.levytate_persist_service_request_action(uuid,jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.levytate_apply_request_command(uuid,text,uuid,jsonb,jsonb,jsonb,boolean)','execute') then raise exception 'Unsafe Requests privilege';end if;
 raise notice 'Requests local actor, CAS, receipt, rollback and privilege checks passed';
end $$;
rollback;
