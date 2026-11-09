-- LOCAL ONLY. Reserve and finish individual invitations with atomic audit.
-- The external Auth send is deliberately outside the transaction. A replayed
-- reservation never grants another send; known delivery evidence may reconcile
-- a failed final commit, but an unknown delivery outcome never auto-resends.
alter table public.levytate_users add column invitation_actor_user_id uuid;

create function public.levytate_client_invitation_command(p_actor_user_id uuid,p_user_id uuid,p_request_id uuid,p_expected_generation integer,p_phase text,p_accepted boolean default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype; v_user public.levytate_users%rowtype;
  v_target uuid; v_now timestamptz:=clock_timestamp(); v_send boolean:=false;
  v_action text; v_summary text;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Service role required'; end if;
  if p_actor_user_id is null or p_user_id is null or p_request_id is null or p_expected_generation is null or p_expected_generation<0
    or p_phase is null or p_phase not in ('reserve','finish') or (p_phase='reserve' and p_accepted is not null) or (p_phase='finish' and p_accepted is null) then
    raise exception using errcode='PT422',message='Invalid invitation command'; end if;
  select organisation_id into v_target from public.levytate_users where id=p_user_id;
  if v_target is null then raise exception using errcode='PT404',message='Account not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||v_target::text,0));
  select * into v_actor from public.levytate_users where id=p_actor_user_id and active and role in ('Platform Admin','Employer Admin','Apprenticeship Lead') for share;
  if not found then raise exception using errcode='PT403',message='Active account administrator required'; end if;
  select * into v_user from public.levytate_users where id=p_user_id for update;
  if v_actor.role<>'Platform Admin' and v_user.organisation_id<>v_actor.organisation_id then raise exception using errcode='PT404',message='Account not found'; end if;
  if v_user.role='Platform Admin' or v_user.role not in ('Employer Admin','Apprenticeship Lead','Line Manager','Employee')
    or (v_actor.role='Apprenticeship Lead' and v_user.role='Employer Admin') then raise exception using errcode='PT403',message='Account invitation is not permitted'; end if;
  perform 1 from public.levytate_organisations where id=v_actor.organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Actor workspace is inactive'; end if;
  perform 1 from public.levytate_organisations where id=v_user.organisation_id and status='Active' and workspace_template='levytate-client-v1' for share;
  if not found then raise exception using errcode='PT409',message='Client workspace is inactive'; end if;
  if v_user.role in ('Employee','Line Manager') and (select count(*) from public.levytate_employees where organisation_id=v_user.organisation_id
    and lower(btrim(email))=lower(btrim(v_user.email)) and status='Active' and platform_role=v_user.role)<>1 then
    raise exception using errcode='PT409',message='Exactly one active matching People record required'; end if;
  if p_phase='reserve' then
    if v_user.invitation_request_reference=p_request_id then
      if v_user.invitation_actor_user_id is distinct from p_actor_user_id or v_user.invitation_generation<>p_expected_generation+1 then
        raise exception using errcode='PT409',message='Invitation request changed'; end if;
      return jsonb_build_object('user',to_jsonb(v_user)-array['auth_subject','auth_bound_at','last_login_at'],'sendAllowed',false);
    end if;
    if exists(select 1 from public.levytate_audit_events where id=p_request_id) then
      raise exception using errcode='PT409',message='Invitation request key was already used'; end if;
    if v_user.invitation_generation<>p_expected_generation or (v_user.invitation_status='sending' and v_user.invitation_requested_at>v_now-interval '2 minutes') then
      raise exception using errcode='PT409',message='Account changed or invitation already sending'; end if;
    update public.levytate_users set invitation_generation=invitation_generation+1,invitation_status='sending',invitation_request_reference=p_request_id,
      invitation_actor_user_id=p_actor_user_id,invitation_requested_at=v_now,invitation_expires_at=v_now+interval '1 hour',updated_at=v_now where id=p_user_id returning * into v_user;
    v_send:=true; v_action:='client_workspace.invitation_requested'; v_summary:='Individual invitation reserved; no send or inbox delivery yet confirmed.';
  else
    if v_user.invitation_request_reference is distinct from p_request_id or v_user.invitation_actor_user_id is distinct from p_actor_user_id
      or v_user.invitation_generation<>p_expected_generation then raise exception using errcode='PT409',message='Access changed while invitation was sending'; end if;
    if v_user.invitation_status=case when p_accepted then 'accepted' else 'failed' end then
      return jsonb_build_object('user',to_jsonb(v_user)-array['auth_subject','auth_bound_at','last_login_at'],'sendAllowed',false);
    end if;
    if v_user.invitation_status<>'sending' then raise exception using errcode='PT409',message='Invitation is no longer pending'; end if;
    update public.levytate_users set invitation_status=case when p_accepted then 'accepted' else 'failed' end,
      active=p_accepted or active,updated_at=v_now where id=p_user_id returning * into v_user;
    v_action:=case when p_accepted then 'client_workspace.invitation_accepted' else 'client_workspace.invitation_failed' end;
    v_summary:=case when p_accepted then 'Authentication provider accepted invitation; inbox delivery remains separate.' else 'Invitation delivery could not be confirmed; no automatic resend attempted.' end;
  end if;
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata,created_at)
    values(case when p_phase='reserve' then p_request_id else gen_random_uuid() end,v_user.organisation_id,v_actor.email,v_actor.role,'client_workspace',p_user_id::text,v_action,v_summary,
      jsonb_build_object('requestId',p_request_id,'generation',v_user.invitation_generation),v_now);
  return jsonb_build_object('user',to_jsonb(v_user)-array['auth_subject','auth_bound_at','last_login_at'],'sendAllowed',v_send);
end; $$;
revoke all on function public.levytate_client_invitation_command(uuid,uuid,uuid,integer,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.levytate_client_invitation_command(uuid,uuid,uuid,integer,text,boolean) to service_role;
