import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessCandidateOffTheJobActivity,
  calculateLearningTimeTotals,
  policyRegimeForOriginalStartDate,
} from "../lib/levytate/off-the-job/domain";
import { analyseLearningTimeAutopilot } from "../lib/levytate/autopilot/operations-autopilot";
import { resolveContextualCopilotIntent } from "../lib/levytate/contextual-copilot-intent";
import { getCoreEarlyAccessPolicy } from "../lib/levytate/core-early-access-policy";
import { hasMvpPermission } from "../lib/levytate/mvp/rbac";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/033_create_off_the_job_learning_assistant.sql"), "utf8");
const server = readFileSync(join(root, "lib/server/levytate-off-the-job.ts"), "utf8");
const assistant = readFileSync(join(root, "lib/server/levytate-off-the-job-assistant.ts"), "utf8");
const capability = readFileSync(join(root, "lib/server/levytate-off-the-job-capability.ts"), "utf8");
const learningTimeUi = readFileSync(join(root, "components/levytate-mvp/LearningTimeModule.tsx"), "utf8");
const checks: string[] = [];
const check = (label: string, condition: unknown) => { assert.ok(condition, label); checks.push(label); };

check("pre-August-2025 starts retain the legacy regime", policyRegimeForOriginalStartDate("2025-07-31") === "legacy_percentage");
check("post-policy starts use exact standard minimums", policyRegimeForOriginalStartDate("2025-08-01") === "standard_minimum");

const eligible = assessCandidateOffTheJobActivity({ lifecycleStatus: "active_learning", activityDate: "2026-09-10", startedAt: "09:00", endedAt: "11:00", breakMinutes: 0, category: "provider_workshop", whatWasNew: "A new campaign measurement method", standardRelevance: "Links to ST1512 measurement knowledge", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true, evidenceReference: "provider-lms-123", practicalPeriodStartDate: "2026-01-01", practicalPeriodEndDate: "2027-01-01" });
check("complete candidate evidence passes the deterministic four-test pre-check", eligible.outcome === "likely_eligible" && eligible.durationMinutes === 120);
const review = assessCandidateOffTheJobActivity({ lifecycleStatus: "active_learning", activityDate: "2026-09-10", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "progress_review", whatWasNew: "Discussion", standardRelevance: "Standard", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true, evidenceReference: "review" });
check("progress reviews are hard-excluded", review.outcome === "likely_ineligible");
const routine = assessCandidateOffTheJobActivity({ lifecycleStatus: "active_learning", activityDate: "2026-09-10", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "provider_workshop", whatWasNew: "New learning", standardRelevance: "Standard", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: false, evidenceReference: "ref" });
check("routine productive work fails the fourth test", routine.outcome === "likely_ineligible");
const breakActivity = assessCandidateOffTheJobActivity({ lifecycleStatus: "break_in_learning", activityDate: "2026-09-10", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "provider_workshop", whatWasNew: "New learning", standardRelevance: "Standard", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true, evidenceReference: "ref", activeBreakStartDate: "2026-09-01" });
check("ordinary activity during a break is rejected", breakActivity.outcome === "likely_ineligible");
const outside = assessCandidateOffTheJobActivity({ lifecycleStatus: "active_learning", activityDate: "2026-09-10", startedAt: "19:00", endedAt: "20:00", breakMinutes: 0, category: "structured_online_learning", whatWasNew: "New learning", standardRelevance: "Standard", workingHoursBasis: "outside_working_hours_uncompensated", separateFromProductiveWork: true, evidenceReference: "ref" });
check("uncompensated outside-hours activity is rejected", outside.outcome === "likely_ineligible");
const overlap = assessCandidateOffTheJobActivity({ lifecycleStatus: "enrolled", activityDate: "2026-09-10", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "structured_online_learning", whatWasNew: "New learning", standardRelevance: "Standard", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true, evidenceReference: "ref", overlappingActivity: true });
check("overlapping time requires clarification rather than being silently counted", overlap.outcome === "needs_clarification" && overlap.clarificationItems.some((item) => item.includes("overlaps")));
const compensated = assessCandidateOffTheJobActivity({ lifecycleStatus: "enrolled", activityDate: "2026-09-10", startedAt: "18:00", endedAt: "19:00", breakMinutes: 0, category: "structured_online_learning", whatWasNew: "New learning", standardRelevance: "Standard", workingHoursBasis: "time_off_in_lieu_exception", separateFromProductiveWork: true, evidenceReference: "ref" });
check("compensated exceptions require an attributable arrangement", compensated.outcome === "needs_clarification");
const outsidePeriod = assessCandidateOffTheJobActivity({ lifecycleStatus: "enrolled", activityDate: "2025-12-31", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "provider_workshop", whatWasNew: "New learning", standardRelevance: "Standard", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true, evidenceReference: "ref", practicalPeriodStartDate: "2026-01-01", practicalPeriodEndDate: "2027-01-01" });
check("activity outside the practical period is rejected", outsidePeriod.outcome === "likely_ineligible");

