import { describe, expect, it, vi } from "vitest";
import { createApplicationReceiptRecovery, decodeWorkspaceResponse } from "@/lib/levytate/mvp/workspace-response";
import { createEmployeeDevelopmentProfile, createEmptyMvpWorkspace, type MvpApplication } from "@/lib/levytate/mvp/workspace";
import type { LevyTateWorkspaceBootstrap, LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import { permissionsForMvpRole } from "@/lib/levytate/mvp/rbac";
import { getCoreEarlyAccessPolicy } from "@/lib/levytate/core-early-access-policy";

const identity = { email: "synthetic@example.invalid", organisationId: "10000000-0000-4000-8000-000000000001" };
const timestamp = "2026-11-09T18:00:00Z";
function application(): MvpApplication { return { id: "synthetic-application", revision: 0, employeeId: "synthetic-employee", apprenticeshipStandardId: "standard-a", status: "Awaiting Manager Review", currentOwner: "Line Manager", reason: "Original synthetic reason", careerGoal: "Original synthetic goal", supportRequired: "", managerNote: "", submittedAt: timestamp, updatedAt: timestamp, history: [] }; }
function envelope() {
  const data = createEmptyMvpWorkspace();
  // A blank live employer may have no published catalogue. Do not fill it in.
  data.providers = []; data.providerProgrammes = [];
  const workspace: LevyTateWorkspaceBootstrap = { data, meta: {
    organisationId: identity.organisationId, organisationName: "Fictional workspace", userEmail: identity.email,
    userRole: "Employee", permissions: permissionsForMvpRole("Employee"), storageMode: "supabase", warnings: [], mutationRevisions: {},
    coreEarlyAccess: getCoreEarlyAccessPolicy("Employee"), requestsEnabled: false,
  } };
  return { ok: true, workspace };
}
type Generic = Record<string, unknown>;
const object = (value: unknown) => value as Generic;

describe("live workspace envelope confirmation", () => {
  it("accepts the current complete live contract without introducing fixture catalogue data", () => {
    const value = envelope(), result = decodeWorkspaceResponse(value, identity);
    expect(result).toBe(value.workspace); expect(result.data.providers).toEqual([]); expect(result.data.providerProgrammes).toEqual([]);
  });
  it("accepts the actual normalized catalogue and development-profile render shapes", () => {
    const value = envelope(); value.workspace.data = createEmptyMvpWorkspace();
    value.workspace.data.employeeDevelopmentProfiles = [{ ...createEmployeeDevelopmentProfile("synthetic-employee"), conversationHistory: [{ role: "user", content: "Fictional context" }] }];
    value.workspace.data.applications = [application()];
    expect(() => decodeWorkspaceResponse(value, identity)).not.toThrow();
  });
  it.each([false, undefined, "true", 1])("rejects HTTP-success envelopes without explicit ok:true (%s)", (ok) => {
    expect(() => decodeWorkspaceResponse({ ...envelope(), ok }, identity)).toThrow();
  });
  it.each([null, {}, { ok: true }, { ok: true, workspace: {} }, { ok: true, workspace: { data: {}, meta: {} } }])("rejects malformed HTTP-success envelopes", (value) => {
    expect(() => decodeWorkspaceResponse(value, identity)).toThrow();
  });
  it.each([
    { organisationId: "20000000-0000-4000-8000-000000000002" }, { organisationId: "" }, { organisationId: "tenant-a" },
    { userEmail: "another@example.invalid" }, { userEmail: " Synthetic@example.invalid " }, { userEmail: null },
    { storageMode: "local_fallback" }, { userRole: "Department Head" }, { permissions: ["finance:manage"] },
    { permissions: null }, { warnings: "unavailable" }, { requestsEnabled: "true" }, { mutationRevisions: null }, { mutationRevisions: { entity: -1 } },
    { mutationRevisions: { entity: 0.5 } }, { mutationRevisions: { entity: "1" } }, { directReportOperationalSummaries: {} },
  ])("does not confirm malformed or changed canonical metadata %j", (change) => {
    const value = envelope(); Object.assign(value.workspace.meta, change);
    expect(() => decodeWorkspaceResponse(value, identity)).toThrow();
  });
  it("does not accept a role policy from another account role", () => {
    const value = envelope(); value.workspace.meta.coreEarlyAccess = getCoreEarlyAccessPolicy("Apprenticeship Lead");
    expect(() => decodeWorkspaceResponse(value, identity)).toThrow();
  });
  it.each([undefined, 5, "6", 7])("rejects unsupported workspace version %s", (version) => {
    const value = envelope(); object(value.workspace.data).version = version;
    expect(() => decodeWorkspaceResponse(value, identity)).toThrow();
  });
  it.each(["employees", "employeeDevelopmentProfiles", "roles", "applications", "providers", "providerProgrammes", "providerRelationships", "organisationProviders", "organisationProgrammes", "matchingRequests", "enrolments", "learnerRecords", "eligibilityDeclarations", "preEnrolmentChecks", "breaksInLearning", "withdrawals", "learnerReviews", "progressUpdates", "assessmentReadiness", "achievements", "operationalActions", "lifecycleEvents"])("requires the %s collection as an array of identified records", (name) => {
    for (const bad of [undefined, {}, "", [null], [{}]]) {
      const value = envelope(); object(value.workspace.data)[name] = bad;
      expect(() => decodeWorkspaceResponse(value, identity)).toThrow();
    }
  });
  it("rejects malformed nested profile, application, role and catalogue render arrays", () => {
    const changes: ((value: ReturnType<typeof envelope>) => void)[] = [
      (value) => { object(value.workspace.data.profile).sites = null; },
      (value) => { value.workspace.data.applications = [application()]; object(value.workspace.data.applications[0]).history = {}; },
      (value) => { object(value.workspace.data).roles = [{ id: "role", pathwayMappings: null }]; },
      (value) => { value.workspace.data = createEmptyMvpWorkspace(); object(value.workspace.data.providers[0]).sectors = null; },
      (value) => { value.workspace.data = createEmptyMvpWorkspace(); object(value.workspace.data.providerProgrammes[0].commercialProfile).downloads = {}; },
      (value) => { value.workspace.data.applications = [application(), application()]; },
    ];
    for (const change of changes) { const value = envelope(); change(value); expect(() => decodeWorkspaceResponse(value, identity)).toThrow(); }
  });
  it("rejects another tenant's learner row even when the outer metadata matches", () => {
    const value = envelope(); object(value.workspace.data).learnerRecords = [{ id: "learner-a", organisationId: "20000000-0000-4000-8000-000000000002" }];
    expect(() => decodeWorkspaceResponse(value, identity)).toThrow();
  });
  it("leaves the existing workspace and confirmation callback untouched after a malformed 200", async () => {
    const previous = envelope().workspace; let displayed = previous; const confirmed = vi.fn();
    const response = Response.json({ ok: true, workspace: { data: { version: 6 }, meta: previous.meta } });
    await expect((async () => {
      const decoded = decodeWorkspaceResponse(await response.json(), identity);
      displayed = decoded; confirmed();
    })()).rejects.toThrow();
    expect(displayed).toBe(previous); expect(confirmed).not.toHaveBeenCalled();
  });
});

describe("exact previously sent application receipt recovery", () => {
  const command = (): LevyTateWorkspaceMutation => ({ type: "saveApplication", application: application(), expectedRevision: 0, idempotencyKey: "original-synthetic-command" });
  it("permits only an exact sent command after reconnect sees the committed application", () => {
    const recovery = createApplicationReceiptRecovery(), original = command();
    expect(recovery.matches(original)).toBe(false); recovery.remember(original);
    // A readback may now show revision1 and Awaiting Manager Review. The original
    // command still needs to reach the server's authority/receipt checks.
    expect(recovery.matches(structuredClone(original))).toBe(true);
    const changed = command(); if (changed.type === "saveApplication") changed.application.reason = "Edited after reconnect";
    expect(recovery.matches(changed)).toBe(false);
    expect(recovery.matches({ ...command(), expectedRevision: 1 })).toBe(false);
    expect(recovery.matches({ ...command(), idempotencyKey: "changed" } as LevyTateWorkspaceMutation)).toBe(false);
    recovery.confirm(changed); expect(recovery.matches(original)).toBe(true);
    recovery.confirm(original); expect(recovery.matches(original)).toBe(false);
  });
  it("captures nested values before a caller edits its object and never trusts an unsent command", () => {
    const recovery = createApplicationReceiptRecovery(), original = command(), copy = structuredClone(original);
    recovery.remember(original);
    if (original.type === "saveApplication") original.application.careerGoal = "Changed goal";
    expect(recovery.matches(original)).toBe(false); expect(recovery.matches(copy)).toBe(true);
    expect(createApplicationReceiptRecovery().matches(copy)).toBe(false);
    recovery.remember({ type: "updateApplicationStatus", id: "synthetic-application", status: "Approved for Enrolment", expectedRevision: 0 });
    expect(recovery.matches(copy)).toBe(true);
  });
});
