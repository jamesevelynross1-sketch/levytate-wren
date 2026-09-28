# LevyTate Operations Autopilot V1

## Purpose

Operations Autopilot turns persisted apprenticeship operations evidence into a prioritised employer work queue. It does not score people or providers, predict outcomes, make operational decisions, send communications, or mutate source workflows.

The human-controlled sequence is:

1. An authorised Employer Admin or Apprenticeship Lead selects **Refresh intelligence**.
2. Deterministic rules evaluate only the current organisation's applications, learner reviews and operational actions.
3. Signals are reconciled idempotently against the existing Intelligence ledger.
4. Optional AI rewrites only new or materially changed signals using the bounded persisted evidence supplied to it.
5. An authorised user reviews the evidence, proposed owner, due date and optional communication draft.
6. Only **Create action** creates or links an existing LevyTate Operational Action. No communication is sent.

## Deterministic rules

V1 detects:

- overdue reviews;
- reviews due within seven days with unresolved actions;
- reviews approaching within 14 days when no more urgent review condition applies;
- overdue existing operational actions;
- overdue or imminent manager actions;
- applications awaiting a manager or provider beyond the defined threshold;
- other applications unchanged in an active state for at least seven days; and
- overdue structured provider-owned operational dependencies.

Rule precedence prevents a source condition appearing as multiple cards. An existing Operational Action is linked rather than duplicated. Repeated refreshes preserve a stable `signal_key`; a dismissal remains suppressed until the material evidence fingerprint changes. Signals resolve when the source condition clears and remain in **Recently resolved** for 14 days.

## AI boundary

AI is optional and uses the existing LevyTate OpenAI configuration. It receives only the signal type, subject label, deterministic summary, deterministic recommendation and minimal source references. Its response is restricted to:

- headline;
- why it matters;
- suggested next step;
- optional communication draft; and
- evidence summary.

Malformed, unavailable or unsafe output is discarded and the deterministic wording remains authoritative. AI cannot create an action, send a message, change a workflow, resolve a condition, or invent evidence.

## Access and tenancy

The server re-resolves every request through the current LevyTate session, organisation membership and RBAC model. Organisation-wide access requires:

- canonical role `Employer Admin` or `Apprenticeship Lead`; and
- `operationalActions:read` or `operationalActions:write`, as appropriate.

Employee, Line Manager, Provider and Platform Admin sessions do not receive organisation-wide Autopilot access through this feature. Direct database access remains revoked from `anon` and `authenticated`; service-role policies remain unchanged.

## Migration 030 approval gate

`030_extend_intelligence_signals_for_autopilot.sql` is additive. It widens the existing Intelligence constraints and adds stable signal identity, lane, Autopilot priority, deterministic payload, constrained AI interpretation, communication draft and suggested action type fields. It preserves existing signals, events, indexes, RLS, grants and service-role policies.

The migration must be reviewed and explicitly approved before it is applied to the shared Supabase project. Until then, do not deploy a Preview that depends on Autopilot V1.