const totals = calculateLearningTimeTotals({ individualMinimumMinutes: 12_000, activities: [{ id: "a", durationMinutes: 120, status: "submitted" }, { id: "b", durationMinutes: 90, status: "employer_checked" }, { id: "c", durationMinutes: 45, status: "draft" }], confirmations: [{ activityId: "b", outcome: "partially_confirmed", confirmedMinutes: 60, recordedAt: "2026-09-12T12:00:00Z" }] });
check("candidate, employer and provider totals remain separate", totals.learnerRecordedMinutes === 210 && totals.employerCheckedMinutes === 90 && totals.providerConfirmedMinutes === 60 && totals.remainingMinutes === 11_940);
const revisedTotals = calculateLearningTimeTotals({ individualMinimumMinutes: 200, activities: [{ id: "b", durationMinutes: 90, status: "employer_checked" }], confirmations: [{ activityId: "b", outcome: "confirmed", confirmedMinutes: 90, recordedAt: "2026-09-12T12:00:00Z" }, { activityId: "b", outcome: "partially_confirmed", confirmedMinutes: 45, recordedAt: "2026-09-13T12:00:00Z" }] });
check("latest provider confirmation supersedes earlier totals without overwriting evidence", revisedTotals.providerConfirmedMinutes === 45 && revisedTotals.remainingMinutes === 155);

check("Employee can read and write own Learning Time", hasMvpPermission("Employee", "learningTime:read") && hasMvpPermission("Employee", "learningTime:write") && !hasMvpPermission("Employee", "learningTime:manage"));
check("Line Manager has read-only Learning Time permission", hasMvpPermission("Line Manager", "learningTime:read") && !hasMvpPermission("Line Manager", "learningTime:write"));
check("Apprenticeship Lead can manage Learning Time", hasMvpPermission("Apprenticeship Lead", "learningTime:manage"));
check("Platform Admin cannot read employer learning evidence", !hasMvpPermission("Platform Admin", "learningTime:read"));
check("navigation is hidden when capability is off", getCoreEarlyAccessPolicy("Apprenticeship Lead").modules.find((item) => item.moduleKey === "Learning Time")?.availability === "hidden");
check("navigation appears for enabled employer roles", getCoreEarlyAccessPolicy("Apprenticeship Lead", { offTheJobAssistantEnabled: true }).modules.find((item) => item.moduleKey === "Learning Time")?.availability === "enabled");
check("Platform Admin remains denied even if capability is enabled", getCoreEarlyAccessPolicy("Platform Admin", { offTheJobAssistantEnabled: true }).modules.find((item) => item.moduleKey === "Learning Time")?.availability === "hidden");

const signals = analyseLearningTimeAutopilot({ organisationId: "00000000-0000-4000-8000-000000000001", now: "2026-10-12T12:00:00Z", learners: [{ learnerRecordId: "learner-1", learnerName: "Fictional Learner", providerId: "provider-1", programmeId: "programme-1", attention: [{ type: "otj_provider_confirmation_pending", label: "Provider confirmation pending", detail: "Candidate evidence has not been confirmed." }] }] });
check("deterministic Learning Time Autopilot signal is read-only until human approval", signals.length === 1 && signals[0].lane === "waiting_externally" && signals[0].suggestedActionType === "");

check("Learning Time context routes provider-confirmed hours to the scoped summary", resolveContextualCopilotIntent({ message: "How many provider-confirmed learning hours do I have?", currentSection: "Learning Time" })?.intent === "learning_time_summary");
check("Learning Time context routes generic confirmation wording to deterministic attention", resolveContextualCopilotIntent({ message: "What is waiting for confirmation?", currentSection: "Learning Time" })?.intent === "learning_time_attention");
check("Learning Time context routes exact employee planning wording to bounded planning", resolveContextualCopilotIntent({ message: "What could I work on for three hours?", currentSection: "Learning Time" })?.intent === "learning_time_planning");
check("Learning Time context routes employer review wording to the employer-check queue", resolveContextualCopilotIntent({ message: "Which learners have activity waiting for review?", currentSection: "Learning Time" })?.filters.actionType === "otj_submission_awaiting_employer_check");
check("Learning Time context routes provider-confirmation wording to the provider queue", resolveContextualCopilotIntent({ message: "Which learning-time items need provider confirmation?", currentSection: "Learning Time" })?.filters.actionType === "otj_provider_confirmation_pending");

