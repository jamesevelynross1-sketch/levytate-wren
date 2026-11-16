-- LG-01A fresh-project Data API hardening.
-- This is the last hash-locked source in the generated convergence migration.
-- It is not part of the shared project's historical migration tree.

revoke create on schema public from public, anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

do $$
declare
  application_table record;
begin
  for application_table in
    select format('%I.%I', n.nspname, c.relname) as qualified_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and (c.relname like 'levytate\_%' escape '\' or c.relname like 'provider\_intelligence\_%' escape '\')
  loop
    execute format('alter table %s enable row level security', application_table.qualified_name);
    execute format('revoke all on table %s from public, anon, authenticated', application_table.qualified_name);
    execute format('revoke truncate, references, trigger, delete on table %s from service_role', application_table.qualified_name);
  end loop;
end
$$;

revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated, service_role;

-- The pre-021 tables had RLS but no Data API privileges. These grants match
-- the operations performed by the server-only workspace modules.
grant select, insert, update on table
  public.levytate_organisations,
  public.levytate_users,
  public.levytate_employees,
  public.levytate_employee_development_profiles,
  public.levytate_roles,
  public.levytate_applications,
  public.levytate_providers,
  public.levytate_provider_programmes,
  public.levytate_provider_relationships,
  public.levytate_matching_requests,
  public.levytate_enrolments,
  public.levytate_early_access_requests,
  public.levytate_guidance_sources,
  public.levytate_guidance_items,
  public.levytate_learner_records,
  public.levytate_learner_eligibility_declarations,
  public.levytate_learner_pre_enrolment_checks,
  public.levytate_learner_breaks_in_learning,
  public.levytate_learner_withdrawals,
  public.levytate_learner_reviews,
  public.levytate_learner_progress_updates,
  public.levytate_learner_assessment_readiness,
  public.levytate_learner_achievements,
  public.levytate_learner_operational_actions,
  public.levytate_operational_actions,
  public.levytate_prospect_access
to service_role;

grant select, insert on table
  public.levytate_application_history,
  public.levytate_audit_events,
  public.levytate_file_assets,
  public.levytate_guidance_item_sources,
  public.levytate_learner_lifecycle_events,
  public.levytate_operational_action_events
to service_role;

grant select, insert on table public.levytate_role_pathway_mappings to service_role;
grant select on table public.levytate_apprenticeship_standards to service_role;

-- The security stores are reachable through SECURITY DEFINER RPCs only. The
-- security event ledger remains insert-only to the email-delivery monitor.
revoke all on table public.levytate_auth_rate_limits from service_role;
revoke all on table public.levytate_pastoral_rate_limits from service_role;
revoke all on table public.levytate_auth_security_events from service_role;
grant insert on table public.levytate_auth_security_events to service_role;
revoke all on table public.levytate_auth_email_delivery_events from service_role;
grant select, insert on table public.levytate_auth_email_delivery_events to service_role;

-- Owner-seeded reference data and append-only evidence never receive direct
-- service-role mutation privileges.
revoke insert, update on table
  public.levytate_apprenticeship_standards,
  public.levytate_assessment_framework_versions,
  public.levytate_lift_framework_versions,
  public.levytate_standard_otj_requirements
from service_role;

revoke update on table
  public.levytate_application_history,
  public.levytate_application_workflow_events,
  public.levytate_assessment_application_links,
  public.levytate_assessment_events,
  public.levytate_assessment_results,
  public.levytate_assessment_reviews,
  public.levytate_audit_events,
  public.levytate_auth_security_events,
  public.levytate_external_connector_events,
  public.levytate_guidance_item_sources,
  public.levytate_intelligence_signal_events,
  public.levytate_learner_lifecycle_events,
  public.levytate_lift_campaigns,
  public.levytate_lift_decision_assumptions,
  public.levytate_lift_decisions,
  public.levytate_lift_employee_observation_contexts,
  public.levytate_lift_evidence_records,
  public.levytate_lift_interpretations,
  public.levytate_lift_opportunities,
  public.levytate_lift_opportunity_candidates,
  public.levytate_lift_opportunity_evidence,
  public.levytate_lift_opportunity_route_members,
  public.levytate_lift_proof_events,
  public.levytate_lift_team_context_revisions,
  public.levytate_operational_action_events,
  public.levytate_otj_activity_confirmations,
  public.levytate_otj_activity_events,
  public.levytate_pastoral_audit_events,
  public.levytate_service_request_agreements,
  public.levytate_service_request_events,
  public.levytate_service_request_handovers,
  public.levytate_service_request_response_versions,
  public.levytate_service_request_versions
from service_role;

-- Runtime deletes are limited to replacement sets and transactional rollback.
grant delete on table
  public.levytate_application_history,
  public.levytate_finance_imports,
  public.levytate_guidance_item_sources,
  public.levytate_organisations,
  public.levytate_pastoral_conversations,
  public.levytate_provider_programmes,
  public.levytate_role_pathway_mappings,
  public.levytate_users
to service_role;

grant usage, select on sequence public.levytate_auth_email_delivery_events_id_seq to service_role;
grant usage, select on sequence public.levytate_auth_security_events_id_seq to service_role;

-- Only server-invoked RPCs and the workflow CHECK validator are exposed.
-- Trigger-only helpers keep no direct Data API EXECUTE grant.
do $$
declare
  application_function record;
begin
  for application_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'levytate_cleanup_auth_email_delivery_events',
        'levytate_cleanup_auth_rate_limits',
        'levytate_consume_auth_rate_limit',
        'levytate_consume_pastoral_rate_limit',
        'levytate_mutate_provider_membership',
        'levytate_persist_service_request_action',
        'levytate_publish_application_workflow',
        'levytate_publish_otj_plan',
        'levytate_record_otj_confirmation',
        'levytate_start_application_workflow',
        'levytate_submit_otj_activity',
        'levytate_submit_pastoral_support_request',
        'levytate_transition_application_workflow',
        'levytate_transition_otj_activity',
        'levytate_transition_pastoral_support_request',
        'levytate_validate_application_workflow_steps'
      ])
  loop
    execute format('grant execute on function %s to service_role', application_function.signature);
  end loop;

  -- Lock SECURITY DEFINER name resolution to system names and the now
  -- non-creatable public schema.
  for application_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('alter function %s set search_path to pg_catalog, public', application_function.signature);
  end loop;
end
$$;
