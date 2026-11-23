-- REVIEW-ONLY follow-up for provider-delivery-v1.sql. Do NOT apply to shared/Production.
-- Employer approval atomically promotes a provider progress report into the
-- canonical learner progress timeline. Provider never receives direct write access.
-- Existing learner update revision and catalogue lock are honoured.
alter table public.levytate_provider_delivery_updates
  add column promoted_progress_id text;

alter table public.levytate_provider_delivery_updates
  add constraint provider_delivery_promotion_progress_fk
    foreign key (organisation_id, promoted_progress_id)
    references public.levytate_learner_progress_updates (organisation_id, id)
    on delete restrict,
  add constraint provider_delivery_promotion_status_check
    check (
      (update_kind <> 'learner_progress' or review_status <> 'accepted' or promoted_progress_id is not null)
      and (update_kind = 'learner_progress' or promoted_progress_id is null)
      and (review_status = 'accepted' or promoted_progress_id is null)
    );

create unique index provider_delivery_canonical_source_unique
  on public.levytate_learner_progress_updates(organisation_id, source_reference)
  where source_reference like 'provider-delivery:%';

-- Replace original four-argument review RPC: it only acknowledged evidence.
-- Do not preserve an alternative service-role-accessible bypass that could mark
-- a learner report accepted without the new canonical progress record.
drop function public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text);

