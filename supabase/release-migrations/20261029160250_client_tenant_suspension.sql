-- Local candidate only. No hosted execution or real employer suspension authorised.
-- Audit UUID is the idempotency key; no automatic reactivation or deletion.
create function public.levytate_suspend_client_tenant(p_organisation_id uuid,p_actor_user_id uuid,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_organisation public.levytate_organisations%rowtype;
  v_previous public.levytate_audit_events%rowtype;
  v_count integer;
  v_now timestamptz:=clock_timestamp();
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Service role required'; end if;
  if p_organisation_id is null or p_actor_user_id is null or p_request_id is null or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then
    raise exception using errcode='PT422',message='An explicit suspension reason and request are required'; end if;
  select u.* into v_actor from public.levytate_users u join public.levytate_organisations o on o.id=u.organisation_id
    where u.id=p_actor_user_id and u.active and u.role='Platform Admin' and o.status='Active' for share of u,o;
  if not found then raise exception using errcode='PT403',message='Active platform administrator required'; end if;
  if v_actor.organisation_id=p_organisation_id then raise exception using errcode='PT403',message='Platform workspace cannot be suspended through client controls'; end if;
  -- Match existing user-before-organisation authority lock order.
  perform 1 from public.levytate_users where organisation_id=p_organisation_id order by id for update;
  select * into v_organisation from public.levytate_organisations where id=p_organisation_id and workspace_template='levytate-client-v1' for update;
  if not found then raise exception using errcode='PT404',message='Client workspace not found'; end if;
  select * into v_previous from public.levytate_audit_events where id=p_request_id;
  if found then
    if v_previous.organisation_id is distinct from p_organisation_id or v_previous.actor_email is distinct from v_actor.email
      or v_previous.action is distinct from 'client_workspace.suspended' or v_previous.metadata->>'reason' is distinct from btrim(p_reason) then
      raise exception using errcode='PT409',message='Request key already belongs to another operation'; end if;
    return v_previous.metadata->'result';
  end if;
  if v_organisation.status not in ('Active','Suspended') then raise exception using errcode='PT409',message='Workspace lifecycle requires an explicit approved recovery procedure'; end if;
  update public.levytate_organisations set status='Suspended',updated_at=v_now where id=p_organisation_id;
  update public.levytate_users set active=false,invitation_status='revoked',invitation_generation=invitation_generation+1,
    invitation_expires_at=null,auth_binding_status='pending',auth_subject=null,auth_bound_at=null,updated_at=v_now
    where organisation_id=p_organisation_id and (active or invitation_status<>'revoked');
  get diagnostics v_count=row_count;
  v_result:=jsonb_build_object('organisationId',p_organisation_id,'status','Suspended','membershipsRevoked',v_count,'suspendedAt',v_now);
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata,created_at)
    values(p_request_id,p_organisation_id,v_actor.email,v_actor.role,'client_workspace',p_organisation_id::text,'client_workspace.suspended',
      'Employer suspended; existing sessions and pending invitations no longer authorise access.',jsonb_build_object('reason',btrim(p_reason),'result',v_result),v_now);
  return v_result;
end; $$;
revoke all on function public.levytate_suspend_client_tenant(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.levytate_suspend_client_tenant(uuid,uuid,text,uuid) to service_role;

-- Stop an invitation already in flight from re-enabling a suspended membership.
-- The row lock also serialises invitation claims against suspension.
create function public.levytate_require_active_tenant_membership() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.active or new.invitation_status in ('sending','accepted') then
    perform 1 from public.levytate_organisations where id=new.organisation_id and status='Active' for share;
    if not found then raise exception using errcode='PT409',message='Workspace does not permit membership activation'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.levytate_require_active_tenant_membership() from public,anon,authenticated,service_role;
create trigger levytate_active_tenant_membership before insert or update on public.levytate_users
  for each row execute function public.levytate_require_active_tenant_membership();
