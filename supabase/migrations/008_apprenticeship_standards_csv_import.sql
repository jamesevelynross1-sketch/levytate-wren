alter table if exists public.levytate_apprenticeship_standards
  add column if not exists programme_type text not null default 'Apprenticeship standard',
  add column if not exists route text not null default '',
  add column if not exists integrated_degree text not null default '',
  add column if not exists professional_recognition text not null default '',
  add column if not exists job_titles jsonb not null default '[]'::jsonb,
  add column if not exists overview text not null default '',
  add column if not exists last_updated date,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.levytate_apprenticeship_standards
set route = case
      when route <> '' then route
      else coalesce(occupational_route, '')
    end,
    programme_type = case
      when programme_type <> '' then programme_type
      else 'Apprenticeship standard'
    end,
    last_updated = coalesce(last_updated, last_verified, last_synced_at),
    updated_at = now()
where true;

create index if not exists levytate_apprenticeship_standards_programme_type_idx
  on public.levytate_apprenticeship_standards (programme_type);

create index if not exists levytate_apprenticeship_standards_status_idx
  on public.levytate_apprenticeship_standards (status);
