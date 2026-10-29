-- LOCAL REVIEW ONLY. Fail on historical conflicts; never delete or rewrite People.
create unique index levytate_employees_unique_normalised_email
  on public.levytate_employees(organisation_id,lower(btrim(email))) where btrim(email)<>'';
create unique index levytate_employees_unique_normalised_number
  on public.levytate_employees(organisation_id,lower(btrim(employee_number)));

create function public.levytate_validate_people_integrity(p_organisation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if exists(select 1 from public.levytate_employees e where e.organisation_id=p_organisation_id and
    (e.platform_role not in ('Employee','Line Manager','Department Head','Apprenticeship Lead')
      or (e.status='Active' and not exists(select 1 from public.levytate_roles r where r.organisation_id=e.organisation_id and r.id=e.role_id and r.status='Active')))) then
    raise exception using errcode='PT422',message='Active People require an active same-workspace role and a valid platform role'; end if;
  if exists(select 1 from public.levytate_employees e where e.organisation_id=p_organisation_id and e.status='Active' and e.manager_id<>'' and
    (e.manager_id=e.id or not exists(select 1 from public.levytate_employees m where m.organisation_id=e.organisation_id and m.id=e.manager_id and m.status='Active' and m.platform_role='Line Manager'))) then
    raise exception using errcode='PT422',message='Active direct reports require an active same-workspace Line Manager'; end if;
  if exists(with recursive chain as (
    select e.id,e.manager_id,array[e.id] as path,false as cycle from public.levytate_employees e where e.organisation_id=p_organisation_id and e.status='Active'
    union all
    select m.id,m.manager_id,c.path||m.id,m.id=any(c.path) from chain c join public.levytate_employees m
      on m.organisation_id=p_organisation_id and m.id=c.manager_id and m.status='Active' where not c.cycle
  ) select 1 from chain where cycle) then
    raise exception using errcode='PT422',message='Reporting lines must not contain cycles'; end if;
end; $$;
revoke all on function public.levytate_validate_people_integrity(uuid) from public,anon,authenticated,service_role;

create function public.levytate_people_tenant_lock() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if TG_OP='UPDATE' and NEW.organisation_id<>OLD.organisation_id then raise exception using errcode='PT403',message='People and role workspace cannot be changed'; end if;
  perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||coalesce(NEW.organisation_id,OLD.organisation_id)::text,0));
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
end; $$;
create function public.levytate_people_integrity_trigger() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.levytate_validate_people_integrity(coalesce(NEW.organisation_id,OLD.organisation_id));
  return null;
end; $$;
revoke all on function public.levytate_people_tenant_lock(),public.levytate_people_integrity_trigger() from public,anon,authenticated,service_role;
create trigger levytate_people_tenant_lock before insert or update or delete on public.levytate_employees
  for each row execute function public.levytate_people_tenant_lock();
create trigger levytate_roles_tenant_lock before insert or update or delete on public.levytate_roles
  for each row execute function public.levytate_people_tenant_lock();
create constraint trigger levytate_people_hierarchy_check after insert or update or delete on public.levytate_employees
  deferrable initially deferred for each row execute function public.levytate_people_integrity_trigger();
create constraint trigger levytate_people_roles_check after update or delete on public.levytate_roles
  deferrable initially deferred for each row execute function public.levytate_people_integrity_trigger();
do $$ declare v_org uuid; begin
  for v_org in select distinct organisation_id from public.levytate_employees loop perform public.levytate_validate_people_integrity(v_org); end loop;
end; $$;

create table public.levytate_people_import_receipts (
  organisation_id uuid not null references public.levytate_organisations(id),
  import_id uuid not null,
  actor_user_id uuid not null references public.levytate_users(id),
  payload_hash text not null,
  imported_count integer not null,
  created_at timestamptz not null default now(),
  primary key(organisation_id,import_id)
);
alter table public.levytate_people_import_receipts enable row level security;
alter table public.levytate_people_import_receipts force row level security;
revoke all on public.levytate_people_import_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_people_import_receipts to service_role;
create policy people_import_receipts_read on public.levytate_people_import_receipts for select to service_role using(true);

