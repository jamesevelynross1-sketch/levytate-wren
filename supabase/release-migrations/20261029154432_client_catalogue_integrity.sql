-- Staged for isolated/local review only. Not part of the hash-locked bootstrap.
-- Catalogue writers share one short transaction lock, including direct service
-- writes, so validation cannot race a provider archive or selection change.
alter table public.levytate_provider_relationships alter column review_date drop not null, alter column last_used_date drop not null;
alter table public.levytate_role_pathway_mappings add constraint catalogue_mapping_role_reference
  foreign key(organisation_id,role_id) references public.levytate_roles(organisation_id,id) deferrable initially deferred;
create index catalogue_mapping_role_idx on public.levytate_role_pathway_mappings(organisation_id,role_id);
create index catalogue_selected_provider_reference_idx on public.levytate_organisation_providers(provider_id);
create index catalogue_selected_programme_reference_idx on public.levytate_organisation_programmes(programme_id);
create index catalogue_selected_programme_provider_idx on public.levytate_organisation_programmes(provider_id);
create index catalogue_learner_provider_idx on public.levytate_learner_records(provider_id) where provider_id<>'';
create index catalogue_learner_programme_idx on public.levytate_learner_records(programme_id) where programme_id<>'';
create index catalogue_enrolment_provider_idx on public.levytate_enrolments(provider_id) where provider_id<>'';
create function public.levytate_catalogue_statement_lock() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0)); return null; end; $$;
revoke all on function public.levytate_catalogue_statement_lock() from public,anon,authenticated,service_role;
create function public.levytate_catalogue_write_lock() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
  if TG_OP='UPDATE' and NEW.organisation_id<>OLD.organisation_id then
    raise exception using errcode='PT403',message='Catalogue workspace cannot be changed';
  end if;
  if TG_OP='UPDATE' and ((to_jsonb(NEW)->'id') is distinct from (to_jsonb(OLD)->'id')
    or (TG_TABLE_NAME in ('levytate_providers','levytate_organisation_providers') and (to_jsonb(NEW)->'provider_id') is distinct from (to_jsonb(OLD)->'provider_id'))
    or (TG_TABLE_NAME='levytate_organisation_programmes' and (to_jsonb(NEW)->'programme_id') is distinct from (to_jsonb(OLD)->'programme_id'))) then
    raise exception using errcode='PT403',message='Catalogue record identifiers cannot be changed'; end if;
  if TG_TABLE_NAME in ('levytate_providers','levytate_provider_programmes') and not exists(
    select 1 from public.levytate_organisations where id=coalesce(NEW.organisation_id,OLD.organisation_id) and slug='levytate-internal' and status='Active'
  ) then raise exception using errcode='PT403',message='Canonical catalogue workspace required'; end if;
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
end; $$;

create function public.levytate_standard_reference_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
  if TG_OP='DELETE' or NEW.id is distinct from OLD.id then
    if exists(select 1 from public.levytate_role_pathway_mappings where apprenticeship_standard_id=OLD.id)
      or exists(select 1 from public.levytate_provider_programmes where linked_standard_id=OLD.id or linked_standard_ids ? OLD.id)
      or exists(select 1 from public.levytate_applications where apprenticeship_standard_id=OLD.id)
      or exists(select 1 from public.levytate_matching_requests where linked_standard_id=OLD.id)
      or exists(select 1 from public.levytate_enrolments where apprenticeship_standard_id=OLD.id)
    then raise exception using errcode='PT409',message='Referenced official standards must be retained for history'; end if;
  end if;
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
end; $$;
create trigger catalogue_standard_reference_guard before update or delete on public.levytate_apprenticeship_standards for each row execute function public.levytate_standard_reference_guard();
create trigger catalogue_standard_statement_lock before update or delete on public.levytate_apprenticeship_standards for each statement execute function public.levytate_catalogue_statement_lock();
revoke all on function public.levytate_standard_reference_guard() from public,anon,authenticated,service_role;

