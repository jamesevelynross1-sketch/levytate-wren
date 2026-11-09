-- LOCAL REVIEW CANDIDATE. This operates on 037 only; it neither creates 038
-- objects nor enables My Support. All content reaches PostgreSQL encrypted.
alter table public.levytate_pastoral_preferences add column lock_version integer not null default 0 check(lock_version>=0);
alter table public.levytate_pastoral_conversations add column last_sequence_number integer not null default 0 check(last_sequence_number>=0);
-- Do not silently repair a historic partial exchange or ambiguous sequence.
do $$ begin
 if exists(select 1 from public.levytate_pastoral_messages group by organisation_id,conversation_id
   having count(*)<>max(sequence_number) or mod(count(*),2)<>0) then
  raise exception 'Private history contains an incomplete exchange; review before applying';
 end if;
end $$;
update public.levytate_pastoral_conversations c set last_sequence_number=(
 select coalesce(max(m.sequence_number),0) from public.levytate_pastoral_messages m where m.organisation_id=c.organisation_id and m.conversation_id=c.id
);
create table public.levytate_pastoral_history_receipts(
 organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
 owner_user_id uuid not null references public.levytate_users(id) on delete restrict,
 employee_id text not null,
 request_key text not null check(char_length(request_key) between 8 and 160),
 action text not null check(action in ('exchange','preference','delete')),
 request_hmac text not null check(request_hmac ~ '^[a-f0-9]{64}$'),
 conversation_id uuid,
 result jsonb not null check(jsonb_typeof(result)='object'),
 created_at timestamptz not null default now(),
 primary key(organisation_id,owner_user_id,request_key),
 foreign key(organisation_id,employee_id) references public.levytate_employees(organisation_id,id) on delete restrict
);
comment on table public.levytate_pastoral_history_receipts is 'Restricted non-content retry receipts. Conversation ID intentionally survives employee deletion to prevent replay resurrection; never include in general employer exports.';
alter table public.levytate_pastoral_history_receipts enable row level security;
alter table public.levytate_pastoral_history_receipts force row level security;
revoke all on public.levytate_pastoral_history_receipts from public,anon,authenticated,service_role;

