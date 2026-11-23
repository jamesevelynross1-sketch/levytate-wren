-- LevyTate Provider Delivery V1 — isolated, unapproved forward-change candidate.
-- NEVER apply to shared Supabase or Production. Validate under the 28-file local
-- reviewed chain and the separate backup/restore/migration approval programme.
-- Employer-provided grant, provider-scoped proposal, employer review. No direct
-- provider modification of canonical programme or authoritative learner records.

alter table public.levytate_organisation_capabilities
  add column if not exists provider_delivery_enabled boolean not null default false;

create table public.levytate_provider_delivery_grants (
  organisation_id uuid not null,
  provider_id text not null,
  enabled boolean not null default false,
  approved_by uuid references public.levytate_users(id) on delete set null,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organisation_id,provider_id),
  constraint delivery_grant_selected_fk foreign key (organisation_id,provider_id)
    references public.levytate_organisation_providers(organisation_id,provider_id) on delete restrict,
  constraint delivery_grant_enabled_check check (not enabled or (approved_by is not null and approved_at is not null))
);
create index provider_delivery_grants_provider_idx
  on public.levytate_provider_delivery_grants(provider_id,enabled,organisation_id);

create table public.levytate_provider_delivery_updates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  provider_id text not null,
  provider_membership_id uuid not null,
  update_kind text not null,
  target_id text not null,
  report_date date not null,
  payload jsonb not null,
  idempotency_key uuid not null,
  review_status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.levytate_users(id) on delete set null,
  review_note text not null default '',
  constraint delivery_update_membership_fk foreign key (provider_membership_id,provider_id)
    references public.levytate_provider_memberships(id,provider_id) on delete restrict,
  constraint delivery_update_grant_fk foreign key (organisation_id,provider_id)
    references public.levytate_provider_delivery_grants(organisation_id,provider_id) on delete restrict,
  constraint delivery_update_kind_check check (update_kind in ('learner_progress','programme_note')),
  constraint delivery_update_target_check check (length(target_id) between 1 and 200),
  constraint delivery_update_payload_check check (jsonb_typeof(payload)='object'),
  constraint delivery_update_review_check check (
    review_status in ('pending','accepted','rejected')
    and ((review_status='pending' and reviewed_at is null and reviewed_by is null)
      or (review_status<>'pending' and reviewed_at is not null and reviewed_by is not null))
  ),
  unique(organisation_id,provider_id,idempotency_key)
);
create index provider_delivery_updates_queue_idx
  on public.levytate_provider_delivery_updates(organisation_id,review_status,submitted_at desc,id);
create index provider_delivery_updates_provider_idx
  on public.levytate_provider_delivery_updates(provider_id,organisation_id,submitted_at desc);

alter table public.levytate_provider_delivery_grants enable row level security;
alter table public.levytate_provider_delivery_grants force row level security;
alter table public.levytate_provider_delivery_updates enable row level security;
alter table public.levytate_provider_delivery_updates force row level security;
revoke all on public.levytate_provider_delivery_grants from public,anon,authenticated;
revoke all on public.levytate_provider_delivery_updates from public,anon,authenticated;
grant select,insert,update on public.levytate_provider_delivery_grants to service_role;
grant select,insert,update on public.levytate_provider_delivery_updates to service_role;
create policy provider_delivery_grants_service_role on public.levytate_provider_delivery_grants
  for all to service_role using(true) with check(true);
create policy provider_delivery_updates_service_role on public.levytate_provider_delivery_updates
  for all to service_role using(true) with check(true);