for (const table of ["levytate_standard_otj_requirements", "levytate_otj_plans", "levytate_otj_plan_versions", "levytate_otj_learning_priorities", "levytate_otj_activities", "levytate_otj_activity_confirmations", "levytate_otj_activity_events"]) check(`migration creates ${table}`, migration.includes(`public.${table}`));
check("migration capability is off by default", /off_the_job_assistant_enabled boolean not null default false/.test(migration));
check("migration uses force RLS for evidence tables", (migration.match(/force row level security/g) ?? []).length >= 7);
check("migration does not grant evidence access to authenticated or anon", !/grant\s+(?:select|insert|update|delete)[^;]+\s+to\s+(?:authenticated|anon)/i.test(migration));
check("confirmation and event ledgers are append-only", migration.includes("Learning-time audit and confirmation records are append-only"));
check("conflicting idempotency replays are rejected", migration.includes("Conflicting learning-time idempotency key") && migration.includes("Conflicting learning-time confirmation idempotency key"));
check("overlapping time is blocked from the only browser submission path", server.includes("Overlapping activity requires resolution before submission") && server.includes('status: "in.(draft,needs_information)"'));
check("provider confirmation is tied to the learner provider", migration.includes("Provider confirmation must match the learner provider"));
check("published plan versions are immutable", migration.includes("Published learning-time plan versions are immutable"));
check("post-policy floor is enforced in storage workflow", migration.includes("greatest(11220, published_standard_minimum_minutes - prior_learning_reduction_minutes)"));
check("published plan version belongs to the exact plan", migration.includes("foreign key (organisation_id, id, current_published_version_id)"));
check("activity and priority learner-plan links are enforced", migration.includes("levytate_enforce_otj_learner_plan_link"));
check("official requirements never default unknown to zero", !/minimum_minutes[^\n]*default\s+0/i.test(migration));
const st1512Seed = migration.split("\n").find((line) => line.includes("('ST1512', '2.1'")) ?? "";
check("ST1512 remains fail-closed pending reliable official-source parsing", st1512Seed.includes("'needs_review'") && !st1512Seed.includes("'verified'"));
check("writes resolve organisation and employee scope server-side", server.includes("organisation_id") && server.includes("manager_id") && server.includes("created_by_user_id"));
check("assistant cannot override deterministic ineligibility", assistant.includes('fallback.assessment === "likely_ineligible"'));
check("AI planning may reference only existing bounded priority IDs", assistant.includes("allowedPriorityIds.has(id)"));
check("assistant planning returns no more than three suggestions", assistant.includes("slice(0, 3)"));
check("private learner drafts stay out of employer and manager workspaces", server.includes('role === "Employee" || activity.status !== "draft"'));
check("inactivity attention is suppressed during a break", server.includes("if (!activeBreak && plan)"));
check("Production capability is fail-closed", capability.includes('process.env.VERCEL_ENV === "production"'));
check("assistant exposes the three apprentice-facing entry choices", ["Does this count?", "Plan my learning time", "Help me write it up"].every((label) => learningTimeUi.includes(label)));
check("assistant entry choices preserve the three existing API modes", ["eligibility_check", "planning", "capture_support"].every((mode) => learningTimeUi.includes(`mode: "${mode}"`)));
check("assistant choices expose their selected state", learningTimeUi.includes("aria-pressed={selected}") && learningTimeUi.includes("Selected</span>"));
check("assistant prompt has an explicit accessible label", learningTimeUi.includes('htmlFor="otj-assistant-prompt"') && learningTimeUi.includes('id="otj-assistant-prompt"'));
check("learner selector has an explicit accessible label", learningTimeUi.includes('htmlFor="learning-time-learner"') && learningTimeUi.includes('id="learning-time-learner"'));
check("employee assistant precedes activity history on mobile without changing desktop columns", learningTimeUi.includes("order-2 grid content-start gap-5 lg:order-1") && learningTimeUi.includes("order-1 grid min-w-0 content-start gap-5 lg:order-2"));

console.log(JSON.stringify({ verdict: "PASS", checks: checks.length, labels: checks }, null, 2));
