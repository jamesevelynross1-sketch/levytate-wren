import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyMvpWorkspace, normaliseProviderProgramme, normaliseProviderRecord, type MvpApplication, type MvpEmployee, type MvpRole } from "@/lib/levytate/mvp/workspace";
import type { LearnerRecord } from "@/lib/levytate/mvp/learner-lifecycle";
import { findRelease2NavigationArea, getRelease2Navigation } from "@/lib/levytate/release-2-navigation";
const store = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/components/levytate-mvp/MvpWorkspaceStore", () => ({ useMvpWorkspace: () => store.current }));
import { PersonalProgrammeDiscovery } from "@/components/levytate-mvp/PersonalProgrammeDiscovery";
import { EmployeeApplicationModule, EmployeeHomeModule } from "@/components/levytate-mvp/EmployeeExperienceModule";
const at = "2026-11-09T18:00:00Z";
const own: MvpEmployee = { id: "own", email: "own@example.invalid", employeeNumber: "own", name: "Fictional Person", jobTitle: "Synthetic role", roleId: "role", managerId: "", department: "Test", site: "Test", platformRole: "Line Manager", status: "Active", startDate: "", createdAt: at, updatedAt: at };
const application: MvpApplication = { id: "app", employeeId: "own", apprenticeshipStandardId: "synthetic-standard", status: "Approved for Enrolment", currentOwner: "Provider Partner", reason: "Fictional application", careerGoal: "Development", supportRequired: "Support", managerNote: "", submittedAt: at, updatedAt: at, history: [] };
const role: MvpRole = { id: "role", title: "Synthetic role", department: "Test", businessArea: "Test", careerLevel: "Manager", status: "Active", skillsTags: [], progression: [], createdAt: at, updatedAt: at, pathwayMappings: [{ id: "mapping", apprenticeshipStandardId: "synthetic-standard", recommendationType: "Primary", priority: 1, businessRationale: "Test mapping", fundingRoute: "Potentially levy-funded", deliveryPreference: "Blended" }] };
function learner(change: Partial<LearnerRecord> = {}): LearnerRecord { return { id: "learner", organisationId: "tenant", employeeId: "own", applicationId: "app", programmeId: "confirmed-programme", providerId: "confirmed-provider", enrolmentId: "enrolment", lifecycleStatus: "enrolled", employmentRoute: "existing_employee_upskill", expectedStartDate: "2026-10-01", actualStartDate: "2026-10-01", expectedEndDate: "2027-10-01", actualEndDate: "", createdAt: at, updatedAt: at, createdBy: "synthetic", updatedBy: "synthetic", recordStatus: "Active", ...change }; }
function workspace() {
  const data = createEmptyMvpWorkspace(); data.employees = [{ ...own, id: "report", email: "report@example.invalid", name: "Direct report" }, own]; data.roles = [role]; data.applications = [application];
  data.providers = [normaliseProviderRecord({ providerId: "assumed-provider", providerName: "Unconfirmed catalogue provider" }), normaliseProviderRecord({ providerId: "confirmed-provider", providerName: "Recorded actual provider" })];
  data.providerProgrammes = [normaliseProviderProgramme({ id: "assumed-programme", providerId: "assumed-provider", programmeName: "Unconfirmed catalogue programme", linkedStandardId: "synthetic-standard", linkedStandardIds: ["synthetic-standard"] }), normaliseProviderProgramme({ id: "confirmed-programme", providerId: "confirmed-provider", programmeName: "Recorded actual programme", linkedStandardId: "synthetic-standard", linkedStandardIds: ["synthetic-standard"] })];
  return data;
}
beforeEach(() => { store.current = { data: workspace(), meta: { storageMode: "supabase", userEmail: own.email, userRole: "Line Manager" }, saveApplication: vi.fn() }; });

