-- LOCAL REVIEW CANDIDATE ONLY. Hosted application requires separate approval.
-- Provider acceptance means the Auth service accepted a send; it is not proof
-- of inbox delivery. Existing bound memberships retain their current linkage.
alter table public.levytate_users
  add column invitation_status text not null default 'not_requested'
    check (invitation_status in ('not_requested','sending','accepted','failed','revoked','consumed')),
  add column invitation_requested_at timestamptz,
  add column invitation_expires_at timestamptz,
  add column invitation_request_reference uuid,
  add column invitation_generation integer not null default 0 check (invitation_generation >= 0);

comment on column public.levytate_users.invitation_status is
  'Invitation lifecycle: accepted is provider send acceptance, not confirmed recipient delivery.';
comment on column public.levytate_users.invitation_generation is
  'Optimistic concurrency generation reserved before each invite/reinvite/revoke, including pending identity binding.';
