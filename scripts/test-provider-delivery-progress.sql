-- Executed solely in the disposable LOCAL transaction after v1 proposal tests
-- and before rollback. Every learner here is fictional and has a distinct ID.
do $provider_promotion_test$
declare
  v_org uuid;
  v_other uuid;
  v_lead uuid;
  v_other_lead uuid;
  v_provider text;
  v_programme text;
  v_employee text;
  v_member uuid;
  v_learner text:='provider-progress-local-'||gen_random_uuid()::text;
  v_new_no_baseline text:='provider-no-baseline-'||gen_random_uuid()::text;
  v_withdrawn text:='provider-withdrawn-'||gen_random_uuid()::text;
  v_id uuid;
  v_second uuid;
  v_third uuid;
  v_report jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_progress_id text;
  v_date text:=current_date::text;
  v_denied boolean;
  v_event_count int;
begin
  select id into strict v_org from public.levytate_organisations where slug like 'release-%-a';
  select id into strict v_other from public.levytate_organisations where slug like 'release-%-b';
  select id into strict v_lead from public.levytate_users where organisation_id=v_org and role='Apprenticeship Lead';
  select id into strict v_other_lead from public.levytate_users where organisation_id=v_other and role='Apprenticeship Lead';
  select provider_id into strict v_provider from public.levytate_organisation_providers where organisation_id=v_org and status='Active';
  select programme_id into strict v_programme from public.levytate_organisation_programmes
    where organisation_id=v_org and provider_id=v_provider and status='Active';
  select id into strict v_employee from public.levytate_employees
    where organisation_id=v_org and platform_role='Employee' and status='Active';
  select id into strict v_member from public.levytate_provider_memberships
    where provider_id=v_provider and email='provider.delivery.acceptance@example.test';

  -- v1 suite revoked the grant after its programme-report tests.
  perform public.levytate_set_provider_delivery_grant(v_org,v_lead,v_provider,true);

  if to_regprocedure('public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text)') is not null
    or to_regprocedure('public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text,integer)') is null
    or has_function_privilege('authenticated',
      'public.levytate_review_provider_delivery_update(uuid,uuid,uuid,text,integer)','EXECUTE') then
    raise exception 'Unsafe old provider review signature or public API grant';
  end if;

  insert into public.levytate_learner_records(
    organisation_id,id,employee_id,programme_id,provider_id,lifecycle_status,employment_route,
    actual_start_date,expected_end_date,record_status,demonstration_record
  ) values(
    v_org,v_learner,v_employee,v_programme,v_provider,'enrolled','existing_employee_upskill',
    current_date-90,current_date+200,'Active',false
  );
  insert into public.levytate_learner_progress_updates(
    organisation_id,id,learner_record_id,update_date,target_progress_percentage,actual_progress_percentage,
    variance_percentage,progress_source,source_reference,summary
  ) values(
    v_org,'baseline-'||gen_random_uuid(),v_learner,current_date-2,42,36,-6,
    'manual_l_and_d_update','fictional-baseline','Baseline provider-controlled target'
  );
  v_report:=jsonb_build_object('reportDate',v_date,
    'actualProgressPercentage',47,'summary','Synthetic training milestone approved by employer.',
    'nextReviewDate',(current_date+45)::text);
  v_id:=gen_random_uuid();
  v_result:=public.levytate_submit_provider_delivery_update(
    v_org,v_provider,v_member,'learner_progress',v_learner,v_report,v_id);

  -- A missing revision or a different employer cannot authorise a mutation.
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',null);
  exception when sqlstate 'PT409' then v_denied:=true; end;
  if not v_denied then raise exception 'Review without learner revision accepted'; end if;
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_other_lead,(v_result->>'id')::uuid,'accepted',0);
  exception when sqlstate 'PT403' then v_denied:=true; end;
  if not v_denied then raise exception 'Other employer approved provider progress'; end if;

  v_result:=public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',0);
  v_progress_id:=v_result->>'promoted_progress_id';
  if v_result->>'review_status'<>'accepted' or v_progress_id<>'provider-progress-'||v_result->>'id'
    or (select mutation_revision from public.levytate_learner_records
      where organisation_id=v_org and id=v_learner)<>1 then
    raise exception 'Approval did not link canonical progress and revision'; end if;
  if not exists(select 1 from public.levytate_learner_progress_updates where
      organisation_id=v_org and id=v_progress_id and learner_record_id=v_learner
      and target_progress_percentage=42 and actual_progress_percentage=47 and variance_percentage=5
      and update_date=current_date and progress_source='provider_report'
      and source_reference='provider-delivery:'||v_result->>'id'
      and updated_by=(select email from public.levytate_users where id=v_lead)) then
    raise exception 'Canonical progress values or provenance mismatch'; end if;
  if (select count(*) from public.levytate_learner_lifecycle_events where
      organisation_id=v_org and learner_record_id=v_learner and event_type='progress_updated'
      and metadata->>'canonicalProgressId'=v_progress_id)<>1
    or (select count(*) from public.levytate_audit_events where
      organisation_id=v_org and entity_type='learner' and action='learner.progress'
      and metadata->>'canonicalProgressId'=v_progress_id)<>1 then
    raise exception 'Official learner events or audit missing'; end if;

  v_replay:=public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',0);
  if v_replay->>'promoted_progress_id'<>v_progress_id
    or (select count(*) from public.levytate_learner_progress_updates where organisation_id=v_org and learner_record_id=v_learner)<>2
    or (select mutation_revision from public.levytate_learner_records where organisation_id=v_org and id=v_learner)<>1 then
    raise exception 'Lost-response retry duplicated progress'; end if;
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'rejected',1);
  exception when sqlstate 'PT409' then v_denied:=true; end;
  if not v_denied then raise exception 'Accepted report reversed'; end if;

  -- Stale client revision must fail without changing report status or ledger.
  v_second:=gen_random_uuid();
  v_result:=public.levytate_submit_provider_delivery_update(v_org,v_provider,v_member,
    'learner_progress',v_learner,jsonb_build_object('reportDate',v_date,
      'actualProgressPercentage',49,'summary','Subsequent synthetic provider milestone'),v_second);
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',0);
  exception when sqlstate 'PT409' then v_denied:=true; end;
  if not v_denied or (select review_status from public.levytate_provider_delivery_updates where id=(v_result->>'id')::uuid)<>'pending'
    or (select count(*) from public.levytate_learner_progress_updates where organisation_id=v_org and learner_record_id=v_learner)<>2 then
    raise exception 'Stale learner revision did not roll back'; end if;
  v_result:=public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',1);
  if (select mutation_revision from public.levytate_learner_records where organisation_id=v_org and id=v_learner)<>2
    or (select count(*) from public.levytate_learner_progress_updates where organisation_id=v_org and learner_record_id=v_learner)<>3
    then raise exception 'Reapproved current revision failed'; end if;

  -- Out-of-date provider report cannot move the learner backwards.
  v_result:=public.levytate_submit_provider_delivery_update(v_org,v_provider,v_member,'learner_progress',v_learner,
    jsonb_build_object('reportDate',(current_date-1)::text,'actualProgressPercentage',20,
      'summary','Old progress cannot replace current evidence'),gen_random_uuid());
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',2);
  exception when sqlstate 'PT409' then v_denied:=true; end;
  if not v_denied then raise exception 'Outdated report unexpectedly promoted'; end if;

  -- No baseline is no approval: a target must never be fabricated.
  insert into public.levytate_learner_records(
    organisation_id,id,employee_id,programme_id,provider_id,lifecycle_status,employment_route,
    actual_start_date,expected_end_date,record_status,demonstration_record
  ) values(
    v_org,v_new_no_baseline,v_employee,v_programme,v_provider,'enrolled','existing_employee_upskill',
    current_date-90,current_date+200,'Active',false
  );
  v_result:=public.levytate_submit_provider_delivery_update(v_org,v_provider,v_member,'learner_progress',v_new_no_baseline,
    jsonb_build_object('reportDate',v_date,'actualProgressPercentage',35,'summary','Missing baseline'),gen_random_uuid());
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',0);
  exception when sqlstate 'PT409' then v_denied:=true; end;
  if not v_denied then raise exception 'Invented target instead of enforcing baseline'; end if;

  -- Withdrawn learners are never progress-eligible, regardless of client version.
  insert into public.levytate_learner_records(
    organisation_id,id,employee_id,programme_id,provider_id,lifecycle_status,employment_route,
    actual_start_date,expected_end_date,record_status,demonstration_record
  ) values(
    v_org,v_withdrawn,v_employee,v_programme,v_provider,'enrolled','existing_employee_upskill',
    current_date-90,current_date+200,'Active',false
  );
  insert into public.levytate_learner_progress_updates(
    organisation_id,id,learner_record_id,update_date,target_progress_percentage,actual_progress_percentage,
    variance_percentage,progress_source
  ) values(
    v_org,'baseline-'||gen_random_uuid(),v_withdrawn,current_date-2,40,30,-10,'manual_l_and_d_update'
  );
  v_result:=public.levytate_submit_provider_delivery_update(v_org,v_provider,v_member,'learner_progress',v_withdrawn,
    jsonb_build_object('reportDate',v_date,'actualProgressPercentage',42,'summary','Withdrawn before approval'),gen_random_uuid());
  update public.levytate_learner_records set lifecycle_status='withdrawn' where organisation_id=v_org and id=v_withdrawn;
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',0);
  exception when sqlstate 'PT409' then v_denied:=true; end;
  if not v_denied then raise exception 'Withdrawn learner accepted provider progress'; end if;

  -- Revocation prevents pending progress being accepted.
  v_result:=public.levytate_submit_provider_delivery_update(v_org,v_provider,v_member,'learner_progress',v_learner,
    jsonb_build_object('reportDate',v_date,'actualProgressPercentage',50,'summary','Pending before revocation'),gen_random_uuid());
  perform public.levytate_set_provider_delivery_grant(v_org,v_lead,v_provider,false);
  v_denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(v_org,v_lead,(v_result->>'id')::uuid,'accepted',2);
  exception when sqlstate 'PT409' then v_denied:=true; end;
  if not v_denied then raise exception 'Revoked provider report approved'; end if;

  if (select count(*) from public.levytate_learner_progress_updates where
    organisation_id=v_org and source_reference like 'provider-delivery:%')<>2
    or (select count(*) from public.levytate_learner_lifecycle_events
      where organisation_id=v_org and source='provider_delivery' and event_type='progress_updated')<>2
    or (select count(*) from public.levytate_audit_events
      where organisation_id=v_org and entity_type='learner' and action='learner.progress')<>2 then
    raise exception 'Provider progress audit, canonical entries or atomicity differs';
  end if;
end $provider_promotion_test$;
