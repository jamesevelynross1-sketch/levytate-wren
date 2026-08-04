# LevyTate Early Access solicitor review pack

> **Internal draft — 4 August 2026. Not legal advice, approved terms or an invitation to contract.** The current public Terms and Privacy Notice remain v1.0. No real employer acceptance exists. Review the linked drafts as a single pack.

## 1. Product summary and boundary

LevyTate is an invitation-only, multi-tenant apprenticeship operating platform. Core Early Access covers employee applications/status; direct-report manager approvals/support; organisation-wide Apprenticeship Lead applications, learner lifecycle, providers/programmes, reviews/actions/reporting; and separate Platform Admin tenant/access/catalogue support. It does not provide public signup, provider marketplace/ranking, solely automated employment decisions or Production AI by default.

Approval flow is Employee → Line Manager → Apprenticeship Lead → enrolment. Employee and manager visibility is restricted to own/direct-report records; Apprenticeship Lead scope is its organisation; Platform Admin does not make normal employer operational decisions.

## 2. Data-flow summary

An employer authorises a user and role. Supabase Auth/Resend deliver passwordless sign-in; the server binds the Auth subject to exactly one active LevyTate membership and resolves organisation/role. Vercel serves the app/functions, which use server-only Supabase credentials. Employer users create applications, approvals, learner/review/provider/action records under server-enforced tenant/RBAC scope. Safe security, delivery, rate-limit, audit and versioned-terms evidence is recorded. OpenAI code exists but Production AI is disabled pending approval. Manual backup exists; Supabase Pro and confirmed daily backup are mandatory before real data.

## 3. Proposed legal architecture

- Proposed operator: CONTROL MY COSTS LTD (12986530) trading as LevyTate, pending approval; active company verified at Companies House. A non-residential public correspondence address is unresolved. No separate entity or registered-trade-mark status has been evidenced.
- Employer controller / LevyTate processor for employer-directed applications, approvals, learner/review/action and employer relationship records.
- LevyTate independent controller for its security, Auth administration, support, contract/acceptance, billing/legal and incident records.
- Provider catalogue, product improvement and any AI reuse require purpose-specific separate/joint-controller review.

Full workflow and basis analysis: [Controller/processor matrix](./LEVYTATE_CONTROLLER_PROCESSOR_MATRIX.md). Employer lawful bases are deliberately not selected by LevyTate. Proposed LevyTate bases are contract for genuinely necessary individual contracting, legitimate interests subject to LIAs for security/support/administration, and specific legal obligation only where documented.

## 4. Contract drafts for review

- [Employer Agreement](./LEVYTATE_EARLY_ACCESS_EMPLOYER_AGREEMENT_DRAFT.md): parties, scope, users, responsibilities, use, security/confidentiality, availability/support, fees, IP/feedback, suspension/termination/export, warranties/liability, law/notices and versioned acceptance.
- [Data Processing Agreement](./LEVYTATE_DATA_PROCESSING_AGREEMENT_DRAFT.md): instructions, confidentiality/security, subprocessors, rights/breach/DPIA assistance, return/deletion, audit, transfers, records and precedence, with Annexes A–E.
- [Security measures](./LEVYTATE_SECURITY_MEASURES_SCHEDULE.md): actual implemented/validated controls separated from pre-pilot and later plans.

No price, SLA, uptime, liability cap, indemnity, jurisdiction, payment, renewal or deletion period has been invented.

## 5. Privacy, subprocessors and transfers

- [Privacy Notice final candidate](./LEVYTATE_PRIVACY_NOTICE_FINAL_CANDIDATE.md) contains visible unresolved markers; it is not public.
- [Subprocessor schedule](./LEVYTATE_SUBPROCESSOR_SCHEDULE.md) covers Supabase, Vercel, Resend, conditional OpenAI and a future monitoring provider.
- [International-transfer assessment](./LEVYTATE_INTERNATIONAL_TRANSFERS_ASSESSMENT.md) treats region, remote support, group access, logs, email and onward subprocessors separately. Supplier DPA/settings evidence and transfer risk assessments remain go-live blockers.

## 6. Retention, rights and incidents

