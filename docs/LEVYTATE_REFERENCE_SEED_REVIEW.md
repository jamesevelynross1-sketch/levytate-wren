# Reference seed review candidate

Prepared 9 November 2026 for issue #7. **Not approved for import. Current source verification has not been performed.** This is an offline, deterministic JSON review artifact, separate from application runtime data and migrations. It reads no credentials, connects to no service and cannot execute an import.

Generate to a new file using Node 22:

```sh
node --import tsx scripts/build-release-reference-candidate.ts /private/tmp/levytate-reference-review.json
```

The prepared artifact is SHA-256 `cb92a93ba5dfdd91347efac6faac2ff1445ea2a9f24c67614c8e379f42dbdb8c`. Its committed inputs are:

| Input | Recorded snapshot | SHA-256 |
| --- | --- | --- |
| `lib/levytate/data/mvp/apprenticeship-standards.generated.json` | 2 July 2026 | `be78178e37ec55efa41a858eb7a8079f851fc93062aa1caca2dbd375cf1d1b02` |
| `data/provider-programme-verification-2026-08.json` | 26 August 2026 | `af0c2f88b93c69971b93645e58dbe76776909eaf0a68d72777c6e32c9b56b1e3` |

The candidate contains 937 unique reference records, 12 providers and 151 programmes with validated provider/standard references and HTTPS evidence URLs. Source statuses and dates are preserved: 595 records were historically approved, including 575 apprenticeship standards. Four programmes have no standard mapping and must not be represented as eligible apprenticeship pathways without evidence.

Four source records are quarantined with their original row numbers, reasons and record checksums: three have missing identifiers/titles; withdrawn standard ST0780 has an unknown level encoded as zero. No identifier, level, verification date or approval is invented to make these records importable. Unknown level is not treated as a verified level zero. Duplicate identifiers, invalid statuses, negative funding, mismatched programme references and missing evidence reject the build.

This artifact prepares the existing material for accountable review; it does not establish that July/August information remains current. Before a separately approved import, the catalogue owner must refresh official source evidence, resolve the four quarantined rows and unmapped programmes, approve the resulting exact artifact, and compare existing database identifiers and newer records. Any subsequent import must be additive and conflict-aware: no blanket delete, stale replacement, automatic verification promotion or recreation of excluded migration 010. Live routes continue to read canonical database records and do not fall back to this artifact.

Validation: ten unit checks challenge malformed and conflicting inputs; the actual repository sources generated the recorded artifact. Hosted import, current source verification and employer publication remain **NOT RUN**.
