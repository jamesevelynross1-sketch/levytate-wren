# LevyTate legal decision matrix

> Internal draft — 4 August 2026. This is a business and solicitor review aid, not legal advice or approval. `Pending` means the position must not be published or relied on for employer onboarding.

## Operator identity

- Trading name: **LevyTate**.
- Proposed operator: **CONTROL MY COSTS LTD**, company number **12986530**, active private limited company, incorporated 30 October 2020.
- Companies House currently displays a registered office at **9 Trent Walk, Brough, United Kingdom, HU15 1GF**. This may be residential and must not be copied into public LevyTate content until James approves a suitable public correspondence address.
- Product contact proposed: `hello@levytate.co.uk`.
- No evidence reviewed establishes a separate LevyTate legal entity. An official UK IPO trade mark search and solicitor confirmation remain required before describing LevyTate as a registered trade mark. Working description: “LevyTate is a trading name of Control My Costs Ltd”, pending approval.

## Decisions

| Decision | Current proposed position | Alternatives | Commercial / operational / data-protection impact | James | Solicitor | Source or evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Operator | Control My Costs Ltd trading as LevyTate | Create separate entity later | Determines contracting party, notices and controller identity | Yes | Yes | Companies House, accessed 4 Aug 2026 | Pending |
| Public address | Approve a non-residential correspondence address | Registered office if expressly approved | Trust pages, contracts and ICO register | Yes | Yes | GOV.UK fee guidance warns public-register address is visible | Blocked |
| Privacy contact | hello@levytate.co.uk | Dedicated privacy mailbox | Must have monitored ownership and continuity | Yes | Review | Current product and DNS/email setup | Pending |
| Role model | Employer controller / LevyTate processor for employer records; LevyTate controller for its own security, contract, billing, support and legal records | Separate/joint controller per exceptional workflow | Drives notice, DPA, rights and breach responsibilities | Yes | Yes | Activity matrix and ICO controller guidance | Pending |
| Controller lawful bases | Contract for contracting representatives; legitimate interests for security/support/product administration; legal obligation only where a specific law is documented | Consent for genuinely optional activity | LIAs and notices required; no employer basis chosen by LevyTate | Yes | Yes | ICO lawful-basis guidance | Pending |
| Sensitive data | Do not intentionally collect; warn against unnecessary health/safeguarding/disciplinary detail in free text | Add tightly governed fields later | Minimisation and Article 9/10 risk | Yes | Yes | Code audit; ICO special-category guidance | Pending |
| DPIA | Complete before first employer; revisit before Production AI | Record “not required” with rationale | Employment context, profiling, AI and monitoring perception create elevated risk | Yes | Yes | ICO DPIA criteria; product audit | Required before pilot |
| Retention | Select periods by record class from retention options | Employer schedule controls processor data | Needs deletion/export engineering and backup treatment | Yes | Yes | Retention schedule | Blocked |
| Subprocessors | General authorisation plus advance change notice and right to object/exit | Specific authorisation | Contract review and notification workflow required | Yes | Yes | Supplier DPAs and UK GDPR Article 28 | Pending |
| Transfers | Complete supplier-by-supplier transfer data protection tests; use approved UK safeguards where required | UK-only suppliers/regions | US and global support/subprocessor exposure remains possible | Yes | Yes | ICO 2026 transfer guidance; supplier DPAs | Blocked |
| Support | Email support, commercially reasonable during Early Access, no SLA | Defined business-hours targets | Set mailbox owner and incident escalation | Yes | Review | Current Support page | Pending |
| Availability | No uptime promise or service credits in controlled pilot | Later paid SLA | Avoid unsupported commitment | Yes | Yes | Current product status | Pending |
| Pilot pricing | No price stated until approved | Free or paid fixed-term pilot | VAT, invoice, term, renewal and cancellation depend on choice | Yes | Yes | Commercial decision sheet below | Blocked |
| Termination/export | Suspend for security; agreed export and deletion process on exit | Immediate deletion | Export format, retention exceptions and notice need decisions | Yes | Yes | Draft agreement/DPA | Pending |
| Liability cap | Blank schedule item | Cap tied to fees/insurance; selected carve-outs | Material risk allocation | Yes | Yes | Draft agreement | Blocked |
| Indemnities | None inserted pending advice | Targeted mutual/one-way provisions | Material risk allocation | Yes | Yes | Draft agreement | Blocked |
| Governing law/jurisdiction | Blank pending approval | England and Wales candidate | Enforcement and notices | Yes | Yes | Draft agreement | Blocked |
| DPA | Separate Article 28 schedule attached to agreement | Integrated terms | Mandatory for processor activity | Yes | Yes | ICO controller/processor contract guidance | Pending |
| ICO fee | Complete official self-assessment before pilot and pay if required | Document exemption if applicable | Control My Costs is expected to act as controller and should not assume exemption | Yes | Review | ICO/GOV.UK fee guidance | Required before pilot |

