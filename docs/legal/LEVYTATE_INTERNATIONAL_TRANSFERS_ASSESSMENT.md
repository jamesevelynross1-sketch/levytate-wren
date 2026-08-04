# LevyTate international transfers assessment

> Internal preliminary assessment. A restricted-transfer safeguard is not established by this document.

UK hosting alone does not exclude overseas remote access, support, corporate-group access, email routing, logs, subprocessors or AI processing. Apply the ICO three-step test and complete a transfer risk assessment (now called a data protection test in legislation) before relying on safeguards.

| Workflow | Exporter / importer and roles | Countries/exposure | Adequacy | Proposed safeguard | TRA | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Database/Auth | Employer controller → LevyTate processor → Supabase subprocessor; LevyTate controller for security data | Actual project region plus Supabase corporate/support/subprocessors | Verify each | Supplier UK terms; UK Addendum/IDTA if needed | Required if no adequacy/appropriate inherited coverage | Blocked |
| Application hosting/logs | Employer/LevyTate → Vercel processor | US and worldwide locations disclosed in DPA | Verify UK-US data bridge eligibility and each onward transfer | Vercel DPA UK provisions; Addendum/other safeguard as applicable | Required | Blocked |
| Authentication email | LevyTate/employer → Resend processor | US primary processing and subprocessors; delivery networks | Verify supplier certification/scope and onward locations | UK Extension to EU-US DPF if valid/in-scope or UK Addendum/IDTA | Required | Blocked |
| AI (disabled) | Employer → LevyTate → OpenAI | Depends on contracted entity, region, support and subprocessors | Verify | Approved DPA plus UK safeguard and settings | Required before enablement | Not authorised |
| Incident support | Relevant controller/processor → supplier support | Remote access country varies | Verify per event/provider | Existing approved supplier mechanism; minimise and gate access | Include in supplier TRA | Pending |
| Manual backup | LevyTate local secure storage | UK-controlled Mac/storage unless later transferred | No restricted transfer on current documented route | Prevent consumer cloud sync unless assessed | Not required if UK-only | Validate operationally |

Before pilot, capture executed supplier DPAs, legal entities, processing regions, subprocessor snapshots, UK safeguard modules, transfer risk assessments and supplementary controls. Do not rely solely on a vendor’s “GDPR compliant” statement.