create function public.levytate_validate_catalogue_integrity(p_table text default null,p_id text default null,p_org uuid default null) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_canonical uuid;
begin
  select id into v_canonical from public.levytate_organisations where slug='levytate-internal' and status='Active';
  if exists(select 1 from public.levytate_provider_programmes p where p.organisation_id=v_canonical
    and (p_table is null or (p_table='levytate_providers' and p.provider_id=p_id) or (p_table='levytate_provider_programmes' and p.id=p_id)) and not exists(
    select 1 from public.levytate_providers v where v.organisation_id=v_canonical and v.provider_id=p.provider_id
      and (p.record_status<>'Active' or v.status='Active')
  )) then raise exception using errcode='PT409',message='Programmes require their canonical provider; archive programmes before their provider'; end if;
  if exists(select 1 from public.levytate_provider_programmes p where p.organisation_id=v_canonical
    and (p_table is null or (p_table='levytate_provider_programmes' and p.id=p_id)) and
    (nullif(p.linked_standard_id,'') is null or not exists(select 1 from public.levytate_apprenticeship_standards s where s.id=p.linked_standard_id)
      or not(p.linked_standard_ids ? p.linked_standard_id)
      or exists(select 1 from jsonb_array_elements_text(p.linked_standard_ids) i where not exists(select 1 from public.levytate_apprenticeship_standards s where s.id=i))))
    then raise exception using errcode='PT422',message='Programme standard references must exist in the official catalogue'; end if;
  if exists(select 1 from public.levytate_organisation_providers s where
    (p_table is null or (p_table='levytate_providers' and s.provider_id=p_id) or (p_table='levytate_organisation_providers' and s.organisation_id=p_org and s.provider_id=p_id)) and not exists(
    select 1 from public.levytate_providers p where p.organisation_id=v_canonical and p.provider_id=s.provider_id
      and (s.status<>'Active' or (p.status='Active' and p.verification_status='verified' and p.last_verified is not null and jsonb_array_length(p.source_urls)>0))
  )) then raise exception using errcode='PT409',message='Selected providers must remain active and verified'; end if;
  if exists(select 1 from public.levytate_organisation_programmes s where
    (p_table is null or (p_table='levytate_providers' and s.provider_id=p_id) or (p_table='levytate_provider_programmes' and s.programme_id=p_id)
      or (p_table='levytate_organisation_providers' and s.organisation_id=p_org and s.provider_id=p_id)
      or (p_table='levytate_organisation_programmes' and s.organisation_id=p_org and s.programme_id=p_id)) and not exists(
    select 1 from public.levytate_provider_programmes p where p.organisation_id=v_canonical and p.id=s.programme_id and p.provider_id=s.provider_id
      and (s.status<>'Active' or (p.record_status='Active' and p.status='Active' and p.verification_status<>'Needs manual verification' and nullif(p.source_url,'') is not null
        and exists(select 1 from public.levytate_organisation_providers v where v.organisation_id=s.organisation_id and v.provider_id=p.provider_id and v.status='Active')))
  )) then raise exception using errcode='PT409',message='Selected programmes require their active verified canonical programme and selected provider'; end if;
  if exists(select 1 from public.levytate_role_pathway_mappings m where
    (p_table is null or (p_table='levytate_role_pathway_mappings' and m.organisation_id=p_org and m.id=p_id)) and (
      not exists(select 1 from public.levytate_roles r where r.organisation_id=m.organisation_id and r.id=m.role_id)
      or not exists(select 1 from public.levytate_apprenticeship_standards s where s.id=m.apprenticeship_standard_id))
  ) then raise exception using errcode='PT422',message='Role mappings require existing same-workspace roles and official standards'; end if;
  if exists(select 1 from public.levytate_provider_relationships r where
    (p_table is null or (p_table='levytate_provider_relationships' and r.organisation_id=p_org and r.id=p_id)
      or (p_table='levytate_providers' and (r.preferred_provider_id=p_id or r.backup_provider_ids ? p_id))
      or (p_table='levytate_provider_programmes' and r.programme_ids ? p_id)) and (
    not exists(select 1 from public.levytate_providers p where p.organisation_id=v_canonical and p.provider_id=r.preferred_provider_id)
    or exists(select 1 from jsonb_array_elements_text(r.backup_provider_ids) b where not exists(select 1 from public.levytate_providers p where p.organisation_id=v_canonical and p.provider_id=b))
    or exists(select 1 from jsonb_array_elements_text(r.programme_ids) i where not exists(select 1 from public.levytate_provider_programmes p where p.organisation_id=v_canonical and p.id=i
      and (p.provider_id=r.preferred_provider_id or r.backup_provider_ids ? p.provider_id))))
  ) then raise exception using errcode='PT422',message='Provider relationship references must belong to the canonical catalogue and selected relationship providers'; end if;
  if exists(select 1 from public.levytate_matching_requests r where
    (p_table is null or (p_table='levytate_matching_requests' and r.organisation_id=p_org and r.id=p_id)
      or (p_table='levytate_providers' and r.shortlist_provider_ids ? p_id)
      or (p_table='levytate_provider_programmes' and r.programme_id=p_id)) and (
    (nullif(r.programme_id,'') is not null and not exists(select 1 from public.levytate_provider_programmes p where p.organisation_id=v_canonical and p.id=r.programme_id
      and (nullif(r.linked_standard_id,'') is null or p.linked_standard_id=r.linked_standard_id or p.linked_standard_ids ? r.linked_standard_id)))
    or (nullif(r.linked_standard_id,'') is not null and not exists(select 1 from public.levytate_apprenticeship_standards s where s.id=r.linked_standard_id))
    or exists(select 1 from jsonb_array_elements_text(r.shortlist_provider_ids) i where not exists(select 1 from public.levytate_providers p where p.organisation_id=v_canonical and p.provider_id=i)))
  ) then raise exception using errcode='PT422',message='Matching request references must belong to the canonical catalogue'; end if;
  if exists(select 1 from public.levytate_learner_records l where
    (p_table is null or (p_table='levytate_providers' and l.provider_id=p_id) or (p_table='levytate_provider_programmes' and l.programme_id=p_id)) and (
    (nullif(l.provider_id,'') is not null and not exists(select 1 from public.levytate_providers p where p.organisation_id=v_canonical and p.provider_id=l.provider_id
      and (l.record_status<>'Active' or l.lifecycle_status in ('withdrawn','achieved','completed_without_achievement') or p.status='Active')))
    or (nullif(l.programme_id,'') is not null and not exists(select 1 from public.levytate_provider_programmes p where p.organisation_id=v_canonical and p.id=l.programme_id and p.provider_id=l.provider_id
      and (l.record_status<>'Active' or l.lifecycle_status in ('withdrawn','achieved','completed_without_achievement') or p.record_status='Active')))))
    then raise exception using errcode='PT409',message='Learner catalogue references must be retained; active learners prevent archival'; end if;
  if exists(select 1 from public.levytate_enrolments e where (p_table is null or (p_table='levytate_providers' and e.provider_id=p_id)) and nullif(e.provider_id,'') is not null and not exists(select 1 from public.levytate_providers p where p.organisation_id=v_canonical and p.provider_id=e.provider_id))
    then raise exception using errcode='PT409',message='Enrolment providers must be retained for history'; end if;
