create table if not exists public.levytate_early_access_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.levytate_organisations(id) on delete restrict,
  accepted_by_user_id uuid not null references public.levytate_users(id) on delete restrict,
  document_type text not null check (document_type = 'early_access_terms'),
  document_version text not null check (length(trim(document_version)) > 0),
  document_content_hash text not null check (document_content_hash ~ '^[a-f0-9]{64}$'),
  accepted_at timestamptz not null default timezone('utc', now()),
  acceptance_method text not null check (acceptance_method = 'authenticated_explicit_acceptance'),
  role_at_acceptance text not null check (role_at_acceptance = 'Apprenticeship Lead'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, accepted_by_user_id, document_type, document_version, document_content_hash)
);

create index if not exists levytate_terms_acceptances_organisation_idx
  on public.levytate_early_access_terms_acceptances (organisation_id, accepted_at desc);

create index if not exists levytate_terms_acceptances_current_document_idx
  on public.levytate_early_access_terms_acceptances (organisation_id, document_type, document_version, document_content_hash);

alter table public.levytate_early_access_terms_acceptances enable row level security;
alter table public.levytate_early_access_terms_acceptances force row level security;

revoke all on table public.levytate_early_access_terms_acceptances from anon, authenticated;
revoke update, delete, truncate, references, trigger on table public.levytate_early_access_terms_acceptances from service_role;
grant select, insert on table public.levytate_early_access_terms_acceptances to service_role;

drop policy if exists "Service role reads LevyTate terms acceptances" on public.levytate_early_access_terms_acceptances;
create policy "Service role reads LevyTate terms acceptances"
  on public.levytate_early_access_terms_acceptances
  for select
  to service_role
  using (true);

drop policy if exists "Service role inserts LevyTate terms acceptances" on public.levytate_early_access_terms_acceptances;
create policy "Service role inserts LevyTate terms acceptances"
  on public.levytate_early_access_terms_acceptances
  for insert
  to service_role
  with check (
    document_type = 'early_access_terms'
    and acceptance_method = 'authenticated_explicit_acceptance'
    and role_at_acceptance = 'Apprenticeship Lead'
  );

comment on table public.levytate_early_access_terms_acceptances is
  'Append-only evidence of explicit organisation-level Early Access Terms acceptance. Server-authorised writes only.';
comment on column public.levytate_early_access_terms_acceptances.document_content_hash is
  'Lowercase SHA-256 of the deterministic published terms representation. No terms body or session secrets are stored.';
