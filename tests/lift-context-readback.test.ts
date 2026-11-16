import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildLiftFixtureWorkspace } from "@/lib/server/levytate-lift-fixtures";
import { decodeLiftReadResponse } from "@/lib/levytate/client-module-reads";
import { LiftModule } from "@/components/levytate-mvp/LiftModule";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";

const gateway = vi.hoisted(() => ({ actor: vi.fn(), enabled: vi.fn(), select: vi.fn(), all: vi.fn(), revision: vi.fn() }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: gateway.actor }));
vi.mock("@/lib/server/levytate-lift-capability", () => ({ isLiftEnabledForOrganisation: gateway.enabled }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseSelect: gateway.select, supabaseSelectAll: gateway.all }));
vi.mock("@/lib/server/levytate-lift-transaction", () => ({ liftRevision: gateway.revision, liftWritePlan: { getStore: () => undefined } }));
import { getLiftWorkspaceForSession } from "@/lib/server/levytate-lift";

const contextTable = "levytate_lift_employee_observation_contexts";
const email = "fictional.employee@example.test";
const session: LevyTateBetaSession = { email, accessLevel: "beta_user", authMode: "supabase_email", authSubject: "fictional-subject", issuedAt: 1, expiresAt: 2 };
let role: string, tenant: string, observationStatus: string, assessmentStatus: string, duplicate: boolean, contextFailure: boolean;
function rows(table: string) {
  const employee = { id: "employee", name: "Fictional employee", email, department: "Test", job_title: "Synthetic", manager_id: "manager", status: "Active" };
  const manager = { ...employee, id: "manager", name: "Fictional manager", email: "fictional.manager@example.test", manager_id: "" };
  if (table === "levytate_employees") return duplicate ? [employee, { ...employee, id: "ambiguous", email: ` ${email.toUpperCase()} ` }, manager] : [employee, manager];
  if (table === "levytate_lift_participants") return [{ id: "participant", campaign_id: "campaign", employee_id: "employee", status: "submitted", submitted_at: "2026-11-09T10:00:00Z" }];
  if (table === "levytate_lift_assessments") return [{ id: "assessment", campaign_id: "campaign", participant_id: "participant", employee_id: "employee", status: assessmentStatus, current_revision: 1, active_submission_revision: assessmentStatus === "submitted" ? 1 : null, current_question_index: 0 }];
  if (table === "levytate_lift_manager_observations") return [{ id: "observation", campaign_id: "campaign", participant_id: "participant", employee_id: "employee", manager_employee_id: "manager", status: observationStatus, current_revision: 1, active_submission_revision: observationStatus === "draft" ? null : 1 }];
  if (table === "levytate_lift_assessment_revisions") return [{ id: "assessment-revision", assessment_id: "assessment", revision_number: 1, status: assessmentStatus, answers: {} }];
  if (table === "levytate_lift_manager_observation_revisions") return [{ id: "observation-revision", observation_id: "observation", revision_number: 1, status: "submitted", observed_work: "Fictional work", concrete_examples: [], suitable_opportunity: "Fictional opportunity", intended_outcome: "Fictional measure", condition_time: "", condition_tools: "", condition_access: "", condition_supervision: "", condition_suitable_work: "" }];
  if (table === contextTable) return [
    { id: "own", organisation_id: "tenant-a", observation_id: "observation", employee_id: "employee", context: "Fictional own recorded clarification", disputed: true, created_by: "private-actor-id", created_at: "2026-11-09T11:00:00Z" },
    { id: "other-person", organisation_id: "tenant-a", observation_id: "observation", employee_id: "other", context: "Other person private", disputed: false, created_at: "2026-11-09T11:00:00Z" },
    { id: "old", organisation_id: "tenant-a", observation_id: "older-observation", employee_id: "employee", context: "Previous observation private", disputed: false, created_at: "2026-11-09T11:00:00Z" },
    { id: "other-tenant", organisation_id: "tenant-b", observation_id: "observation", employee_id: "employee", context: "Other tenant private", disputed: false, created_at: "2026-11-09T11:00:00Z" },
  ];
  return [];
}
async function select(_connection: unknown, table: string, query: URLSearchParams | string) {
  if (table === contextTable && contextFailure) throw new Error("Synthetic dependency failure");
  const params = new URLSearchParams(query);
  return rows(table).filter(row => [...params.entries()].every(([key, value]) => !value.startsWith("eq.") || !(key in row) || String(Reflect.get(row, key)) === value.slice(3)));
}
beforeEach(() => {
  vi.clearAllMocks(); role = "Employee"; tenant = "tenant-a"; observationStatus = "released"; assessmentStatus = "submitted"; duplicate = false; contextFailure = false;
  gateway.actor.mockImplementation(async () => ({ organisation: { id: tenant }, user: { id: "actor", email, role } }));
  gateway.enabled.mockResolvedValue(true); gateway.revision.mockResolvedValue(3); gateway.select.mockImplementation(select); gateway.all.mockImplementation(select);
});
function contextQueries() { return gateway.all.mock.calls.filter(call => call[1] === contextTable); }