end; $$;

create function public.levytate_catalogue_integrity_trigger() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row jsonb:=coalesce(to_jsonb(NEW),to_jsonb(OLD)); v_id text;
begin
  v_id:=case when TG_TABLE_NAME in ('levytate_providers','levytate_organisation_providers') then v_row->>'provider_id'
    when TG_TABLE_NAME='levytate_organisation_programmes' then v_row->>'programme_id' else v_row->>'id' end;
  perform public.levytate_validate_catalogue_integrity(TG_TABLE_NAME,v_id,(v_row->>'organisation_id')::uuid);
  return null;
end; $$;

do $$ declare v_table text; begin
  foreach v_table in array array['levytate_providers','levytate_provider_programmes','levytate_organisation_providers','levytate_organisation_programmes','levytate_role_pathway_mappings','levytate_provider_relationships','levytate_matching_requests'] loop
    execute format('create trigger catalogue_statement_lock before insert or update or delete on public.%I for each statement execute function public.levytate_catalogue_statement_lock()',v_table);
    execute format('create trigger catalogue_write_lock before insert or update or delete on public.%I for each row execute function public.levytate_catalogue_write_lock()',v_table);
    execute format('create constraint trigger catalogue_integrity_check after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.levytate_catalogue_integrity_trigger()',v_table);
  end loop;
end; $$;
revoke all on function public.levytate_catalogue_write_lock(),public.levytate_catalogue_integrity_trigger(),public.levytate_validate_catalogue_integrity(text,text,uuid) from public,anon,authenticated,service_role;

