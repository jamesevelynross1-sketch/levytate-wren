import assert from "node:assert/strict";
import { analyseOperationsAutopilot, buildOperationsBrief } from "../lib/levytate/autopilot/operations-autopilot";
import { buildSeedModel, COPILOT_PILOT_ORGANISATION_ID, COPILOT_PILOT_PROGRAMMES } from "./seed-copilot-pilot-demo";

const checks: string[] = [];
const referenceDate = "2026-10-08";
const model = buildSeedModel(referenceDate);

check("seed creates 17 live learner records", model.learnerRecords.length === 17 && model.learnerRecords.every((row) => row.lifecycle_status === "enrolled" && row.record_status === "Active"));
check("seed creates 4 pipeline applications without learner records", model.applications.filter((row) => row.current_owner !== "Completed").length === 4 && model.learnerRecords.every((row) => !model.applications.filter((application) => application.current_owner !== "Completed").some((application) => application.id === row.application_id)));
check("seed creates only fictional non-deliverable employee emails", model.employees.every((row) => row.email.endsWith("@copilot-pilot.invalid")));
check("seed creates manager relationships without user accounts", model.employees.filter((row) => row.platform_role === "Line Manager").length === 3 && model.employees.filter((row) => row.platform_role === "Employee").every((row) => Boolean(row.manager_id)));
check("seed uses exactly 3 canonical providers", model.providerSelections.length === 3);
check("seed uses exactly 5 canonical programmes", model.programmeSelections.length === 5);
check("programme mix is exactly 6/4/3/2/2", JSON.stringify(COPILOT_PILOT_PROGRAMMES.map((programme) => model.learnerRecords.filter((record) => record.programme_id === programme.id).length)) === JSON.stringify([6, 4, 3, 2, 2]));
check("exactly four provider reviews are due within 14 days", model.reviews.filter((review) => review.next_review_date >= referenceDate && review.next_review_date <= addDays(referenceDate, 14)).length === 4);
check("review dates are 3, 8, 11 and 13 days away", JSON.stringify(model.reviews.map((review) => review.next_review_date).filter((date) => date <= addDays(referenceDate, 14)).sort()) === JSON.stringify([3, 8, 11, 13].map((days) => addDays(referenceDate, days)).sort()));
check("seed creates only the three intended operational actions", model.actions.length === 3 && model.actionEvents.length === 3);
check("seed construction is deterministic", JSON.stringify(model) === JSON.stringify(buildSeedModel(referenceDate)));

const employees = new Map(model.employees.map((row) => [row.id, row.name]));
const programmes = new Map(COPILOT_PILOT_PROGRAMMES.map((programme) => [programme.id, programme]));
const signals = analyseOperationsAutopilot({
  organisationId: COPILOT_PILOT_ORGANISATION_ID,
  now: `${referenceDate}T12:00:00.000Z`,
  learners: model.learnerRecords.map((learner) => {
    const programme = programmes.get(learner.programme_id);
    if (!programme) throw new Error("Seed validation found an unknown programme.");
    return {
      learnerRecordId: learner.id,
      learnerName: employees.get(learner.employee_id) ?? "Employee",
      providerId: programme.providerId,
      providerName: programme.providerName,
      programmeId: programme.id,
      programmeName: programme.name,
      reviews: model.reviews.filter((review) => review.learner_record_id === learner.id).map((review) => ({
        id: review.id,
        type: "provider_review" as const,
        nextReviewDate: review.next_review_date,
        reviewDate: review.review_date,
        status: review.status,
      })),
    };
  }),
  actions: model.actions.map((action) => ({
    id: action.id,
    learnerRecordId: String(action.learner_record_id),
    applicationId: String(action.application_id),
    employeeId: String(action.employee_id),
    title: action.title,
    description: action.description,
    actionType: action.action_type,
    ownerType: action.owner_type as "Line Manager" | "Provider",
    dueDate: action.due_date,
    status: action.status,
    sourceUrl: action.source_url,
    updatedAt: action.updated_at,
  })),
  applications: model.applications.map((application) => ({
    id: application.id,
    employeeId: application.employee_id,
    employeeName: employees.get(application.employee_id) ?? "Employee",
    status: application.status,
    currentOwner: application.current_owner as "Employee" | "Line Manager" | "Apprenticeship Lead" | "Provider Partner" | "Completed",
    updatedAt: application.updated_at,
  })),
});
const persisted = signals.map((signal) => ({ ...signal, status: "new" as const }));
const brief = buildOperationsBrief(persisted);
check("source conditions produce exactly nine Autopilot signals", signals.length === 9);
check("source conditions produce Action now 3", brief.actionNow === 3);
check("source conditions produce This week 3", brief.thisWeek === 3);
check("source conditions produce Upcoming 3", brief.upcoming === 3);
check("source conditions produce Waiting externally 2", brief.waitingExternally === 2);
check("source conditions produce the intended signal types", JSON.stringify(signals.map((signal) => signal.signalType).sort()) === JSON.stringify([
  "application_awaiting_manager",
  "application_awaiting_provider",
  "application_stalled",
  "manager_action_due_soon",
  "provider_dependency_overdue",
  "review_due_with_outstanding_actions",
  "review_upcoming",
  "review_upcoming",
  "review_upcoming",
].sort()));

console.log(`Copilot pilot demo validation passed (${checks.length}/${checks.length}).`);

function check(name: string, condition: unknown) {
  assert.ok(condition, name);
  checks.push(name);
}
function addDays(date: string, days: number) { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
