-- Test-only stand-ins for schemas Supabase provisions before application
-- migrations. Never apply this file to a hosted Supabase project.

create schema if not exists auth;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), session_user::text)
$$;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false
);