create function public.levytate_save_role(p_organisation_id uuid,p_actor_user_id uuid,p_role jsonb,p_mappings jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor public.levytate_users%rowtype; v_id text; v_mapping jsonb;
begin
  select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
  if not found or v_actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Active employer catalogue manager required'; end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  -- Same ordering as learner transactions: catalogue, then tenant/record locks.
  perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
  perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
  if jsonb_typeof(p_role) is distinct from 'object' or jsonb_typeof(p_mappings) is distinct from 'array' then raise exception using errcode='PT422',message='Invalid role payload'; end if;
  v_id:=p_role->>'id';
  if not(p_role ?& array['id','title','department','status','career_level','skills_tags','progression'])
    or exists(select 1 from jsonb_each(p_role) f where f.key in ('id','title','department','status','career_level') and (jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>160))
    or jsonb_typeof(p_role->'skills_tags') is distinct from 'array' or jsonb_typeof(p_role->'progression') is distinct from 'array'
    or jsonb_array_length(p_role->'skills_tags')>100 or jsonb_array_length(p_role->'progression')>100
    or exists(select 1 from jsonb_array_elements((p_role->'skills_tags')||(p_role->'progression')) e where jsonb_typeof(e)<>'string' or length(e#>>'{}')>1000)
    or (p_role ? 'business_area' and (jsonb_typeof(p_role->'business_area')<>'string' or length(p_role->>'business_area')>1000))
    or nullif(v_id,'') is null or nullif(btrim(p_role->>'title'),'') is null or nullif(btrim(p_role->>'department'),'') is null
    or p_role->>'status' not in ('Active','Archived') or p_role->>'career_level' not in ('Entry','Experienced','Supervisor','Manager','Senior Manager')
    or jsonb_array_length(p_mappings) not between 1 and 20
    or (select count(*) from jsonb_array_elements(p_mappings) m where m->>'recommendation_type'='Primary')<>1
    or (select count(distinct m->>'apprenticeship_standard_id') from jsonb_array_elements(p_mappings) m)<>jsonb_array_length(p_mappings)
    or (select count(distinct m->>'id') from jsonb_array_elements(p_mappings) m)<>jsonb_array_length(p_mappings)
  then raise exception using errcode='PT422',message='Role title, department, level and unique primary mapping are required'; end if;
  for v_mapping in select value from jsonb_array_elements(p_mappings) loop
    if jsonb_typeof(v_mapping) is distinct from 'object' or not(v_mapping ?& array['id','apprenticeship_standard_id','recommendation_type','priority'])
      or jsonb_typeof(v_mapping->'id') is distinct from 'string' or jsonb_typeof(v_mapping->'apprenticeship_standard_id') is distinct from 'string'
      or jsonb_typeof(v_mapping->'recommendation_type') is distinct from 'string' or jsonb_typeof(v_mapping->'priority') is distinct from 'number'
      or nullif(v_mapping->>'id','') is null or v_mapping->>'recommendation_type' not in ('Primary','Alternative')
      or exists(select 1 from jsonb_each(v_mapping) f where f.key in ('business_rationale','funding_route','delivery_preference') and (jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>1000))
      or (v_mapping->>'priority')::numeric<>trunc((v_mapping->>'priority')::numeric) or (v_mapping->>'priority')::numeric not between 1 and 100 then
      raise exception using errcode='PT422',message='Invalid role mapping'; end if;
    perform 1 from public.levytate_apprenticeship_standards where id=v_mapping->>'apprenticeship_standard_id' and status='Approved for delivery' for share;
    if not found then raise exception using errcode='PT422',message='Role mappings require an approved official standard'; end if;
    if exists(select 1 from public.levytate_role_pathway_mappings where organisation_id=p_organisation_id and id=v_mapping->>'id' and role_id<>v_id) then
      raise exception using errcode='PT409',message='Mapping identifier belongs to another role'; end if;
  end loop;
  insert into public.levytate_roles(organisation_id,id,title,department,business_area,career_level,skills_tags,progression,status)
    values(p_organisation_id,v_id,btrim(p_role->>'title'),btrim(p_role->>'department'),coalesce(p_role->>'business_area',''),p_role->>'career_level',p_role->'skills_tags',p_role->'progression',p_role->>'status')
    on conflict(organisation_id,id) do update set title=excluded.title,department=excluded.department,business_area=excluded.business_area,career_level=excluded.career_level,
      skills_tags=excluded.skills_tags,progression=excluded.progression,status=excluded.status,updated_at=now();
  delete from public.levytate_role_pathway_mappings where organisation_id=p_organisation_id and role_id=v_id;
  insert into public.levytate_role_pathway_mappings(organisation_id,id,role_id,apprenticeship_standard_id,recommendation_type,priority,business_rationale,funding_route,delivery_preference)
    select p_organisation_id,m->>'id',v_id,m->>'apprenticeship_standard_id',m->>'recommendation_type',(m->>'priority')::int,coalesce(m->>'business_rationale',''),coalesce(m->>'funding_route',''),coalesce(m->>'delivery_preference','') from jsonb_array_elements(p_mappings) m;
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'role',v_id,'role.saved','Role and pathway mappings saved atomically.');
  return jsonb_build_object('id',v_id);
end; $$;

create function public.levytate_select_catalogue(p_organisation_id uuid,p_actor_user_id uuid,p_kind text,p_id text,p_provider_id text,p_status text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor public.levytate_users%rowtype; v_canonical uuid; v_provider text; v_programme public.levytate_provider_programmes%rowtype;
begin
  select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
  if not found or v_actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Active employer catalogue manager required'; end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  if p_kind is null or p_kind not in ('provider','programme') or p_status is null or p_status not in ('Active','Inactive') or nullif(p_id,'') is null then
    raise exception using errcode='PT422',message='Invalid catalogue selection'; end if;
  perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
  select id into v_canonical from public.levytate_organisations where slug='levytate-internal' and status='Active' for share;
  if not found then raise exception using errcode='PT404',message='Canonical catalogue is unavailable'; end if;
  if p_kind='provider' then v_provider:=p_id;
  else
    select * into v_programme from public.levytate_provider_programmes where organisation_id=v_canonical and id=p_id;
    if not found or v_programme.provider_id is distinct from p_provider_id then raise exception using errcode='PT422',message='Programme and provider do not match'; end if;
    v_provider:=v_programme.provider_id;
    if p_status='Active' and (v_programme.status<>'Active' or v_programme.record_status<>'Active' or v_programme.verification_status='Needs manual verification'
      or nullif(v_programme.source_url,'') is null or jsonb_array_length(v_programme.linked_standard_ids)=0
      or exists(select 1 from jsonb_array_elements_text(v_programme.linked_standard_ids) i where not exists(select 1 from public.levytate_apprenticeship_standards s where s.id=i and s.status='Approved for delivery')))
    then raise exception using errcode='PT422',message='Select an active verified programme with approved standards'; end if;
  end if;
  if p_status='Active' then
    perform 1 from public.levytate_providers where organisation_id=v_canonical and provider_id=v_provider and status='Active' and verification_status='verified' and last_verified is not null and jsonb_array_length(source_urls)>0;
    if not found then raise exception using errcode='PT422',message='Select an active verified canonical provider'; end if;
    insert into public.levytate_organisation_providers(organisation_id,provider_id,status,selected_by)
      values(p_organisation_id,v_provider,'Active',v_actor.email) on conflict(organisation_id,provider_id) do update set status='Active',selected_by=excluded.selected_by,updated_at=now();
  elsif p_kind='provider' then
    update public.levytate_organisation_providers set status='Inactive',selected_by=v_actor.email,updated_at=now() where organisation_id=p_organisation_id and provider_id=p_id;
    if not found then raise exception using errcode='PT404',message='Provider selection not found'; end if;
    update public.levytate_organisation_programmes set status='Inactive',selected_by=v_actor.email,updated_at=now() where organisation_id=p_organisation_id and provider_id=p_id and status='Active';
  end if;
  if p_kind='programme' then
    if p_status='Inactive' and not exists(select 1 from public.levytate_organisation_programmes where organisation_id=p_organisation_id and programme_id=p_id) then raise exception using errcode='PT404',message='Programme selection not found'; end if;
    insert into public.levytate_organisation_programmes(organisation_id,programme_id,provider_id,status,selected_by)
      values(p_organisation_id,p_id,v_provider,p_status,v_actor.email) on conflict(organisation_id,programme_id) do update set status=excluded.status,provider_id=excluded.provider_id,selected_by=excluded.selected_by,updated_at=now();
  end if;
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'organisation_'||p_kind,p_id,'catalogue.selection_saved','Catalogue selection saved atomically.',jsonb_build_object('status',p_status,'providerId',v_provider));
  return jsonb_build_object('id',p_id,'status',p_status);
end; $$;
revoke all on function public.levytate_save_role(uuid,uuid,jsonb,jsonb),public.levytate_select_catalogue(uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.levytate_save_role(uuid,uuid,jsonb,jsonb),public.levytate_select_catalogue(uuid,uuid,text,text,text,text) to service_role;

-- Existing conflicts are a review blocker, never silently merged or removed.
select public.levytate_validate_catalogue_integrity();