create function public.levytate_import_people(p_organisation_id uuid,p_actor_user_id uuid,p_import_id uuid,p_employees jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_receipt public.levytate_people_import_receipts%rowtype;
  v_hash text;
  v_count integer;
begin
  if p_organisation_id is null or p_actor_user_id is null or p_import_id is null or jsonb_typeof(p_employees) is distinct from 'array' then
    raise exception using errcode='PT422',message='Invalid People import'; end if;
  v_count:=jsonb_array_length(p_employees);
  if v_count<1 or v_count>500 then raise exception using errcode='PT422',message='People import must contain 1 to 500 records'; end if;
  select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
  if not found or v_actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Active employer People manager required'; end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
  v_hash:=encode(sha256(convert_to(p_employees::text,'UTF8')),'hex');
  select * into v_receipt from public.levytate_people_import_receipts where organisation_id=p_organisation_id and import_id=p_import_id;
  if found then
    if v_receipt.actor_user_id<>p_actor_user_id or v_receipt.payload_hash<>v_hash then raise exception using errcode='PT409',message='Import ID already used for different People data'; end if;
    return jsonb_build_object('importedCount',v_receipt.imported_count,'importId',p_import_id,'replayed',true);
  end if;
  if exists(select 1 from jsonb_array_elements(p_employees) e where jsonb_typeof(e)<>'object') then raise exception using errcode='PT422',message='Invalid People row'; end if;
  if exists(select 1 from jsonb_array_elements(p_employees) e cross join lateral jsonb_each(e) f where
    f.key not in ('id','employee_number','name','email','job_title','role_id','manager_id','department','site','platform_role','status','start_date','created_at','updated_at')
    or jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>500) then raise exception using errcode='PT422',message='Invalid People field'; end if;
  if exists(select 1 from jsonb_array_elements(p_employees) e where
    not(e ?& array['id','employee_number','name','email','role_id','platform_role','status','start_date'])
    or nullif(btrim(e->>'id'),'') is null or nullif(btrim(e->>'employee_number'),'') is null or nullif(btrim(e->>'name'),'') is null
    or e->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or e->>'status' not in ('Active','Archived') or e->>'start_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
    raise exception using errcode='PT422',message='People row is missing valid identity, role, status or date'; end if;
  insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,role_id,manager_id,department,site,platform_role,status,start_date)
    select p_organisation_id,e->>'id',btrim(e->>'employee_number'),btrim(e->>'name'),lower(btrim(e->>'email')),coalesce(e->>'job_title',''),e->>'role_id',coalesce(e->>'manager_id',''),
      coalesce(e->>'department',''),coalesce(e->>'site',''),e->>'platform_role',e->>'status',(e->>'start_date')::date from jsonb_array_elements(p_employees) e;
  perform public.levytate_validate_people_integrity(p_organisation_id);
  insert into public.levytate_people_import_receipts(organisation_id,import_id,actor_user_id,payload_hash,imported_count) values(p_organisation_id,p_import_id,p_actor_user_id,v_hash,v_count);
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'people_import',p_import_id::text,'people.imported','People imported atomically.',jsonb_build_object('importId',p_import_id,'importedCount',v_count,'payloadHash',v_hash));
  return jsonb_build_object('importedCount',v_count,'importId',p_import_id,'replayed',false);
exception when unique_violation then raise exception using errcode='PT409',message='A People ID or email already exists; no rows were imported';
  when invalid_datetime_format or datetime_field_overflow then raise exception using errcode='PT422',message='People start date is invalid';
end; $$;
revoke all on function public.levytate_import_people(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_import_people(uuid,uuid,uuid,jsonb) to service_role;
