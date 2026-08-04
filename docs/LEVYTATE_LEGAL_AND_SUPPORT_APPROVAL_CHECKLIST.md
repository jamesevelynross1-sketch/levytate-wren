# LevyTate legal and support approval checklist

## Mandatory approvals before real employer onboarding

- [ ] Confirm the contracting/operator legal entity, registered address and public contact details.
- [ ] Confirm controller/processor roles for each Core Early Access workflow.
- [ ] Approve lawful-basis wording for each personal-data purpose.
- [ ] Approve organisation-specific processing terms and instructions.
- [ ] Approve retention and deletion periods listed below.
- [ ] Confirm international-transfer locations and safeguards for enabled providers.
- [ ] Approve Early Access liability, suspension, termination and governing-law terms.
- [x] Implement the technical versioned Early Access Terms acceptance mechanism.
- [ ] Obtain professional approval of the published legal content before issuing the first real employer account. Privacy remains informational and is not clickwrap.
- [ ] Upgrade the production Supabase project to Pro and confirm daily backups before loading real employer or employee data. Keep PITR disabled and spend cap enabled unless separately approved.
- [ ] Confirm production support ownership, escalation contacts and incident communications.

Nothing unchecked may be represented publicly as approved or certified.

Real employer invitations remain prohibited while any legal-content approval above is outstanding, even though the technical acceptance mechanism is complete.

## Internal service-provider inventory

| Service | Verified purpose | Data involved | Location/transfer position | Enabled status | Contract/disclosure status | Unresolved approval |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase | Database, authentication and protected service APIs | Account, membership, organisation and operational records; authentication events | Project-region and transfer position require contract confirmation | Enabled | Public overview is generic; detailed disclosure pending | DPA, region, subprocessors and transfer safeguards |
| Vercel | Application hosting, Preview and runtime delivery | Requests, runtime logs and data processed by application functions | Deployment-region and transfer position require confirmation | Enabled | Detailed disclosure pending | Contract, log settings, region and transfer safeguards |
| Resend | Transactional authentication-email delivery | Recipient address, message metadata and delivery events | Processing location and transfer position require confirmation | Enabled for authentication delivery | Sender configured; detailed disclosure pending | DPA, subprocessors, location and retention |
| OpenAI | AI-assisted responses only when production AI is enabled | User prompt and scoped platform context sent by the enabled function | Must be confirmed before production enablement | Conditional; code path exists | Not approved here for real employer data | Production enablement, contract, data controls and disclosure |
| Monitoring provider | No separate production monitoring provider identified in the repository audit | None confirmed | Not applicable until selected | Not identified | Not disclosed | Select and approve only if required |

Do not treat this inventory as a public subprocessor list until legal, contractual and location facts have been verified.

## Retention decision register

| Record category | Current technical fact | Approved period | Required decision owner |
| --- | --- | --- | --- |
| Authentication email delivery events | Technical cleanup model uses 90 days | Not legally approved | Security/privacy owner |
| Authentication rate-limit events | Stored for distributed enforcement and audit | Not approved | Security/privacy owner |
| Authentication identities and sessions | Maintained for active controlled access | Not approved | Security/privacy owner |
| Early Access requests and prospect access | Supports invitation, expiry and revocation | Not approved | Product/privacy owner |
| Organisation memberships and role history | Supports access and audit context | Not approved | Product/privacy owner |
| Applications and approval records | Core employer workflow record | Not approved | Employer/legal owner |
| Learner lifecycle, progress and review records | Core operational record | Not approved | Employer/legal owner |
| Provider relationships and reviews | Core provider-management record | Not approved | Employer/legal owner |
| Operational actions and lifecycle events | Supports accountable operations | Not approved | Employer/legal owner |
| Support and incident records | Needed for resolution and evidence | Not approved | Support/security owner |
| Backups | Free-plan baseline and secure manual dump process only; daily managed backup is a go-live gate | Not approved | Security/operations owner |

No period should be added to public copy until its purpose, trigger, deletion mechanism and exceptions are approved.

## Incident process

1. Receive the report through the approved support channel; never request passwords, magic links, tokens or credentials.
2. Record time, reporter, affected service and a minimal factual description in a restricted incident record.
3. Triage severity, ongoing exposure and account-access risk. Revoke or contain access where authorised and proportionate.
4. Preserve relevant logs and evidence without copying unnecessary personal data.
5. Notify the internal security/privacy owner and relevant organisation contact according to the approved escalation matrix.
6. Assess notification duties and communications with qualified legal/privacy input; do not make unsupported breach statements.
7. Resolve, validate containment, record decisions and identify corrective actions.
8. Close only after ownership, follow-up and safe retention/deletion of incident evidence are recorded.

## Unsupported-claim audit

Public copy and launch material must not claim or imply:

- public self-service signup;
- 24/7 support, a guaranteed response time or guaranteed uptime;
- Digital Apprenticeship Service integration unless implemented and verified;
- provider endorsement, ranking, rating or automated selection;
- predictive analytics or automated employment decisions;
- a compliance certification or registration not independently verified;
- managed daily backups while the Supabase production project remains on Free;
- that LevyTate is fully launched before controlled production approval.

## Production support readiness

- [ ] Name primary and secondary support owners.
- [ ] Approve severity definitions and escalation contacts.
- [ ] Approve identity-verification procedure for account and data requests.
- [ ] Approve incident and privacy-request record storage.
- [ ] Confirm support mailbox access, continuity and secure handling.
- [ ] Complete the acceptance-model implementation and tests.
- [ ] Complete legal review of all pages marked `legal_approval_required` in Platform Admin.
