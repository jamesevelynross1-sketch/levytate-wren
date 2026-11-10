import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
const source = vi.hoisted(() => ({ context: vi.fn(), select: vi.fn(), rpc: vi.fn(), people: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: source.context }));
vi.mock("@/lib/server/levytate-off-the-job-capability", () => ({ isOffTheJobAssistantEnabledForOrganisation: async () => true }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseSelect: source.select, supabaseSelectAll: source.select, supabaseFetchJson: source.rpc }));
vi.mock("@/components/levytate-mvp/MvpWorkspaceStore", () => ({ useMvpWorkspace: () => ({ meta: { userEmail: "manager@example.invalid", organisationId: "tenant" } }) }));
import { getLearningTimeWorkspace, saveLearningTimeActivity, submitLearningTimeActivity } from "@/lib/server/levytate-off-the-job";
import { LearningTimeLearnerContent } from "@/components/levytate-mvp/LearningTimeModule";
import { decodeLearningTimeReadResponse } from "@/lib/levytate/client-module-reads";

const session = { email: "manager@example.invalid" } as LevyTateBetaSession;
const at = "2026-11-09T12:00:00Z";
const employee = (id: string, email: string, manager = "") => ({ id, email, name: `Fictional ${id}`, manager_id: manager, status: "Active", job_title: "Synthetic role", department: "Test", site: "Test" });
const learner = (id: string) => ({ id: `${id}-learner`, employee_id: id, programme_id: "programme", provider_id: "provider", lifecycle_status: "enrolled", record_status: "Active", actual_start_date: "2025-01-01" });
const activity = (id: string, owner: string, status: string, creator: string) => ({ id, learner_record_id: `${owner}-learner`, plan_version_id: `${owner}-version`, activity_date: "2026-11-08", started_at: "09:00", ended_at: "10:00", break_minutes: 0, duration_minutes: 60, timezone: "Europe/London", category: "provider_workshop", title: id, description: "Fictional evidence", what_was_new: "New skill", standard_relevance: "Synthetic standard", reflection: "Fictional reflection", working_hours_basis: "within_normal_working_hours", compensation_note: "", separate_from_productive_work: true, ksb_references: [], evidence_reference: "synthetic", deterministic_outcome: "likely_eligible", deterministic_reasons: [], status, created_by_user_id: creator, submitted_at: status === "draft" ? null : at, lock_version: 0, created_at: at, updated_at: at });
const activities = [activity("own-private-draft", "manager", "draft", "manager-user"), activity("old-binding-private-draft", "manager", "draft", "retired-user"), activity("report-private-draft", "report", "draft", "report-user"), activity("report-submitted", "report", "submitted", "report-user"), activity("unrelated-submitted", "unrelated", "submitted", "unrelated-user")];
const version = (id: string) => ({ id: `${id}-version`, plan_id: `${id}-plan`, version_number: 1, policy_regime: "legacy_percentage", original_apprenticeship_start_date: "2025-01-01", practical_period_start_date: "2025-01-01", practical_period_end_date: "2028-01-01", standard_id: "SYNTHETIC", standard_version: "1", published_standard_minimum_minutes: null, legacy_indicative_minimum_minutes: 12000, prior_learning_reduction_minutes: 0, individual_minimum_minutes: 12000, planned_delivery_minutes: 12000, provider_id: "provider", training_plan_reference: "Fictional agreement", source_type: "provider_training_plan", source_date: "2026-10-01", inactivity_attention_days: 28, notes: "", status: "published", published_at: at, created_at: at });
function filtered<T extends Record<string, unknown>>(rows: T[], query: URLSearchParams, field: string) {
  const condition = query.get(field);
  if (!condition) return rows;
  return rows.filter(row => condition.startsWith("eq.") ? row[field] === condition.slice(3) : condition.slice(4, -1).split(",").includes(String(row[field])));
}
beforeEach(() => {
  vi.clearAllMocks();
  source.people = [employee("report", "report@example.invalid", "manager"), employee("manager", " MANAGER@example.invalid "), employee("unrelated", "unrelated@example.invalid")];
  source.context.mockResolvedValue({ organisation: { id: "tenant" }, user: { id: "manager-user", email: session.email, role: "Line Manager" } });
  source.rpc.mockResolvedValue(null);
  source.select.mockImplementation(async (_config, table: string, query: URLSearchParams) => {
    if (table === "levytate_organisations") return [{ id: "catalogue" }];
    if (table === "levytate_employees") return source.people;
    if (table === "levytate_learner_records") return filtered(filtered([learner("report"), learner("manager"), learner("unrelated")], query, "employee_id"), query, "id");
    if (table === "levytate_otj_plans") return filtered(["manager", "report", "unrelated"].map(id => ({ id: `${id}-plan`, learner_record_id: `${id}-learner`, status: "published", current_published_version_id: `${id}-version` })), query, "learner_record_id");
    if (table === "levytate_otj_plan_versions") return filtered(filtered(["manager", "report", "unrelated"].map(version), query, "plan_id"), query, "id");
    if (table === "levytate_otj_activities") return filtered(activities, query, "learner_record_id");
    if (table === "levytate_provider_programmes") return [{ id: "programme", programme_name: "Fictional programme", linked_standard_id: "SYNTHETIC" }];
    if (table === "levytate_providers") return [{ provider_id: "provider", provider_name: "Fictional provider" }];
    return [];
  });
});