## Commercial decision sheet

James must select and document: free or paid pilot; duration; licence fee; billing frequency; VAT treatment; renewal; cancellation notice; export entitlement and format; additional-services rates; implementation/import scope; and price-change treatment. No prior conversation is treated as an offer. No default values are proposed.

## Support decision sheet

Proposed for consideration only: email support through `hello@levytate.co.uk`; commercially reasonable support during Early Access; no formal SLA; planned-maintenance notice where practicable; incident updates proportionate to impact; an agreed export on exit; and named primary/secondary internal escalation owners. James must approve channel ownership, support hours, severity model, target (not guaranteed) responses, maintenance communications and export format.

## Source register

| Source | Accessed | Relevance / decision supported | Professional confirmation |
| --- | --- | --- | --- |
| [Companies House company 12986530](https://find-and-update.company-information.service.gov.uk/company/12986530) | 4 Aug 2026 | Name, number, status, registered office | Operator/trading-name wording and address approval required |
| [ICO controller/processor contracts](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/) | 4 Aug 2026 | Functional role analysis and DPA terms | Yes |
| [ICO lawful-basis guide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/) | 4 Aug 2026 | Controller lawful-basis choices and LIA need | Yes |
| [ICO DPIA guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/) | 4 Aug 2026 | Employment, profiling and AI risk decision | Yes |
| [ICO international-transfer guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/) (updated Jan 2026) | 4 Aug 2026 | Restricted-transfer test, safeguards and transfer risk assessment | Yes, per supplier |
| [ICO breach guidance](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide/) | 4 Aug 2026 | Processor notice without undue delay; controller risk decision | Yes |
| [GOV.UK data-protection-fee guidance](https://www.gov.uk/data-protection-register-notify-ico-personal-data) | 4 Aug 2026 | Fee assessment and public address | Assessment still required |
| [Supabase DPA](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf), [Vercel DPA](https://vercel.com/legal/dpa), [Resend DPA](https://resend.com/legal/dpa), [OpenAI DPA](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) | 4 Aug 2026 | Supplier identities, roles, subprocessors and transfer mechanisms | Contracts/settings must be checked before pilot |
| LevyTate repository and production-foundation runbooks | 4 Aug 2026 | Actual processing, security controls and current limitations | Factual engineering evidence only |

## Application impact

**Before first employer:** approve operator/address and documents; complete DPIA, LIAs, ICO fee assessment, supplier DPAs/transfers; upgrade Supabase to Pro and confirm daily backup; add free-text sensitive-data warnings; implement employer export/account closure and documented deletion process; assign privacy, support and incident owners; publish versioned approved notice/terms and capture instructions.

**Before wider launch:** automate retention; subprocessor-change notices; incident case management; audit export; formal restore exercise; monitoring provider assessment; AI opt-in/disablement and production data controls.

**Optional:** self-service rights dashboard, configurable employer retention policies and enhanced compliance reporting.
