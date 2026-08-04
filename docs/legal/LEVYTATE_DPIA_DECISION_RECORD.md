# LevyTate DPIA decision record

> Internal draft — not a completed or approved DPIA.

## Screening result

A formal DPIA is **prudent and required as a LevyTate go-live governance gate before the first employer**, even if final legal screening concludes Article 35 is not strictly triggered at pilot scale. Reasons include workplace power imbalance; role-based visibility of applications and progress; derived target variance and operational conditions; employee-monitoring perception; possible special-category content in free text; multi-tenant impact; and future AI assistance/profiling. Scale is currently controlled and LevyTate does not intentionally collect biometrics, ethnicity, religion, trade-union, criminal-offence or health data, or make solely automated employment decisions. Those mitigations do not remove the need to document the assessment.

## Sensitive/high-risk data audit

| Category | Current position |
| --- | --- |
| Health, disability, safeguarding, disciplinary/performance detail | Not intentionally requested as dedicated fields; technically possible in application, review, support and operational free text. Prohibit unnecessary entry and add contextual warnings/minimisation |
| Ethnicity, religious belief, trade-union, biometric and criminal-offence data | No intentional Core Early Access fields found; technically possible only through unrestricted text/uploads. Prohibit unless a later approved workflow supplies a legal condition and controls |
| Progress/variance and workforce capability | Intentionally processed as ordinary employment/apprenticeship operational data, but potentially high impact in context; no solely automated decision should be permitted |
| AI prompts/context | Code path exists; Production AI disabled pending separate approval. User text can contain sensitive data, so minimisation, supplier settings and human review are mandatory gates |

## DPIA scope and consultation

Map applications, approvals, learner records, reviews, actions, reports, Auth/security, suppliers, exports/deletion and AI. Consult product/security, James, solicitor/privacy adviser and a representative employer; consider worker/user views without exposing production data. Document purpose, necessity/proportionality, data flow, role, lawful basis/Article 9 or 10 condition, recipients/transfers, retention and rights.

## Principal risks and required controls

- Wrong-tenant or overbroad-role disclosure: server scope, RLS, Platform Admin separation, regression tests and audit.
- Employment detriment from inaccurate/derived information: source labels, correction route, human decision ownership and no automated adverse decision.
- Sensitive data in free text: warnings, purpose-specific prompts, length/access controls, staff guidance and deletion process.
- AI leakage or overreliance: disabled by default, employer opt-in/instruction, supplier DPA/settings, scoped retrieval, output warning and human review.
- Stale access: live membership/expiry/role revalidation, Auth revocation and periodic access review.
- Unbounded retention/export gaps: approved schedule, tested export/closure and backup expiry.
- Supplier/transfer risk: approved list, notices, DPAs, transfer data protection tests and minimisation.
- Availability/loss: Supabase Pro/daily backup go-live gate, manual pre-migration dumps and restore exercise.

Residual risks, owners, target dates, consultation outcome and approval signatures remain open. If high residual risk cannot be mitigated, obtain professional advice on prior ICO consultation.
