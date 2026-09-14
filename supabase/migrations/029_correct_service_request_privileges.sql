-- LevyTate Requests V1.1: narrow inherited Supabase service-role table privileges.

revoke all privileges on table public.levytate_organisation_capabilities from service_role;
revoke all privileges on table public.levytate_provider_memberships from service_role;
revoke all privileges on table public.levytate_service_requests from service_role;
revoke all privileges on table public.levytate_service_request_versions from service_role;
revoke all privileges on table public.levytate_service_request_invitations from service_role;
revoke all privileges on table public.levytate_provider_access_invites from service_role;
revoke all privileges on table public.levytate_service_request_responses from service_role;
revoke all privileges on table public.levytate_service_request_response_versions from service_role;
revoke all privileges on table public.levytate_service_request_clarifications from service_role;
revoke all privileges on table public.levytate_service_request_decisions from service_role;
revoke all privileges on table public.levytate_service_request_agreements from service_role;
revoke all privileges on table public.levytate_service_request_handovers from service_role;
revoke all privileges on table public.levytate_service_request_events from service_role;

grant select, insert, update on table public.levytate_organisation_capabilities to service_role;
grant select, insert, update on table public.levytate_provider_memberships to service_role;
grant select, insert, update on table public.levytate_service_requests to service_role;
grant select, insert on table public.levytate_service_request_versions to service_role;
grant select, insert, update on table public.levytate_service_request_invitations to service_role;
grant select, insert, update on table public.levytate_provider_access_invites to service_role;
grant select, insert, update on table public.levytate_service_request_responses to service_role;
grant select, insert on table public.levytate_service_request_response_versions to service_role;
grant select, insert, update on table public.levytate_service_request_clarifications to service_role;
grant select, insert, update on table public.levytate_service_request_decisions to service_role;
grant select, insert on table public.levytate_service_request_agreements to service_role;
grant select, insert on table public.levytate_service_request_handovers to service_role;
grant select, insert on table public.levytate_service_request_events to service_role;