describe("manager own Learning Time service and rendered permissions (fictional transport)", () => {
  it("includes the exact own learner alongside reports, never the first People row or unrelated learner", async () => {
    const workspace = await getLearningTimeWorkspace(session);
    expect(workspace.learners.map(item => item.employeeId)).toEqual(["manager", "report"]);
    expect(workspace).toMatchObject({ canCreateActivities: true, canManagePlans: false, canReviewActivities: false });
    expect(workspace.learners.map(item => [item.employeeId, item.canCreateActivities])).toEqual([["manager", true], ["report", false]]);
    expect(workspace.learners[0].activities.map(item => item.id)).toEqual(["own-private-draft"]);
    expect(workspace.learners[1].activities.map(item => item.id)).toEqual(["report-submitted"]);
    expect(decodeLearningTimeReadResponse(workspace)).toBe(workspace);
  });
  it("renders own capture controls and read-only report controls using the selected learner, not a workspace-wide write flag", async () => {
    const workspace = await getLearningTimeWorkspace(session);
    const render = (index: number) => renderToStaticMarkup(createElement(LearningTimeLearnerContent, { workspace, learner: workspace.learners[index], busy: false, act: async () => false }));
    expect(render(0)).toContain("Add learning activity"); expect(render(0)).not.toContain("Candidate activity review");
    expect(render(1)).toContain("Direct-report learning summary"); expect(render(1)).not.toContain("Add learning activity"); expect(render(1)).not.toContain("Employer check");
    expect(render(1)).not.toContain("Withdraw activity");
    workspace.learners[0].activities[0].status = "submitted";
    expect(render(0)).toContain("Withdraw activity"); expect(render(0)).not.toContain("Employer check");
    workspace.learners[0].activities[0].status = "withdrawn";
    expect(render(0)).not.toContain("Withdraw activity");
  });
  it.each(["missing", "ambiguous", "archived"])("fails closed for %s own People identity before loading a manager's reports", async state => {
    if (state === "missing") source.people = source.people.filter(item => item.id !== "manager");
    if (state === "ambiguous") source.people.push(employee("duplicate", "manager@example.invalid"));
    if (state === "archived") source.people.find(item => item.id === "manager")!.status = "Archived";
    expect(await getLearningTimeWorkspace(session)).toMatchObject({ learners: [], canCreateActivities: false, canReviewActivities: false });
    expect(source.select.mock.calls.some(call => call[1] === "levytate_learner_records")).toBe(false);
  });
  it("preserves Lead oversight while withholding every private draft", async () => {
    source.context.mockResolvedValue({ organisation: { id: "tenant" }, user: { id: "lead-user", email: "lead@example.invalid", role: "Apprenticeship Lead" } });
    const workspace = await getLearningTimeWorkspace(session);
    expect(workspace).toMatchObject({ canCreateActivities: false, canManagePlans: true, canReviewActivities: true });
    expect(workspace.learners.flatMap(item => item.activities).every(item => item.status !== "draft")).toBe(true);
  });
  it("permits a Manager's own save only through the atomic RPC and retains exact receipt replay", async () => {
    source.rpc.mockResolvedValue(activities[0]);
    const result = await saveLearningTimeActivity(session, { idempotencyKey: "manager-own-save", learnerRecordId: "manager-learner", activityDate: "2026-11-08", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "provider_workshop", title: "Fictional", description: "Fictional evidence", whatWasNew: "New", standardRelevance: "Relevant", reflection: "Synthetic", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true });
    expect(result.activity).toBe(activities[0]);
    expect(JSON.parse(source.rpc.mock.calls[0][2].body)).toMatchObject({ p_actor_user_id: "manager-user", p_action: "save_activity", p_probe: true });
  });
  it("rejects ambiguous own identity before probing even a previously successful save", async () => {
    source.people.push(employee("duplicate", "manager@example.invalid"));
    await expect(saveLearningTimeActivity(session, { idempotencyKey: "manager-own-save", learnerRecordId: "manager-learner", activityDate: "2026-11-08", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "provider_workshop", title: "Fictional", description: "Fictional", whatWasNew: "New", standardRelevance: "Relevant", reflection: "Synthetic", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true })).rejects.toMatchObject({ status: 403 });
    expect(source.rpc).not.toHaveBeenCalled();
  });
  it("sends Manager submission to the unchanged atomic actor/ownership boundary", async () => {
    source.rpc.mockResolvedValue({ id: "own-private-draft", status: "submitted" });
    await submitLearningTimeActivity(session, { idempotencyKey: "manager-own-submit", activityId: "own-private-draft", lockVersion: 0 });
    expect(JSON.parse(source.rpc.mock.calls[0][2].body)).toMatchObject({ p_actor_user_id: "manager-user", p_action: "submit_activity" });
  });
  it("does not use manager visibility to write a report's draft", async () => {
    await expect(saveLearningTimeActivity(session, { idempotencyKey: "manager-report-save", learnerRecordId: "report-learner", activityDate: "2026-11-08", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, category: "provider_workshop", title: "Fictional", description: "Fictional", whatWasNew: "New", standardRelevance: "Relevant", reflection: "Synthetic", workingHoursBasis: "within_normal_working_hours", separateFromProductiveWork: true })).rejects.toMatchObject({ status: 404 });
    expect(source.rpc).toHaveBeenCalledTimes(1);
    expect(JSON.parse(source.rpc.mock.calls[0][2].body)).toMatchObject({ p_probe: true });
  });
});
