import { readFileSync } from "node:fs";

const domain = readFileSync("lib/levytate/mvp/operational-actions.ts", "utf8");
const operations = readFileSync("lib/levytate/mvp/operations-centre.ts", "utf8");
const migration = readFileSync("supabase/migrations/014_extend_operational_action_types_for_assessment.sql", "utf8");
const operationsApi = readFileSync("app/api/levytate-operations/route.ts", "utf8");
const actionsApi = readFileSync("app/api/levytate-operational-actions/route.ts", "utf8");
const operationsUi = readFileSync("components/levytate-mvp/OperationsCentreModule.tsx", "utf8");

const domainActionTypes = extractTsArray(domain, "persistentOperationalActionTypes");
const domainSourceTypes = extractTsArray(domain, "operationalActionSourceTypes");
const migrationActionTypes = extractSqlCheckValues(migration, "levytate_operational_actions_action_type_check", "action_type");
const migrationSourceTypes = extractSqlCheckValues(migration, "levytate_operational_actions_source_type_check", "source_type");

assertEqualSets("Operational action types", domainActionTypes, migrationActionTypes);
assertEqualSets("Operational source types", domainSourceTypes, migrationSourceTypes);

for (const actionType of [
  "confirm_assessment_model",
  "confirm_assessment_organisation",
  "complete_assessment_readiness",
  "obtain_provider_readiness_confirmation",
  "obtain_manager_readiness_confirmation",
  "obtain_learner_readiness_confirmation",
  "record_gateway",
  "move_learner_to_assessment",
]) {
  assertIncludes(operations, `"${actionType}"`, "Assessment synchronisation action");
  if (!domainActionTypes.includes(actionType)) throw new Error(`Assessment action is outside the canonical domain: ${actionType}`);
}

assertIncludes(operations, 'item.sourceType = "assessment_readiness"', "Assessment source mapping");
assertIncludes(operationsApi, "operationalActionsRefreshError", "Safe operations API error");
assertIncludes(actionsApi, "operationalActionsRefreshError", "Safe action synchronisation API error");
assertIncludes(operationsUi, "retryOperations", "Operations retry action");
assertIncludes(operationsUi, "{data ?", "Last-successful-data rendering guard");

for (const forbidden of ["constraint", "SQLSTATE", "error.message"]) {
  if (operationsApi.includes(forbidden)) throw new Error(`Operations API exposes forbidden database detail: ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  canonicalActionTypes: domainActionTypes.length,
  canonicalSourceTypes: domainSourceTypes.length,
  assessmentActionTypes: 8,
  safeErrorContract: true,
}, null, 2));

function extractTsArray(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) throw new Error(`Could not read ${name}.`);
  return Array.from(match[1].matchAll(/"([a-z0-9_]+)"/g), (item) => item[1]);
}

function extractSqlCheckValues(source, constraint, column) {
  const match = source.match(new RegExp(`add constraint ${constraint} check \\(${column} in \\(([\\s\\S]*?)\\)\\);`));
  if (!match) throw new Error(`Could not read ${constraint}.`);
  return Array.from(match[1].matchAll(/'([a-z0-9_]+)'/g), (item) => item[1]);
}

function assertEqualSets(label, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  const unexpected = actual.filter((item) => !expected.includes(item));
  if (missing.length || unexpected.length || expected.length !== actual.length) {
    throw new Error(`${label} contract drift. Missing: ${missing.join(", ") || "none"}. Unexpected: ${unexpected.join(", ") || "none"}.`);
  }
}

function assertIncludes(source, value, label) {
  if (!source.includes(value)) throw new Error(`${label} is missing: ${value}`);
}
