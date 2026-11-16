import { describe, expect, it } from "vitest";
import { buildEmployerIntelligence } from "@/lib/levytate/intelligence/build";
import { createEmptyMvpWorkspace } from "@/lib/levytate/mvp/workspace";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";

function fixture() {
  const data = createEmptyMvpWorkspace();
  return { data, meta: { userRole: "Apprenticeship Lead", organisationId: "synthetic-tenant", organisationName: "Synthetic tenant" } } as LevyTateWorkspaceBootstrap;
}
const unavailable = { ok: false as const, message: "Source deliberately unavailable." };

describe("employer Insights live-record reconciliation", () => {
  it("counts pre-enrolment handoffs once alongside their approved application and legacy projection", () => {
    const workspace = fixture();
    workspace.data.applications = [{ id: "approved-1", status: "Approved for Enrolment", currentOwner: "Provider Partner", updatedAt: "2026-10-29" }] as typeof workspace.data.applications;
    workspace.data.learnerRecords = [{ id: "learner-1", applicationId: "approved-1", recordStatus: "Active", lifecycleStatus: "pre_enrolment", updatedAt: "2026-10-29" }] as typeof workspace.data.learnerRecords;
    workspace.data.enrolments = [{ id: "old-projection-1", applicationId: "approved-1", status: "Enrolment in progress", updatedAt: "2026-10-29" }] as typeof workspace.data.enrolments;
    const result = buildEmployerIntelligence({ workspace: { ok: true, value: workspace }, operations: unavailable, assessments: unavailable, finance: unavailable });
    expect(result.overview.signals.find((item) => item.metricId === "upcoming-enrolments")?.value).toBe(1);
    expect(result.overview.signals.find((item) => item.metricId === "operational-attention")).toMatchObject({ value: null, availability: "unavailable" });
    expect(result.overview.sourceStatus.find((source) => source.source === "DAS finance")?.available).toBe(false);
  });

  it("moves enrolled records out of the upcoming total even if an old approved projection remains", () => {
    const workspace = fixture();
    workspace.data.applications = [{ id: "approved-1", status: "Approved for Enrolment", currentOwner: "Provider Partner", updatedAt: "2026-10-29" }] as typeof workspace.data.applications;
    workspace.data.learnerRecords = [{ id: "learner-1", applicationId: "approved-1", recordStatus: "Active", lifecycleStatus: "enrolled", updatedAt: "2026-10-29" }] as typeof workspace.data.learnerRecords;
    const result = buildEmployerIntelligence({ workspace: { ok: true, value: workspace }, operations: unavailable, assessments: unavailable, finance: unavailable });
    expect(result.overview.signals.find((item) => item.metricId === "upcoming-enrolments")?.value).toBe(0);
    expect(result.overview.signals.find((item) => item.metricId === "active-learners")?.value).toBe(1);
  });
});
