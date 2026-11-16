-- Candidate only: local review/tests; no hosted execution approval.
-- The reviewed bootstrap intentionally withholds direct rate-limit table access.
-- Inspect only the failed-callback bucket, without consuming successful logins
-- or granting the service role general table reads. Transport/token caps remain
-- enforced by the existing atomic consume RPC before this check.
create function public.levytate_check_auth_callback_failures(
  p_environment_namespace text,
  p_key_hash text
)
returns table (allowed boolean, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_start timestamptz;
  v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_environment_namespace is null or p_environment_namespace not in ('local', 'preview', 'production')
    or p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid callback budget parameters' using errcode = '22023';
  end if;
  -- Same fixed 10 failures / 900 second window as invalidCallbackNetwork.
  -- Neither caller-selected limits nor caller-selected time are accepted.
  v_start := to_timestamp(floor(extract(epoch from v_now) / 900) * 900);
  select request_count into v_count from public.levytate_auth_rate_limits
    where environment_namespace = p_environment_namespace
      and action = 'magic_link.callback.failure' and key_hash = p_key_hash
      and window_start = v_start and expires_at > v_now;
  return query select coalesce(v_count, 0) < 10, v_start + interval '900 seconds';
end;
$$;
revoke all on function public.levytate_check_auth_callback_failures(text, text) from public, anon, authenticated, service_role;
grant execute on function public.levytate_check_auth_callback_failures(text, text) to service_role;
