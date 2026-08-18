# LevyTate Levy Finance

## Purpose and boundary

Levy Finance gives an employer Apprenticeship Lead or Employer Admin a clear monthly view of Apprenticeship Service (DAS) levy transactions. It is an employer operating workspace, not payroll software, an accounting ledger, or a replacement for DAS. Employee, Line Manager and Platform Admin roles cannot access it.

Sprint 1 deliberately uses a CSV import. No DAS API connection, bank connection, spreadsheet library, predictive forecast, marketplace behaviour, or finance write action is included.

## Data sources and persistence

- The empty state accepts a DAS transaction-history CSV of no more than 5 MB.
- The parser recognises common DAS-like headings and offers explicit manual mapping when date, description, or monetary fields cannot be identified safely.
- Dates must be explicit UK `DD/MM/YYYY` or ISO `YYYY-MM-DD` dates.
- Monetary values are converted to integer pennies before calculation.
- Duplicate fingerprints are ignored. Malformed rows are reported. Unclassified rows remain visible under **Needs review** and are excluded from category totals.
- The Ground Control demonstration uses 20 months of wholly fictional illustrative values, providers, programmes and learner labels.
- A local demonstration is stored under an organisation-scoped browser key. A Supabase-backed workspace retains imported finance data only for the current browser session in Sprint 1.
- No database migration or production finance table is introduced in this sprint.

## Deterministic transaction categories

The importer uses fixed description rules for levy funding received, apprenticeship provider payments, levy expiry, transfers in, transfers out, and refunds or adjustments. Anything else is `other` and requires review. Classification never uses an LLM.

Sign handling is canonical: funding and transfers in are positive; provider spend, expiry and transfers out are negative. Refunds and adjustments preserve their source sign. Calculations expose received, spend, difference, expiry, transfer net, adjustments and net movement by calendar month.

## Balance hierarchy

1. The newest balance reported in an imported DAS row.
2. A balance manually confirmed from DAS by the authorised user.
3. **Not confirmed** when neither exists.

LevyTate does not infer an authoritative current balance by accumulating incomplete transaction history.

## Finance Copilot

Contextual Finance questions are resolved deterministically in the browser from the calculated Finance summary. Supported intents cover spend, contributions received, current balance, expiry, spend-versus-contribution comparison and a general summary. Raw transaction rows are not included in an API request or sent to an LLM. Finance Copilot cannot mutate data.

## Security and access

- `finance:read` controls module visibility and route access.
- `finance:manage` is limited to Apprenticeship Lead and Employer Admin for local/session import and balance confirmation.
- Platform Admin has no employer Finance permission through broad inheritance.
- Core Early Access policy denies unauthorised deep links and redirects to the role's first safe module.
- File names are sanitised; uploaded content is not executed or rendered as HTML.

## Proposed production schema (not applied)

Before production persistence, create a reviewed migration with organisation isolation and RLS. A minimal design is:

- `levytate_finance_imports`: `id`, `organisation_id`, `imported_by_user_id`, `source_filename`, source/new/duplicate/review row counts, date range, created timestamp.
- `levytate_finance_transactions`: `id`, `organisation_id`, `finance_import_id`, source fingerprint, transaction date, description, canonical category, amount in pennies, optional reported balance in pennies, optional provider/learner/programme references or source labels, source row, created timestamp.
- `levytate_finance_balance_confirmations`: `id`, `organisation_id`, amount in pennies, balance date, confirmed by, created timestamp.

Use a unique constraint on `(organisation_id, source_fingerprint)`, indexes beginning with `organisation_id`, immutable import audit records, and RLS that resolves the authenticated user's active organisation membership. Only authorised employer roles should select; only `finance:manage` service operations should insert imports or confirmations. Platform administrators must not inherit employer transaction access. Retention, deletion, audit export and subject-access implications require approval before migration.

## Operational limitations

- Imported files may change shape; ambiguous columns require human confirmation.
- Provider, learner and programme labels are optional and are not automatically linked to canonical records.
- Expiry forecast is intentionally unavailable until fund age and committed future spend can be modelled reliably.
- Imported values should always be reconciled to DAS before financial decisions.
