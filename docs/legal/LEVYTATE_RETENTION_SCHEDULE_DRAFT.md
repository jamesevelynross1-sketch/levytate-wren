# LevyTate retention schedule — decision draft

> No period below is approved. “Options” prompt a documented choice; the employer decides retention for its controller records, subject to law and legitimate need.

| Record | Purpose / current technical position | Decision options (not defaults) | Disposal / owner / status |
| --- | --- | --- | --- |
| Employer account | Contract/service and tenant scope; retained while active | Active term + selected post-termination window; longer minimal contract evidence | Export then delete/anonymise; legal/product; pending |
| Memberships/role history | Access and audit | Active + short closure period; retain minimal historical role with decisions | Deactivate, minimise identifiers; employer/security; pending |
| Applications/approvals | Apprenticeship decision record | Employer policy tied to employment/apprenticeship need; separate declined/withdrawn option | Export/delete or anonymise under instruction; employer/legal; pending |
| Learner lifecycle/reviews/progress | Operational record | Employer apprenticeship/HR schedule; completed/withdrawn trigger | Export/delete/anonymise; employer/legal; pending |
| Operational actions/events | Accountability and workflow | Align to linked application/learner plus dispute window | Cascade only through approved process; employer/legal; pending |
| Terms acceptance | Contract evidence | Contract limitation/evidence option to be selected | Append-only currently; retain minimal evidence; LevyTate legal; pending |
| Support | Resolution/evidence | Short operational period; longer only for dispute/security case | Delete attachments/unneeded content first; support/privacy; pending |
| Auth/security events | Access protection/investigation | Short rolling security window; extend only for active incident | Delete or pseudonymise; security/privacy; pending |
| Rate-limit records | Abuse prevention | Window counters + short investigation period | Scheduled deletion; security; pending |
| Delivery events | Delivery diagnosis; technical model currently references 90 days | Choose shorter operational window or justify 90 days | Scheduled deletion/minimise recipient; security/privacy; pending |
| Incidents | Response, accountability, claims | Severity-based closure period plus approved legal hold | Restricted deletion; security/legal; pending |
| Backups | Recovery; manual Free-plan baseline only | Backup cycle based on recovery need; managed daily policy after Pro | Cryptographic erasure/expiry; operations; blocked pending Pro |
| Contract/billing | Contract, tax/accounting | Period required by named obligations and claims decision | Restricted archive then secure deletion; finance/legal; pending |
| Deleted-user identifiers | Preserve decision/acceptance evidence | Pseudonymous stable reference vs retained minimum identity | Tokenise/minimise; legal/privacy; pending |

## Required selections

James and solicitor must approve triggers, active/archive periods, legal holds, employer-configurable differences, export timing, deletion evidence and backup expiry. Engineering must then map every table, Auth identity, supplier system, log and manual backup to the schedule and test deletion without breaking tenant integrity.
