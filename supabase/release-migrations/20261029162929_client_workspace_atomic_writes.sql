-- Isolated candidate only. All workspace writes, CAS receipts and append-only
-- audit events below commit together. Existing catalogue RPCs run inside this tx.
create table public.levytate_workspace_entity_versions(
 organisation_id uuid not null,entity_key text not null,revision bigint not null check(revision between 1 and 9007199254740991),
 primary key(organisation_id,entity_key)
);
create table public.levytate_workspace_command_receipts(
 organisation_id uuid not null,entity_key text not null,base_revision bigint not null,actor_user_id uuid not null,
 command_hash text not null,result jsonb not null,created_at timestamptz not null default now(),
 primary key(organisation_id,entity_key,base_revision)
);
alter table public.levytate_workspace_entity_versions enable row level security;
alter table public.levytate_workspace_command_receipts enable row level security;
revoke all on public.levytate_workspace_entity_versions,public.levytate_workspace_command_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_workspace_entity_versions to service_role;
create policy workspace_versions_service_read on public.levytate_workspace_entity_versions for select to service_role using(true);

create function public.levytate_record_workspace_entity_version() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row jsonb;v_org uuid;v_id text;v_entity_table text:=TG_TABLE_NAME;
begin
 if TG_OP='UPDATE' and (to_jsonb(NEW)-array['created_at','updated_at'])=(to_jsonb(OLD)-array['created_at','updated_at']) then return NEW;end if;
 v_row:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 v_org:=case when TG_TABLE_NAME='levytate_organisations' then (v_row->>'id')::uuid else (v_row->>'organisation_id')::uuid end;
 if TG_TABLE_NAME='levytate_role_pathway_mappings' then v_entity_table:='levytate_roles';end if;
 v_id:=case when TG_TABLE_NAME='levytate_role_pathway_mappings' then v_row->>'role_id'
   when TG_TABLE_NAME='levytate_employee_development_profiles' then v_row->>'employee_id'
   when TG_TABLE_NAME in ('levytate_providers','levytate_organisation_providers') then v_row->>'provider_id'
   when TG_TABLE_NAME='levytate_organisation_programmes' then v_row->>'programme_id' else v_row->>'id' end;
 insert into public.levytate_workspace_entity_versions values(v_org,v_entity_table||':'||v_id,1)
 on conflict(organisation_id,entity_key) do update set revision=levytate_workspace_entity_versions.revision+1;
 if TG_OP='DELETE' then return OLD;else return NEW;end if;
end; $$;
revoke all on function public.levytate_record_workspace_entity_version() from public,anon,authenticated,service_role;
do $$ declare v_table text;begin
 foreach v_table in array array['levytate_organisations','levytate_employees','levytate_employee_development_profiles','levytate_roles','levytate_role_pathway_mappings','levytate_providers','levytate_provider_programmes','levytate_provider_relationships','levytate_matching_requests','levytate_organisation_providers','levytate_organisation_programmes'] loop
 execute format('create trigger levytate_workspace_entity_version after insert or update or delete on public.%I for each row execute function public.levytate_record_workspace_entity_version()',v_table);
 end loop;
end; $$;

