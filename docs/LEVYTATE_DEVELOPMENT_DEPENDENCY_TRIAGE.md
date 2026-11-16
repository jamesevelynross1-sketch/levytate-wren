# Development dependency triage — 16 November 2026

The targeted lockfile update reduces the full npm audit from 11 findings (3 high, 8 moderate) to 6 moderate findings. The production-only audit remains at zero. The remaining findings are open and individually recorded below; this is not a claim that the full audit is clean.

The candidate uses Node 22.23.4 and npm 11.6.2, with its own `node_modules` in an isolated worktree. It changes no direct dependency ranges, package manifest, override, major version or application code. The running application's installed modules were not changed.

## Reviewed changes

| Package | Before | Candidate | Consumer |
| --- | --- | --- | --- |
| brace-expansion |1.1.14 /5.0.6|1.1.22 /5.0.13| ESLint and its TypeScript parser glob matching |
| browserslist |4.28.2|4.29.5| Autoprefixer during CSS builds |
| baseline-browser-mapping |2.10.31|2.11.37| Browserslist |
| js-yaml |4.1.1|4.3.2| ESLint configuration loading |
| postcss-selector-parser |6.1.2|6.1.6| Tailwind CSS and postcss-nested |

The resolver also updated the compatible Browserslist datasets and updater, and removed the now-unused `cssesc` dependency. Eleven lockfile nodes changed in total.

One shared production leaf, `caniuse-lite`, changes from 1.0.30001793 to 1.0.30001826 because the patched Browserslist requires newer browser data and Next.js also consumes that package. This was explicitly reviewed. The other 58 non-development lock entries are byte-identical. The production graph therefore changes; the audit remaining at zero does not mean that graph is unchanged. The evidence contains both graph hashes and the complete package diff.

## Remaining findings

All six findings below derive from [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Its published fix is minimatch 11.0.1. The current published typescript-eslint 8.72.2 still depends on minimatch `^10.2.2`, so upgrading typescript-eslint within its major does not remove this finding. A forced minimatch major upgrade or manifest override is outside this update.

| Finding | Installed version | Dependency path | Owner | Review due |
| --- | --- | --- | --- | --- |
| @typescript-eslint/eslint-plugin |8.59.4| type-utils / utils → typescript-estree → minimatch | LevyTate lead engineer |23 Nov 2026, or before client release if earlier |
| @typescript-eslint/parser |8.59.4| typescript-estree → minimatch | LevyTate lead engineer |23 Nov 2026, or before client release if earlier |
| @typescript-eslint/type-utils |8.59.4| typescript-estree / utils → minimatch | LevyTate lead engineer |23 Nov 2026, or before client release if earlier |
| @typescript-eslint/typescript-estree |8.59.4| minimatch | LevyTate lead engineer |23 Nov 2026, or before client release if earlier |
| @typescript-eslint/utils |8.59.4| typescript-estree → minimatch | LevyTate lead engineer |23 Nov 2026, or before client release if earlier |
| minimatch |10.2.5| typescript-estree project-service matching | LevyTate lead engineer |23 Nov 2026, or before client release if earlier |

Each finding remains **open, triaged**. Its upgrade condition is an upstream supported typescript-eslint release that accepts patched minimatch, or a separately reviewed development-only major/override proposal with compatibility tests. The review date is not a blanket risk waiver or client-release approval.

The inspected parser call is `useProgramFromProjectService.js:204`: it matches filenames against configured `allowDefaultProject` patterns using only `{ dot: true }`. The installed minimatch defaults to `optimizationLevel=1`; the published amplification requires level 2 or greater. These inputs originate in lint/project configuration. Untrusted repository or configuration changes remain a build-time exposure and must not be treated as safe merely because the package is development-only. The existing CI job has a 45-minute timeout. Untrusted configuration changes require review; a timeout does not remove this exposure.

No imports of these audited packages were found in application request code. A read-only scan of 148 baseline server trace files and 148 newly built candidate trace files found no audited package paths. This trace inspection is supporting reachability evidence, not proof against all possible future imports or configuration changes. Reassess the findings when lint/project-service configuration or runtime imports change.

## Validation

A targeted dry-run preceded lock-only resolution. Installation used `npm ci --ignore-scripts` in the dedicated worktree; lifecycle scripts were disabled. The full suite passed 1,924 tests with zero failures; two existing opt-in PostgreSQL tests were skipped because this run does not access a database. Lint, TypeScript and the production build passed. The production audit reported zero findings; the full audit correctly exited nonzero with the six open moderate findings above. No shared installation, application runtime, hosted resource or customer data is part of this verification.

[The evidence](evidence/LEVYTATE_DEVELOPMENT_DEPENDENCY_TRIAGE_2026-11-16.json) preserves the complete original 11 findings, remaining 6 findings, exact versions, graph hashes and validation results.

The reviewed fixes are documented by the [brace-expansion advisory](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [Browserslist cache advisory](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [Browserslist custom-statistics advisory](https://github.com/advisories/GHSA-73wf-gq98-2v4g), [baseline mapping advisory](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv), [JS-YAML advisory](https://github.com/advisories/GHSA-2883-xcg3-v3hh), and [selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). Package versions and constraints were verified against the public npm registry on 16 November 2026.
