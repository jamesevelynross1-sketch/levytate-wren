-- Regression: the old24 contract incorrectly remains available after this
-- mandatory command disappears. Dedicated empty LOCAL DB; whole test rolls back.
begin;
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()->>'available'='true','complete starting schema reports available');
reset role;
alter function public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean) rename to missing_learning_time_command;
set local role service_role;
select pg_temp.check_result(public.levytate_required_client_contracts()->>'available'='false','missing mandatory Learning Time command reports unavailable');
reset role;
rollback;
