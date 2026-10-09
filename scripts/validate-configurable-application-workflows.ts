import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDefaultApplicationWorkflow, validateApplicationWorkflowSteps, type ApplicationWorkflowStep, type ApplicationWorkflowVersion } from "../lib/levytate/application-workflows/domain";
import type { ApplicationWorkflowEvent } from "../lib/levytate/application-workflows/domain";
import { createApplicationWorkflowInstance, transitionApplicationWorkflow } from "../lib/levytate/application-workflows/engine";
import { deriveApplicationWorkflowCompatibility } from "../lib/levytate/application-workflows/compatibility";
import { hasMvpPermission } from "../lib/levytate/mvp/rbac";

const now = "2026-10-09T09:00:00.000Z";
const organisationId = "00000000-0000-4000-8000-000000000001";
let assertions = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); assertions += 1; };
const throws = (fn: () => unknown, pattern: RegExp) => { assert.throws(fn, pattern); assertions += 1; };

function version(steps: ApplicationWorkflowStep[], id = "version-1"): ApplicationWorkflowVersion {
  return { id, organisationId, workflowId: "workflow-1", version: 1, status: "published", steps, createdAt: now, publishedAt: now };
}

function advance(workflow: ApplicationWorkflowVersion, applicationId = "application-a") {
  let instance = createApplicationWorkflowInstance(applicationId, workflow, now);
  const events: ApplicationWorkflowEvent[] = [];
  const act = (role: "Employee" | "Line Manager" | "Apprenticeship Lead" | "Employer Admin", action: "submit" | "continue" | "approve" | "request_information" | "resubmit" | "decline", key: string, isDirectManager?: boolean) => {
    const result = transitionApplicationWorkflow({ instance, workflow, actor: { role, isDirectManager }, action, idempotencyKey: key, expectedLockVersion: instance.lockVersion, previousEvents: events, now });
    if (!result.replayed) events.push(result.event);
    instance = result.instance;
    return result;
  };
  return { get instance() { return instance; }, events, act };
}

// Journey A: backwards-compatible default.
const defaultWorkflow = createDefaultApplicationWorkflow(organisationId, now);
check(validateApplicationWorkflowSteps(defaultWorkflow.steps).length === 0, "default workflow is valid");
check(defaultWorkflow.steps[0].type === "employee_submission", "employee submission is fixed first");
check(defaultWorkflow.steps.at(-1)?.type === "provider_handoff", "provider handoff is fixed last");
const journeyA = advance(defaultWorkflow);
journeyA.act("Employee", "submit", "journey-a-submit");
throws(() => transitionApplicationWorkflow({ instance: journeyA.instance, workflow: defaultWorkflow, actor: { role: "Line Manager", isDirectManager: true }, action: "approve", idempotencyKey: "journey-a-skip", expectedLockVersion: journeyA.instance.lockVersion, now }), /not allowed/);
throws(() => journeyA.act("Line Manager", "continue", "journey-a-wrong-manager", false), /current direct manager/);
journeyA.act("Line Manager", "continue", "journey-a-manager", true);
journeyA.act("Apprenticeship Lead", "approve", "journey-a-lead");
check(journeyA.instance.state === "ready_for_provider", "default journey reaches provider handoff");
throws(() => journeyA.act("Apprenticeship Lead", "approve", "journey-a-terminal"), /terminal/);

