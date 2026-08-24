create table if not exists public.provider_intelligence_sources (
  id text primary key, provider_id text not null, label text not null, source_url text not null unique,
  provider_domain text not null, parser text not null check (parser in ('feed','html')),
  status text not null check (status in ('active','needs-review','disabled')),
  etag text, last_modified text, last_attempt_at timestamptz, last_successful_fetch_at timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.provider_intelligence_articles (
  id text primary key, fingerprint text not null unique, provider_id text not null,
  source_id text not null references public.provider_intelligence_sources(id) on delete restrict,
  title text not null, excerpt text not null, canonical_url text not null unique, image_url text,
  published_at timestamptz, discovered_at timestamptz not null default now(), content_type text not null,
  topics jsonb not null default '[]'::jsonb, status text not null default 'published' check(status in ('published','hidden'))
);
create index if not exists provider_intelligence_articles_provider_date_idx on public.provider_intelligence_articles(provider_id,published_at desc nulls last);
create index if not exists provider_intelligence_articles_source_idx on public.provider_intelligence_articles(source_id);
alter table public.provider_intelligence_sources enable row level security;
alter table public.provider_intelligence_articles enable row level security;
revoke all on public.provider_intelligence_sources from anon, authenticated;
revoke all on public.provider_intelligence_articles from anon, authenticated;
grant all on public.provider_intelligence_sources to service_role;
grant all on public.provider_intelligence_articles to service_role;
create policy provider_intelligence_sources_service_role on public.provider_intelligence_sources for all to service_role using (true) with check (true);
create policy provider_intelligence_articles_service_role on public.provider_intelligence_articles for all to service_role using (true) with check (true);
