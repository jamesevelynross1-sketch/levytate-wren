-- Local-only candidate. This does not enable Requests or send notifications.
create table public.levytate_request_command_receipts (
 organisation_id uuid not null references public.levytate_organisations(id),actor_kind text not null check(actor_kind in ('employer','provider')),actor_id uuid not null,request_key text not null,command jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(organisation_id,actor_kind,actor_id,request_key)
);
alter table public.levytate_request_command_receipts enable row level security;
revoke all on public.levytate_request_command_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_request_command_receipts to service_role;

create function public.levytate_apply_request_command(p_organisation_id uuid,p_actor_kind text,p_actor_id uuid,p_command jsonb,p_changes jsonb default '{}',p_expected jsonb default '{}',p_probe boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare
 actor public.levytate_users;member public.levytate_provider_memberships;receipt public.levytate_request_command_receipts;request public.levytate_service_requests;invitation public.levytate_service_request_invitations;
 command_action text:=p_command->>'action';command_key text:=p_command->>'idempotencyKey';request_id uuid;allowed text[];required text[];entry record;item jsonb;current_row jsonb;expected_rows jsonb;table_name text;field_name text;result jsonb;actor_email text;actor_role text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then raise exception using errcode='PT403',message='Server credential required';end if;
 if p_organisation_id is null or p_actor_id is null or p_actor_kind is null or p_actor_kind not in ('employer','provider') or p_probe is null or jsonb_typeof(p_command) is distinct from 'object' or jsonb_typeof(p_changes) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object' or command_key is null or command_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,198}[A-Za-z0-9]$' or command_action is null then raise exception using errcode='PT422',message='Invalid Requests command';end if;
 perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-request-action:'||p_organisation_id::text,0));
 perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;if not found then raise exception using errcode='PT403',message='Workspace inactive';end if;
 perform 1 from public.levytate_organisation_capabilities where organisation_id=p_organisation_id and requests_enabled for share;if not found then raise exception using errcode='PT404',message='Requests disabled';end if;
 if p_actor_kind='employer' then
  select * into actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_id and active for share;
  if actor.id is null or actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Employer Requests authority required';end if;
  actor_email:=actor.email;actor_role:=actor.role;
  if command_action not in ('create_draft','update_draft','send_request','send_existing_draft','publish','publish_revision','invite_providers','retry_invitation','ask_clarification','answer_clarification','shortlist','decline_provider','progress_to_agreement','confirm_agreement','confirm_and_handover','not_proceeded','handover','cancel','close_request','extend_deadline','record_invitation_delivery') then raise exception using errcode='PT403',message='Unsupported employer command';end if;
 else
  select * into member from public.levytate_provider_memberships where id=p_actor_id and active and auth_binding_status='bound' and auth_subject is not null for share;
  if member.id is null then raise exception using errcode='PT403',message='Bound active provider membership required';end if;
  actor_email:=member.email;actor_role:=member.role;
  if command_action not in ('mark_viewed','save_draft','submit_response','decline','ask_clarification','answer_clarification','record_response_notification') then raise exception using errcode='PT403',message='Unsupported provider command';end if;
  if nullif(p_command->>'invitationId','') is null then raise exception using errcode='PT422',message='Provider invitation identity required';end if;
  select * into invitation from public.levytate_service_request_invitations where organisation_id=p_organisation_id and id=(p_command->>'invitationId')::uuid and provider_id=member.provider_id for update;
  if invitation.id is null then raise exception using errcode='PT403',message='Current provider invitation scope required';end if;
 end if;
 select * into receipt from public.levytate_request_command_receipts r where r.organisation_id=p_organisation_id and r.actor_kind=p_actor_kind and r.actor_id=p_actor_id and r.request_key=command_key;
 if found then if receipt.command<>p_command then raise exception using errcode='PT409',message='Retry key conflicts';end if;if p_actor_kind='provider' and receipt.result->>'requestId' is distinct from invitation.request_id::text then raise exception using errcode='PT403',message='Receipt is outside current provider scope';end if;return receipt.result;end if;
 if p_probe then return null;end if;
 if jsonb_array_length(coalesce(p_changes->'requests_insert','[]'))>1 then raise exception using errcode='PT422',message='One Request per command';end if;
 request_id:=coalesce(nullif(p_command->>'requestId','')::uuid,(p_changes->'requests_insert'->0->>'id')::uuid);
 if p_command ? 'invitationId' then
  select * into invitation from public.levytate_service_request_invitations where organisation_id=p_organisation_id and id=(p_command->>'invitationId')::uuid for update;
  if invitation.id is null or (request_id is not null and request_id<>invitation.request_id) or (p_actor_kind='provider' and invitation.provider_id<>member.provider_id) then raise exception using errcode='PT403',message='Invitation outside actor scope';end if;
  request_id:=invitation.request_id;
 end if;
 if request_id is null then raise exception using errcode='PT422',message='Request identity required';end if;
 select * into request from public.levytate_service_requests where organisation_id=p_organisation_id and id=request_id for update;
 if request.id is null and command_action not in ('create_draft','send_request') then raise exception using errcode='PT404',message='Request unavailable';end if;
 if request.id is not null and command_action in ('create_draft','send_request') then raise exception using errcode='PT409',message='Request already exists';end if;
 if request.id is not null and not exists(select 1 from jsonb_array_elements(coalesce(p_expected->'requests','[]')) x where (x->>'id')::uuid=request.id and (x->>'updated_at')::timestamptz=request.updated_at) then raise exception using errcode='PT409',message='Current Request revision required';end if;
 if p_actor_kind='provider' and command_action not in ('mark_viewed','record_response_notification') and (request.status not in ('open','responses_received','decision_in_progress') or request.response_deadline<current_date or invitation.status in ('cancelled','declined','deadline_passed','pending_delivery','delivery_failed')) then raise exception using errcode='PT409',message='Provider response window closed';end if;
 if p_actor_kind='employer' and request.id is not null then
  if command_action in ('update_draft','publish') and request.status<>'draft' then raise exception using errcode='PT409',message='Draft Request required';end if;
  if command_action in ('publish_revision','invite_providers','retry_invitation','ask_clarification','answer_clarification','shortlist','decline_provider','progress_to_agreement') and request.status not in ('open','responses_received','decision_in_progress') then raise exception using errcode='PT409',message='Open decision workflow required';end if;
  if command_action='send_existing_draft' and request.status not in ('draft','open','responses_received','decision_in_progress') then raise exception using errcode='PT409',message='Request cannot be sent';end if;
  if command_action in ('confirm_agreement','confirm_and_handover','not_proceeded') and request.status<>'progressed_to_agreement' then raise exception using errcode='PT409',message='Progressed agreement required';end if;
  if command_action='handover' and request.status<>'closed' then raise exception using errcode='PT409',message='Confirmed agreement required';end if;
  if command_action='close_request' and (request.status not in ('open','responses_received','decision_in_progress','expired') or request.response_deadline>=current_date) then raise exception using errcode='PT409',message='Request cannot yet close';end if;
  if command_action='cancel' and request.status in ('closed','cancelled','expired','progressed_to_agreement') then raise exception using errcode='PT409',message='Request cannot be cancelled';end if;
  if command_action='extend_deadline' and (request.status not in ('open','responses_received','decision_in_progress','expired') or (p_command->>'deadline')::date<=request.response_deadline or (p_command->>'deadline')::date<=current_date) then raise exception using errcode='PT409',message='Valid forward deadline extension required';end if;
 end if;
 allowed:=case command_action
  when 'create_draft' then array['requests_insert'] when 'update_draft' then array['requests_update']
  when 'send_request' then array['requests_insert','versions_insert','invitations_insert']
  when 'send_existing_draft' then array['requests_update','versions_insert','invitations_insert']
  when 'publish' then array['requests_update','versions_insert']
  when 'publish_revision' then array['requests_update','versions_insert','invitations_update']
  when 'invite_providers' then array['requests_update','invitations_insert'] when 'retry_invitation' then array[]::text[]
  when 'record_invitation_delivery' then array['invitations_update']
  when 'mark_viewed' then array['invitations_update'] when 'save_draft' then array['responses_insert','responses_update','invitations_update']
  when 'submit_response' then array['responses_insert','responses_update','response_versions_insert','invitations_update','requests_update']
  when 'decline' then array['invitations_update','responses_update']
  when 'ask_clarification' then array['clarifications_insert'] when 'answer_clarification' then array['clarifications_update']
  when 'shortlist' then array['requests_update','decisions_insert','decisions_update'] when 'decline_provider' then array['requests_update','decisions_insert','decisions_update']
  when 'progress_to_agreement' then array['requests_update','decisions_insert','decisions_update']
  when 'confirm_agreement' then array['requests_update','decisions_update','agreements_insert']
  when 'confirm_and_handover' then array['requests_update','decisions_update','agreements_insert','handovers_insert','organisation_providers_upsert','organisation_programmes_upsert']
  when 'not_proceeded' then array['requests_update','decisions_update']
  when 'handover' then array['handovers_insert','organisation_providers_upsert','organisation_programmes_upsert']
  when 'cancel' then array['requests_update','invitations_update'] when 'close_request' then array['requests_update']
  when 'extend_deadline' then array['requests_update','versions_insert','invitations_update']
  when 'record_response_notification' then array[]::text[] else array[]::text[] end || array['events_insert'];
 for entry in select key,value from jsonb_each(p_changes) loop
  if jsonb_typeof(entry.value) is distinct from 'array' or jsonb_array_length(entry.value)>200 then raise exception using errcode='PT422',message='Invalid Requests write batch';end if;
  if jsonb_array_length(entry.value)>0 and not entry.key=any(allowed) then raise exception using errcode='PT403',message='Write kind outside command authority';end if;
  for item in select value from jsonb_array_elements(entry.value) loop
   current_row:=null;
   if jsonb_typeof(item) is distinct from 'object' or item->>'organisation_id' is distinct from p_organisation_id::text or (item ? 'request_id' and item->>'request_id' is distinct from request_id::text) or (entry.key like 'requests_%' and item->>'id' is distinct from request_id::text) then raise exception using errcode='PT403',message='Request child scope denied';end if;
   if p_actor_kind='provider' and item ? 'provider_id' and item->>'provider_id' is distinct from member.provider_id then raise exception using errcode='PT403',message='Cross-provider write denied';end if;
   if entry.key in ('requests_update','invitations_update','responses_update','decisions_update','clarifications_update') then
    table_name:=case entry.key when 'requests_update' then 'levytate_service_requests' else 'levytate_service_request_'||split_part(entry.key,'_',1) end;
    execute format('select to_jsonb(t) from public.%I t where organisation_id=$1 and id=$2',table_name) into current_row using p_organisation_id,(item->>'id')::uuid;
    expected_rows:=coalesce(p_expected->split_part(entry.key,'_',1),'[]');
    if current_row is null or not exists(select 1 from jsonb_array_elements(expected_rows) x where x->>'id'=item->>'id') then raise exception using errcode='PT409',message='Existing child and revision required';end if;
    if entry.key<>'requests_update' and current_row->>'request_id' is distinct from request_id::text then raise exception using errcode='PT403',message='Child belongs to another Request';end if;
    if p_actor_kind='provider' and current_row ? 'provider_id' and current_row->>'provider_id' is distinct from member.provider_id then raise exception using errcode='PT403',message='Existing child belongs to another provider';end if;
    if entry.key='requests_update' and p_actor_kind='provider' and ((item-array['status','updated_at']) is distinct from (current_row-array['status','updated_at']) or item->>'status' is distinct from (case when request.status='open' then 'responses_received' else request.status end) or command_action<>'submit_response') then raise exception using errcode='PT403',message='Provider cannot change employer brief';end if;
    if entry.key='clarifications_update' and (current_row->>'asked_by_type' is distinct from (case when p_actor_kind='provider' then 'employer_user' else 'provider_member' end) or item->>'answer' is distinct from p_command->>'answer' or item->>'answered_by_type' is distinct from (case when p_actor_kind='provider' then 'provider_member' else 'employer_user' end) or item->>(case when p_actor_kind='provider' then 'answered_by_provider_membership_id' else 'answered_by_employer_user_id' end) is distinct from p_actor_id::text or (p_actor_kind='provider' and item->>'visibility' is distinct from current_row->>'visibility')) then raise exception using errcode='PT403',message='Clarification answer authority denied';end if;
   end if;
   if entry.key='requests_insert' and (item->>'created_by' is distinct from p_actor_id::text or item->>'status' is distinct from case when command_action='send_request' then 'open' else 'draft' end or item->>'current_version' is distinct from case when command_action='send_request' then '1' else '0' end) then raise exception using errcode='PT403',message='Request actor or initial state denied';end if;
   if entry.key in ('requests_insert','requests_update') then
    if command_action in ('create_draft','update_draft','send_request','send_existing_draft','publish_revision') and (item->>'title' is distinct from p_command->'content'->>'title' or item->>'requirement' is distinct from p_command->'content'->>'requirement' or item->>'response_deadline' is distinct from p_command->'content'->>'responseDeadline') then raise exception using errcode='PT422',message='Request content must match the original command';end if;
    if entry.key='requests_update' and command_action not in ('update_draft','send_existing_draft','publish_revision','extend_deadline') and (item-array['status','current_version','published_by','published_at','closed_at','cancellation_reason','updated_at']) is distinct from (current_row-array['status','current_version','published_by','published_at','closed_at','cancellation_reason','updated_at']) then raise exception using errcode='PT403',message='This action cannot alter the employer brief';end if;
    if entry.key='requests_update' and command_action='update_draft' and (item->>'status'<>'draft' or item->>'current_version' is distinct from current_row->>'current_version') then raise exception using errcode='PT409',message='Draft edits cannot advance workflow';end if;
    if entry.key='requests_update' and command_action in ('publish','send_existing_draft') and (item->>'status'<>'open' or (item->>'current_version')::integer<>request.current_version+1) then raise exception using errcode='PT409',message='Publish must advance one version';end if;
   end if;
   if entry.key='versions_insert' and item->>'published_by' is distinct from p_actor_id::text then raise exception using errcode='PT403',message='Version publisher denied';end if;
   if p_actor_kind='provider' and entry.key in ('responses_insert','responses_update') and item->>'provider_membership_id' is distinct from p_actor_id::text then raise exception using errcode='PT403',message='Response author denied';end if;
   if p_actor_kind='provider' and entry.key in ('responses_insert','responses_update','response_versions_insert','clarifications_insert','clarifications_update') and item ? 'invitation_id' and item->>'invitation_id' is distinct from invitation.id::text then raise exception using errcode='PT403',message='Child invitation differs from command';end if;
   if entry.key in ('responses_insert','responses_update') then
    if item->>'status' is distinct from (case when command_action='submit_response' then 'submitted' else 'draft' end) or (item->>'current_version')::integer<>coalesce((current_row->>'current_version')::integer,0)+(case when command_action='submit_response' then 1 else 0 end) then raise exception using errcode='PT409',message='Response state/version does not match command';end if;
    if ((item->'draft_content')-'proposedProgramme') is distinct from ((p_command->'content')-'proposedProgramme') or item->'draft_content'->'proposedProgramme'->>'kind' is distinct from p_command->'content'->'proposedProgramme'->>'kind' or item->'draft_content'->'proposedProgramme'->>'programmeId' is distinct from p_command->'content'->'proposedProgramme'->>'programmeId' then raise exception using errcode='PT422',message='Response evidence must match original command';end if;
   end if;
   if entry.key='response_versions_insert' and item->>'submitted_by_provider_membership_id' is distinct from p_actor_id::text then raise exception using errcode='PT403',message='Submission author denied';end if;
   if entry.key='events_insert' and (item->>'actor_type' is distinct from case when command_action='record_response_notification' then 'system' when p_actor_kind='employer' then 'employer_user' else 'provider_member' end or (command_action<>'record_response_notification' and item->>'actor_id' is distinct from p_actor_id::text)) then raise exception using errcode='PT403',message='Event author denied';end if;
   if command_action='record_response_notification' and entry.key='events_insert' and (item->>'event_type' is distinct from 'employer_response_notification_sent' or item->>'invitation_id' is distinct from invitation.id::text or not exists(select 1 from public.levytate_service_request_responses r where r.organisation_id=p_organisation_id and r.id=(item->>'response_id')::uuid and r.invitation_id=invitation.id and r.status='submitted')) then raise exception using errcode='PT403',message='Notification evidence scope denied';end if;
   if entry.key='clarifications_insert' and (item->>'question' is distinct from p_command->>'question' or item->>'asked_by_type' is distinct from (case when p_actor_kind='provider' then 'provider_member' else 'employer_user' end) or item->>(case when p_actor_kind='provider' then 'asked_by_provider_membership_id' else 'asked_by_employer_user_id' end) is distinct from p_actor_id::text or (p_actor_kind='provider' and item->>'visibility'<>'provider_specific')) then raise exception using errcode='PT403',message='Clarification author denied';end if;
   if entry.key='agreements_insert' and (item->>'confirmed_by' is distinct from p_actor_id::text or not exists(select 1 from public.levytate_service_request_decisions d where d.organisation_id=p_organisation_id and d.request_id=request_id and d.response_id=(item->>'response_id')::uuid and d.provider_id=item->>'provider_id' and d.state='progressed_to_agreement')) then raise exception using errcode='PT409',message='Matching progressed provider required';end if;
   if entry.key='handovers_insert' and item->>'completed_by' is distinct from p_actor_id::text then raise exception using errcode='PT403',message='Handover actor denied';end if;
   if entry.key in ('organisation_providers_upsert','organisation_programmes_upsert') and item->>'selected_by' is distinct from actor_email then raise exception using errcode='PT403',message='Selection actor denied';end if;
   if entry.key in ('decisions_insert','decisions_update') then
    if not exists(select 1 from public.levytate_service_request_responses r where r.organisation_id=p_organisation_id and r.id=(item->>'response_id')::uuid and r.request_id=request_id and r.provider_id=item->>'provider_id' and r.status='submitted') then raise exception using errcode='PT409',message='Submitted matching response required';end if;
    if item->>'state' is distinct from (case command_action when 'shortlist' then 'shortlisted' when 'decline_provider' then 'declined' when 'progress_to_agreement' then 'progressed_to_agreement' when 'not_proceeded' then 'not_proceeded' else 'agreement_confirmed' end) then raise exception using errcode='PT409',message='Decision state does not match command';end if;
    if current_row->>'state' in ('declined','agreement_confirmed','not_proceeded') then raise exception using errcode='PT409',message='Terminal decision is immutable';end if;
    if command_action='progress_to_agreement' and exists(select 1 from public.levytate_service_request_decisions d where d.organisation_id=p_organisation_id and d.request_id=request_id and d.provider_id<>item->>'provider_id' and d.state in ('progressed_to_agreement','agreement_confirmed')) then raise exception using errcode='PT409',message='Another provider is progressing';end if;
    foreach field_name in array array['shortlisted_by','declined_by','progressed_by','agreement_confirmed_by','not_proceeded_by'] loop
     if nullif(item->>field_name,'') is not null and item->>field_name is distinct from current_row->>field_name and item->>field_name is distinct from p_actor_id::text then raise exception using errcode='PT403',message='Decision actor denied';end if;
    end loop;
   end if;
  end loop;
 end loop;
 -- Allowed write kinds are not sufficient: a command must commit its domain
 -- effect and immutable publication/submission evidence, not an empty receipt.
 required:=case command_action
  when 'create_draft' then array['requests_insert'] when 'update_draft' then array['requests_update']
  when 'send_request' then array['requests_insert','versions_insert']
  when 'publish' then array['requests_update','versions_insert']
  when 'publish_revision' then array['requests_update','versions_insert']
  when 'send_existing_draft' then case when request.status='draft' then array['requests_update','versions_insert'] else array[]::text[] end
  when 'submit_response' then array['response_versions_insert','invitations_update']
  when 'ask_clarification' then array['clarifications_insert'] when 'answer_clarification' then array['clarifications_update']
  when 'confirm_agreement' then array['agreements_insert','decisions_update','requests_update']
  when 'confirm_and_handover' then array['agreements_insert','decisions_update','requests_update','handovers_insert']
  when 'handover' then array['handovers_insert']
  when 'extend_deadline' then array['requests_update','versions_insert']
  when 'cancel' then array['requests_update'] when 'close_request' then array['requests_update']
  when 'decline' then array['invitations_update'] when 'record_invitation_delivery' then array['invitations_update']
  when 'record_response_notification' then array['events_insert'] else array[]::text[] end;
 foreach field_name in array required loop
  if jsonb_array_length(coalesce(p_changes->field_name,'[]'))<>1 and field_name<>'events_insert' then raise exception using errcode='PT422',message='Required Requests write or immutable evidence missing';end if;
  if field_name='events_insert' and jsonb_array_length(coalesce(p_changes->field_name,'[]'))<1 then raise exception using errcode='PT422',message='Notification evidence missing';end if;
 end loop;
 if command_action in ('save_draft','submit_response') and jsonb_array_length(coalesce(p_changes->'responses_insert','[]'))+jsonb_array_length(coalesce(p_changes->'responses_update','[]'))<>1 then raise exception using errcode='PT422',message='Exactly one response write required';end if;
 if command_action in ('shortlist','decline_provider','progress_to_agreement','not_proceeded') and jsonb_array_length(coalesce(p_changes->'decisions_insert','[]'))+jsonb_array_length(coalesce(p_changes->'decisions_update','[]'))<>1 then raise exception using errcode='PT422',message='Exactly one decision write required';end if;
 for item in select value from jsonb_array_elements(coalesce(p_changes->'versions_insert','[]')) loop
  if (item->>'version')::integer is distinct from coalesce((p_changes->'requests_insert'->0->>'current_version')::integer,(p_changes->'requests_update'->0->>'current_version')::integer) then raise exception using errcode='PT422',message='Publication snapshot version mismatch';end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(p_changes->'response_versions_insert','[]')) loop
  if not exists(select 1 from jsonb_array_elements(coalesce(p_changes->'responses_insert','[]')||coalesce(p_changes->'responses_update','[]')) r where r->>'id'=item->>'response_id' and r->>'current_version'=item->>'version' and r->>'invitation_id'=item->>'invitation_id') then raise exception using errcode='PT422',message='Submission snapshot identity/version mismatch';end if;
 end loop;
 perform public.levytate_persist_service_request_action(p_organisation_id,p_changes,p_expected);
 insert into public.levytate_audit_events(organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata) values(p_organisation_id,actor_email,actor_role,'service_request',request_id::text,'request.'||command_action,'Requests action committed atomically.',jsonb_build_object('actorKind',p_actor_kind,'actorId',p_actor_id,'requestKey',command_key));
 -- Bind notification resumption to the exact invitation set authorised at commit,
 -- never to later additions to this Request. Non-outbound commands have no set.
 result:=jsonb_build_object('committed',true,'requestId',request_id,'deliveryInvitationIds',coalesce((
  select jsonb_agg(i.id order by i.id) from public.levytate_service_request_invitations i
  where i.organisation_id=p_organisation_id and i.request_id=request_id and
   ((command_action in ('send_request','send_existing_draft','invite_providers') and i.provider_id in (select jsonb_array_elements_text(coalesce(p_command->'providerIds','[]'))))
    or (command_action='retry_invitation' and i.id=invitation.id))
 ),'[]'::jsonb));
 insert into public.levytate_request_command_receipts(organisation_id,actor_kind,actor_id,request_key,command,result) values(p_organisation_id,p_actor_kind,p_actor_id,command_key,p_command,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then raise exception using errcode='PT422',message='Invalid Requests field';
end $$;
revoke all on function public.levytate_apply_request_command(uuid,text,uuid,jsonb,jsonb,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_request_command(uuid,text,uuid,jsonb,jsonb,jsonb,boolean) to service_role;
revoke all on function public.levytate_persist_service_request_action(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate on public.levytate_service_requests,public.levytate_service_request_versions,public.levytate_service_request_invitations,public.levytate_service_request_responses,public.levytate_service_request_response_versions,public.levytate_service_request_clarifications,public.levytate_service_request_decisions,public.levytate_service_request_agreements,public.levytate_service_request_handovers,public.levytate_service_request_events from service_role;
