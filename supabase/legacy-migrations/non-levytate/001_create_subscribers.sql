create extension if not exists "pgcrypto";

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source_page text,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token text unique,
  segments text[] not null default array['all']::text[]
);

create index if not exists subscribers_status_idx
  on public.subscribers (status);

create index if not exists subscribers_unsubscribe_token_idx
  on public.subscribers (unsubscribe_token);

create index if not exists subscribers_segments_idx
  on public.subscribers using gin (segments);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscribers_set_updated_at on public.subscribers;

create trigger subscribers_set_updated_at
before update on public.subscribers
for each row
execute function public.set_updated_at();