create function public.levytate_review_provider_delivery_update(
  p_organisation_id uuid,
  p_actor_user_id uuid,
  p_update_id uuid,
  p_decision text,
  p_expected_learner_revision integer
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_update public.levytate_provider_delivery_updates%rowtype;
  v_learner public.levytate_learner_records%rowtype;
  v_baseline public.levytate_learner_progress_updates%rowtype;
  v_now timestamptz := clock_timestamp();
  v_progress_id text;
  v_actual numeric(5,2);
  v_target numeric(5,2);
  v_report_date date;
  v_event_id text;
begin
  if p_organisation_id is null or p_actor_user_id is null or p_update_id is null
    or p_decision not in ('accepted','rejected')
    or (p_expected_learner_revision is not null and p_expected_learner_revision < 0) then
    raise exception using errcode='PT422', message='Invalid provider evidence decision';
  end if;

  -- Match learner-command lock ordering: catalogue integrity lock is acquired
  -- before employee/learner rows. All changes roll back on any exception.
  perform pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));

  select * into v_actor from public.levytate_users
    where organisation_id=p_organisation_id and id=p_actor_user_id
      and active=true and role in ('Apprenticeship Lead','Employer Admin') for share;
  if not found then
    raise exception using errcode='PT403',message='Employer cannot review delivery evidence';
  end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then
    raise exception using errcode='PT403',message='Employer workspace is inactive';
  end if;
  if not exists(select 1 from public.levytate_organisation_capabilities
    where organisation_id=p_organisation_id and provider_delivery_enabled=true) then
    raise exception using errcode='PT403',message='Provider delivery is disabled';
  end if;

  select * into v_update from public.levytate_provider_delivery_updates
    where organisation_id=p_organisation_id and id=p_update_id for update;
  if not found then raise exception using errcode='PT404',message='Provider evidence not available'; end if;

  -- Lost-response retries are exactly idempotent and must not require a
  -- still-fresh learner revision; the committed progress ID is immutable.
  if v_update.review_status<>'pending' then
    if v_update.review_status=p_decision
      and (v_update.update_kind<>'learner_progress' or p_decision='rejected'
        or v_update.promoted_progress_id is not null) then
      return to_jsonb(v_update);
    end if;
    raise exception using errcode='PT409',message='Provider evidence has already been reviewed';
  end if;

  if p_decision='accepted' then
    -- Revoke races take the provider grant lock before anything is promoted.
    perform 1 from public.levytate_provider_delivery_grants
      where organisation_id=p_organisation_id and provider_id=v_update.provider_id
        and enabled=true for share;
    if not found or not exists(select 1 from public.levytate_organisation_providers
      where organisation_id=p_organisation_id and provider_id=v_update.provider_id
        and status='Active') then
      raise exception using errcode='PT409',message='Provider permission was revoked';
    end if;
  end if;

  if p_decision='accepted' and v_update.update_kind='learner_progress' then
    if p_expected_learner_revision is null then
      raise exception using errcode='PT409',message='Reload the learner before accepting provider progress';
    end if;
    if v_update.payload->>'reportDate' is distinct from v_update.report_date::text
      or jsonb_typeof(v_update.payload->'actualProgressPercentage') is distinct from 'number'
      or v_update.payload->>'actualProgressPercentage' !~ '^(100|[0-9]|[1-9][0-9])$'
      or jsonb_typeof(v_update.payload->'summary') is distinct from 'string'
      or length(btrim(v_update.payload->>'summary')) not between 1 and 1200 then
      raise exception using errcode='PT422',message='Provider report evidence is incomplete';
    end if;

    -- Same employee-before-learner lock ordering as the existing learner RPC.
    perform 1 from public.levytate_employees e join public.levytate_learner_records l
      on l.organisation_id=e.organisation_id and l.employee_id=e.id
      where l.organisation_id=p_organisation_id and l.id=v_update.target_id
        and e.status='Active' for update of e;
    if not found then raise exception using errcode='PT409',message='Learner employment record is unavailable'; end if;

    select * into v_learner from public.levytate_learner_records
      where organisation_id=p_organisation_id and id=v_update.target_id
        and record_status='Active' for update;
    if not found or v_learner.provider_id<>v_update.provider_id
      or v_learner.lifecycle_status not in ('enrolled','assessment_preparation','in_assessment')
      or v_learner.demonstration_record then
      raise exception using errcode='PT409',message='Learner is no longer eligible for this provider update';
    end if;
    if not exists(select 1 from public.levytate_organisation_programmes p
        where p.organisation_id=p_organisation_id and p.programme_id=v_learner.programme_id
          and p.provider_id=v_update.provider_id and p.status='Active') then
      raise exception using errcode='PT409',message='Assigned provider programme is no longer active';
    end if;
    if p_expected_learner_revision<>v_learner.mutation_revision then
      raise exception using errcode='PT409',message='Learner progress changed; reload before approval';
    end if;
    v_report_date:=v_update.report_date;
    if v_learner.actual_start_date is null or v_report_date < v_learner.actual_start_date
      or v_report_date > current_date+7 then
      raise exception using errcode='PT409',message='Provider evidence date is outside the current learner journey';
    end if;

    select * into v_baseline from public.levytate_learner_progress_updates
      where organisation_id=p_organisation_id and learner_record_id=v_learner.id
      order by update_date desc,created_at desc,id desc limit 1;
    if not found or v_report_date < v_baseline.update_date then
      raise exception using errcode='PT409',message='Provider report is older than the latest learner progress evidence';
    end if;
    v_target:=v_baseline.target_progress_percentage; -- Never invent a target
    v_actual:=(v_update.payload->>'actualProgressPercentage')::numeric;
    v_progress_id:='provider-progress-'||v_update.id::text;
    v_event_id:='provider-progress-event-'||v_update.id::text;

    insert into public.levytate_learner_progress_updates(
      organisation_id,id,learner_record_id,update_date,
      target_progress_percentage,actual_progress_percentage,variance_percentage,
      progress_source,source_reference,updated_by,summary,support_action,created_at
    ) values (
      p_organisation_id,v_progress_id,v_learner.id,v_report_date,
      v_target,v_actual,round(v_actual-v_target,2),
      'provider_report','provider-delivery:'||v_update.id::text,
      v_actor.email,btrim(v_update.payload->>'summary'),
      'Employer-approved provider report',v_now
    );

    insert into public.levytate_learner_lifecycle_events(
      organisation_id,id,learner_record_id,event_type,
      previous_status,new_status,event_date,actor_user_id,actor_name,source,summary,metadata,created_at
    ) values (
      p_organisation_id,v_event_id,v_learner.id,'progress_updated',
      '','',v_now,v_actor.id::text,v_actor.email,'provider_delivery',
      'Employer approved provider-reported learner progress.',
      jsonb_build_object(
        'providerDeliveryUpdateId',v_update.id,
        'providerId',v_update.provider_id,
        'providerMembershipId',v_update.provider_membership_id,
        'sourceReportDate',v_update.report_date,
        'canonicalProgressId',v_progress_id,
        'previousTargetProgressPercentage',v_target,
        'approvedActualProgressPercentage',v_actual,
        'nextReviewDateProposed',v_update.payload->>'nextReviewDate',
        'actor',v_actor.id
      ),v_now
    );
    update public.levytate_learner_records
      set mutation_revision=mutation_revision+1,updated_at=v_now,updated_by=v_actor.email
      where organisation_id=p_organisation_id and id=v_learner.id;
  end if;

  update public.levytate_provider_delivery_updates
    set review_status=p_decision,reviewed_at=v_now,reviewed_by=p_actor_user_id,
      promoted_progress_id=v_progress_id
    where id=p_update_id and organisation_id=p_organisation_id
    returning * into v_update;
  insert into public.levytate_audit_events(
    organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata
  ) values(
    p_organisation_id,v_actor.email,v_actor.role,'provider_delivery_update',p_update_id::text,
    'delivery.'||p_decision,'Employer reviewed a provider evidence submission.',
    jsonb_build_object('providerId',v_update.provider_id,'kind',v_update.update_kind,
      'targetId',v_update.target_id,'canonicalProgressId',v_progress_id)
  );
  if v_progress_id is not null then
    insert into public.levytate_audit_events(
      organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata
    ) values(
      p_organisation_id,v_actor.email,v_actor.role,'learner',v_update.target_id,
      'learner.progress','Employer accepted provider evidence into learner progress.',
      jsonb_build_object('providerDeliveryUpdateId',v_update.id,
        'canonicalProgressId',v_progress_id,'mutationRevision',v_learner.mutation_revision+1)
    );
  end if;
  return to_jsonb(v_update);
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
  or check_violation or invalid_text_representation or not_null_violation then
  raise exception using errcode='PT422',message='Provider progress evidence is invalid';
  when unique_violation then
  raise exception using errcode='PT409',message='This progress evidence is already recorded';
end $$;

revoke all on function public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text,integer)
  to service_role;
