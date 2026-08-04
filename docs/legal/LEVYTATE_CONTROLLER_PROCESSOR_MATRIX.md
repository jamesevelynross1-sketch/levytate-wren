# Controller, processor and lawful-basis matrices

> Internal draft. Roles follow factual purpose and essential means, not labels. Employer lawful bases remain the employer’s decision.

## Processing activity matrix

| Activity | Subjects / data | Purpose and decision maker | Proposed roles | Suppliers / transfer exposure | Basis and retention owner | Approval |
| --- | --- | --- | --- | --- | --- | --- |
| Employer setup and employer account administration | Employer contacts, organisation details | Employer requests workspace; LevyTate sets service-administration method | Separate purposes: employer controller for its staff data; LevyTate independent controller for contract/admin records | Supabase, Vercel; possible non-UK access | LevyTate basis: contract or LI; James/privacy owner | Pending |
| Authentication | Users; email, Auth subject, session/security metadata | LevyTate determines secure-access operation | LevyTate independent controller for security; processor where implementing employer access instruction | Supabase, Vercel, Resend | LI proposed; security owner | Pending/LIA |
| Membership and role access | Users; organisation, role, status | Employer determines authorised people/roles; LevyTate implements RBAC | Employer controller / LevyTate processor; LevyTate controller for abuse/security evidence | Supabase/Vercel | Employer basis; employer retention, LevyTate security retention | Pending |
| Applications and approvals | Employees/managers; identity, role, answers, decisions, notes | Employer determines apprenticeship workflow | Employer controller / LevyTate processor | Supabase/Vercel | Employer decides; employer/legal owner | Pending |
| Learner, progress and reviews | Learners/managers/provider contacts; programme, progress, review, support notes | Employer operates apprenticeship records | Employer controller / LevyTate processor | Supabase/Vercel | Employer decides; employer/legal owner | Pending |
| Operational actions | Users/learners; tasks, dates, reasons, events | Employer workflow; platform derives operational conditions | Employer controller / LevyTate processor | Supabase/Vercel | Employer decides; employer/legal owner | Pending |
| Provider information | Provider contacts and relationship notes | Platform catalogue facts partly LevyTate purpose; employer relationship records employer purpose | Separate controllers for catalogue vs employer relationship; processor for hosted employer notes | Supabase/Vercel | LevyTate LI candidate for catalogue; product owner | Pending/LIA |
| Support requests | Users; contact, issue, limited account facts | LevyTate determines support administration | LevyTate independent controller; processor for employer-record investigation | Email provider/Microsoft 365, Vercel/Supabase as relevant | LI proposed; support/privacy owner | Pending/LIA |
| Audit/security events | Users; actor, action, timestamps, safe metadata | LevyTate determines security/accountability controls | LevyTate independent controller, with processor evidence supplied to employer | Supabase/Vercel | LI and legal obligation where specified; security owner | Pending/LIA |
| Auth delivery events and rate limits | Users; pseudonymous counters, delivery metadata | LevyTate prevents abuse and diagnoses delivery | LevyTate independent controller | Supabase, Resend, Vercel; US/global exposure | LI proposed; security owner | Pending/LIA |
| Terms acceptance | Employer representative; identity, role snapshot, version/hash/time | LevyTate evidences contract; employer representative accepts | LevyTate independent controller | Supabase/Vercel | Contract and LI; legal owner | Pending |
| Platform analytics/product improvement | Users; usage and derived metrics | LevyTate would determine improvement purpose | LevyTate independent controller; joint-controller assessment if employer co-defines profiling | Provider not yet confirmed | LI only after LIA and minimisation; product/privacy owner | Not enabled/approved |
| AI/Copilot (if enabled) | User prompts and scoped operational context | Employer workflow instruction vs LevyTate model/product purpose must be separated | Processor for employer-instructed assistance; separate/joint assessment for any model improvement | OpenAI and subprocessors; transfers possible | Employer basis for workflow; LevyTate basis for own logs; AI/privacy owner | Disabled pending approval |
| Backups | All hosted records | Resilience for instructed service and LevyTate security | Mirrors source role: processor or controller | Supabase/manual secure storage | Respective owner; operations owner | Free-plan limitation; Pro gate |
| Incident investigation | Users and affected persons; logs/evidence | LevyTate contains service incident; employer decides its notifications | Separate controllers for own duties; processor assistance for employer records | Relevant suppliers/support channels | LI/legal obligation as applicable; security/legal owner | Pending |

No current workflow clearly requires joint controllership, but co-designed workforce profiling, shared AI improvement, or shared provider-selection purposes require a fresh assessment before enablement.

## LevyTate controller lawful-basis proposals

| Purpose | Proposed basis | Why it may apply / alternatives rejected | LIA | Status |
| --- | --- | --- | --- | --- |
| Contracting representative, terms and billing | Contract where necessary for the individual’s contract; otherwise legitimate interests for corporate contracting | Consent is not freely necessary; legal obligation needs a named law | Yes for corporate representatives | Pending solicitor review |
| Authentication, fraud prevention, RBAC and security audit | Legitimate interests | Expected, necessary service protection; contract alone may not cover all security evidence | Yes | Pending |
| Support administration | Legitimate interests; contract where directly necessary | Consent is inappropriate for routine support | Yes | Pending |
| Compliance, claims and mandatory records | Legal obligation only when the specific UK rule is recorded; otherwise legitimate interests | Avoid generic “legal obligation” | Sometimes | Pending |
| Platform catalogue and service improvement | Legitimate interests after minimisation and LIA | Consent may be needed for optional analytics; no unexpected reuse | Yes | Not approved |
| Optional marketing | Consent or legitimate interests only after PECR/UK GDPR assessment | Not part of Early Access operational email | Yes if LI | Out of scope |

Vital interests and public task are not proposed for routine LevyTate controller processing. The employer must identify and document its own Article 6 basis and any Article 9/10 condition for employee/apprenticeship records.

## Data-rights procedure

1. Receive at the approved privacy/support address; log minimum necessary details.
2. Verify identity proportionately and verify the requester’s organisational authority separately.
3. Classify LevyTate as controller or processor for each requested record. Route processor requests promptly to the employer controller and assist only on documented instruction.
4. Search user/membership, Auth, application, learner, review, operational action, terms, support, delivery/rate-limit/security, audit and backup locations as applicable.
5. Involve suppliers through their approved channels; do not disclose another tenant’s data.
6. Escalate exemptions, manifestly unfounded/excessive requests, litigation holds, third-party data and deletion/evidence conflicts to legal review.
7. Have the responsible controller approve the response. Deliver through a secure channel and record searches, redactions, decision and completion.
8. For correction, restriction, objection, portability, employer-authorised export and closure, update only authorised systems and record downstream/backup treatment. Do not promise automatic erasure where an approved retention duty applies.