describe("actual personal programme record rendering", () => {
  it("does not promote the first matching catalogue provider into an active application's confirmed provider", () => {
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain("Not confirmed for this application"); expect(html).not.toContain("Unconfirmed catalogue provider"); expect(html).not.toContain("Unconfirmed catalogue programme");
  });
  it("labels an archived enrolled record as archived rather than presenting it as a current programme", () => {
    const data = workspace(); data.learnerRecords = [learner({ recordStatus: "Archived" })]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(PersonalProgrammeDiscovery, { onNavigate: vi.fn() }));
    expect(html).toContain("Archived programme record"); expect(html).toContain("Last recorded status"); expect(html).toContain("enrolled");
  });
  it.each([EmployeeApplicationModule, EmployeeHomeModule])("shows the linked programme, never another provider's first catalogue match", (Component) => {
    const data = workspace(); data.learnerRecords = [learner()]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(Component, { onNavigate: vi.fn() }));
    expect(html).toContain("Recorded actual programme"); expect(html).not.toContain("Unconfirmed catalogue");
  });
  it.each(["Approved for Enrolment", "Completed"] as const)("shows only the provider recorded for a %s application", (status) => {
    const data = workspace(); data.applications = [{ ...application, status }]; data.learnerRecords = [learner()]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(EmployeeApplicationModule, { onNavigate: vi.fn() }));
    expect(html).toContain("Recorded actual provider"); expect(html).not.toContain("Unconfirmed catalogue provider");
  });
  it("does not borrow a programme belonging to a different provider", () => {
    const data = workspace(); data.learnerRecords = [learner({ providerId: "missing-provider" })]; store.current.data = data;
    for (const Component of [EmployeeApplicationModule, PersonalProgrammeDiscovery]) {
      const html = renderToStaticMarkup(createElement(Component, { onNavigate: vi.fn() }));
      expect(html).not.toContain("Recorded actual programme"); expect(html).toContain("Provider no longer in the current catalogue");
    }
  });
  it.each(["withdrawn", "achieved", "completed_without_achievement"] as const)("labels %s as a previous programme", (lifecycleStatus) => {
    const data = workspace(); data.learnerRecords = [learner({ lifecycleStatus })]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(PersonalProgrammeDiscovery, { onNavigate: vi.fn() }));
    expect(html).toContain("Previous programme record"); expect(html).not.toContain("Current programme record");
  });
  it("shows current own records independently of catalogue publication and does not include a manager's reports", () => {
    const data = workspace(); data.learnerRecords = [learner({ id: "report-learner", employeeId: "report", programmeId: "assumed-programme", providerId: "assumed-provider" }), learner()]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(PersonalProgrammeDiscovery, { onNavigate: vi.fn() }));
    expect(html).toContain("Current programme record"); expect(html).toContain("Recorded actual programme");
    expect(html).not.toContain("Unconfirmed catalogue"); expect(html).toContain("You already have an active application");
  });
  it("preserves a recorded journey when its catalogue rows have been removed", () => {
    const data = workspace(); data.learnerRecords = [learner({ lifecycleStatus: "withdrawn" })]; data.providers = []; data.providerProgrammes = []; data.applications = [{ ...application, status: "Completed" }]; store.current.data = data;
    const html = renderToStaticMarkup(createElement(PersonalProgrammeDiscovery, { onNavigate: vi.fn() }));
    expect(html).toContain("Previous programme record"); expect(html).toContain("Provider no longer in the current catalogue"); expect(html).toContain("2026-10-01"); expect(html).not.toContain("You already have an active application");
  });
  it("makes both manager personal routes reachable without adding unavailable modules", () => {
    const available = ["My Programme", "My Application", "Approvals", "My Team", "Learning Time"] as const;
    const menu = getRelease2Navigation("Line Manager", available);
    expect(findRelease2NavigationArea(menu, "My Programme")?.key).toBe("development");
    expect(findRelease2NavigationArea(menu, "My Application")?.key).toBe("development");
    expect(findRelease2NavigationArea(menu, "Approvals")?.key).toBe("approvals");
    expect(menu.flatMap((area) => area.modules)).toEqual(expect.arrayContaining([...available]));
    expect(getRelease2Navigation("Line Manager", ["Approvals"]).flatMap((area) => area.modules)).toEqual(["Approvals"]);
  });
});
