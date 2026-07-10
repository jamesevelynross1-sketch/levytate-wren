create table if not exists public.levytate_guidance_sources (
  id text primary key,
  title text not null,
  publisher text not null,
  source_url text not null unique,
  authority_level text not null,
  source_type text not null,
  guidance_categories jsonb not null default '[]'::jsonb,
  jurisdiction text not null default 'England',
  funding_year text,
  effective_from date,
  effective_to date,
  applicable_start_date_from date,
  applicable_start_date_to date,
  refresh_frequency text not null default 'Quarterly',
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_reviewed_at timestamptz,
  reviewed_by text,
  review_status text not null default 'Unreviewed',
  copilot_approved boolean not null default false,
  source_status text not null default 'Active',
  content_hash text,
  last_change_summary text,
  automated_check_enabled boolean not null default false,
  monitoring_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.levytate_guidance_sources
  add column if not exists title text,
  add column if not exists publisher text,
  add column if not exists source_url text,
  add column if not exists authority_level text,
  add column if not exists source_type text,
  add column if not exists guidance_categories jsonb not null default '[]'::jsonb,
  add column if not exists jurisdiction text not null default 'England',
  add column if not exists funding_year text,
  add column if not exists effective_from date,
  add column if not exists effective_to date,
  add column if not exists applicable_start_date_from date,
  add column if not exists applicable_start_date_to date,
  add column if not exists refresh_frequency text not null default 'Quarterly',
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_changed_at timestamptz,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists review_status text not null default 'Unreviewed',
  add column if not exists copilot_approved boolean not null default false,
  add column if not exists source_status text not null default 'Active',
  add column if not exists content_hash text,
  add column if not exists last_change_summary text,
  add column if not exists automated_check_enabled boolean not null default false,
  add column if not exists monitoring_notes text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.levytate_guidance_items (
  id text primary key,
  title text not null,
  summary text not null default '',
  guidance_category text not null,
  body text not null default '',
  review_status text not null default 'Unreviewed',
  copilot_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.levytate_guidance_item_sources (
  id text primary key,
  guidance_item_id text not null references public.levytate_guidance_items(id) on delete cascade,
  guidance_source_id text not null references public.levytate_guidance_sources(id) on delete cascade,
  source_role text not null default 'Supporting',
  created_at timestamptz not null default now(),
  unique (guidance_item_id, guidance_source_id)
);

create index if not exists levytate_guidance_sources_authority_idx on public.levytate_guidance_sources(authority_level);
create index if not exists levytate_guidance_sources_review_status_idx on public.levytate_guidance_sources(review_status);
create index if not exists levytate_guidance_sources_source_status_idx on public.levytate_guidance_sources(source_status);
create index if not exists levytate_guidance_sources_copilot_idx on public.levytate_guidance_sources(copilot_approved);
create index if not exists levytate_guidance_sources_funding_year_idx on public.levytate_guidance_sources(funding_year);
create index if not exists levytate_guidance_sources_categories_idx on public.levytate_guidance_sources using gin(guidance_categories);
create index if not exists levytate_guidance_items_category_idx on public.levytate_guidance_items(guidance_category);
create index if not exists levytate_guidance_item_sources_item_idx on public.levytate_guidance_item_sources(guidance_item_id);
create index if not exists levytate_guidance_item_sources_source_idx on public.levytate_guidance_item_sources(guidance_source_id);

alter table public.levytate_guidance_sources enable row level security;
alter table public.levytate_guidance_items enable row level security;
alter table public.levytate_guidance_item_sources enable row level security;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('levytate-guidance-sources', 'levytate-guidance-sources', false)
    on conflict (id) do nothing;
  end if;
end $$;
