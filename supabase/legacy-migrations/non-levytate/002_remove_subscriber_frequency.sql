drop index if exists subscribers_status_frequency_idx;

alter table public.subscribers
  drop column if exists frequency;

create index if not exists subscribers_status_idx
  on public.subscribers (status);
