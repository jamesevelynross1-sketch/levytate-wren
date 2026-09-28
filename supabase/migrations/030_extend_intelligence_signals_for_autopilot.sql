-- Extend the existing organisation-scoped Intelligence ledger for Operations Autopilot V1.
-- Additive only: existing signals, events, grants, RLS policies and source records are preserved.

alter table public.levytate_intelligence_signals
  add column if not exists signal_key text not null default '',
  add column if not exists lane text not null default '',
  add column if not exists autopilot_priority text not null default '',
  add column if not exists deterministic_payload jsonb not null default '{}'::jsonb,
  add column if not exists ai_interpretation jsonb,
  add column if not exists communication_draft text not null default '',
  add column if not exists suggested_action_type text not null default '';

alter table public.levytate_intelligence_signals
  drop constraint if exists levytate_intelligence_signals_entity_check,
  drop constraint if exists levytate_intelligence_signals_category_check,
  drop constraint if exists levytate_intelligence_signals_type_check;

alter table public.levytate_intelligence_signals
  add constraint levytate_intelligence_signals_entity_check check (
    entity_type in ('learner','provider','programme','organisation','application','review','operational_action')
  ),
  add constraint levytate_intelligence_signals_category_check check (
    category in ('risk','action','quality','pattern','opportunity','reviews','actions','manager_actions','applications','provider_dependencies')
  ),
  add constraint levytate_intelligence_signals_type_check check (
    signal_type in (
      'repeated_workplace_blocker','progress_deterioration','repeated_unresolved_action','manager_support_required',
      'provider_action_required','review_progress_inconsistency','repeated_support_requirement','escalating_pattern',
      'assessment_or_completion_opportunity','review_overdue','review_due_with_outstanding_actions','review_upcoming',
      'operational_action_overdue','manager_action_overdue','manager_action_due_soon','application_stalled',
      'application_awaiting_manager','application_awaiting_provider','provider_dependency_overdue'
    )
  ),
  add constraint levytate_intelligence_signals_lane_check check (
    lane in ('','needs_your_decision','ready_to_action','waiting_externally','upcoming','recently_resolved')
  ),
  add constraint levytate_intelligence_signals_autopilot_priority_check check (
    autopilot_priority in ('','action_now','this_week','upcoming')
  ),
  add constraint levytate_intelligence_signals_deterministic_payload_check check (
    jsonb_typeof(deterministic_payload) = 'object'
  ),
  add constraint levytate_intelligence_signals_ai_interpretation_check check (
    ai_interpretation is null or jsonb_typeof(ai_interpretation) = 'object'
  );

create unique index if not exists levytate_intelligence_signals_org_signal_key_unique
  on public.levytate_intelligence_signals (organisation_id, signal_key)
  where signal_key <> '';

create index if not exists levytate_intelligence_signals_org_lane_idx
  on public.levytate_intelligence_signals (organisation_id, lane, status, last_evaluated_at desc)
  where signal_key <> '';

comment on column public.levytate_intelligence_signals.signal_key is
  'Stable organisation-scoped Autopilot condition identity; evidence fingerprint changes only when material evidence changes.';
comment on column public.levytate_intelligence_signals.ai_interpretation is
  'Optional constrained AI wording derived only from deterministic_payload and evidence; never an authority or prediction.';
