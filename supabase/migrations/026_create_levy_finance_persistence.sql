-- Persistent, organisation-scoped DAS finance imports for LevyTate Client V1.
-- Additive only: existing workspace and learner data is not altered.

create table public.levytate_finance_imports (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  id text not null,
  file_name text not null,
  source_rows integer not null check (source_rows >= 0),
  new_transactions integer not null check (new_transactions >= 0),
  duplicate_rows integer not null check (duplicate_rows >= 0),
  review_rows integer not null check (review_rows >= 0),
  date_range_from date,
  date_range_to date,
  imported_by text not null default '',
  imported_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, id),
  constraint levytate_finance_imports_date_range_check
    check (date_range_from is null or date_range_to is null or date_range_from <= date_range_to)
);

create index levytate_finance_imports_recent_idx
  on public.levytate_finance_imports (organisation_id, imported_at desc);

create table public.levytate_finance_transactions (
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  fingerprint text not null,
  transaction_id text not null,
  transaction_date date not null,
  description text not null,
  category text not null,
  amount_pence bigint not null,
  provider_name text not null default '',
  apprentice_name text not null default '',
  programme_name text not null default '',
  paye_scheme text not null default '',
  payroll_month text not null default '',
  reported_balance_pence bigint,
  source_row integer not null check (source_row > 0),
  import_id text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organisation_id, fingerprint),
  constraint levytate_finance_transactions_import_fk
    foreign key (organisation_id, import_id)
    references public.levytate_finance_imports (organisation_id, id) on delete restrict,
  constraint levytate_finance_transactions_category_check
    check (category in ('levy_in','apprenticeship_spend','levy_expiry','transfer_out','transfer_in','refund_or_adjustment','other')),
  constraint levytate_finance_transactions_fingerprint_check
    check (fingerprint ~ '^[a-f0-9]{64}$')
);

create index levytate_finance_transactions_date_idx
  on public.levytate_finance_transactions (organisation_id, transaction_date desc);
create index levytate_finance_transactions_category_idx
  on public.levytate_finance_transactions (organisation_id, category, transaction_date desc);

create table public.levytate_finance_balances (
  organisation_id uuid primary key references public.levytate_organisations(id) on delete restrict,
  amount_pence bigint not null check (amount_pence >= 0),
  confirmed_by text not null default '',
  confirmed_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.levytate_finance_imports enable row level security;
alter table public.levytate_finance_imports force row level security;
alter table public.levytate_finance_transactions enable row level security;
alter table public.levytate_finance_transactions force row level security;
alter table public.levytate_finance_balances enable row level security;
alter table public.levytate_finance_balances force row level security;

revoke all on table public.levytate_finance_imports from public, anon, authenticated;
revoke all on table public.levytate_finance_transactions from public, anon, authenticated;
revoke all on table public.levytate_finance_balances from public, anon, authenticated;
grant select, insert, update, delete on table public.levytate_finance_imports to service_role;
grant select, insert, update, delete on table public.levytate_finance_transactions to service_role;
grant select, insert, update, delete on table public.levytate_finance_balances to service_role;

create policy levytate_finance_imports_service_role_all
  on public.levytate_finance_imports for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_finance_transactions_service_role_all
  on public.levytate_finance_transactions for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy levytate_finance_balances_service_role_all
  on public.levytate_finance_balances for all to service_role
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
