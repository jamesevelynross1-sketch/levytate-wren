-- LOCAL REVIEW CANDIDATE ONLY. Requires explicit managed-platform compatibility
-- review before any hosted installation. Supabase recommends leaving its
-- managed storage schema unchanged; this narrow I/U trigger is an intentional
-- dependency, not a claim of provider endorsement. All object creation/removal
-- still uses the Storage API. Never delete managed metadata directly.

-- Technical ownership tombstones contain only a tenant UUID and a SHA-256 key
-- digest. They survive tenant/evidence erasure so an old legacy path can never
-- become unclassified and bypass the boundary. No path, filename, email, actor
-- or object bytes are stored here. This retained security record needs an
-- explicit legal/privacy decision before real-client activation.
create table public.levytate_storage_ownership_boundaries(
 object_key_hash text primary key check(object_key_hash ~ '^[a-f0-9]{64}$'),
 tenant_id uuid not null
);
alter table public.levytate_storage_ownership_boundaries enable row level security;
revoke all on public.levytate_storage_ownership_boundaries from public,anon,authenticated,service_role;

do $$ begin
 if exists(select 1 from public.levytate_file_assets group by bucket_name,object_path having count(distinct organisation_id)>1) then
  raise exception 'Storage ownership must be resolved before the boundary can be installed';end if;
end; $$;
insert into public.levytate_storage_ownership_boundaries(object_key_hash,tenant_id)
 select distinct encode(sha256(convert_to(bucket_name||E'\n'||object_path,'UTF8')),'hex'),organisation_id from public.levytate_file_assets;

create function public.levytate_record_storage_ownership_boundary() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare key_hash text;owner_id uuid;segment text;
begin
 segment:=split_part(new.object_path,'/',1);
 if segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and segment::uuid<>new.organisation_id then
  raise exception using errcode='PT409',message='Registered Storage namespace must match its tenant';end if;
 key_hash:=encode(sha256(convert_to(new.bucket_name||E'\n'||new.object_path,'UTF8')),'hex');
 insert into public.levytate_storage_ownership_boundaries(object_key_hash,tenant_id)
  values(key_hash,new.organisation_id) on conflict do nothing;
 select tenant_id into owner_id from public.levytate_storage_ownership_boundaries where object_key_hash=key_hash;
 if owner_id is distinct from new.organisation_id then raise exception using errcode='PT409',message='Storage path ownership cannot be reassigned';end if;
 return new;
end; $$;
create trigger levytate_record_storage_ownership_boundary before insert or update on public.levytate_file_assets
 for each row execute function public.levytate_record_storage_ownership_boundary();

create function public.levytate_storage_object_tenant(p_bucket text,p_path text) returns uuid
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare namespace_id uuid;registered uuid;key_hash text;segment text;
begin
 if p_bucket not in('levytate-organisations','levytate-provider-documents','levytate-uploads','levytate-guidance-sources') then return null;end if;
 segment:=split_part(p_path,'/',1);
 if segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then namespace_id:=segment::uuid;end if;
 key_hash:=encode(sha256(convert_to(p_bucket||E'\n'||p_path,'UTF8')),'hex');
 select tenant_id into registered from public.levytate_storage_ownership_boundaries where object_key_hash=key_hash;
 if registered is not null and namespace_id is not null and registered<>namespace_id then
  raise exception using errcode='PT409',message='Storage tenant ownership is inconsistent';end if;
 if coalesce(namespace_id,registered) is null then
  raise exception using errcode='PT409',message='Storage object needs a reviewed tenant namespace or registered ownership';end if;
 return coalesce(namespace_id,registered);
end; $$;

create function public.levytate_storage_lifecycle_write_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare previous_tenant uuid;next_tenant uuid;target uuid;
begin
 if tg_op='UPDATE' then previous_tenant:=public.levytate_storage_object_tenant(old.bucket_id,old.name);end if;
 next_tenant:=public.levytate_storage_object_tenant(new.bucket_id,new.name);
 if tg_op='UPDATE' and previous_tenant is distinct from next_tenant then
  raise exception using errcode='PT409',message='Storage object cannot change tenant scope';end if;
 for target in select distinct t from unnest(array[previous_tenant,next_tenant]) t where t is not null order by t loop
  perform pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||target::text,0));
  -- Lock/recheck after any wait. Suspension blocks a request which passed the
  -- provider's pre-upload probe but is still sending bytes at this point.
  perform 1 from public.levytate_organisations where id=target and status='Active' for share;
  if not found or exists(select 1 from public.levytate_tenant_offboarding_cases
   where tenant_id=target and status in('approved','exported','deleting','completed')) then
   raise exception using errcode='PT409',message='Tenant lifecycle blocks Storage writes';end if;
 end loop;
 return new;
end; $$;
create trigger levytate_storage_lifecycle_write_guard before insert or update on storage.objects
 for each row execute function public.levytate_storage_lifecycle_write_guard();

create function public.levytate_offboarding_assert_storage_boundary() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass
  and tgname='levytate_storage_lifecycle_write_guard' and tgenabled='O'
  and tgfoid=to_regprocedure('public.levytate_storage_lifecycle_write_guard()'))
  or not exists(select 1 from pg_trigger where tgrelid='public.levytate_file_assets'::regclass
   and tgname='levytate_record_storage_ownership_boundary' and tgenabled='O') then
  raise exception using errcode='PT409',message='Storage lifecycle boundary requires independent review';end if;
end; $$;
revoke all on function public.levytate_record_storage_ownership_boundary(),public.levytate_storage_object_tenant(text,text),
 public.levytate_storage_lifecycle_write_guard(),public.levytate_offboarding_assert_storage_boundary()
 from public,anon,authenticated,service_role;
