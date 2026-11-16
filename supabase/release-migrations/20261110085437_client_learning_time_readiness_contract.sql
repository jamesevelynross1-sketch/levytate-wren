-- Local review candidate only. Does not activate Learning Time or change its
-- routines, evidence, capabilities, grants or migration history.
-- This is a bounded compatibility check for the reviewed 20261109193701 bodies
-- (file SHA256 209c8dedc643029186ea6959fc7d36982cad530d38e9d517935d186d69385d64).
-- pg_proc.prosrc is the literal stored body; no version-dependent catalogue
-- serialization is hashed. Matching bytes do not replace behavioural/security
-- acceptance. A future reviewed routine change must advance this contract too.
create or replace function public.levytate_required_client_contracts() returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('version','20261110085437','available',
  coalesce((select bool_and(coalesce(has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE'),false)
   and not coalesce(has_function_privilege('anon',to_regprocedure(signature),'EXECUTE'),true)
   and not coalesce(has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'),true))
   from unnest(array[
    'public.levytate_apply_application_command(uuid,uuid,text,text,integer,text,jsonb)',
    'public.levytate_apply_learner_command(uuid,uuid,text,text,text,jsonb,integer,jsonb,jsonb,boolean)',
    'public.levytate_start_pre_enrolment(uuid,uuid,text,integer,text,jsonb)',
    'public.levytate_personal_programme_choices(uuid,jsonb)',
    'public.levytate_reactivation_command(uuid,jsonb)',
    'public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)',
    'public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean)'
   ]) signature),false)
  and exists(select 1 from pg_index where indexrelid=to_regclass('public.levytate_applications_one_active_employee') and indisvalid and indisunique)
  and exists(select 1 from pg_class where oid=to_regclass('public.levytate_tenant_reactivation_requests') and relrowsecurity)
  and (select count(*)=3 from information_schema.columns where table_schema='public' and table_name='levytate_employee_development_profiles'
    and column_name in('saved_programme_ids','compared_programme_ids','discovery_revision'))
  and (select bool_and(coalesce(p.prosecdef and p.prokind='f'
    and encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=expected.source_sha256,false))
   from (values
    ('public.levytate_submit_otj_activity(uuid,uuid,uuid,text,integer)','f4bfbb3ef74b4fec3525dd4fbbc28075e3ef4c2e7c4f9cb18f92f3c6f48a8357'),
    ('public.levytate_transition_otj_activity(uuid,uuid,uuid,text,text,text,integer)','468400319d6b640b4f3d0172ddee42bbc5f9534337e3af025df801b6b7efef8d'),
    ('public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean)','294cb04cecb25b3a195d4cb0c808a7f8af0eb12ab2418d620ff292545f4ce645')
   ) expected(signature,source_sha256)
   left join pg_proc p on p.oid=to_regprocedure(expected.signature))
  and (select bool_and(coalesce(to_regprocedure(signature) is not null
    and not has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE')
    and not has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
    and not has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'),false))
   from unnest(array[
    'public.levytate_submit_otj_activity(uuid,uuid,uuid,text,integer)',
    'public.levytate_transition_otj_activity(uuid,uuid,uuid,text,text,text,integer)',
    'public.levytate_publish_otj_plan(uuid,uuid,uuid)',
    'public.levytate_record_otj_confirmation(uuid,uuid,uuid,text,integer,text,text,text,date,text,text)',
    'public.levytate_assert_learning_time_period(uuid,text,uuid,date)',
    'public.levytate_guard_learning_time_candidate()'
   ]) signature)
  and (select bool_and(coalesce(to_regclass(relation) is not null
    and has_table_privilege('service_role',to_regclass(relation),'SELECT')
    and not has_table_privilege('service_role',to_regclass(relation),'INSERT,UPDATE,DELETE,TRUNCATE')
    and not has_any_column_privilege('service_role',to_regclass(relation),'INSERT,UPDATE')
    and not has_table_privilege('anon',to_regclass(relation),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    and not has_any_column_privilege('anon',to_regclass(relation),'SELECT,INSERT,UPDATE')
    and not has_table_privilege('authenticated',to_regclass(relation),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    and not has_any_column_privilege('authenticated',to_regclass(relation),'SELECT,INSERT,UPDATE'),false))
   from unnest(array[
    'public.levytate_otj_plans','public.levytate_otj_plan_versions','public.levytate_otj_learning_priorities',
    'public.levytate_otj_activities','public.levytate_otj_activity_confirmations',
    'public.levytate_otj_activity_events','public.levytate_otj_command_receipts'
   ]) relation));
$$;
revoke all on function public.levytate_required_client_contracts() from public,anon,authenticated,service_role;
grant execute on function public.levytate_required_client_contracts() to service_role;