[Retention options](./LEVYTATE_RETENTION_SCHEDULE_DRAFT.md) cover tenant, membership, application, learner, action, acceptance, support, Auth/security, delivery/rate-limit, incident, backup, contract/billing and deleted-user evidence. No period is approved.

The internal rights procedure verifies identity and organisational authority; separates controller/processor routing; searches application, learner, Auth, supplier, support, audit and backup locations; obtains controller approval; securely delivers; and records evidence. Deletion is subject to lawful retention and backup expiry.

The incident schedule covers detection, containment, evidence, revocation, supplier escalation, risk assessment, role-specific notification ownership, remediation and lessons. Processor notice to the employer is proposed “without undue delay”; no arbitrary shorter deadline is inserted.

## 7. DPIA and sensitive data

[DPIA decision record](./LEVYTATE_DPIA_DECISION_RECORD.md) recommends completing a formal DPIA before first employer due to employment context, profiling/variance, monitoring perception, free text, multi-tenancy and future AI. Dedicated health, disability, ethnicity, religion, trade-union, biometric, criminal or safeguarding fields were not found in Core Early Access, but sensitive content is technically possible through free text. Pre-pilot warnings/minimisation and no solely automated adverse decisions are proposed.

## 8. Terms redline and acceptance

[Terms redline](./LEVYTATE_TERMS_REDLINE.md) recommends v1.1 after approval and reacceptance for material changes. Current v1.0 is untouched. The implemented mechanism permits only an authenticated canonical Apprenticeship Lead to accept for an organisation and stores version, deterministic hash, time, method and role snapshot append-only. Please advise whether signatory authority wording and clickwrap presentation form the full Employer Agreement effectively.

## 9. Business decisions

[Legal decision matrix](./LEVYTATE_LEGAL_DECISION_MATRIX.md) records owner, alternatives and status. James must decide operator/address/contact, support ownership/hours, free/paid pilot and all pricing, term/renewal/cancellation, export, availability position, suspension/termination appetite, liability/insurance context and supplier-change treatment.

## 10. Requested solicitor decisions

1. Confirm operator/trading-name disclosure and suitable non-residential public address.
2. Confirm role matrix, exceptional provider/AI/product-improvement roles and employer lawful-basis allocation wording.
3. Approve LevyTate controller bases/LIAs, sensitive-data prohibition and DPIA conclusion/process.
4. Finalise Employer Agreement formation/authority, risk allocation, termination, law/notices and order of precedence.
5. Finalise DPA, audit/assistance, subprocessor authorisation/notice and deletion/export provisions.
6. Confirm supplier transfer safeguards and transfer data protection tests, including UK-US routes and onward transfers.
7. Approve retention choices and reconciliation of erasure with append-only contractual evidence.
8. Approve Privacy Notice, Terms v1.1/redline and whether reacceptance is sufficient.
9. Advise on ICO fee/registration, records and whether any other apprenticeship/employment rules affect the service.
10. Confirm breach clause and regulator/individual decision ownership.

## 11. ICO and launch gates

[ICO checklist](./LEVYTATE_ICO_REGULATORY_CHECKLIST.md) concludes the official fee assessment must be completed before pilot; exemption is not assumed. Other mandatory gates: professional document approval; supplier contracts/transfers; DPIA/LIAs; retention/export/deletion; free-text warning; named support/privacy/incident owners; Supabase Pro and confirmed daily backups; restore test; and an approved production release. PITR remains disabled unless separately approved.

## 12. Official sources accessed 4 August 2026

- Companies House, company 12986530: exact company facts.
- ICO: controllers/processors and contracts; lawful bases; DPIAs; individual rights; personal-data breaches; international transfers/IDTA/Addendum/transfer risk assessments; fee guidance.
- GOV.UK: data protection for business and ICO fee/public-register-address guidance.
- UK GDPR/Data Protection Act official statutory materials: Articles 6, 9, 10, 28, 30, 32–36.
- Supplier official documents: Supabase DPA/privacy/security/regions/subprocessors; Vercel DPA/security/subprocessors; Resend DPA/privacy/subprocessors; OpenAI DPA/subprocessor list (conditional only).

Supplier contracts and actual account settings must be captured at signature; this pack does not accept them. No credentials, test identities or private record contents are included.
