-- LOCAL REVIEW CANDIDATE ONLY. No hosted execution is authorised.
create table public.levytate_finance_command_receipts (
  organisation_id uuid not null references public.levytate_organisations(id),
  request_id text not null,
  actor_user_id uuid not null references public.levytate_users(id),
  command_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(organisation_id,request_id)
);
alter table public.levytate_finance_command_receipts enable row level security;
alter table public.levytate_finance_command_receipts force row level security;
revoke all on public.levytate_finance_command_receipts from public,anon,authenticated,service_role;
grant select on public.levytate_finance_command_receipts to service_role;
create policy finance_receipts_read on public.levytate_finance_command_receipts for select to service_role using(true);
create table public.levytate_finance_versions (
  organisation_id uuid primary key references public.levytate_organisations(id),
  revision bigint not null default 0 check(revision>=0)
);
alter table public.levytate_finance_versions enable row level security;
alter table public.levytate_finance_versions force row level security;
revoke all on public.levytate_finance_versions from public,anon,authenticated,service_role;
grant select on public.levytate_finance_versions to service_role;
create policy finance_versions_read on public.levytate_finance_versions for select to service_role using(true);

create function public.levytate_apply_finance_command(p_organisation_id uuid,p_actor_user_id uuid,p_request_id text,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor public.levytate_users%rowtype;
  v_receipt public.levytate_finance_command_receipts%rowtype;
  v_import public.levytate_finance_imports%rowtype;
  v_balance public.levytate_finance_balances%rowtype;
  v_hash text;
  v_count integer;
  v_added integer;
  v_review integer;
  v_id text:=gen_random_uuid()::text;
  v_now timestamptz:=clock_timestamp();
  v_result jsonb;
begin
  if p_organisation_id is null or p_actor_user_id is null or p_request_id is null or p_action is null
    or p_request_id !~ '^[A-Za-z0-9:_-]{8,128}$' or p_action not in ('import','balance') or jsonb_typeof(p_input) is distinct from 'object' then
    raise exception using errcode='PT422',message='Invalid Finance command'; end if;
  select * into v_actor from public.levytate_users where organisation_id=p_organisation_id and id=p_actor_user_id and active for share;
  if not found or v_actor.role not in ('Apprenticeship Lead','Employer Admin') then raise exception using errcode='PT403',message='Active employer Finance manager required'; end if;
  perform 1 from public.levytate_organisations where id=p_organisation_id and status='Active' for share;
  if not found then raise exception using errcode='PT403',message='Workspace is not active'; end if;
  -- Serialise import counts and balances, including simultaneous duplicate files.
  perform pg_advisory_xact_lock(hashtextextended('levytate-finance:'||p_organisation_id::text,0));
  v_hash:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'input',p_input)::text,'UTF8')),'hex');
  select * into v_receipt from public.levytate_finance_command_receipts where organisation_id=p_organisation_id and request_id=p_request_id;
  if found then
    if v_receipt.actor_user_id<>p_actor_user_id or v_receipt.command_hash<>v_hash then raise exception using errcode='PT409',message='Finance request ID already used for different data'; end if;
    return v_receipt.result;
  end if;
  if p_action='import' then
    if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('fileName','sourceRows','transactions'))
      or jsonb_typeof(p_input->'fileName') is distinct from 'string' or length(p_input->>'fileName') not between 1 and 120
      or jsonb_typeof(p_input->'sourceRows') is distinct from 'number' or p_input->>'sourceRows' !~ '^[0-9]{1,5}$'
      or jsonb_typeof(p_input->'transactions') is distinct from 'array' then raise exception using errcode='PT422',message='Invalid Finance import fields'; end if;
    v_count:=jsonb_array_length(p_input->'transactions');
    if v_count<1 or v_count>10000 or (p_input->>'sourceRows')::integer<>v_count then raise exception using errcode='PT422',message='Import all valid source rows, up to 10000; correct malformed rows before retrying'; end if;
    if exists(select 1 from jsonb_array_elements(p_input->'transactions') r where jsonb_typeof(r)<>'object') then raise exception using errcode='PT422',message='Invalid Finance row'; end if;
    if exists(select 1 from jsonb_array_elements(p_input->'transactions') r cross join lateral jsonb_each(r) f where
      f.key not in ('fingerprint','transaction_id','transaction_date','description','category','amount_pence','provider_name','apprentice_name','programme_name','paye_scheme','payroll_month','reported_balance_pence','source_row')
      or (f.key not in ('amount_pence','reported_balance_pence','source_row') and (jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>500))
      or (f.key in ('amount_pence','source_row') and (jsonb_typeof(f.value)<>'number' or f.value::text !~ '^-?[0-9]{1,16}$'))
      or (f.key='reported_balance_pence' and jsonb_typeof(f.value) not in ('null','number'))) then raise exception using errcode='PT422',message='Invalid Finance transaction types'; end if;
    if exists(select 1 from jsonb_array_elements(p_input->'transactions') r where
      not(r ?& array['fingerprint','transaction_id','transaction_date','description','category','amount_pence','source_row'])
      or r->>'fingerprint' !~ '^[a-f0-9]{64}$' or r->>'transaction_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or nullif(btrim(r->>'description'),'') is null or (r->>'source_row')::numeric not between 1 and 10001
      or abs((r->>'amount_pence')::numeric)>9007199254740991
      or r->>'category' not in ('levy_in','apprenticeship_spend','levy_expiry','transfer_out','transfer_in','refund_or_adjustment','other')
      or (r->>'reported_balance_pence' is not null and (r->>'reported_balance_pence' !~ '^-?[0-9]{1,16}$' or abs((r->>'reported_balance_pence')::numeric)>9007199254740991))) then
      raise exception using errcode='PT422',message='Invalid Finance transaction values'; end if;
    if exists(select 1 from jsonb_array_elements(p_input->'transactions') r where r->>'fingerprint'<>encode(sha256(convert_to(
      concat_ws('|',r->>'transaction_date',lower(regexp_replace(btrim(r->>'description'),'\s+',' ','g')),r->>'amount_pence',coalesce(r->>'provider_name',''),coalesce(r->>'apprentice_name',''),coalesce(r->>'programme_name','')),'UTF8')),'hex')) then
      raise exception using errcode='PT422',message='Finance fingerprint does not match source evidence'; end if;
    -- A fingerprint may deduplicate exact evidence, never conceal conflicting evidence.
    if exists(select 1 from jsonb_array_elements(p_input->'transactions') r join public.levytate_finance_transactions t
      on t.organisation_id=p_organisation_id and t.fingerprint=r->>'fingerprint' where
      t.transaction_date<>(r->>'transaction_date')::date or t.amount_pence<>(r->>'amount_pence')::bigint or t.category<>r->>'category'
      or lower(regexp_replace(btrim(t.description),'\s+',' ','g'))<>lower(regexp_replace(btrim(r->>'description'),'\s+',' ','g'))
      or t.provider_name<>coalesce(r->>'provider_name','') or t.apprentice_name<>coalesce(r->>'apprentice_name','') or t.programme_name<>coalesce(r->>'programme_name','')
      or t.paye_scheme<>coalesce(r->>'paye_scheme','') or t.payroll_month<>coalesce(r->>'payroll_month','')
      or t.reported_balance_pence is distinct from (r->>'reported_balance_pence')::bigint) then raise exception using errcode='PT409',message='Duplicate Finance fingerprint contains conflicting evidence'; end if;
    if exists(select 1 from jsonb_array_elements(p_input->'transactions') r group by r->>'fingerprint'
      having count(distinct (r-'source_row'-'transaction_id'))>1) then raise exception using errcode='PT409',message='Repeated Finance rows contain conflicting evidence'; end if;
    insert into public.levytate_finance_imports(organisation_id,id,file_name,source_rows,new_transactions,duplicate_rows,review_rows,date_range_from,date_range_to,imported_by,imported_at)
      select p_organisation_id,v_id,p_input->>'fileName',v_count,0,0,0,min((r->>'transaction_date')::date),max((r->>'transaction_date')::date),v_actor.email,v_now
      from jsonb_array_elements(p_input->'transactions') r;
    with inserted as (
      insert into public.levytate_finance_transactions(organisation_id,fingerprint,transaction_id,transaction_date,description,category,amount_pence,provider_name,apprentice_name,programme_name,paye_scheme,payroll_month,reported_balance_pence,source_row,import_id,created_at)
      select distinct on (r->>'fingerprint') p_organisation_id,r->>'fingerprint',r->>'transaction_id',(r->>'transaction_date')::date,r->>'description',r->>'category',(r->>'amount_pence')::bigint,
        coalesce(r->>'provider_name',''),coalesce(r->>'apprentice_name',''),coalesce(r->>'programme_name',''),coalesce(r->>'paye_scheme',''),coalesce(r->>'payroll_month',''),(r->>'reported_balance_pence')::bigint,(r->>'source_row')::integer,v_id,v_now
        from jsonb_array_elements(p_input->'transactions') r order by r->>'fingerprint',(r->>'source_row')::integer
      on conflict(organisation_id,fingerprint) do nothing returning category
    ) select count(*),count(*) filter(where category='other') into v_added,v_review from inserted;
    update public.levytate_finance_imports set new_transactions=v_added,duplicate_rows=v_count-v_added,review_rows=v_review where organisation_id=p_organisation_id and id=v_id returning * into v_import;
    v_result:=to_jsonb(v_import);
  else
    if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('amountPence','expectedConfirmedAt'))
      or not(p_input ?& array['amountPence','expectedConfirmedAt']) or jsonb_typeof(p_input->'amountPence') is distinct from 'number'
      or p_input->>'amountPence' !~ '^[0-9]{1,16}$' or (p_input->>'amountPence')::numeric>9007199254740991
      or jsonb_typeof(p_input->'expectedConfirmedAt') not in ('null','string') then raise exception using errcode='PT422',message='Valid balance and expected confirmation version required'; end if;
    select * into v_balance from public.levytate_finance_balances where organisation_id=p_organisation_id for update;
    if v_balance.confirmed_at is distinct from (p_input->>'expectedConfirmedAt')::timestamptz then raise exception using errcode='PT409',message='Finance balance changed; refresh before confirming'; end if;
    insert into public.levytate_finance_balances(organisation_id,amount_pence,confirmed_by,confirmed_at,updated_at)
      values(p_organisation_id,(p_input->>'amountPence')::bigint,v_actor.email,v_now,v_now)
      on conflict(organisation_id) do update set amount_pence=excluded.amount_pence,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at returning * into v_balance;
    v_result:=to_jsonb(v_balance);
  end if;
  insert into public.levytate_finance_command_receipts(organisation_id,request_id,actor_user_id,command_hash,result) values(p_organisation_id,p_request_id,p_actor_user_id,v_hash,v_result);
  insert into public.levytate_finance_versions(organisation_id,revision) values(p_organisation_id,1)
    on conflict(organisation_id) do update set revision=public.levytate_finance_versions.revision+1;
  insert into public.levytate_audit_events(id,organisation_id,actor_email,actor_role,entity_type,entity_id,action,summary,metadata)
    values(gen_random_uuid(),p_organisation_id,v_actor.email,v_actor.role,'finance',coalesce(v_import.id,p_organisation_id::text),'finance.'||p_action,'Finance evidence committed.',
      jsonb_build_object('requestId',p_request_id,'newTransactions',v_added,'duplicateRows',v_count-v_added));
  return v_result;
exception when invalid_datetime_format or datetime_field_overflow then raise exception using errcode='PT422',message='Finance date is invalid';
end; $$;
revoke all on function public.levytate_apply_finance_command(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.levytate_apply_finance_command(uuid,uuid,text,text,jsonb) to service_role;
revoke insert,update,delete on public.levytate_finance_imports,public.levytate_finance_transactions,public.levytate_finance_balances from service_role;
