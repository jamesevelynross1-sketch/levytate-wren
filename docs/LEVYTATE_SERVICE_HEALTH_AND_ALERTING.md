# LevyTate service health and alerting

## Current boundary

LevyTate has application-owned health contracts but **no external uptime monitor or transition alerting**. Protected Previews require Vercel Authentication, so an unauthenticated external monitor cannot currently reach their generated URLs. No SLA, 24/7 monitoring, response time or historical uptime is claimed.

## Public contracts

| Route | Purpose | Success / failure | Cache and limit |
| --- | --- | --- | --- |
| `GET/HEAD /api/levytate-health/live` | Dependency-free HTTP process liveness | `200`; GET body has only `status`, `service`, `checkedAt` | Edge cache 5 seconds; no DB or logs on success |
| `GET/HEAD /api/levytate-health/ready` | Minimum safe authenticated-service dependencies | `200 operational/degraded`; `503 unavailable`; body has only `status`, `checkedAt`, optional generic `message` | In-process coalescing and edge cache 10 seconds; 2.5-second dependency timeout |
| `/levytate/status` | Plain-English current state | Operational, Service disruption or Status temporarily unavailable | Server-rendered; canonical `https://www.levytate.co.uk/status` |

API responses are JSON/noindex and expose no provider, environment, deployment, migration, tenant, count, hostname, error or credential details.

## Dependency classification

Critical: application runtime; required service configuration; database connectivity through the membership read; membership/RBAC schema; Terms acceptance gate; authentication security/audit events. Any critical failure makes readiness unavailable (`503`).

Non-critical for core access: prospect-access diagnostics, distributed rate-limit reporting schema and authentication delivery-event reporting. Failure makes internal/public readiness degraded (`200`), not a claim that email delivery itself has failed. Optional AI being disabled is normal and never degrades readiness. Public trust metadata is diagnostic-only.

Checks select at most one identifier, run concurrently, make no writes/counts, consume no rate limit and send no Auth/email request. There are no retries or recursive health calls. Serverless local recovery logs are diagnostic evidence only and do not constitute reliable global transition alerts.

## Platform Admin diagnostics

`GET /api/levytate-platform/diagnostics` requires a valid Supabase-email LevyTate session, one current active and Auth-bound Platform Admin record, subject equality and the explicit `diagnostics:read` permission. Internal beta sessions and employer roles receive the same safe `403`; unauthenticated callers receive `401`.

It reports only labelled states, safe summaries, checked time and useful duration for runtime; membership/RBAC; prospect access; Terms; rate-limit; security/audit; delivery events; public trust definitions; and the migration `023` schema marker. It reports safe configuration presence booleans, environment label, Terms version and unresolved ownership. It does not replace `supabase migration list --linked`, which remains the ledger parity check at cutover.

## Safe logging

Structured server logs cover readiness failure/recovery, dependency failure, denied diagnostics and timeout. Payload is limited to event and safe outcome/key. Do not log liveness success, request headers, URLs, provider payloads, tokens, cookies, personal data or stack traces.

## Ownership register

Every role and backup must be approved before the first employer.

| Role | Responsibility / escalation | Backup | Status |
| --- | --- | --- | --- |
| Service Owner | Overall availability decision, business impact and customer communication authority | Required | Decision required before first employer |
| Technical Responder | Diagnose, contain, restore and preserve technical evidence | Required | Decision required before first employer |
| Support Owner | Intake, user-safe updates and verified routing | Required | Decision required before first employer |
| Privacy/Incident Owner | Role/breach assessment and legal/privacy escalation | Required | Decision required before first employer |
| Release Owner | Authorise rollback/release and protect Production change control | Required | Decision required before first employer |
| Technical Verifier | Independently validate recovery, tenant/RBAC and regression state | Required | Decision required before first employer |

## Severity framework

- **Critical:** widespread login/tenant-boundary failure, confirmed sensitive-data exposure or critical service unavailable. Contain access, preserve evidence, convene technical/privacy/release owners and assess employer/regulatory duties.
- **High:** material role/workflow outage or repeated authentication failure affecting a controlled employer. Triage scope, contain, assign owner and prepare verified update.
- **Moderate:** non-critical diagnostic/reporting impairment or limited workaround. Record, prioritise and verify fix.
- **Low:** cosmetic/status wording or isolated non-blocking issue. Backlog and review.

No public acknowledgement or resolution time is promised.

## Future external-monitor contract

Required configuration values, excluding secrets:

- Service label: `LevyTate`
- Liveness URL: `https://www.levytate.co.uk/api/levytate-health/live`
- Readiness URL: `https://www.levytate.co.uk/api/levytate-health/ready`
- Method: `GET` (optional independent `HEAD` contract check)
- Expected live: HTTP `200`, JSON `status=operational`, `service=LevyTate`, valid `checkedAt`
- Expected ready: HTTP `200` for operational/degraded; `503` for unavailable; allowlisted JSON keys only
- Timeout: monitor value must exceed application dependency bound of 2.5 seconds but remain short; exact monitor timeout/cadence require owner approval
- Alerts: at least two approved owners; duplicate suppression; recovery notification; basic timestamp/status evidence; no response headers or employer data retained
- Network gate: configure only after the Production domain is deliberately reachable and approved

Provider selection, cadence, escalation channels and retention are the next monitoring sprint. Do not reuse a protected Preview as the external target.

## Incident workflow

Detect → classify → contain/revoke → preserve minimal evidence → notify approved owners/suppliers → assess controller/processor duties → restore → independently verify health/auth/RBAC → communicate safely → record lessons and close. An external monitor must confirm recovery; local instance memory cannot do so reliably.
