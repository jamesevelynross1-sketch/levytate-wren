# LevyTate security measures schedule

> Internal factual draft. Status is based on repository evidence and prior controlled validation, not certification.

| Control | Status | Factual position / next evidence |
| --- | --- | --- |
| Individual passwordless authentication | Implemented and validated | Supabase email authentication; membership checked before provider invocation |
| Single-use magic links | Implemented and validated | Callback verifies provider token; reuse/expiry fails safely |
| Session cookies | Implemented and validated | HTTP-only, SameSite=Lax, root path; Secure in Production; private/no-store responses |
| Session refresh/logout | Implemented and validated | Current-browser refresh revocation, application-cookie expiry and protected-route denial |
| RBAC and organisation isolation | Implemented and validated | Canonical server role, organisation-derived scope, direct-report constraints and cross-tenant denial |
| Platform Admin separation | Implemented and validated | Support/catalogue administration separated from employer operational decisions |
| Database RLS/service-role isolation | Implemented; validated by migrations/tests | RLS/forced RLS on sensitive security/acceptance tables; browser privileges denied; server secrets only |
| Access expiry/revocation | Implemented and validated | Membership, prospect expiry, Auth binding and role revalidated on protected requests |
| Distributed rate limiting | Implemented and validated | Supabase-backed atomic counters, HMAC-derived actor keys, environment isolation, fail-closed boundaries |
| Security/delivery event logging | Implemented and validated | Safe events avoid token/cookie/provider payloads; delivery lifecycle monitoring exists |
| Append-only acceptance evidence | Implemented and validated | Version/hash/time/role evidence; service role SELECT/INSERT only |
| Encrypted transport | Implemented at public provider endpoints; supplier confirmation retained | HTTPS/TLS; do not claim unverified at-rest characteristics for LevyTate as a whole |
| Secrets management | Implemented operationally | Local ignored environment file and Vercel/Supabase secret settings; no secrets in repository |
| Preview protection | Implemented and validated | Vercel Authentication protects Preview independently of LevyTate login |
| Backup | Manual procedure implemented; managed daily backup planned before pilot | Supabase Free is current; secure manual dump/checksum runbook exists. Pro/daily-backup confirmation is a gate; PITR remains disabled |
| Incident response | Drafted; planned before pilot | Assign owners, restricted incident record and test escalation |
| Development/release separation | Implemented in part | Feature branch/protected Preview; explicit Production deployment required. Formal release approval record planned |
| Penetration test / external assurance | Not claimed; planned before wider launch | Scope and provider require approval |
| 24/7 monitoring, ISO, Cyber Essentials, DR guarantee | Not claimed | No supporting evidence; do not publish |

## Security responsibilities

LevyTate owns platform implementation and supplier configuration. Employers own authorised-user selection, role accuracy, lawful instructions, secure endpoint use and prompt reporting. Both must keep incident contacts current. The schedule must be reviewed after material architectural or supplier change.

## Incident response and escalation

1. Detect/report through the approved channel; open a restricted case with time, reporter, affected systems and minimal facts.
2. Triage confidentiality, integrity, availability and ongoing access risk. Revoke access/rotate credentials or isolate functions where authorised.
3. Preserve relevant audit evidence without copying unnecessary content; maintain chain and decision log.
4. Escalate to named security, privacy, product and legal owners and affected suppliers.
5. Identify roles per affected processing. As processor, notify the employer controller without undue delay and provide available facts/assistance. For LevyTate controller data, LevyTate owns its regulatory risk decision. The employer owns its controller ICO/individual notification decision.
6. Remediate, validate containment and recovery, communicate proportionately, document reportability decisions, close with lessons/actions.

No shorter contractual deadline is promised in this draft. The employer-facing clause should require notice without undue delay and progressive updates, subject to solicitor approval.
