import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/012_create_learner_lifecycle_foundation.sql", "utf8");
const lifecycleDomain = readFileSync("lib/levytate/mvp/learner-lifecycle.ts", "utf8");
const groundControlSeed = readFileSync("lib/levytate/data/demo/ground-control-workspace.ts", "utf8");

const requiredTables = [
  "levytate_learner_records",
  "levytate_learner_eligibility_declarations",
  "levytate_learner_pre_enrolment_checks",
  "levytate_learner_breaks_in_learning",
  "levytate_learner_withdrawals",
  "levytate_learner_reviews",
  "levytate_learner_progress_updates",
  "levytate_learner_assessment_readiness",
  "levytate_learner_achievements",
  "levytate_learner_operational_actions",
  "levytate_learner_lifecycle_events",
];

const requiredStatuses = [
  "pre_enrolment",
  "enrolled",
  "break_in_learning",
  "withdrawn",
  "assessment_preparation",
  "in_assessment",
  "achieved",
  "completed_without_achievement",
];

const requiredOperationalActions = [
  "guides_sent",
  "hr_and_manager_assessment_email_sent",
  "completion_email_sent",
];

const requiredSeedScenarios = [
  "pre-enrolment",
  "on-track",
  "behind-target",
  "break",
  "withdrawn",
  "assessment-prep",
  "in-assessment",
  "achieved",
  "completed-without-achievement",
];

function assertIncludes(source, value, label) {
  if (!source.includes(value)) {
    throw new Error(`${label} is missing required value: ${value}`);
  }
}

for (const table of requiredTables) {
  assertIncludes(migration, `public.${table}`, "Learner lifecycle migration");
}

assertIncludes(migration, "_service_role_all", "Learner lifecycle RLS policy");
assertIncludes(migration, "auth.role() = ''service_role''", "Learner lifecycle RLS policy");

for (const status of requiredStatuses) {
  assertIncludes(lifecycleDomain, status, "Learner lifecycle domain");
  assertIncludes(migration, status, "Learner lifecycle migration");
  assertIncludes(groundControlSeed, status, "Ground Control lifecycle seed");
}

for (const action of requiredOperationalActions) {
  assertIncludes(lifecycleDomain, action, "Learner lifecycle action domain");
  assertIncludes(migration, action, "Learner lifecycle migration");
  assertIncludes(groundControlSeed, action, "Ground Control lifecycle seed");
}

for (const scenario of requiredSeedScenarios) {
  assertIncludes(groundControlSeed, `key: "${scenario}"`, "Ground Control lifecycle seed");
}

assertIncludes(lifecycleDomain, "englandWorkingHoursDeclarationWording", "Learner eligibility declaration");
assertIncludes(lifecycleDomain, "canTransitionLearnerLifecycle", "Lifecycle transition helper");
assertIncludes(lifecycleDomain, "getLearnerLifecycleSummary", "Lifecycle summary helper");
assertIncludes(groundControlSeed, "learnerLifecycleData(applications)", "Ground Control workspace bootstrap");

console.log("Learner lifecycle foundation validation passed.");
console.log(`Tables checked: ${requiredTables.length}`);
console.log(`Statuses checked: ${requiredStatuses.length}`);
console.log(`Ground Control scenarios checked: ${requiredSeedScenarios.length}`);
