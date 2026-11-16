import { describe, expect, it } from "vitest";
import { buildEmployerEvidenceExport } from "@/lib/levytate/intelligence/evidence-export";
import { buildEmployerIntelligence } from "@/lib/levytate/intelligence/build";
import { createEmptyMvpWorkspace } from "@/lib/levytate/mvp/workspace";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
import type { WorkforceIntelligenceReport } from "@/lib/levytate/intelligence/types";

export function intelligenceFixture() {
  const unavailable = { ok: false as const, message: "private source diagnostic" };
  const workspace = { data: createEmptyMvpWorkspace(), meta: { userRole: "Apprenticeship Lead", organisationId: "fictional-a", organisationName: "Fictional A" } } as LevyTateWorkspaceBootstrap;
  return buildEmployerIntelligence({ workspace: { ok: true, value: workspace }, operations: unavailable, assessments: unavailable, finance: unavailable });
}

describe("narrow aggregate employer evidence contract", () => {
  it("never serialises individual identities, notes, labels or source diagnostics", () => {
    const input = intelligenceFixture();
    input.overview.priorities = [{ id: "application:private-person-id", owner: "Private Person", why: "private medical note" }] as typeof input.overview.priorities;
    input.finance.providerSpend = [{ label: "private supplier note", amountPence: 123 }];
    input.finance.missingInformation = ["private diagnostic"];
    input.limitations.push("private personal note");
    const json = JSON.stringify(buildEmployerEvidenceExport(input));
    expect(json).not.toContain("private"); expect(json).not.toContain("Private Person");
    expect(JSON.parse(json).metrics).toHaveLength(4);
  });
  it("preserves missing sources as unavailable and null, not fabricated zeroes", () => {
    const result = buildEmployerEvidenceExport(intelligenceFixture());
    expect(result.finance).toMatchObject({ availability: "unavailable", currentBalancePence: null, unclassifiedCount: null });
    expect(result.metrics.find((metric) => metric.id === "operational-attention")).toMatchObject({ availability: "unavailable", value: null });
    expect(result.sources).toHaveLength(4);
    expect(result.workforce).toEqual({ available: false, campaigns: [] });
  });
  it("retains exact integer pence, zeroes and explicit evidence periods", () => {
    const input = intelligenceFixture();
    Object.assign(input.finance, { availability: "available", currentBalancePence: 123456789, contributionsPence: 0, unclassifiedPence: -7, importedPeriod: { from: "2026-10-01", to: "2026-10-28" }, latestImportAt: "2026-10-29T12:00:00Z" });
    expect(buildEmployerEvidenceExport(input).finance).toMatchObject({ unit: "pence", currentBalancePence: 123456789, contributionsPence: 0, unclassifiedPence: -7, importedPeriod: input.finance.importedPeriod, latestImportAt: input.finance.latestImportAt });
  });
  it.each([[4, 4, "campaign_suppressed"], [10, 3, "complementary_suppressed"], [10, 10, "available"]])("reapplies disclosure for %s submissions with a %s-person group", (submitted, group, mode) => {
    const input = intelligenceFixture();
    input.workforce.sourceAvailable = true;
    input.workforce.reports = [{ campaignId: "fictional-campaign", campaignTitle: "private campaign", campaignPurpose: "private purpose", frameworkTitle: "Framework", definition: "Definition", nonResponse: 10 - Number(submitted), suppressed: false, priorities: [], limitation: "", disclosure: { mode: "available", organisationFindingsAvailable: true, departmentFindingsAvailable: true, reason: "", residualRisk: "" }, questionnaireVersion: "1", campaignStatus: "closed", createdAt: "2026-10-01", closingDate: "2026-10-28", invited: 10, submitted: Number(submitted), participationPercent: Number(submitted) * 10, suppressionThreshold: 5, profiles: [{ label: "private profile", count: 3 }], dimensions: [], barriers: [], useCases: [], cohorts: [], groups: [{ department: "private department", invited: 10, submitted: Number(group), participationPercent: Number(group) * 10, suppressed: false, suppressionReason: null, recurringNeeds: [], blockers: [] }] }] satisfies WorkforceIntelligenceReport[];
    const campaign = buildEmployerEvidenceExport(input).workforce.campaigns[0];
    expect(campaign).toMatchObject({ disclosureMode: mode, findingsIncluded: false });
    expect(JSON.stringify(campaign)).not.toContain("private");
    expect(campaign).not.toHaveProperty("groups");
  });
});
