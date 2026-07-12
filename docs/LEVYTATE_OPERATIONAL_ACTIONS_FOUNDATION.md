# LevyTate Persistent Operational Actions

## Authority Boundary

Learner lifecycle records remain the source of truth. Persistent operational actions record how a current derived condition is being managed; they do not create queue conditions and cannot override lifecycle state.

## Source Keys And Recurrence

Each current condition has a stable key in the form:

`<learner-record-id>:<source-condition>`

A partial unique database index permits only one `open`, `acknowledged` or `in_progress` action for an organisation and source key. When a resolved condition recurs, synchronisation creates a new action ID with the same source pattern and stores the prior action ID in metadata. Completed history is never reopened.

Dismissal suppresses the current occurrence while its source condition remains. Once synchronisation observes that the condition has cleared, it records `conditionClearedAt`. A later recurrence can then create a new occurrence.

## Status Transitions

| From | Allowed targets |
| --- | --- |
| Open | Acknowledged, In progress, Completed, Dismissed, Cancelled |
| Acknowledged | In progress, Completed, Dismissed, Cancelled |
| In progress | Completed, Dismissed, Cancelled |
| Completed | None |
| Dismissed | None |
| Cancelled | None |

All mutations require the current version. Stale updates fail with HTTP 409. Actor identity and organisation come from the signed server session, never the request body.

## Completion And Dismissal

Synchronisation automatically completes a non-terminal action with `source_condition_resolved` when its current lifecycle condition disappears. A user completion is rejected while the condition remains active.

Critical compliance blockers cannot be dismissed. Controlled dismissal requires a reason and one of:

- not applicable
- duplicate administrative warning
- managed outside LevyTate

Dismissal does not modify learner lifecycle truth.

## Synchronisation Triggers

Current implementation supports a controlled initial Operations Centre refresh. Recommended production triggers are:

1. After a successful learner lifecycle mutation.
2. A bounded scheduled background reconciliation.
3. A controlled Operations Centre refresh.

Do not synchronise on every client render. A future scheduled job must use the same central synchronisation function and must not duplicate lifecycle rule logic.

## Scale Limits

The initial implementation loads active learner details and up to 5,000 action records for one organisation. It avoids per-learner synchronisation queries and does not write unchanged actions. Before very large employers are onboarded, add keyset pagination, an organisation-level reconciliation cursor and a database transaction/RPC for fully atomic action-plus-event writes.
