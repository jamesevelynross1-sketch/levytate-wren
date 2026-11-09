-- Independent rollback-only failure injection in a dedicated local schema DB.
begin;
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
savepoint missing_function;
alter function public.levytate_reactivation_command(uuid,jsonb) rename to temporarily_missing_reactivation;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()->>'available'='false','missing required command reports unavailable rather than throwing success');
reset role;
rollback to savepoint missing_function;
savepoint absent_rls;
alter table public.levytate_tenant_reactivation_requests disable row level security;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()->>'available'='false','missing required RLS reports unavailable');
reset role;
rollback to savepoint absent_rls;
savepoint inherited_browser;
grant execute on function public.levytate_reactivation_command(uuid,jsonb) to public;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()->>'available'='false','publicly inherited browser permission reports unavailable');
reset role;
rollback to savepoint inherited_browser;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()='{"version":"20261109182509","available":true}'::jsonb,'exact release returns available after each rollback recovery');
reset role;
select pg_temp.check_result((select count(*)=0 from auth.users) and (select count(*)=0 from storage.objects) and (select count(*)=0 from supabase_migrations.schema_migrations),'probe creates no Auth Storage or fabricated ledger data');
rollback;