create function public.levytate_set_provider_delivery_grant(
  p_organisation_id uuid,p_actor_user_id uuid,p_provider_id text,p_enabled boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor public.levytate_users%rowtype; v_before boolean; v_updated public.levytate_provider_delivery_grants%rowtype;
begin
  select * into v_actor from public.levytate_users where id=p_actor_user_id and organisation_id=p_organisation_id and active=true
    and role in ('Apprenticeship Lead','Employer Admin');
  if not found then raise exception using errcode='PT403',message='Employer delivery permission denied'; end if;
  if not exists(select 1 from public.levytate_organisation_capabilities where organisation_id=p_organisation_id and provider_delivery_enabled=true)
    then raise exception using errcode='PT403',message='Employer delivery capability disabled'; end if;
  if p_provider_id is null or length(p_provider_id) not between 1 and 160 or p_enabled is null
    then raise exception using errcode='PT422',message='Invalid delivery grant'; end if;
  perform 1 from public.levytate_organisation_providers
    where organisation_id=p_organisation_id and provider_id=p_provider_id and status='Active' for update;
  if not found then raise exception using errcode='PT403',message='Provider relationship not active'; end if;
  select enabled into v_before from public.levytate_provider_delivery_grants
    where organisation_id=p_organisation_id and provider_id=p_provider_id for update;
  insert into public.levytate_provider_delivery_grants (organisation_id,provider_id,enabled,approved_by,approved_at,updated_at)
    values(p_organisation_id,p_provider_id,p_enabled,case when p_enabled then p_actor_user_id else null end,
      case when p_enabled then now() else null end,now())
    on conflict(organisation_id,provider_id) do update set enabled=excluded.enabled,
      approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now()
    returning * into v_updated;
  if v_before is distinct from p_enabled then
    insert into public.levytate_audit_events(organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
      values(p_organisation_id,v_actor.email,v_actor.role,'provider_delivery_grant',p_provider_id,
        case when p_enabled then 'delivery.granted' else 'delivery.revoked' end,
        'Employer changed provider delivery access.',jsonb_build_object('providerId',p_provider_id,'enabled',p_enabled));
  end if;
  return jsonb_build_object('providerId',v_updated.provider_id,'enabled',v_updated.enabled,'updatedAt',v_updated.updated_at);
end $$;

create function public.levytate_submit_provider_delivery_update(
  p_organisation_id uuid,p_provider_id text,p_membership_id uuid,
  p_update_kind text,p_target_id text,p_payload jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_old public.levytate_provider_delivery_updates%rowtype;
        v_new public.levytate_provider_delivery_updates%rowtype;
        v_report_date date; v_keys text[];
begin
  if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or p_update_kind not in ('learner_progress','programme_note') or p_target_id is null
    or length(p_target_id) not between 1 and 200
    then raise exception using errcode='PT422',message='Invalid provider update'; end if;
  if not exists(select 1 from public.levytate_provider_memberships where id=p_membership_id and provider_id=p_provider_id
    and active=true and auth_binding_status='bound' and auth_subject is not null)
    then raise exception using errcode='PT403',message='Provider membership inactive'; end if;
  if not exists(select 1 from public.levytate_organisation_capabilities where organisation_id=p_organisation_id and provider_delivery_enabled=true)
    then raise exception using errcode='PT403',message='Delivery capability disabled'; end if;
  perform 1 from public.levytate_provider_delivery_grants
    where organisation_id=p_organisation_id and provider_id=p_provider_id and enabled=true for update;
  if not found then raise exception using errcode='PT403',message='Employer has not granted provider access'; end if;
  if not exists(select 1 from public.levytate_organisation_providers
    where organisation_id=p_organisation_id and provider_id=p_provider_id and status='Active')
    then raise exception using errcode='PT403',message='Provider relationship inactive'; end if;

  select * into v_old from public.levytate_provider_delivery_updates
    where organisation_id=p_organisation_id and provider_id=p_provider_id and idempotency_key=p_idempotency_key;
  if found then
    if v_old.provider_membership_id<>p_membership_id or v_old.update_kind<>p_update_kind
      or v_old.target_id<>p_target_id or v_old.payload<>p_payload then
      raise exception using errcode='PT409',message='Request key reused with different update'; end if;
    return to_jsonb(v_old);
  end if;

  if not(p_payload ? 'reportDate') or jsonb_typeof(p_payload->'reportDate')<>'string'
    or p_payload->>'reportDate' !~ '^20[0-9]{2}-[0-1][0-9]-[0-3][0-9]$'
    then raise exception using errcode='PT422',message='Report date required'; end if;
  v_report_date:=(p_payload->>'reportDate')::date;
  if v_report_date>current_date+1 or v_report_date<current_date-interval '3 years'
    then raise exception using errcode='PT422',message='Report date out of bounds'; end if;

  if p_update_kind='learner_progress' then
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('reportDate','actualProgressPercentage','summary','nextReviewDate'))
      or not(p_payload ?& array['reportDate','actualProgressPercentage','summary'])
      or jsonb_typeof(p_payload->'actualProgressPercentage')<>'number'
      or p_payload->>'actualProgressPercentage' !~ '^(100|[0-9]|[1-9][0-9])$'
      or jsonb_typeof(p_payload->'summary')<>'string'
      or length(btrim(p_payload->>'summary')) not between 1 and 1200
      then raise exception using errcode='PT422',message='Invalid learner progress evidence'; end if;
    if p_payload ? 'nextReviewDate' and
      (jsonb_typeof(p_payload->'nextReviewDate')<>'string' or p_payload->>'nextReviewDate' !~ '^20[0-9]{2}-[0-1][0-9]-[0-3][0-9]$'
        or (p_payload->>'nextReviewDate')::date<v_report_date) then
      raise exception using errcode='PT422',message='Invalid next review date'; end if;
    if not exists(select 1 from public.levytate_learner_records
       where organisation_id=p_organisation_id and provider_id=p_provider_id and id=p_target_id
         and record_status='Active' and lifecycle_status in ('enrolled','assessment_preparation','in_assessment')
         and exists(select 1 from public.levytate_organisation_programmes
           where organisation_id=p_organisation_id and provider_id=p_provider_id and programme_id=public.levytate_learner_records.programme_id and status='Active'))
       then raise exception using errcode='PT403',message='Learner is not assigned to this provider'; end if;
  else
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('reportDate','deliveryNote','capacityStatus'))
      or not(p_payload ?& array['reportDate','deliveryNote','capacityStatus'])
      or jsonb_typeof(p_payload->'deliveryNote')<>'string'
      or length(btrim(p_payload->>'deliveryNote')) not between 1 and 1200
      or (p_payload->>'capacityStatus') not in ('available','limited','unavailable','unknown')
      then raise exception using errcode='PT422',message='Invalid provider programme report'; end if;
    if not exists(select 1 from public.levytate_organisation_programmes
       where organisation_id=p_organisation_id and provider_id=p_provider_id and programme_id=p_target_id and status='Active')
      then raise exception using errcode='PT403',message='Programme is not assigned to this provider'; end if;
  end if;

  insert into public.levytate_provider_delivery_updates(organisation_id,provider_id,provider_membership_id,
    update_kind,target_id,report_date,payload,idempotency_key)
    values(p_organisation_id,p_provider_id,p_membership_id,p_update_kind,p_target_id,v_report_date,p_payload,p_idempotency_key)
    returning * into v_new;
  insert into public.levytate_audit_events(organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    select p_organisation_id,m.email,m.role,'provider_delivery_update',v_new.id::text,'delivery.submitted',
      'Provider submitted delivery evidence for employer review.',
      jsonb_build_object('providerId',p_provider_id,'kind',p_update_kind,'targetId',p_target_id)
    from public.levytate_provider_memberships m where m.id=p_membership_id;
  return to_jsonb(v_new);
exception when invalid_datetime_format or datetime_field_overflow then
  raise exception using errcode='PT422',message='Invalid provider report date';
end $$;

create function public.levytate_review_provider_delivery_update(
  p_organisation_id uuid,p_actor_user_id uuid,p_update_id uuid,p_decision text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor public.levytate_users%rowtype; v_update public.levytate_provider_delivery_updates%rowtype;
begin
  select * into v_actor from public.levytate_users
    where id=p_actor_user_id and organisation_id=p_organisation_id and active=true
      and role in ('Apprenticeship Lead','Employer Admin');
  if not found then raise exception using errcode='PT403',message='Employer cannot review delivery evidence'; end if;
  if not exists(select 1 from public.levytate_organisation_capabilities
    where organisation_id=p_organisation_id and provider_delivery_enabled=true)
    then raise exception using errcode='PT403',message='Delivery capability disabled'; end if;
  if p_decision not in ('accepted','rejected') or p_update_id is null
    then raise exception using errcode='PT422',message='Invalid review decision'; end if;
  select * into v_update from public.levytate_provider_delivery_updates
    where organisation_id=p_organisation_id and id=p_update_id for update;
  if not found then raise exception using errcode='PT404',message='Update not available'; end if;
  if v_update.review_status<>'pending' then
    if v_update.review_status=p_decision then return to_jsonb(v_update); end if;
    raise exception using errcode='PT409',message='Update already reviewed';
  end if;
  if p_decision='accepted' and not exists(select 1 from public.levytate_provider_delivery_grants g
      join public.levytate_organisation_providers p on p.organisation_id=g.organisation_id and p.provider_id=g.provider_id
      where g.organisation_id=p_organisation_id and g.provider_id=v_update.provider_id and g.enabled and p.status='Active')
    then raise exception using errcode='PT409',message='Provider access was revoked'; end if;
  -- Acceptance acknowledges the provider report. It does not overwrite the
  -- official learner progress, review, compliance or canonical catalogue data.
  update public.levytate_provider_delivery_updates set review_status=p_decision,
    reviewed_at=now(),reviewed_by=p_actor_user_id where id=p_update_id returning * into v_update;
  insert into public.levytate_audit_events(organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    values(p_organisation_id,v_actor.email,v_actor.role,'provider_delivery_update',p_update_id::text,
      'delivery.'||p_decision,'Employer reviewed a provider evidence submission.',
      jsonb_build_object('providerId',v_update.provider_id,'kind',v_update.update_kind,'targetId',v_update.target_id));
  return to_jsonb(v_update);
end $$;

revoke all on function public.levytate_set_provider_delivery_grant(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.levytate_submit_provider_delivery_update(uuid,text,uuid,text,text,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.levytate_set_provider_delivery_grant(uuid,uuid,text,boolean) to service_role;
grant execute on function public.levytate_submit_provider_delivery_update(uuid,text,uuid,text,text,jsonb,uuid) to service_role;
grant execute on function public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text) to service_role;
