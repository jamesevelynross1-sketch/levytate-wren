import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/013_create_persistent_operational_actions.sql", "utf8");
const domain = readFileSync("lib/levytate/mvp/operational-actions.ts", "utf8");
const server = readFileSync("lib/server/levytate-operational-actions.ts", "utf8");
const operations = readFileSync("lib/levytate/mvp/operations-centre.ts", "utf8");
const api = readFileSync("app/api/levytate-operational-actions/[actionId]/route.ts", "utf8");

const requiredTables = ["levytate_operational_actions", "levytate_operational_action_events"];
const requiredFunctions = [
  "synchroniseOrganisationOperationalActions",
  "listOperationalActions",
  "getOperationalAction",
  "acknowledgeOperationalAction",
  "startOperationalAction",
  "completeOperationalAction",
  "dismissOperationalAction",
  "getOperationalActionHistory",
  "resolveActionsForLearnerConditionChange",
];
const requiredStatuses = ["open", "acknowledged", "in_progress", "completed", "dismissed", "cancelled"];
const requiredEvents = ["detected", "priority_changed", "owner_changed", "due_date_changed", "acknowledged", "started", "completed", "dismissed", "cancelled", "regenerated"];
const requiredCoverage = [
  "ready_to_enrol",
  "hr-approval-complete",
  "provider_review_overdue",
  "significantly_behind",
  "return_date_overdue",
  "post_return_review_required",
  "guides_outstanding",
];

for (const table of requiredTables) assertIncludes(migration, `public.${table}`, "Migration table");
for (const fn of requiredFunctions) assertIncludes(server, `function ${fn}`, "Server contract");
for (const status of requiredStatuses) {
  assertIncludes(domain, `"${status}"`, "Action domain status");
  assertIncludes(migration, `'${status}'`, "Migration status constraint");
}
for (const event of requiredEvents) {
  assertIncludes(domain, `"${event}"`, "Action event domain");
  assertIncludes(migration, `'${event}'`, "Migration event constraint");
}
for (const condition of requiredCoverage) assertIncludes(operations, condition, "Operations condition mapping");

assertIncludes(migration, "levytate_operational_actions_active_source_idx", "Partial uniqueness index");
assertIncludes(migration, "where status in ('open', 'acknowledged', 'in_progress')", "Partial uniqueness predicate");
assertIncludes(migration, "enable row level security", "RLS");
assertIncludes(migration, "auth.role() = 'service_role'", "Service-role policy");
assertIncludes(server, "version: `eq.${action.version}`", "Optimistic concurrency control");
assertIncludes(server, "source_condition_resolved", "Automatic completion");
assertIncludes(server, "dismissalSuppressesUntilConditionClears", "Dismissal recurrence policy");
assertIncludes(server, "/duplicate|23505/i", "Concurrent insertion recovery");
assertIncludes(api, "expectedVersion", "Mutation version contract");
assertIncludes(api, "organisationId?: string", "Client organisation input is accepted only as ignored input");
assertIncludes(api, "actorUserId?: string", "Client actor input is accepted only as ignored input");

console.log(JSON.stringify({
  ok: true,
  tables: requiredTables.length,
  serverContracts: requiredFunctions.length,
  statuses: requiredStatuses.length,
  events: requiredEvents.length,
  demonstrationConditions: requiredCoverage.length,
}, null, 2));

function assertIncludes(source, value, label) {
  if (!source.includes(value)) throw new Error(`${label} is missing: ${value}`);
}
