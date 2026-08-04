# LevyTate Production readiness

## Service-health cutover gate

Before the first employer:

- approve primary/backup Service, Technical, Support, Privacy/Incident, Release and Verification owners;
- select/configure an external monitor against the approved Production domain, with duplicate suppression and recovery alerts to at least two owners;
- validate public liveness/readiness/status contracts from outside the hosting account;
- approve incident severity, escalation and communications;
- upgrade Supabase to Pro and confirm daily backups; keep PITR disabled unless separately approved;
- complete a secure manual dump and isolated restore test before further schema migration;
- confirm migrations `006–018`, `020–023` locally/remotely and schema marker `023`; migration `019` remains absent;
- approve legal/operator, DPA, DPIA, retention, transfer, ICO and support decisions;
- run Production authentication, logout, tenant isolation, RBAC, Terms and service-health smoke tests without real employer data;
- confirm Production beta login and AI states match approved policy;
- record release owner approval and independent technical verification.

## Production validation sequence

1. Confirm exact Git commit, branch, environment and approved change window.
2. Confirm secrets by presence only and supplier/account ownership.
3. Verify migration ledger read-only; do not repair or push during a health check.
4. Check liveness, readiness and status externally.
5. Authenticate one approved fictional/isolated identity; verify role/organisation, refresh and logout.
6. Verify Platform Admin diagnostics and employer-role denial.
7. Exercise a controlled dependency test outside live data, then verify safe `503` and recovery.
8. Confirm monitor alert/recovery delivery to approved owners.
9. Confirm public/legal versions, empty pre-employer acceptance state and backup evidence.
10. Record go/no-go. Roll back or stop on critical failure.

## Current status

Application-owned health contracts and protected Preview validation are available. External monitoring, approved owners, Production-domain cutover, Supabase Pro/daily backup confirmation, legal approval and real employer onboarding remain incomplete. A Preview configuration must never be labelled Production-ready solely because its variables are present.
