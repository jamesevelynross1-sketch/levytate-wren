-- Runs ONLY inside a disposable, loopback Postgres transaction after reviewed local bootstrap.
-- The runner wraps this entire test in BEGIN / ROLLBACK; never export test identities.
do $delivery_test$
declare
  a uuid;
  b uuid;
  lead_a uuid;
  lead_b uuid;
  provider text;
  programme text;
  member uuid := gen_random_uuid();
  idem uuid := gen_random_uuid();
  first_update jsonb;
  retry_update jsonb;
  accepted jsonb;
  date_today text := to_char(current_date,'YYYY-MM-DD');
  payload jsonb;
  denied boolean;
begin
  select id into strict a from public.levytate_organisations where slug like 'release-%-a';
  select id into strict b from public.levytate_organisations where slug like 'release-%-b';
  select id into strict lead_a from public.levytate_users where organisation_id=a and role='Apprenticeship Lead';
  select id into strict lead_b from public.levytate_users where organisation_id=b and role='Apprenticeship Lead';
  select provider_id into strict provider from public.levytate_organisation_providers where organisation_id=a and status='Active';
  select programme_id into strict programme from public.levytate_organisation_programmes
    where organisation_id=a and provider_id=provider and status='Active';

  insert into public.levytate_provider_memberships(id,provider_id,email,display_name,auth_subject,auth_binding_status,auth_bound_at,active,role)
    values(member,provider,'provider.delivery.acceptance@example.test','Synthetic provider',gen_random_uuid(),'bound',now(),true,'Provider User');

  -- Default disabled: a provider's existing Requests login alone grants no delivery.
  denied:=false;
  begin
    perform public.levytate_set_provider_delivery_grant(a,lead_a,provider,true);
  exception when sqlstate 'PT403' then denied:=true; end;
  if not denied then raise exception 'Fail: default capability must deny employer sharing'; end if;

  insert into public.levytate_organisation_capabilities(organisation_id,provider_delivery_enabled)
    values(a,true),(b,true)
    on conflict(organisation_id) do update set provider_delivery_enabled=true;

  denied:=false;
  begin
    perform public.levytate_set_provider_delivery_grant(a,lead_b,provider,true);
  exception when sqlstate 'PT403' then denied:=true; end;
  if not denied then raise exception 'Fail: cross-tenant employer grant'; end if;

  payload:=jsonb_build_object('reportDate',date_today,'deliveryNote','Synthetic January intake planning.','capacityStatus','limited');
  denied:=false;
  begin
    perform public.levytate_submit_provider_delivery_update(a,provider,member,'programme_note',programme,payload,idem);
  exception when sqlstate 'PT403' then denied:=true; end;
  if not denied then raise exception 'Fail: provider submission without employer grant'; end if;

  perform public.levytate_set_provider_delivery_grant(a,lead_a,provider,true);
  first_update:=public.levytate_submit_provider_delivery_update(a,provider,member,'programme_note',programme,payload,idem);
  retry_update:=public.levytate_submit_provider_delivery_update(a,provider,member,'programme_note',programme,payload,idem);
  if first_update->>'id' is distinct from retry_update->>'id'
    or (select count(*) from public.levytate_provider_delivery_updates where organisation_id=a)<>1
    then raise exception 'Fail: provider submission not idempotent'; end if;

  denied:=false;
  begin
    perform public.levytate_submit_provider_delivery_update(a,provider,member,'programme_note',programme,
      jsonb_build_object('reportDate',date_today,'deliveryNote','Different payload.','capacityStatus','available'),idem);
  exception when sqlstate 'PT409' then denied:=true; end;
  if not denied then raise exception 'Fail: conflicting idempotency key'; end if;

  denied:=false;
  begin
    perform public.levytate_submit_provider_delivery_update(b,provider,member,'programme_note',programme,payload,gen_random_uuid());
  exception when sqlstate 'PT403' then denied:=true; end;
  if not denied then raise exception 'Fail: cross-tenant provider update'; end if;

  denied:=false;
  begin
    perform public.levytate_submit_provider_delivery_update(a,provider,member,'learner_progress','not-an-assigned-learner',
      jsonb_build_object('reportDate',date_today,'actualProgressPercentage',46,'summary','Synthetic learner note'),gen_random_uuid());
  exception when sqlstate 'PT403' then denied:=true; end;
  if not denied then raise exception 'Fail: unassigned learner must be denied'; end if;

  denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(a,lead_b,(first_update->>'id')::uuid,'accepted');
  exception when sqlstate 'PT403' then denied:=true; end;
  if not denied then raise exception 'Fail: cross-tenant employer review'; end if;

  accepted:=public.levytate_review_provider_delivery_update(a,lead_a,(first_update->>'id')::uuid,'accepted');
  if accepted->>'review_status'<>'accepted' or (accepted->>'reviewed_at') is null
    or public.levytate_review_provider_delivery_update(a,lead_a,(first_update->>'id')::uuid,'accepted')->>'id'<>first_update->>'id'
    then raise exception 'Fail: employer acceptance or idempotent review'; end if;

  denied:=false;
  begin
    perform public.levytate_review_provider_delivery_update(a,lead_a,(first_update->>'id')::uuid,'rejected');
  exception when sqlstate 'PT409' then denied:=true; end;
  if not denied then raise exception 'Fail: cannot reverse accepted evidence'; end if;

  if exists(select 1 from public.levytate_learner_progress_updates where organisation_id=a)
    or (select count(*) from public.levytate_audit_events
        where organisation_id=a and entity_type in ('provider_delivery_grant','provider_delivery_update'))<>3
    then raise exception 'Fail: direct learner mutation or missing audit events'; end if;

  perform public.levytate_set_provider_delivery_grant(a,lead_a,provider,false);
  denied:=false;
  begin
    perform public.levytate_submit_provider_delivery_update(a,provider,member,'programme_note',programme,payload,gen_random_uuid());
  exception when sqlstate 'PT403' then denied:=true; end;
  if not denied then raise exception 'Fail: revoked provider still submitting'; end if;
  if has_table_privilege('anon','public.levytate_provider_delivery_updates','SELECT')
    or has_table_privilege('authenticated','public.levytate_provider_delivery_grants','SELECT')
    or has_function_privilege('anon','public.levytate_submit_provider_delivery_update(uuid,text,uuid,text,text,jsonb,uuid)','EXECUTE')
    then raise exception 'Fail: browser/API database permissions'; end if;
end $delivery_test$;
