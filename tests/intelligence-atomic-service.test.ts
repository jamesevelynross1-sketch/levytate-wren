import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), select: vi.fn(), context: vi.fn(), details: vi.fn(), actions: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", async original => ({ ...await original<typeof import("@/lib/server/levytate-supabase")>(), getLevyTateSupabaseConfig: () => ({ url: "https://fictional.invalid", serviceRoleKey: "fictional-only" }), supabaseFetchJson: mocks.rpc, supabaseSelect: mocks.select, supabaseInsert: mocks.insert, supabaseUpdate: mocks.update }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: mocks.context, listOrganisationLearnerLifecycleDetails: mocks.details, LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
vi.mock("@/lib/server/levytate-operational-actions", () => ({ listOperationalActions: mocks.actions }));
import { intelligenceCommand, IntelligenceCommandError } from "@/lib/server/levytate-intelligence-commands";
import { analyseAndPersistIntelligenceSignals, listIntelligenceSignals, updateIntelligenceSignal } from "@/lib/server/levytate-intelligence-signals";
import { createAutopilotAction, dismissAutopilotSignal, getAutopilotWorkspace } from "@/lib/server/levytate-autopilot";
import { LevyTateSupabaseError } from "@/lib/server/levytate-supabase";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
const org = "10000000-0000-4000-8000-000000000001", actor = "20000000-0000-4000-8000-000000000002", request = "30000000-0000-4000-8000-000000000003";
const scope = { organisationId: org, userId: actor, userEmail: "lead@example.test", role: "Apprenticeship Lead" }, family = "progress-review-v1";
const session = { email: scope.userEmail } as LevyTateBetaSession;
const row = { organisation_id: org, id: "signal-one", revision: 2, analyser_version: family, status: "acknowledged", fingerprint: "fictional-source", entity_type: "learner", entity_id: "learner-one", learner_record_id: "learner-one", category: "risk", signal_type: "progress_deterioration", title: "Synthetic signal", summary: "Synthetic recorded evidence", evidence: [{ sourceType: "progress_update", sourceId: "progress-one", sourceDate: "2026-11-10", label: "Recorded progress" }], confidence: "High", priority: "High", recommended_action: "Review evidence", suggested_owner_type: "Apprenticeship Lead", suggested_due_date: null, detected_at: "2026-11-10T08:00:00Z", last_evaluated_at: "2026-11-10T08:00:00Z", acknowledged_by: actor, acknowledged_at: "2026-11-10T08:10:00Z", dismissed_by: "", dismissal_reason: "", model_identifier: "" };
function receipt(action = "acknowledge", selectedFamily = family) {
  const signal = { ...row, analyser_version: selectedFamily, status: action === "dismiss" ? "dismissed" : ["accept", "create_action"].includes(action) ? "accepted" : "acknowledged", linked_operational_action_id: ["accept", "create_action"].includes(action) ? "action-one" : null };
  return { receipt: { signals: [signal], signal, state: { organisation_id: org, family: selectedFamily, revision: 4, reconciled_at: "2026-11-10T08:00:00Z" }, confirmation: { idempotencyKey: request, action, organisationId: org, userEmail: scope.userEmail, role: scope.role, signalId: signal.id, revision: 2 }, operationalActionId: signal.linked_operational_action_id, reused: false, learnerCount: 1 } };
}
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue({ organisation: { id: org }, user: { id: actor, email: scope.userEmail, role: scope.role } }); mocks.rpc.mockResolvedValue(receipt()); mocks.select.mockResolvedValue([]); });
describe("atomic Intelligence service transport", () => {
  it.each(["acknowledge", "dismiss", "accept"] as const)("sends %s only through the actor-bound atomic RPC", async action => {
    mocks.rpc.mockResolvedValue(receipt(action));
    const result = await updateIntelligenceSignal(session, row.id, action, action === "dismiss" ? "No action required" : undefined, { idempotencyKey: request, expectedRevision: 1 });
    expect(result.signal.revision).toBe(2); expect(result.confirmation.action).toBe(action);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.rpc.mock.calls[0][2].body)).toMatchObject({ p_organisation_id: org, p_actor_user_id: actor, p_family: family, p_command: { idempotencyKey: request, expectedRevision: 1, signalId: row.id, action } });
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("an exact analysis receipt returns its recorded result without rerunning mutable source analysis", async () => {
    const value = receipt("analyse"); value.receipt.confirmation.signalId = null as unknown as string; value.receipt.confirmation.revision = 4;
    mocks.rpc.mockResolvedValue(value);
    const result = await analyseAndPersistIntelligenceSignals(session, { idempotencyKey: request });
    expect(result.lastAnalysedAt).toBe("2026-11-10T08:00:00Z"); expect(result.learnersAnalysed).toBe(1);
    expect(mocks.details).not.toHaveBeenCalled(); expect(mocks.actions).not.toHaveBeenCalled(); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("an empty recorded store is explicitly unchecked, not freshly evaluated", async () => {
    const actual = await listIntelligenceSignals(session);
    expect(actual).toMatchObject({ signals: [], checked: false, revision: 0, lastAnalysedAt: null, scope: { organisationId: org, userEmail: scope.userEmail, role: scope.role } });
    expect(mocks.select.mock.calls.find(([,table]) => table === "levytate_intelligence_signals")?.[2].get("analyser_version")).toBe(`eq.${family}`);
  });
  it.each(["Employee", "Line Manager", "Department Head", "Platform Admin"])("does not turn %s into organisation Intelligence authority", async role => {
    mocks.context.mockResolvedValue({ organisation: { id: org }, user: { id: actor, email: scope.userEmail, role } });
    await expect(updateIntelligenceSignal(session, row.id, "acknowledge", undefined, { idempotencyKey: request, expectedRevision: 1 })).rejects.toThrow(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["PT409", "40001", "40P01", "23505"])("maps %s to safe conflict while preserving the original command", async code => {
    mocks.rpc.mockRejectedValue(new LevyTateSupabaseError(`${code} fictional private diagnostic`));
    await expect(intelligenceCommand(scope, family, { action: "acknowledge", signalId: row.id, idempotencyKey: request, expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    try { await intelligenceCommand(scope, family, {}); } catch(error) { expect((error as Error).message).not.toContain("private"); }
  });
  it.each([
    (value: ReturnType<typeof receipt>) => { value.receipt.confirmation.organisationId = "other"; },
    (value: ReturnType<typeof receipt>) => { value.receipt.confirmation.userEmail = "other@example.test"; },
    (value: ReturnType<typeof receipt>) => { value.receipt.confirmation.idempotencyKey = "different"; },
    (value: ReturnType<typeof receipt>) => { value.receipt.confirmation.action = "dismiss"; },
    (value: ReturnType<typeof receipt>) => { value.receipt.confirmation.revision = 9; },
    (value: ReturnType<typeof receipt>) => { value.receipt.signals[0].organisation_id = "other"; },
    (value: ReturnType<typeof receipt>) => { value.receipt.state.family = "other"; },
  ])("rejects an unconfirmed or wrong-scope successful RPC response", async corrupt => {
    const value = receipt(); corrupt(value); mocks.rpc.mockResolvedValue(value);
    await expect(intelligenceCommand(scope, family, { action: "acknowledge", signalId: row.id, idempotencyKey: request, expectedRevision: 1 })).rejects.toBeInstanceOf(IntelligenceCommandError);
  });
});
describe("Autopilot uses the same atomic boundary and truthful read state", () => {
  it("never supplies a fresh generatedAt for an employer with no recorded reconciliation", async () => { expect(await getAutopilotWorkspace(session)).toMatchObject({ checked: false, generatedAt: null, revision: 0, organisationId: org }); });
  it("keeps actual reconciledAt on later GET even when no signals remain", async () => {
    mocks.select.mockImplementation(async (_config,table) => table === "levytate_intelligence_workspaces" ? [{ revision: 3, reconciled_at: "2026-11-09T09:00:00Z" }] : []);
    expect(await getAutopilotWorkspace(session)).toMatchObject({ checked: true, generatedAt: "2026-11-09T09:00:00Z", revision: 3 });
  });
  it("dismissal returns the exact atomic snapshot without a failure-prone follow-up read", async () => {
    mocks.rpc.mockResolvedValue(receipt("dismiss", "operations-autopilot-v1"));
    const result = await dismissAutopilotSignal(session, row.id, "Synthetic explicit decision", { idempotencyKey: request, expectedRevision: 1 });
    expect(result.confirmation.action).toBe("dismiss"); expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("accepted action and signal are confirmed by one receipt without direct writes", async () => {
    mocks.rpc.mockResolvedValue(receipt("create_action", "operations-autopilot-v1"));
    const result = await createAutopilotAction(session, row.id, { title: "Synthetic human reviewed action", ownerType: "Apprenticeship Lead", dueDate: "2026-11-11", communicationDraft: "Draft only; never sent" }, { idempotencyKey: request, expectedRevision: 1 });
    expect(result.operationalActionId).toBe("action-one"); expect(result.confirmation.action).toBe("create_action"); expect(mocks.rpc).toHaveBeenCalledOnce(); expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.select).not.toHaveBeenCalled();
  });
});
