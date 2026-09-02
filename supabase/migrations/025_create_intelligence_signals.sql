-- Persistent organisation-scoped Progress Review Intelligence signals for LevyTate Client V1.
-- Additive only: existing workspace and learner data is not altered.
create table public.levytate_intelligence_signals (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  id text not null,
  fingerprint text not null,
  entity_type text not null,
  entity_id text not null,
  learner_record_id text,
  provider_id text,
  programme_id text,
  category text not null,
  signal_type text not null,
  title text not null,
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence text not null,
  priority text not null,
  recommended_action text not null default '',
  suggested_owner_type text not null default '',
  suggested_due_date date,
  status text not null default 'new',
  linked_operational_action_id text,
  analyser_version text not null,
  model_identifier text not null default '',
  detected_at timestamptz not null default timezone('utc', now()),
  last_evaluated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  acknowledged_by text not null default '',
  acknowledged_at timestamptz,
  dismissed_by text not null default '',
  dismissed_at timestamptz,
  dismissal_reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_intelligence_signals_fingerprint_unique unique (organisation_id, fingerprint),
  constraint levytate_intelligence_signals_learner_fk foreign key (organisation_id, learner_record_id)
    references public.levytate_learner_records (organisation_id, id) on delete restrict,
  constraint levytate_intelligence_signals_entity_check check (entity_type in ('learner','provider','programme','organisation')),
  constraint levytate_intelligence_signals_category_check check (category in ('risk','action','quality','pattern','opportunity')),
  constraint levytate_intelligence_signals_type_check check (signal_type in ('repeated_workplace_blocker','progress_deterioration','repeated_unresolved_action','manager_support_required','provider_action_required','review_progress_inconsistency','repeated_support_requirement','escalating_pattern','assessment_or_completion_opportunity')),
  constraint levytate_intelligence_signals_confidence_check check (confidence in ('High','Medium','Low')),
  constraint levytate_intelligence_signals_priority_check check (priority in ('Critical','High','Medium','Low')),
  constraint levytate_intelligence_signals_status_check check (status in ('new','acknowledged','accepted','dismissed','resolved')),
  constraint levytate_intelligence_signals_owner_check check (suggested_owner_type in ('','Employee','Line Manager','Apprenticeship Lead','HR','Provider','Shared')),
  constraint levytate_intelligence_signals_evidence_check check (jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)>0)
);
create index levytate_intelligence_signals_org_status_idx on public.levytate_intelligence_signals (organisation_id,status,priority,detected_at desc);
create index levytate_intelligence_signals_learner_idx on public.levytate_intelligence_signals (organisation_id,learner_record_id,last_evaluated_at desc);

create table public.levytate_intelligence_signal_events (
  organisation_id uuid not null,
  id text not null,
  signal_id text not null,
  event_type text not null,
  previous_status text not null default '',
  new_status text not null default '',
  actor_user_id text not null default '',
  actor_name text not null default '',
  event_date timestamptz not null default timezone('utc', now()),
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id,id),
  constraint levytate_intelligence_signal_events_signal_fk foreign key (organisation_id,signal_id)
    references public.levytate_intelligence_signals (organisation_id,id) on delete restrict,
  constraint levytate_intelligence_signal_events_type_check check (event_type in ('detected','updated','acknowledged','accepted','dismissed','resolved','regenerated'))
);
create index levytate_intelligence_signal_events_signal_idx on public.levytate_intelligence_signal_events (organisation_id,signal_id,event_date desc);

alter table public.levytate_intelligence_signals enable row level security;
alter table public.levytate_intelligence_signal_events enable row level security;
revoke all on public.levytate_intelligence_signals from anon, authenticated;
revoke all on public.levytate_intelligence_signal_events from anon, authenticated;
grant all on public.levytate_intelligence_signals to service_role;
grant all on public.levytate_intelligence_signal_events to service_role;
create policy levytate_intelligence_signals_service_role on public.levytate_intelligence_signals for all to service_role using (true) with check (true);
create policy levytate_intelligence_signal_events_service_role on public.levytate_intelligence_signal_events for all to service_role using (true) with check (true);