// Journey B: required custom flow and information return to the exact step.
const custom = version([
  defaultWorkflow.steps[0],
  { id: "lead-check", type: "role_review", label: "Apprenticeship Lead check", responsibleRole: "Apprenticeship Lead", allowDecline: true },
  { id: "manager-approval", type: "role_approval", label: "Line Manager approval", responsibleRole: "Line Manager", allowDecline: true },
  { id: "lead-final", type: "role_approval", label: "Apprenticeship Lead final approval", responsibleRole: "Apprenticeship Lead", allowDecline: true },
  defaultWorkflow.steps.at(-1)!,
]);
const journeyB = advance(custom, "application-b");
journeyB.act("Employee", "submit", "journey-b-submit");
journeyB.act("Apprenticeship Lead", "continue", "journey-b-lead-check");
journeyB.act("Line Manager", "request_information", "journey-b-info", true);
check(journeyB.instance.state === "needs_information" && journeyB.instance.returnStepId === "manager-approval", "information request records exact return step");
journeyB.act("Employee", "resubmit", "journey-b-resubmit");
check(journeyB.instance.currentStepId === "manager-approval", "resubmission returns to same step");
const progressed = journeyB.act("Line Manager", "approve", "journey-b-manager", true);
const replay = transitionApplicationWorkflow({ instance: progressed.instance, workflow: custom, actor: { role: "Line Manager", isDirectManager: true }, action: "approve", idempotencyKey: "journey-b-manager", expectedLockVersion: progressed.instance.lockVersion, previousEvents: journeyB.events, now });
check(replay.replayed && replay.instance.lockVersion === progressed.instance.lockVersion, "duplicate submission is idempotent");
throws(() => transitionApplicationWorkflow({ instance: progressed.instance, workflow: custom, actor: { role: "Line Manager", isDirectManager: true }, action: "decline", idempotencyKey: "journey-b-manager", expectedLockVersion: progressed.instance.lockVersion, previousEvents: journeyB.events, now }), /different transition/);
throws(() => transitionApplicationWorkflow({ instance: progressed.instance, workflow: custom, actor: { role: "Apprenticeship Lead" }, action: "approve", idempotencyKey: "journey-b-stale", expectedLockVersion: progressed.instance.lockVersion - 1, previousEvents: journeyB.events, now }), /state changed/);
journeyB.act("Apprenticeship Lead", "approve", "journey-b-final");
check(journeyB.instance.state === "ready_for_provider", "custom journey reaches provider handoff one step at a time");

// Journey C: the same responsible role may appear in consecutive positions.
const leadOnly = version([defaultWorkflow.steps[0], { id: "lead-review", type: "role_review", label: "Apprenticeship Lead review", responsibleRole: "Apprenticeship Lead", allowDecline: true }, { id: "lead-approval", type: "role_approval", label: "Apprenticeship Lead approval", responsibleRole: "Apprenticeship Lead", allowDecline: true }, defaultWorkflow.steps.at(-1)!], "version-2");
const journeyC = advance(leadOnly, "application-c");
journeyC.act("Employee", "submit", "journey-c-submit");
throws(() => journeyC.act("Employer Admin", "continue", "journey-c-admin"), /requires Apprenticeship Lead/);
journeyC.act("Apprenticeship Lead", "continue", "journey-c-review");
journeyC.act("Apprenticeship Lead", "approve", "journey-c-approval");
check(journeyC.instance.state === "ready_for_provider", "repeated Apprenticeship Lead steps complete independently");

const declined = advance(defaultWorkflow, "application-declined");
declined.act("Employee", "submit", "declined-submit");
declined.act("Line Manager", "decline", "declined-manager", true);
check(declined.instance.state === "declined", "decline is terminal");
throws(() => declined.act("Line Manager", "continue", "declined-after"), /terminal/);

