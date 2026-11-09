-- LOCAL CANDIDATE ONLY. No hosted application is authorised.
-- A committed membership is not an Auth identity or an invitation. External
-- Auth creation happens only on the separately requested invitation path.
create table public.levytate_client_admin_commands (
  request_id uuid primary key,
  organisation_id uuid not null references public.levytate_organisations(id),
  actor_user_id uuid not null,
  command text not null check(command in ('create_workspace','provision_user','update_user')),
  request_payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index levytate_client_admin_commands_organisation_idx on public.levytate_client_admin_commands(organisation_id);
alter table public.levytate_client_admin_commands enable row level security;
revoke all on public.levytate_client_admin_commands from public,anon,authenticated,service_role;

create function public.levytate_client_admin_command(p_actor_user_id uuid,p_request_id uuid,p_command text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_user public.levytate_users%rowtype;
  v_org public.levytate_organisations%rowtype;
  v_receipt public.levytate_client_admin_commands%rowtype;
  v_target uuid; v_role text; v_email text; v_active boolean; v_expected integer;
  v_fields text[]; v_result jsonb; v_action text; v_summary text;
  v_now timestamptz:=clock_timestamp();
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Service role required'; end if;
  if p_actor_user_id is null or p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text)>8192 then raise exception using errcode='PT422',message='Invalid account command'; end if;
  case p_command
    when 'create_workspace' then v_fields:=array['name','workspaceName','primaryContact','email','role','slug'];
    when 'provision_user' then v_fields:=array['organisationId','email','displayName','role'];
    when 'update_user' then v_fields:=array['userId','role','active','expectedGeneration'];
    else raise exception using errcode='PT422',message='Unsupported account command';
  end case;
  if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(v_fields)))
    or not(p_payload ?& v_fields) then raise exception using errcode='PT422',message='Invalid account fields'; end if;
  if exists(select 1 from unnest(v_fields) k where k not in ('active','expectedGeneration') and jsonb_typeof(p_payload->k) is distinct from 'string') then
    raise exception using errcode='PT422',message='Account text fields must be strings'; end if;
  perform pg_advisory_xact_lock(hashtextextended('levytate-client-command:'||p_request_id::text,0));
  -- Serialize with People writers before validating deterministic membership linkage.
  select organisation_id into v_target from public.levytate_users where id=p_actor_user_id;
  if p_command='provision_user' then v_target:=(p_payload->>'organisationId')::uuid;
  elsif p_command='update_user' then select organisation_id into v_target from public.levytate_users where id=(p_payload->>'userId')::uuid; end if;
  if v_target is not null then perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||v_target::text,0)); end if;
  -- Canonical user-before-organisation order, also used by tenant suspension.
  select * into v_actor from public.levytate_users where id=p_actor_user_id and active
    and role in ('Platform Admin','Employer Admin','Apprenticeship Lead') for share;
  if not found then raise exception using errcode='PT403',message='Active account administrator required'; end if;
  if p_command='update_user' then
    select * into v_user from public.levytate_users where id=(p_payload->>'userId')::uuid for update;
    if not found then raise exception using errcode='PT404',message='Account not found'; end if;
    v_target:=v_user.organisation_id;
  end if;
  perform 1 from public.levytate_organisations where id=v_actor.organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Active actor workspace required'; end if;
  v_role:=p_payload->>'role';
  if v_role is null or v_role not in ('Employer Admin','Apprenticeship Lead','Line Manager','Employee') then
    raise exception using errcode='PT422',message='Supported employer role required'; end if;
  if p_command='create_workspace' then
    if v_actor.role<>'Platform Admin' then raise exception using errcode='PT403',message='Platform administrator required'; end if;
    if v_role not in ('Employer Admin','Apprenticeship Lead') then raise exception using errcode='PT422',message='Initial administrator required'; end if;
  else
    if v_actor.role<>'Platform Admin' and v_target is distinct from v_actor.organisation_id then raise exception using errcode='PT404',message='Account not found'; end if;
    if v_user.role='Platform Admin' or (v_actor.role='Apprenticeship Lead' and (v_role='Employer Admin' or v_user.role='Employer Admin')) then
      raise exception using errcode='PT403',message='Administrator authority required'; end if;
    select * into v_org from public.levytate_organisations where id=v_target and workspace_template='levytate-client-v1' and status='Active' for share;
    if not found then raise exception using errcode='PT404',message='Active client workspace not found'; end if;
  end if;
  select * into v_receipt from public.levytate_client_admin_commands where request_id=p_request_id;
  if found then
    if v_receipt.actor_user_id<>p_actor_user_id or v_receipt.command<>p_command or v_receipt.request_payload<>p_payload then
      raise exception using errcode='PT409',message='Request key belongs to another command'; end if;
    if p_command='create_workspace' then
      perform 1 from public.levytate_organisations where id=v_receipt.organisation_id and status='Active' for share;
      if not found then raise exception using errcode='PT409',message='Workspace lifecycle changed'; end if;
    end if;
    return v_receipt.result;
  end if;
  if p_command in ('create_workspace','provision_user') then
    v_email:=p_payload->>'email';
    if v_email is null or v_email<>lower(btrim(v_email)) or length(v_email)>254 or v_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception using errcode='PT422',message='Valid normalised email required'; end if;
    perform pg_advisory_xact_lock(hashtextextended('levytate-client-email:'||v_email,0));
    if exists(select 1 from public.levytate_users where lower(btrim(email))=v_email) then raise exception using errcode='PT409',message='Email already has organisation access'; end if;
    if p_command='create_workspace' then
      if coalesce(length(btrim(p_payload->>'name')),0) not between 1 and 160
        or coalesce(length(btrim(p_payload->>'workspaceName')),0) not between 1 and 160
        or coalesce(length(btrim(p_payload->>'primaryContact')),0) not between 1 and 160
        or coalesce(p_payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_payload->>'slug')>72 then
        raise exception using errcode='PT422',message='Valid workspace details required'; end if;
      insert into public.levytate_organisations(name,slug,workspace_name,primary_contact,contact_email,default_site,sites,departments,priorities,workspace_template,status)
        values(p_payload->>'name',p_payload->>'slug',p_payload->>'workspaceName',p_payload->>'primaryContact',v_email,'','[]','[]','[]','levytate-client-v1','Active') returning * into v_org;
      v_target:=v_org.id;
    else
      if coalesce(length(btrim(p_payload->>'displayName')),0) not between 1 and 160 then raise exception using errcode='PT422',message='Display name required'; end if;
      if v_role in ('Employee','Line Manager') and (select count(*) from public.levytate_employees
        where organisation_id=v_target and lower(btrim(email))=v_email and status='Active' and platform_role=v_role)<>1 then
        raise exception using errcode='PT409',message='Exactly one matching active People record required'; end if;
    end if;
    insert into public.levytate_users(organisation_id,email,role,access_level,display_name,active,auth_binding_status,invitation_status,invitation_generation)
      values(v_target,v_email,v_role,'beta_user',case when p_command='create_workspace' then p_payload->>'primaryContact' else p_payload->>'displayName' end,false,'pending','not_requested',0) returning * into v_user;
    v_action:=case when p_command='create_workspace' then 'client_workspace.created' else 'client_workspace.user_provisioned' end;
    v_summary:=case when p_command='create_workspace' then 'Blank Client V1 workspace and pending initial membership created.' else 'Pending individual account prepared; no Auth identity or invitation sent.' end;
  else
    if jsonb_typeof(p_payload->'active') is distinct from 'boolean' or jsonb_typeof(p_payload->'expectedGeneration') is distinct from 'number'
      or (p_payload->>'expectedGeneration') !~ '^[0-9]+$' then raise exception using errcode='PT422',message='Active flag and generation required'; end if;
    v_active:=(p_payload->>'active')::boolean; v_expected:=(p_payload->>'expectedGeneration')::integer;
    if v_user.invitation_generation<>v_expected then raise exception using errcode='PT409',message='Account changed; refresh before retry'; end if;
    if v_user.id=v_actor.id and (v_role<>v_user.role or not v_active) then raise exception using errcode='PT409',message='Another administrator must change own access'; end if;
    if v_active and not v_user.active then raise exception using errcode='PT409',message='Reactivation requires a new invitation'; end if;
    if v_active and v_role in ('Employee','Line Manager') and (select count(*) from public.levytate_employees
      where organisation_id=v_target and lower(btrim(email))=lower(btrim(v_user.email)) and status='Active' and platform_role=v_role)<>1 then
      raise exception using errcode='PT409',message='Exactly one matching active People record required'; end if;
    update public.levytate_users set role=v_role,active=v_active,invitation_generation=invitation_generation+1,
      auth_subject=case when v_active then auth_subject else null end,
      auth_binding_status=case when v_active then auth_binding_status else 'pending' end,
      auth_bound_at=case when v_active then auth_bound_at else null end,
      invitation_status=case when v_active then invitation_status else 'revoked' end,
      invitation_expires_at=case when v_active then invitation_expires_at else null end,updated_at=v_now
      where id=v_user.id returning * into v_user;
    v_action:=case when v_active then 'client_workspace.user_updated' else 'client_workspace.user_revoked' end;
    v_summary:='Account role and access updated with a pinned generation.';
  end if;
  -- Receipt never stores Auth identifiers or tokens. API returns only the public
  -- account summary, not raw database rows or receipt internals.
  v_result:=jsonb_build_object('requestId',p_request_id,'command',p_command,'user',to_jsonb(v_user)-array['auth_subject','auth_bound_at','last_login_at']);
  if p_command='create_workspace' then v_result:=v_result||jsonb_build_object('organisation',to_jsonb(v_org)); end if;
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata,created_at)
    values(p_request_id,v_target,v_actor.email,v_actor.role,'client_workspace',case when p_command='create_workspace' then v_target::text else v_user.id::text end,v_action,v_summary,'{}',v_now);
  insert into public.levytate_client_admin_commands values(p_request_id,v_target,p_actor_user_id,p_command,p_payload,v_result,v_now);
  return v_result;
end; $$;
revoke all on function public.levytate_client_admin_command(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_client_admin_command(uuid,uuid,text,jsonb) to service_role;
