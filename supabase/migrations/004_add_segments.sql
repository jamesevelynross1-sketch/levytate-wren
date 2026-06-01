alter table public.subscribers
  add column if not exists segments text[] not null default array['all']::text[];

update public.subscribers
set segments = array['all']::text[]
where segments is null or cardinality(segments) = 0;

create index if not exists subscribers_segments_idx
  on public.subscribers using gin (segments);