create function public.levytate_pastoral_history_command(p_organisation_id uuid,p_owner_user_id uuid,p_employee_id text,p_command jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_actor public.levytate_users%rowtype;v_employee public.levytate_employees%rowtype;
 v_preference public.levytate_pastoral_preferences%rowtype;v_conversation public.levytate_pastoral_conversations%rowtype;
 v_receipt public.levytate_pastoral_history_receipts%rowtype;v_message public.levytate_pastoral_messages%rowtype;
 v_action text:=p_command->>'action';v_key text;v_hmac text:=p_command->>'request_hmac';v_expected integer;
 v_conversation_id uuid;v_requested_id uuid;v_fields text[];v_result jsonb;v_envelope jsonb;
 v_now timestamptz:=clock_timestamp();v_client_id text;v_index integer;v_version text;
begin
 if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Service role required';end if;
 if p_organisation_id is null or p_owner_user_id is null or p_employee_id is null or jsonb_typeof(p_command) is distinct from 'object'
   or octet_length(p_command::text)>110000 or v_hmac is null or v_hmac!~'^[a-f0-9]{64}$' then
  raise exception using errcode='PT422',message='Invalid private history command';end if;
 if v_action in ('probe_exchange','exchange') then
  v_client_id:=p_command->>'client_message_id';
  if v_client_id is null or v_client_id!~'^[a-zA-Z0-9:_-]{8,118}$' then raise exception using errcode='PT422',message='Invalid exchange identifier';end if;
  v_key:='exchange:'||v_client_id;
  v_fields:=array['action','request_hmac','client_message_id','conversation_id'];
  if v_action='exchange' then v_fields:=v_fields||array['new_conversation_id','expected_sequence','policy_version','messages'];end if;
 elsif v_action='preference' then
  v_expected:=(p_command->>'expected_version')::integer;
  if v_expected is null or v_expected<0 or jsonb_typeof(p_command->'save_history') is distinct from 'boolean'
    or (p_command->>'retention_days')::integer not between 1 and 90 or p_command->>'retention_days' is null then
   raise exception using errcode='PT422',message='Invalid history preference';end if;
  v_key:='preference:'||v_expected;
  v_fields:=array['action','request_hmac','expected_version','save_history','retention_days'];
 elsif v_action='delete' then
  v_requested_id:=(p_command->>'conversation_id')::uuid;
  if v_requested_id is null then raise exception using errcode='PT422',message='Conversation identifier required';end if;
  v_key:='delete:'||v_requested_id;
  v_fields:=array['action','request_hmac','conversation_id'];
 else raise exception using errcode='PT422',message='Unsupported private history command';end if;
 if exists(select 1 from jsonb_object_keys(p_command) k where k<>all(v_fields)) then raise exception using errcode='PT422',message='Unexpected private history field';end if;

 -- Short transaction: no model/network call. People mutation lock matches the
 -- application identity writer; row locks make revocation effective in order.
 perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-pastoral-owner:'||p_owner_user_id::text,0));
 select u.* into v_actor from public.levytate_users u join public.levytate_organisations o on o.id=u.organisation_id
  where u.id=p_owner_user_id and u.organisation_id=p_organisation_id and u.active and u.role='Employee' and o.status='Active' for share of u,o;
 if not found then raise exception using errcode='PT403',message='Current private history owner required';end if;
 select * into v_employee from public.levytate_employees where organisation_id=p_organisation_id and id=p_employee_id
  and status='Active' and platform_role='Employee' and lower(btrim(email))=lower(btrim(v_actor.email)) for share;
 if not found then raise exception using errcode='PT403',message='Current private history owner required';end if;
 perform 1 from public.levytate_organisation_capabilities where organisation_id=p_organisation_id and pastoral_support_enabled for share;
 if not found then raise exception using errcode='PT403',message='Private history is unavailable';end if;
 perform 1 from public.levytate_pastoral_access_eligibility where organisation_id=p_organisation_id and employee_id=p_employee_id
  and owner_user_id=p_owner_user_id and active and age_assurance_status='adult' and approved_by is not null and approved_at is not null
  and (expires_at is null or expires_at>v_now) for share;
 if not found then raise exception using errcode='PT403',message='Private history is unavailable';end if;
 select * into v_preference from public.levytate_pastoral_preferences where organisation_id=p_organisation_id and owner_user_id=p_owner_user_id for update;
 if found and v_preference.employee_id<>p_employee_id then raise exception using errcode='PT403',message='Private history is unavailable';end if;
 select * into v_receipt from public.levytate_pastoral_history_receipts where organisation_id=p_organisation_id and owner_user_id=p_owner_user_id and request_key=v_key;
 if found then
  if v_receipt.employee_id<>p_employee_id or v_receipt.request_hmac<>v_hmac then raise exception using errcode='PT409',message='Conflicting private history retry';end if;
  if v_action in ('exchange','probe_exchange') then
   if v_preference.save_history is distinct from true then raise exception using errcode='PT409',message='History saving changed';end if;
   select * into v_conversation from public.levytate_pastoral_conversations where organisation_id=p_organisation_id and id=v_receipt.conversation_id
    and employee_id=p_employee_id and owner_user_id=p_owner_user_id and retention_expires_at>v_now for share;
   if not found then raise exception using errcode='PT404',message='Saved conversation unavailable';end if;
   select * into v_message from public.levytate_pastoral_messages where organisation_id=p_organisation_id and conversation_id=v_conversation.id
    and employee_id=p_employee_id and owner_user_id=p_owner_user_id and client_message_id=v_client_id||':assistant';
   if not found then raise exception using errcode='PT409',message='Saved exchange incomplete';end if;
   return v_receipt.result||jsonb_build_object('replayed',true,'message',to_jsonb(v_message));
  end if;
  return v_receipt.result||jsonb_build_object('replayed',true);
 end if;
 if v_action='probe_exchange' then return null;end if;

 if v_action='preference' then
  if coalesce(v_preference.lock_version,0)<>v_expected then raise exception using errcode='PT409',message='History preference changed';end if;
  insert into public.levytate_pastoral_preferences(organisation_id,employee_id,owner_user_id,save_history,history_retention_days,lock_version)
   values(p_organisation_id,p_employee_id,p_owner_user_id,(p_command->>'save_history')::boolean,(p_command->>'retention_days')::integer,v_expected+1)
   on conflict(organisation_id,owner_user_id) do update set save_history=excluded.save_history,history_retention_days=excluded.history_retention_days,lock_version=excluded.lock_version
   returning * into v_preference;
  insert into public.levytate_pastoral_audit_events(organisation_id,employee_id,actor_user_id,entity_type,entity_id,action,outcome,correlation_id)
   values(p_organisation_id,p_employee_id,p_owner_user_id,'preference',v_preference.id,case when v_preference.save_history then 'history_saving.enabled' else 'history_saving.disabled' end,'completed',v_key);
  v_result:=jsonb_build_object('preferenceVersion',v_preference.lock_version);
 elsif v_action='delete' then
  select * into v_conversation from public.levytate_pastoral_conversations where organisation_id=p_organisation_id and id=v_requested_id
   and employee_id=p_employee_id and owner_user_id=p_owner_user_id for update;
  if not found then raise exception using errcode='PT404',message='Saved conversation unavailable';end if;
  delete from public.levytate_pastoral_conversations where organisation_id=p_organisation_id and id=v_requested_id;
  insert into public.levytate_pastoral_audit_events(organisation_id,employee_id,actor_user_id,entity_type,entity_id,action,outcome,correlation_id)
   values(p_organisation_id,p_employee_id,p_owner_user_id,'conversation',v_requested_id,'conversation.deleted','completed',v_key);
  v_conversation_id:=v_requested_id;v_result:=jsonb_build_object('deleted',true,'conversationId',v_requested_id);
 else
  if v_preference.save_history is distinct from true then raise exception using errcode='PT409',message='History saving changed';end if;
  v_requested_id:=(p_command->>'conversation_id')::uuid;v_expected:=(p_command->>'expected_sequence')::integer;v_version:=p_command->>'policy_version';
  if v_expected is null or v_expected<0 or mod(v_expected,2)<>0 or v_version is distinct from 'pastoral-support-v1'
    or jsonb_typeof(p_command->'messages') is distinct from 'array' or jsonb_array_length(p_command->'messages')<>2 then
   raise exception using errcode='PT422',message='Invalid encrypted exchange';end if;
  if v_requested_id is null then
   v_conversation_id:=(p_command->>'new_conversation_id')::uuid;
   if v_conversation_id is null or v_expected<>0 then raise exception using errcode='PT422',message='Invalid new conversation';end if;
   insert into public.levytate_pastoral_conversations(id,organisation_id,employee_id,owner_user_id,policy_version,history_saving_enabled,retention_expires_at)
    values(v_conversation_id,p_organisation_id,p_employee_id,p_owner_user_id,v_version,true,v_now+make_interval(days=>v_preference.history_retention_days)) returning * into v_conversation;
   insert into public.levytate_pastoral_audit_events(organisation_id,employee_id,actor_user_id,entity_type,entity_id,action,outcome,correlation_id)
    values(p_organisation_id,p_employee_id,p_owner_user_id,'conversation',v_conversation_id,'conversation.created','completed',v_key);
  else
   v_conversation_id:=v_requested_id;
   select * into v_conversation from public.levytate_pastoral_conversations where organisation_id=p_organisation_id and id=v_conversation_id
    and employee_id=p_employee_id and owner_user_id=p_owner_user_id and retention_expires_at>v_now and status='active' for update;
   if not found then raise exception using errcode='PT404',message='Saved conversation unavailable';end if;
  end if;
  if v_conversation.last_sequence_number<>v_expected then raise exception using errcode='PT409',message='Saved conversation changed';end if;
  for v_index in 0..1 loop
   v_envelope:=p_command->'messages'->v_index;
   if jsonb_typeof(v_envelope) is distinct from 'object' or exists(select 1 from jsonb_object_keys(v_envelope) k where k<>all(array['ciphertext','nonce','authenticationTag','keyVersion'])) then
    raise exception using errcode='PT422',message='Invalid ciphertext envelope';end if;
   insert into public.levytate_pastoral_messages(organisation_id,conversation_id,employee_id,owner_user_id,sequence_number,author_type,ciphertext,nonce,authentication_tag,encryption_key_version,policy_version,client_message_id)
    values(p_organisation_id,v_conversation_id,p_employee_id,p_owner_user_id,v_expected+v_index+1,case when v_index=0 then 'employee' else 'assistant' end,
      v_envelope->>'ciphertext',v_envelope->>'nonce',v_envelope->>'authenticationTag',v_envelope->>'keyVersion',v_version,case when v_index=0 then v_client_id else v_client_id||':assistant' end) returning * into v_message;
  end loop;
  update public.levytate_pastoral_conversations set last_sequence_number=v_expected+2,last_message_at=v_now where organisation_id=p_organisation_id and id=v_conversation_id;
  insert into public.levytate_pastoral_audit_events(organisation_id,employee_id,actor_user_id,entity_type,entity_id,action,outcome,correlation_id)
   values(p_organisation_id,p_employee_id,p_owner_user_id,'conversation',v_conversation_id,'conversation.exchange_saved','completed',v_key);
  v_result:=jsonb_build_object('conversationId',v_conversation_id,'sequence',v_expected+2);
 end if;
 insert into public.levytate_pastoral_history_receipts(organisation_id,owner_user_id,employee_id,request_key,action,request_hmac,conversation_id,result)
  values(p_organisation_id,p_owner_user_id,p_employee_id,v_key,v_action,v_hmac,v_conversation_id,v_result);
 return v_result||jsonb_build_object('replayed',false)||case when v_action='exchange' then jsonb_build_object('message',to_jsonb(v_message)) else '{}'::jsonb end;
end; $$;
revoke all on function public.levytate_pastoral_history_command(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_pastoral_history_command(uuid,uuid,text,jsonb) to service_role;
-- All private-history mutation paths now pass the actor-bound transaction.
revoke insert,update,delete on public.levytate_pastoral_preferences,public.levytate_pastoral_conversations,public.levytate_pastoral_messages from service_role;