create function public.levytate_workspace_command(p_organisation_id uuid,p_actor_user_id uuid,p_action text,p_entity_id text,p_expected_revision bigint,p_record jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_actor public.levytate_users%rowtype;v_target uuid:=p_organisation_id;v_table text;v_key text:='id';v_fields text[];
 v_row jsonb;v_old jsonb;v_exists boolean;v_record jsonb;v_hash text;v_entity text;v_revision bigint;
 v_receipt public.levytate_workspace_command_receipts%rowtype;v_result jsonb;v_attr record;v_columns text;v_values text;v_updates text;
 v_now timestamptz:=clock_timestamp();v_inner_audit boolean:=false;v_standard public.levytate_apprenticeship_standards%rowtype;
 v_revoked_memberships integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Service role required';end if;
 if p_organisation_id is null or p_actor_user_id is null or p_action is null or p_entity_id is null or p_entity_id!~'^[A-Za-z0-9_-]{1,100}$'
 or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740991 or jsonb_typeof(p_record) is distinct from 'object'
 or octet_length(p_record::text)>65536 then raise exception using errcode='PT422',message='Invalid workspace command';end if;
 -- Match catalogue and People writers. Actual row is locked before reading its
 -- version, so independent direct writers cannot race the compare-and-swap.
 perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));
 perform pg_advisory_xact_lock(hashtextextended('levytate-people:'||p_organisation_id::text,0));
 select u.* into v_actor from public.levytate_users u join public.levytate_organisations o on o.id=u.organisation_id
 where u.id=p_actor_user_id and u.organisation_id=p_organisation_id and u.active and o.status='Active' for share of u,o;
 if not found then raise exception using errcode='PT403',message='Active workspace actor required';end if;
 if p_action in ('saveProvider','archiveProvider','saveProviderProgramme','archiveProviderProgramme','removeProviderProgramme') then
  if v_actor.role<>'Platform Admin' then raise exception using errcode='PT403',message='Platform catalogue authority required';end if;
  select id into v_target from public.levytate_organisations where slug='levytate-internal' and status='Active' for share;
  if not found then raise exception using errcode='PT409',message='Canonical catalogue is unavailable';end if;
 elsif p_action='saveProfile' then
  if v_actor.role not in ('Platform Admin','Employer Admin') or p_entity_id<>p_organisation_id::text then raise exception using errcode='PT403',message='Workspace settings authority required';end if;
 elsif p_action='saveEmployeeDevelopmentProfile' then
  if v_actor.role not in ('Employer Admin','Apprenticeship Lead','Line Manager','Employee') then raise exception using errcode='PT403',message='Employee profile authority required';end if;
  if not exists(select 1 from public.levytate_employees e where e.organisation_id=p_organisation_id and e.id=p_entity_id and e.status='Active'
    and (v_actor.role in ('Employer Admin','Apprenticeship Lead') or lower(btrim(e.email))=lower(btrim(v_actor.email))
      or (v_actor.role='Line Manager' and exists(select 1 from public.levytate_employees m where m.organisation_id=p_organisation_id and m.id=e.manager_id and m.status='Active' and m.platform_role='Line Manager' and lower(btrim(m.email))=lower(btrim(v_actor.email)))))) then
    raise exception using errcode='PT403',message='Employee profile is outside the current scope';end if;
 elsif v_actor.role not in ('Employer Admin','Apprenticeship Lead') then raise exception using errcode='PT403',message='Employer administration authority required';
 end if;
 case p_action
 when 'saveProfile' then v_table:='levytate_organisations';v_fields:=array['name','workspace_name','primary_contact','contact_email','default_site','sites','departments','priorities'];
 when 'saveEmployee' then v_table:='levytate_employees';v_fields:=array['id','employee_number','name','email','job_title','role_id','manager_id','department','site','platform_role','status','start_date'];
 when 'archiveEmployee' then v_table:='levytate_employees';v_fields:=array['status'];
 when 'saveEmployeeDevelopmentProfile' then v_table:='levytate_employee_development_profiles';v_key:='employee_id';v_fields:=array['employee_id','stage','responsibilities','current_skills','business_functions','current_capabilities','apprenticeship_indicators','ai_opportunities','data_opportunities','automation_opportunities','future_capabilities','conversation_history','conversation_profile','recommendation_result','preferred_standard_id'];
 when 'saveRole' then v_table:='levytate_roles';v_fields:=array['role','mappings'];v_inner_audit:=true;
 when 'archiveRole' then v_table:='levytate_roles';v_fields:=array['status'];
 when 'saveProvider' then v_table:='levytate_providers';v_key:='provider_id';v_fields:=array['provider_id','provider_name','website','provider_type','sectors','industries','technologies','delivery_models','regions','employer_types','specialisms','contact_name','contact_email','ofsted_rating','status','source_urls','notes','last_verified','verification_status'];
 when 'archiveProvider' then v_table:='levytate_providers';v_key:='provider_id';v_fields:=array['status'];
 when 'saveProviderProgramme' then v_table:='levytate_provider_programmes';v_fields:=array['id','provider_id','programme_name','short_description','full_description','status','verification_status','target_organisations','target_industries','target_job_roles','seniority','employer_size','business_problems_solved','skills_developed','technologies_covered','expected_outcomes','delivery_models','regions','duration','cohort_options','commercial_notes','apprenticeship_standard_id','linked_standard_id','linked_standard_ids','linked_standard_name','level','route','funding_band','official_url','source_url','notes','funding_route','record_status'];
 when 'archiveProviderProgramme' then v_table:='levytate_provider_programmes';v_fields:=array['status'];
 when 'removeProviderProgramme' then v_table:='levytate_provider_programmes';v_fields:='{}';
 when 'saveProviderRelationship' then v_table:='levytate_provider_relationships';v_fields:=array['id','category','preferred_provider_id','backup_provider_ids','programme_ids','status','notes','review_date','last_used_date'];
 when 'saveMatchingRequest' then v_table:='levytate_matching_requests';v_fields:=array['id','role_need','department','future_capability','employer_size','programme_id','linked_standard_id','learner_count','sites','delivery_preference','funding_position','urgency','notes','business_problems','target_roles','technologies','industries','status','shortlist_provider_ids'];
 when 'updateMatchingStatus' then v_table:='levytate_matching_requests';v_fields:=array['status'];
 when 'saveOrganisationProvider' then v_table:='levytate_organisation_providers';v_key:='provider_id';v_fields:=array['provider_id','status'];v_inner_audit:=true;
 when 'saveOrganisationProgramme' then v_table:='levytate_organisation_programmes';v_key:='programme_id';v_fields:=array['provider_id','status'];v_inner_audit:=true;
 else raise exception using errcode='PT422',message='Unsupported workspace action';
 end case;
 v_record:=p_record-array['created_at','updated_at'];
 if p_action='saveRole' then
  if jsonb_typeof(v_record->'role') is distinct from 'object' or jsonb_typeof(v_record->'mappings') is distinct from 'array' then raise exception using errcode='PT422',message='Role and mappings required';end if;
  v_record:=jsonb_set(v_record,'{role}',(v_record->'role')-array['created_at','updated_at']);
  if exists(select 1 from jsonb_object_keys(v_record->'role') k where not(k=any(array['id','title','department','business_area','career_level','skills_tags','progression','status']))) then raise exception using errcode='PT422',message='Unsupported role fields';end if;
  for v_row in select value from jsonb_array_elements(v_record->'mappings') loop
   if jsonb_typeof(v_row)<>'object' then raise exception using errcode='PT422',message='Invalid mapping record';end if;
   if exists(select 1 from jsonb_object_keys(v_row) k where not(k=any(array['id','role_id','apprenticeship_standard_id','recommendation_type','priority','business_rationale','funding_route','delivery_preference'])))
     or (v_row ? 'role_id' and v_row->>'role_id' is distinct from p_entity_id) then raise exception using errcode='PT422',message='Unsupported mapping identity or fields';end if;
  end loop;
 end if;
 if exists(select 1 from jsonb_object_keys(v_record) k where not(k=any(v_fields))) then raise exception using errcode='PT422',message='Unsupported record fields';end if;
 if v_record ? v_key and v_record->>v_key is distinct from p_entity_id then raise exception using errcode='PT422',message='Record identity mismatch';end if;
 if p_action='saveRole' and v_record->'role'->>'id' is distinct from p_entity_id then raise exception using errcode='PT422',message='Role identity mismatch';end if;
 v_entity:=v_table||':'||p_entity_id;v_hash:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'record',v_record)::text,'UTF8')),'hex');
 if v_table='levytate_organisations' then
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',v_table) into v_old using v_target;
 else execute format('select to_jsonb(t) from public.%I t where organisation_id=$1 and %I=$2 for update',v_table,v_key) into v_old using v_target,p_entity_id;end if;
 v_exists:=v_old is not null;
 select * into v_receipt from public.levytate_workspace_command_receipts where organisation_id=v_target and entity_key=v_entity and base_revision=p_expected_revision;
 if found then
  if v_receipt.actor_user_id=p_actor_user_id and v_receipt.command_hash=v_hash then return v_receipt.result||jsonb_build_object('replayed',true);end if;
  raise exception using errcode='PT409',message='Revision already used by another command';end if;
 select revision into v_revision from public.levytate_workspace_entity_versions where organisation_id=v_target and entity_key=v_entity;
 if coalesce(v_revision,0)<>p_expected_revision then raise exception using errcode='PT409',message='Record changed; refresh before retrying';end if;
 if (p_action like 'archive%' or p_action in ('removeProviderProgramme','updateMatchingStatus','saveProfile')) and not v_exists then raise exception using errcode='PT404',message='Record not found';end if;
 if p_action like 'archive%' then
  if v_record->>'status' is null or v_record->>'status' not in ('Active','Archived') then raise exception using errcode='PT422',message='Explicit archive state required';end if;
  if p_action='archiveProviderProgramme' then v_record:=jsonb_build_object('record_status',v_record->>'status');end if;
 end if;
 if p_action='saveEmployee' then
  if not(v_record ?& array['employee_number','name','email','job_title','department','platform_role','status','start_date'])
   or nullif(btrim(v_record->>'employee_number'),'') is null or nullif(btrim(v_record->>'name'),'') is null
   or nullif(btrim(v_record->>'job_title'),'') is null or nullif(btrim(v_record->>'department'),'') is null
   or coalesce(v_record->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or coalesce(v_record->>'platform_role','') not in ('Employee','Line Manager','Department Head','Apprenticeship Lead')
   or coalesce(v_record->>'status','') not in ('Active','Archived') then raise exception using errcode='PT422',message='Valid People identity and role required';end if;
  v_record:=v_record||jsonb_build_object('email',lower(btrim(v_record->>'email')));
 end if;
 if p_action in ('saveEmployee','archiveEmployee') and v_exists and
  (coalesce(v_record->>'email',v_old->>'email')<>v_old->>'email' or coalesce(v_record->>'platform_role',v_old->>'platform_role')<>v_old->>'platform_role'
   or coalesce(v_record->>'status',v_old->>'status')='Archived') then
  if lower(btrim(v_old->>'email'))=lower(btrim(v_actor.email)) then raise exception using errcode='PT403',message='Another administrator must revoke this account';end if;
  update public.levytate_users set active=false,auth_subject=null,auth_binding_status='pending',auth_bound_at=null,invitation_status='revoked',
   invitation_generation=invitation_generation+1,invitation_expires_at=null,updated_at=v_now
   where organisation_id=v_target and lower(btrim(email))=lower(btrim(v_old->>'email')) and (active or invitation_status<>'revoked');
  get diagnostics v_revoked_memberships=row_count;
 end if;
 if p_action='saveEmployeeDevelopmentProfile' and (v_record->>'stage' is null or v_record->>'stage' not in ('role_context','future_capability','recommendation_ready')) then raise exception using errcode='PT422',message='Valid discovery stage required';end if;
 if p_action in ('saveMatchingRequest','updateMatchingStatus') and (v_record->>'status' is null or v_record->>'status' not in ('Submitted','Under Review','Provider Shortlist Being Prepared','Shortlist Ready')) then raise exception using errcode='PT422',message='Valid matching state required';end if;
 if p_action='saveMatchingRequest' and (nullif(btrim(v_record->>'role_need'),'') is null or jsonb_typeof(v_record->'learner_count') is distinct from 'number'
   or (v_record->>'learner_count')::numeric not between 1 and 100000 or (v_record->>'learner_count')::numeric<>trunc((v_record->>'learner_count')::numeric)) then raise exception using errcode='PT422',message='Valid matching need and whole learner count required';end if;
 if p_action='saveMatchingRequest' then v_record:=v_record||jsonb_build_object('apprenticeship_standard_id',coalesce(v_record->>'linked_standard_id',''));end if;
 if p_action='saveProvider' and (nullif(btrim(v_record->>'provider_name'),'') is null or coalesce(v_record->>'status','') not in ('Active','Archived') or coalesce(v_record->>'verification_status','') not in ('verified','needs_verification')) then raise exception using errcode='PT422',message='Valid provider name and states required';end if;
 if p_action='saveProviderRelationship' and coalesce(v_record->>'status','') not in ('Preferred','Review due','Alternative required') then raise exception using errcode='PT422',message='Valid provider relationship state required';end if;
 if p_action='saveProviderProgramme' then
  select * into v_standard from public.levytate_apprenticeship_standards where id=v_record->>'linked_standard_id' and status='Approved for delivery';
  if not found then raise exception using errcode='PT422',message='Approved official standard required';end if;
  v_record:=v_record||jsonb_build_object('apprenticeship_standard_id',v_standard.id,'linked_standard_name',v_standard.title,'level',v_standard.level,'route',coalesce(v_standard.route,v_standard.occupational_route,''),'funding_band',v_standard.funding_band,'official_url',coalesce(v_standard.official_url,''));
 end if;
 if p_action='saveRole' then
  perform public.levytate_save_role(v_target,p_actor_user_id,v_record->'role',v_record->'mappings');
 elsif p_action in ('saveOrganisationProvider','saveOrganisationProgramme') then
  perform public.levytate_select_catalogue(v_target,p_actor_user_id,case when p_action='saveOrganisationProvider' then 'provider' else 'programme' end,p_entity_id,v_record->>'provider_id',v_record->>'status');
 elsif p_action='removeProviderProgramme' then execute format('delete from public.%I where organisation_id=$1 and %I=$2',v_table,v_key) using v_target,p_entity_id;
 else
  -- Validate JSON types before PostgreSQL can coerce untrusted scalars.
  for v_attr in select a.attname,t.typname,t.typcategory from pg_attribute a join pg_type t on t.oid=a.atttypid where a.attrelid=('public.'||v_table)::regclass and a.attnum>0 and not a.attisdropped and v_record ? a.attname loop
   if v_record->v_attr.attname='null'::jsonb then continue;end if;
   if v_attr.typcategory in ('S','D') and jsonb_typeof(v_record->v_attr.attname)<>'string' then raise exception using errcode='PT422',message='Text/date field has wrong type';end if;
   if v_attr.typcategory='S' and length(v_record->>v_attr.attname)>20000 then raise exception using errcode='PT422',message='Text field is too long';end if;
   if v_attr.typcategory='N' and jsonb_typeof(v_record->v_attr.attname)<>'number' then raise exception using errcode='PT422',message='Number field has wrong type';end if;
   if v_attr.typname in ('int2','int4','int8') and (v_record->>v_attr.attname)::numeric<>trunc((v_record->>v_attr.attname)::numeric) then raise exception using errcode='PT422',message='Whole number required';end if;
   if v_attr.typname='jsonb' and v_attr.attname not in ('conversation_profile','recommendation_result') and jsonb_typeof(v_record->v_attr.attname)<>'array' then raise exception using errcode='PT422',message='List field has wrong type';end if;
   if v_attr.typname='jsonb' and v_attr.attname in ('conversation_profile','recommendation_result') and jsonb_typeof(v_record->v_attr.attname)<>'object' then raise exception using errcode='PT422',message='Profile field has wrong type';end if;
   if v_attr.typname='jsonb' and jsonb_typeof(v_record->v_attr.attname)='array' then
    if jsonb_array_length(v_record->v_attr.attname)>100 then raise exception using errcode='PT422',message='Too many list entries';end if;
    if v_attr.attname not in ('priorities','conversation_history') and exists(select 1 from jsonb_array_elements(v_record->v_attr.attname) x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>1000) then raise exception using errcode='PT422',message='List entries must be bounded text';end if;
    if v_attr.attname in ('priorities','conversation_history') and exists(select 1 from jsonb_array_elements(v_record->v_attr.attname) x where jsonb_typeof(x)<>'object') then raise exception using errcode='PT422',message='Structured list entries must be objects';end if;
   end if;
  end loop;
  v_row:=v_record||jsonb_build_object(v_key,p_entity_id);
  if v_table<>'levytate_organisations' then v_row:=v_row||jsonb_build_object('organisation_id',v_target);end if;
  if exists(select 1 from pg_attribute where attrelid=('public.'||v_table)::regclass and attname='updated_at') then v_row:=v_row||jsonb_build_object('updated_at',v_now);end if;
  if not v_exists and exists(select 1 from pg_attribute where attrelid=('public.'||v_table)::regclass and attname='created_at') then v_row:=v_row||jsonb_build_object('created_at',v_now);end if;
  select string_agg(format('%I',k),',' order by k),string_agg(format('x.%I',k),',' order by k),string_agg(format('%I=x.%I',k,k),',' order by k)
   into v_columns,v_values,v_updates from jsonb_object_keys(v_row) k;
  if v_exists then
   if v_table='levytate_organisations' then execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$3) x where t.id=$1',v_table,v_updates,v_table) using v_target,p_entity_id,v_row;
   else execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$3) x where t.organisation_id=$1 and t.%I=$2',v_table,v_updates,v_table,v_key) using v_target,p_entity_id,v_row;end if;
  else execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) x',v_table,v_columns,v_values,v_table) using v_row;end if;
 end if;
 -- A semantically identical command still advances its receipt generation.
 insert into public.levytate_workspace_entity_versions values(v_target,v_entity,p_expected_revision+1)
 on conflict(organisation_id,entity_key) do update set revision=greatest(levytate_workspace_entity_versions.revision,excluded.revision) returning revision into v_revision;
 if not v_inner_audit then
 insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
 values(gen_random_uuid(),v_target,v_actor.email,v_actor.role,v_table,p_entity_id,
 case p_action when 'saveEmployee' then 'employee.saved' when 'archiveEmployee' then case when v_record->>'status'='Archived' then 'employee.archived' else 'employee.restored' end else 'workspace.'||p_action end,
 'Workspace record changed atomically.',jsonb_build_object('expectedRevision',p_expected_revision,'revision',v_revision,'previousStatus',v_old->>'status','status',v_record->>'status','revokedMemberships',v_revoked_memberships));
 end if;
 v_result:=jsonb_build_object('entityKey',v_entity,'revision',v_revision,'replayed',false);
 insert into public.levytate_workspace_command_receipts values(v_target,v_entity,p_expected_revision,p_actor_user_id,v_hash,v_result,v_now);
 return v_result;
exception when unique_violation then raise exception using errcode='PT409',message='Concurrent or duplicate record; no partial save';
 when not_null_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception using errcode='PT422',message='Invalid record details; no partial save';
end; $$;
revoke all on function public.levytate_workspace_command(uuid,uuid,text,text,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_workspace_command(uuid,uuid,text,text,bigint,jsonb) to service_role;
