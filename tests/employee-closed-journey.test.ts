import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyMvpWorkspace, type MvpApplication, type MvpEmployee } from "@/lib/levytate/mvp/workspace";
import { closedApplicationOutcome, personalApplicationHistory, personalApplicationRecord } from "@/lib/levytate/mvp/personal-application-history";
import { employeeCurrentApplication } from "@/lib/levytate/mvp/workspace-insights";
import { createDefaultApplicationWorkflow } from "@/lib/levytate/application-workflows/domain";
const store = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/components/levytate-mvp/MvpWorkspaceStore", () => ({ useMvpWorkspace: () => store.current, WorkspaceSessionRecovery: () => null }));
import { EmployeeApplicationModule, EmployeeHomeModule } from "@/components/levytate-mvp/EmployeeExperienceModule";

const at = "2026-11-09T18:00:00Z";
function person(id = "own", email = "employee@example.invalid"): MvpEmployee { return { id, email, employeeNumber: id, name: id === "own" ? "Fictional Person" : "Fictional Direct Report", jobTitle: "Synthetic role", roleId: "role", managerId: "", department: "Test", site: "Test", platformRole: "Employee", status: "Active", startDate: "", createdAt: at, updatedAt: at }; }
function application(status: MvpApplication["status"], options: Partial<MvpApplication> = {}): MvpApplication { return {
  id: "own-application", employeeId: "own", apprenticeshipStandardId: "synthetic-standard", status, currentOwner: "Completed", reason: "Retained original answers", careerGoal: "Fictional development", supportRequired: "Recorded support", managerNote: "Recorded decision", submittedAt: at, updatedAt: at,
  history: [{ id: "decision", status, owner: "Completed", note: "Recorded terminal feedback", createdAt: at }], ...options,
}; }
function workspace() { const data = createEmptyMvpWorkspace(); data.employees = [person()]; data.roles = []; data.providers = []; data.providerProgrammes = []; return data; }
function configured(applicationId = "own-application"): NonNullable<MvpApplication["workflow"]> {
  const version = createDefaultApplicationWorkflow("fictional-tenant", at);
  version.steps[1].label = "Obsolete pending step";
  return { version, instance: { id: "instance", organisationId: version.organisationId, applicationId, workflowVersionId: version.id, currentStepId: version.steps[1].id, state: "active", lockVersion: 3, lastProgressedAt: at } };
}
beforeEach(() => { store.current = { data: workspace(), meta: { storageMode: "supabase", userEmail: "employee@example.invalid", userRole: "Employee" }, saveApplication: vi.fn() }; });

