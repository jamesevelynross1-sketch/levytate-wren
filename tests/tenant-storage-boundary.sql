-- Schema-only synthetic metadata in the exclusive LOCAL test DB. No actual
-- Storage bytes exist here. Real API/in-flight cleanup requires a separate drill.
begin;
create function pg_temp.check_test(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end; $$;
create function pg_temp.denied(statement text,label text) returns void language plpgsql as $$
declare actual text;
begin begin execute statement;exception when others then get stacked diagnostics actual=returned_sqlstate;end;
 perform pg_temp.check_test(actual='PT409',label);end; $$;
insert into public.levytate_organisations(id,name,slug,workspace_template,status) values
 ('41000000-0000-4000-8000-000000000001','Synthetic Storage A','storage-boundary-a','levytate-client-v1','Active'),
 ('41000000-0000-4000-8000-000000000002','Synthetic Storage B','storage-boundary-b','levytate-client-v1','Active');
select pg_temp.check_test(not has_table_privilege('service_role','public.levytate_storage_ownership_boundaries','INSERT')
 and not has_function_privilege('authenticated','public.levytate_storage_object_tenant(text,text)','EXECUTE'),'ownership tombstones have no client/service direct writes or browser reads');
insert into public.levytate_file_assets(organisation_id,entity_type,entity_id,bucket_name,object_path,original_name,uploaded_by_email)
 values('41000000-0000-4000-8000-000000000002','synthetic','test','outside-reviewed-bucket','41000000-0000-4000-8000-000000000002/outside.txt','Synthetic','fictional@example.test');
select pg_temp.denied($q$select public.levytate_offboarding_storage_inventory('41000000-0000-4000-8000-000000000002')$q$,'unreviewed bucket prevents export and disposal');
insert into storage.objects(bucket_id,name,version,metadata) values
 ('levytate-uploads','41000000-0000-4000-8000-000000000001/fixture.txt',gen_random_uuid(),'{}');
select pg_temp.check_test((select count(*)=1 from storage.objects where name='41000000-0000-4000-8000-000000000001/fixture.txt'),'active tenant metadata allowed');
select pg_temp.denied($q$insert into storage.objects(bucket_id,name,version) values('levytate-uploads','unclassified/fixture.txt',gen_random_uuid())$q$,'unknown path fails closed');
select pg_temp.denied($q$insert into storage.objects(bucket_id,name,version) values('levytate-uploads','41000000-0000-4000-8000-000000000003/fixture.txt',gen_random_uuid())$q$,'missing tenant fails closed');
select pg_temp.denied($q$update storage.objects set name='41000000-0000-4000-8000-000000000002/fixture.txt' where name='41000000-0000-4000-8000-000000000001/fixture.txt'$q$,'metadata move cannot cross tenant scope');
update public.levytate_organisations set status='Suspended' where id='41000000-0000-4000-8000-000000000001';
select pg_temp.denied($q$insert into storage.objects(bucket_id,name,version) values('levytate-uploads','41000000-0000-4000-8000-000000000001/new.txt',gen_random_uuid())$q$,'suspended tenant new object denied');
select pg_temp.denied($q$update storage.objects set version=gen_random_uuid() where name='41000000-0000-4000-8000-000000000001/fixture.txt'$q$,'suspended tenant replacement denied');
insert into storage.objects(bucket_id,name,version) values('levytate-uploads','41000000-0000-4000-8000-000000000002/fixture.txt',gen_random_uuid());
select pg_temp.check_test((select count(*)=1 from storage.objects where name='41000000-0000-4000-8000-000000000002/fixture.txt'),'second tenant remains writable');
-- An unreferenced tenant row may be removed in this schema-only fixture. The
-- surviving UUID namespace and legacy hash both deny writes after erasure.
insert into public.levytate_storage_ownership_boundaries values(encode(sha256(convert_to('levytate-uploads'||E'\n'||'legacy/fixture.txt','UTF8')),'hex'),'41000000-0000-4000-8000-000000000001');
delete from public.levytate_organisations where id='41000000-0000-4000-8000-000000000001';
select pg_temp.denied($q$insert into storage.objects(bucket_id,name,version) values('levytate-uploads','41000000-0000-4000-8000-000000000001/late.txt',gen_random_uuid())$q$,'deleted tenant cannot accept a late upload');
select pg_temp.denied($q$insert into storage.objects(bucket_id,name,version) values('levytate-uploads','legacy/fixture.txt',gen_random_uuid())$q$,'legacy tombstone survives tenant removal');
select public.levytate_offboarding_assert_storage_boundary();
drop function public.levytate_storage_lifecycle_write_guard() cascade;
select pg_temp.denied($q$select public.levytate_offboarding_assert_inventory()$q$,'removed managed guard prevents offboarding completion');
rollback;
