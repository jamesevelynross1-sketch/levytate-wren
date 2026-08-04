create extension if not exists "pgcrypto";

alter table public.subscribers
  add column if not exists unsubscribe_token text unique;

update public.subscribers
set unsubscribe_token = gen_random_uuid()::text
where unsubscribe_token is null;

create index if not exists subscribers_unsubscribe_token_idx
  on public.subscribers (unsubscribe_token);