describe("actual personal closed-application screens", () => {
  it("keeps the declined record and feedback visible even after the published programme is removed", () => {
    const data = workspace(); data.applications = [application("Declined by Line Manager")]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain("Decision feedback"); expect(html).toContain("Recorded terminal feedback");
    expect(html).toContain("Retained original answers"); expect(html).not.toContain("not published any apprenticeship programmes");
  });
  it("does not describe a completed application as never started on Home", () => {
    const data = workspace(); data.applications = [application("Completed")]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeHomeModule, { onNavigate: vi.fn() }));
    expect(html).toContain("Completed"); expect(html).not.toContain("No apprenticeship programme is available yet");
    expect(html).not.toContain("Not started");
  });
  it.each(["Declined by Line Manager", "Declined by Apprenticeship Lead", "Completed", "Withdrawn", "Cancelled"] as const)("keeps %s read-only and offers separate programme discovery", (status) => {
    const data = workspace(); data.applications = [application(status, { workflow: configured() })]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain(status); expect(html).toContain("Explore programmes"); expect(html).toContain("This application stays closed");
    expect(html).toContain("Application history"); expect(html).toContain("read-only"); expect(html).not.toContain("Obsolete pending step");
    expect(html).not.toContain("<form"); expect(html).not.toContain("<textarea"); expect(html).not.toContain("Submit to line manager");
    expect(html).not.toContain("Save draft"); expect(store.current.saveApplication).not.toHaveBeenCalled();
  });
  it("shows the manager's own latest closed record rather than their first direct report", () => {
    const data = workspace(); data.employees = [person("report", "report@example.invalid"), { ...person(), platformRole: "Line Manager" }];
    data.applications = [application("Awaiting Manager Review", { id: "report-application", employeeId: "report", reason: "Private report answer" }), application("Withdrawn", { id: "own-older", updatedAt: "2026-11-01T00:00:00Z" }), application("Completed", { id: "own-latest", updatedAt: at })];
    store.current.data = data; store.current.meta = { storageMode: "supabase", userEmail: "employee@example.invalid", userRole: "Line Manager" };
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain("This application is recorded as completed"); expect(html).not.toContain("Private report answer");
    expect(html).not.toContain("This application has been withdrawn");
  });
  it("uses an existing new active draft instead of an older closed record", () => {
    const data = workspace(); data.applications = [application("Completed"), application("Draft", { id: "new-draft", reason: "New independent draft", currentOwner: "Employee", updatedAt: "2026-11-01T00:00:00Z" })]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain("New independent draft"); expect(html).toContain("Save draft"); expect(html).toContain("<form");
    expect(html).not.toContain("This application stays closed"); expect(html).not.toContain("Retained original answers");
  });
  it("fails closed on ambiguous personal People identity even when reports are visible", () => {
    const data = workspace(); data.employees.push(person("duplicate", "EMPLOYEE@example.invalid")); data.applications = [application("Completed")]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain("Employee setup required"); expect(html).not.toContain("Retained original answers");
  });
  it("renders every recorded history entry in order without inferring unrecorded approval stages", () => {
    const data = workspace(); const current = application("Withdrawn");
    current.history = [
      { id: "last", status: "Withdrawn", owner: "Completed", note: "Terminal note", createdAt: at },
      { id: "first", status: "Draft", owner: "Employee", note: "First draft note", createdAt: "2026-11-01T00:00:00Z" },
      { id: "second", status: "Draft", owner: "Employee", note: "Second draft note", createdAt: "2026-11-02T00:00:00Z" },
    ]; data.applications = [current]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html.indexOf("First draft note")).toBeLessThan(html.indexOf("Second draft note")); expect(html.indexOf("Second draft note")).toBeLessThan(html.indexOf("Terminal note"));
    expect(html).not.toContain("Manager approved"); expect(html).not.toContain("Approved for enrolment");
    expect(current.history[0].id).toBe("last");
  });
  it("shows the recorded configured decision role instead of treating Completed as a decision maker", () => {
    const data = workspace(), workflow = configured();
    workflow.events = [{ id: "decision", organisationId: "fictional-tenant", applicationId: "own-application", workflowVersionId: workflow.version.id, stepId: workflow.instance.currentStepId, action: "decline", actorRole: "Employer Admin", idempotencyKey: "synthetic-decline", fromLockVersion: 2, toLockVersion: 3, createdAt: at }];
    data.applications = [application("Declined by Apprenticeship Lead", { workflow })]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain("Decision maker"); expect(html).toContain("Employer Admin");
  });
});

describe("personal application display selection remains separate from active-application guards", () => {
  it.each(["Declined by Line Manager", "Declined by Apprenticeship Lead", "Completed", "Withdrawn", "Cancelled"] as const)("%s remains visible without blocking creation of a separate draft", (status) => {
    const data = workspace(), closed = application(status); data.applications = [closed];
    expect(personalApplicationRecord(data, "own")).toBe(closed); expect(employeeCurrentApplication(data, "own")).toBeNull();
    expect(closedApplicationOutcome(closed)?.state).not.toBeNull();
    const draft = application("Draft", { id: "separate-draft", updatedAt: "2026-10-01T00:00:00Z" }); data.applications.push(draft);
    expect(personalApplicationRecord(data, "own")).toBe(draft); expect(employeeCurrentApplication(data, "own")).toBe(draft);
  });
  it("selects the latest own closure by recorded update, with stable fallback ordering and no in-place sorting", () => {
    const data = workspace(), first = application("Withdrawn", { id: "a", updatedAt: "bad-date", submittedAt: "2026-11-08T00:00:00Z" }), latest = application("Completed", { id: "b", updatedAt: at });
    data.applications = [application("Completed", { id: "foreign", employeeId: "report", updatedAt: "2026-12-01T00:00:00Z" }), first, latest];
    expect(personalApplicationRecord(data, "own")).toBe(latest); expect(personalApplicationRecord(data, "unmatched")).toBeNull();
    expect(data.applications.map((item) => item.id)).toEqual(["foreign", "a", "b"]);
    first.updatedAt = at; expect(personalApplicationRecord(data, "own")).toBe(first);
  });
  it("does not mutate history or collapse repeated recorded statuses", () => {
    const current = application("Cancelled"); current.history.push({ ...current.history[0], id: "older", createdAt: "2026-11-08T00:00:00Z" });
    expect(personalApplicationHistory(current).map((entry) => entry.id)).toEqual(["older", "decision"]);
    expect(current.history.map((entry) => entry.id)).toEqual(["decision", "older"]);
  });
});
