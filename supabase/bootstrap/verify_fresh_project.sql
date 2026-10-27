\set ON_ERROR_STOP on

do $$
declare
  application_table_count integer;
  rls_table_count integer;
  lift_table_count integer;
  browser_grant_count integer;
  service_ddl_grant_count integer;
  public_rpc_grant_count integer;
  required_rpc_grant_count integer;
  unused_lift_update_grant_count integer;
  foreign_key_count integer;
  browser_sequence_grant_count integer;
  unexpected_service_sequence_grant_count integer;
  unexpected_owner_count integer;
begin
  select count(*), count(*) filter (where c.relrowsecurity),
         count(*) filter (where c.relname like 'levytate\_lift\_%' escape '\')
  into application_table_count, rls_table_count, lift_table_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (c.relname like 'levytate\_%' escape '\' or c.relname like 'provider\_intelligence\_%' escape '\');

  if application_table_count <> 113 or rls_table_count <> 113 or lift_table_count <> 19 then
    raise exception 'unexpected table/RLS counts: %, %, %', application_table_count, rls_table_count, lift_table_count;
  end if;

  select count(*) into browser_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated')
    and (table_name like 'levytate\_%' escape '\' or table_name like 'provider\_intelligence\_%' escape '\');
  if browser_grant_count <> 0 then raise exception 'browser table grants found: %', browser_grant_count; end if;

  select count(*) into service_ddl_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'service_role'
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
    and (table_name like 'levytate\_%' escape '\' or table_name like 'provider\_intelligence\_%' escape '\');
  if service_ddl_grant_count <> 0 then raise exception 'broad service grants found: %', service_ddl_grant_count; end if;

  select count(*) into unused_lift_update_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'service_role' and privilege_type = 'UPDATE'
    and table_name = any(array[
      'levytate_lift_campaigns', 'levytate_lift_decision_assumptions',
      'levytate_lift_decisions', 'levytate_lift_employee_observation_contexts',
      'levytate_lift_evidence_records', 'levytate_lift_interpretations',
      'levytate_lift_opportunities', 'levytate_lift_opportunity_candidates',
      'levytate_lift_opportunity_evidence', 'levytate_lift_opportunity_route_members',
      'levytate_lift_proof_events', 'levytate_lift_team_context_revisions'
    ]);
  if unused_lift_update_grant_count <> 0 then
    raise exception 'unused Lift update grants found: %', unused_lift_update_grant_count;
  end if;

  select count(*) into browser_sequence_grant_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) acl
  where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'levytate\_%' escape '\'
    and (acl.grantee = 0 or pg_get_userbyid(acl.grantee) in ('anon', 'authenticated'));
  if browser_sequence_grant_count <> 0 then
    raise exception 'browser/public sequence grants found: %', browser_sequence_grant_count;
  end if;

  select count(*) into unexpected_service_sequence_grant_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) acl
  where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'levytate\_%' escape '\'
    and pg_get_userbyid(acl.grantee) = 'service_role'
    and not (
      c.relname in ('levytate_auth_email_delivery_events_id_seq', 'levytate_auth_security_events_id_seq')
      and acl.privilege_type in ('SELECT', 'USAGE')
    );
  if unexpected_service_sequence_grant_count <> 0 then
    raise exception 'unexpected service sequence grants found: %', unexpected_service_sequence_grant_count;
  end if;

  select count(*) into public_rpc_grant_count
  from information_schema.routine_privileges
  where routine_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated')
    and routine_name like 'levytate\_%' escape '\' and privilege_type = 'EXECUTE';
  if public_rpc_grant_count <> 0 then raise exception 'browser/public function grants found: %', public_rpc_grant_count; end if;

  select count(*) into required_rpc_grant_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array[
      'levytate_cleanup_auth_email_delivery_events', 'levytate_cleanup_auth_rate_limits',
      'levytate_consume_auth_rate_limit', 'levytate_consume_pastoral_rate_limit',
      'levytate_mutate_provider_membership', 'levytate_persist_service_request_action',
      'levytate_publish_application_workflow', 'levytate_publish_otj_plan',
      'levytate_record_otj_confirmation', 'levytate_start_application_workflow',
      'levytate_submit_otj_activity', 'levytate_submit_pastoral_support_request',
      'levytate_transition_application_workflow', 'levytate_transition_otj_activity',
      'levytate_transition_pastoral_support_request', 'levytate_validate_application_workflow_steps'
    ])
    and has_function_privilege('service_role', p.oid, 'EXECUTE');
  if required_rpc_grant_count <> 16 then raise exception 'required service function grants: %', required_rpc_grant_count; end if;

  select count(*) into foreign_key_count
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and c.contype = 'f'
    and (t.relname like 'levytate\_%' escape '\' or t.relname like 'provider\_intelligence\_%' escape '\');
  if foreign_key_count <> 257 then raise exception 'unexpected foreign key count: %', foreign_key_count; end if;
  if (select count(*) from pg_constraint where contype = 'f' and not convalidated) <> 0 then
    raise exception 'unvalidated foreign keys found';
  end if;
  if (select count(*) from pg_index where not indisvalid) <> 0 then raise exception 'invalid indexes found'; end if;

  if (select count(*) from storage.buckets where id like 'levytate-%') <> 4
     or (select count(*) from storage.buckets where id like 'levytate-%' and public) <> 0 then
    raise exception 'private Storage bucket parity failed';
  end if;

  if (select count(*) from public.levytate_standard_otj_requirements) <> 2
     or (select count(*) from public.levytate_assessment_framework_versions) <> 3
     or (select count(*) from public.levytate_lift_framework_versions) <> 1 then
    raise exception 'required migration-owned reference rows are missing';
  end if;

  if (select count(*) from public.levytate_apprenticeship_standards) <> 0 then
    raise exception 'unapproved apprenticeship catalogue data was loaded';
  end if;

  select count(*) into unexpected_owner_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and (c.relname like 'levytate\_%' escape '\' or c.relname like 'provider\_intelligence\_%' escape '\')
    and pg_get_userbyid(c.relowner) <> 'postgres';
  if unexpected_owner_count <> 0 then raise exception 'unexpected application table owners: %', unexpected_owner_count; end if;
  if (select count(*) from public.levytate_organisations) <> 0
     or (select count(*) from public.levytate_users) <> 0
     or (select count(*) from public.levytate_employees) <> 0 then
    raise exception 'fresh bootstrap contains employer or workforce records';
  end if;

  if to_regclass('public.levytate_pastoral_support_actions') is not null
     or to_regclass('public.levytate_pastoral_support_action_events') is not null then
    raise exception 'migration 038 objects are present';
  end if;

  if (select array_agg(version order by version) from supabase_migrations.schema_migrations)
     <> array['20261027174133', '20261027190000']::text[] then
    raise exception 'unexpected migration ledger';
  end if;
end
$$;

-- An untrusted Data API role cannot read even when it forges tenant context.
begin;
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
select set_config('request.jwt.claims', '{"role":"authenticated","organisation_id":"00000000-0000-0000-0000-000000000001"}', true);
do $$
begin
  begin
    perform count(*) from public.levytate_organisations;
    raise exception 'authenticated unexpectedly read an application table';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
rollback;

begin;
set local role anon;
do $$
begin
  begin
    perform count(*) from public.levytate_users;
    raise exception 'anon unexpectedly read an application table';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
rollback;

-- The server role can execute the actual readiness dependency and core writes.
begin;
set local role service_role;
set local "request.jwt.claim.role" = 'service_role';
insert into public.levytate_organisations (id, name, slug)
values ('00000000-0000-0000-0000-000000000101', 'Bootstrap verification', 'bootstrap-verification');
insert into public.levytate_users (id, organisation_id, email, role, access_level)
values (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000101',
  'fictional-bootstrap@example.invalid',
  'Apprenticeship Lead',
  'beta_user'
);
insert into public.levytate_application_workflows (id, organisation_id, name)
values (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000101',
  'Bootstrap workflow verification'
);
insert into public.levytate_application_workflow_versions (
  id, organisation_id, workflow_id, version_number, status, steps, created_by
) values (
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000103',
  1,
  'draft',
  '[{"id":"employee-submit","label":"Employee submission","type":"employee_submission","responsibleRole":"Employee","allowDecline":false},{"id":"lead-review","label":"Lead review","type":"role_review","responsibleRole":"Apprenticeship Lead","allowDecline":false},{"id":"provider-handoff","label":"Provider handoff","type":"provider_handoff","responsibleRole":"Provider Partner","allowDecline":false}]'::jsonb,
  '00000000-0000-0000-0000-000000000102'
);
select public.levytate_consume_auth_rate_limit(
  'local', 'health.readiness', repeat('0', 64), 60, 10000,
  '/api/levytate-health/ready', 'health_readiness_rate_limited', timezone('utc', now())
);
rollback;

select 'LG-01A fresh-project verification passed' as result;