// Validation and version pinning.
check(validateApplicationWorkflowSteps([...defaultWorkflow.steps, ...defaultWorkflow.steps]).length > 0, "more than eight or duplicate steps rejected");
check(validateApplicationWorkflowSteps([{ ...defaultWorkflow.steps[0], label: "<script>" }, ...defaultWorkflow.steps.slice(1)]).length > 0, "unsafe custom labels rejected");
check(validateApplicationWorkflowSteps([{ ...defaultWorkflow.steps[0], responsibleRole: "Line Manager" }, ...defaultWorkflow.steps.slice(1)]).length > 0, "fixed employee owner cannot be changed");
check(validateApplicationWorkflowSteps([...defaultWorkflow.steps.slice(0, -1), { ...defaultWorkflow.steps.at(-1)!, responsibleRole: "Apprenticeship Lead" }]).length > 0, "fixed provider owner cannot be changed");
const eightSteps = [defaultWorkflow.steps[0], ...Array.from({ length: 6 }, (_, index): ApplicationWorkflowStep => ({ id: `review-${index}`, type: "role_review", label: `Review ${index + 1}`, responsibleRole: index % 2 ? "Apprenticeship Lead" : "Line Manager", allowDecline: true })), defaultWorkflow.steps.at(-1)!];
check(validateApplicationWorkflowSteps(eightSteps).length === 0, "eight-step maximum is accepted");
throws(() => transitionApplicationWorkflow({ instance: createApplicationWorkflowInstance("application-d", defaultWorkflow, now), workflow: { ...defaultWorkflow, id: "other-version" }, actor: { role: "Employee" }, action: "submit", idempotencyKey: "journey-d-submit", expectedLockVersion: 0, now }), /does not belong/);
const compatibility = deriveApplicationWorkflowCompatibility({ status: "Draft", currentOwner: "Employee", updatedAt: now, workflow: { instance: progressed.instance, version: custom } });
check(compatibility.configurable && compatibility.currentStepLabel === "Apprenticeship Lead final approval", "compatibility adapter exposes current configurable step");
check(compatibility.currentResponsibleRole === "Apprenticeship Lead", "compatibility adapter exposes responsible role");
const applicationV1 = createApplicationWorkflowInstance("application-version-one", defaultWorkflow, now);
const applicationV2 = createApplicationWorkflowInstance("application-version-two", { ...custom, id: "version-2", version: 2 }, now);
check(applicationV1.workflowVersionId === defaultWorkflow.id && applicationV2.workflowVersionId === "version-2", "new applications pin the published version active at submission");
check(applicationV1.workflowVersionId !== applicationV2.workflowVersionId, "publishing a new version does not mutate an in-flight instance");
const legacy = deriveApplicationWorkflowCompatibility({ status: "Awaiting Manager Review", currentOwner: "Line Manager", updatedAt: now });
check(!legacy.configurable && legacy.currentOwner === "Line Manager", "legacy application semantics remain unchanged");

// RBAC boundary.
check(hasMvpPermission("Employer Admin", "applicationWorkflows:manage"), "Employer Admin may configure workflows");
check(hasMvpPermission("Apprenticeship Lead", "applicationWorkflows:manage"), "Apprenticeship Lead may configure workflows");
for (const role of ["Platform Admin", "Line Manager", "Employee"] as const) check(!hasMvpPermission(role, "applicationWorkflows:manage"), `${role} may not configure workflows`);

// Static persistence/security contract: migration is additive, gated and service-only.
const migration = readFileSync(resolve("supabase/migrations/032_create_configurable_application_workflows.sql"), "utf8");
for (const text of ["application_workflows_enabled boolean not null default false", "force row level security", "revoke all on table", "from public, anon, authenticated, service_role", "append-only", "idempotency_key", "lock_version", "published application workflow versions are immutable"]) check(migration.toLowerCase().includes(text), `migration contains ${text}`);
for (const text of ["levytate_publish_application_workflow", "levytate_start_application_workflow", "levytate_transition_application_workflow", "only the current direct manager may act", "foreign key (organisation_id, application_id)"]) check(migration.toLowerCase().includes(text), `migration contains ${text}`);
check(!/\b(drop table|truncate table|delete from)\b/i.test(migration), "migration contains no destructive data statement");
check(!/grant\s+(?:all|delete|truncate).*authenticated/i.test(migration), "authenticated clients receive no broad workflow grants");

console.log(`Configurable application workflows: ${assertions} assertions passed.`);