describe("Lift own clarification service readback (transport simulation, not authentication acceptance)", () => {
  it("returns the persisted own clarification using only the released observation projection", async () => {
    const result = await getLiftWorkspaceForSession(session);
    expect(Reflect.get(result.assessment!.releasedManagerObservation!, "ownContexts")).toEqual([{ id: "own", context: "Fictional own recorded clarification", disputed: true, recordedAt: "2026-11-09T11:00:00Z" }]);
    const calls = contextQueries(); expect(calls).toHaveLength(1);
    const query = new URLSearchParams(calls[0][2]);
    expect(Object.fromEntries(query)).toMatchObject({ organisation_id: "eq.tenant-a", employee_id: "eq.employee", observation_id: "eq.observation", select: "id,context,disputed,created_at", order: "created_at.asc,id.asc" });
  });
  it("returns the same durable context on a later independent service read", async () => {
    const first = await getLiftWorkspaceForSession(session), next = await getLiftWorkspaceForSession(session);
    expect(Reflect.get(next.assessment!.releasedManagerObservation!, "ownContexts")).toEqual(Reflect.get(first.assessment!.releasedManagerObservation!, "ownContexts"));
    expect(contextQueries()).toHaveLength(2);
  });
  it.each(["draft", "submitted", "revoked"])("never loads clarifications before an observation is released (%s)", async status => {
    observationStatus = status; const result = await getLiftWorkspaceForSession(session);
    expect(result.assessment!.releasedManagerObservation).toBeNull(); expect(contextQueries()).toHaveLength(0);
  });
  it("does not expose a released observation when the own assessment is not submitted", async () => {
    assessmentStatus = "draft"; const result = await getLiftWorkspaceForSession(session);
    expect(result.assessment!.releasedManagerObservation).toBeNull(); expect(contextQueries()).toHaveLength(0);
  });
  it.each(["Line Manager", "Apprenticeship Lead", "Employer Admin"])("never fetches or exposes employee clarifications to %s", async nextRole => {
    role = nextRole; const result = await getLiftWorkspaceForSession(nextRole === "Line Manager" ? { ...session, email: "fictional.manager@example.test" } : session);
    expect(result.assessment).toBeNull(); expect(contextQueries()).toHaveLength(0); expect(JSON.stringify(result)).not.toContain("Fictional own recorded clarification");
  });
  it("never exposes the same employee identifier's contexts from another employer", async () => {
    tenant = "tenant-c"; const result = await getLiftWorkspaceForSession(session);
    expect(Reflect.get(result.assessment!.releasedManagerObservation!, "ownContexts")).toEqual([]);
    expect(new URLSearchParams(contextQueries()[0][2]).get("organisation_id")).toBe("eq.tenant-c");
  });
  it("rejects ambiguous normalized active People identity before fetching private contexts", async () => {
    duplicate = true; await expect(getLiftWorkspaceForSession(session)).rejects.toMatchObject({ status: 403 }); expect(contextQueries()).toHaveLength(0);
  });
  it("fails the read when its context dependency is unavailable, without substituting empty history", async () => {
    contextFailure = true; await expect(getLiftWorkspaceForSession(session)).rejects.toThrow();
  });
});


describe("Lift clarification render and response contract", () => {
  const saved = () => {
    const workspace = { ...buildLiftFixtureWorkspace("Employee"), mutationRevision: 1 };
    workspace.assessment!.releasedManagerObservation!.ownContexts = [{ id: "own-context", context: "Fictional clarification <script>not executable</script>", disputed: true, recordedAt: "2026-11-09T11:00:00Z" }];
    return { ok: true, workspace };
  };
  it("renders recorded context, dispute status and timestamp from a fresh validated model", () => {
    const workspace = decodeLiftReadResponse(saved()), html = renderToStaticMarkup(createElement(LiftModule, { initialWorkspace: workspace }));
    expect(html).toContain('aria-label="Your recorded context"'); expect(html).toContain("Disputed observation");
    expect(html).toContain("Fictional clarification &lt;script&gt;not executable&lt;/script&gt;");
    expect(html).toMatch(/datetime="2026-11-09T11:00:00Z"/i);
  });
  it.each([undefined, null, [{}], [{ id: "x", context: "Private", disputed: "false", recordedAt: "2026-11-09T11:00:00Z" }], [{ id: "x", context: "Private", disputed: false, recordedAt: "invalid" }]])("rejects absent or malformed context history without presenting an empty successful history", ownContexts => {
    const value = saved(); Object.assign(value.workspace.assessment!.releasedManagerObservation!, { ownContexts });
    expect(() => decodeLiftReadResponse(value)).toThrow("incomplete response");
  });
});
