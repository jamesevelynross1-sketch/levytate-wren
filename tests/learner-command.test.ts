import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ fetch: vi.fn(), config: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: transport.config, supabaseFetchJson: transport.fetch, supabaseSelect: transport.select }));
import { applyLearnerTransaction, learnerCommandKey, learnerRevision, learnerWritePlan } from "@/lib/server/levytate-learner-transaction";

const command = { organisationId: "tenant-fixture", actorId: "lead-fixture", learnerId: "learner-fixture", action: "progress", input: [{ actualProgressPercentage: 12, expectedActivityVersion: "version-fixture" }] };
beforeEach(() => { vi.clearAllMocks(); transport.config.mockReturnValue({}); transport.fetch.mockResolvedValue({ kind: "detail", value: null }); transport.select.mockResolvedValue([{ mutation_revision: 4 }]); });

describe("learner transaction transport (not hosted authentication or database acceptance)", () => {
  it("uses one bounded RPC for evidence, events and result, with the authoritative actor and revision", async () => {
    const writes = [{ table: "levytate_learner_progress_updates", row: { id: "progress-fixture" } }, { table: "levytate_learner_lifecycle_events", row: { id: "event-fixture" } }];
    await applyLearnerTransaction(command, { expectedRevision: 4, writes, result: { kind: "detail", value: null } });
    expect(transport.fetch).toHaveBeenCalledTimes(1);
    expect(transport.fetch.mock.calls[0][1]).toBe("rpc/levytate_apply_learner_command");
    expect(JSON.parse(transport.fetch.mock.calls[0][2].body)).toMatchObject({ p_actor_user_id: command.actorId, p_organisation_id: command.organisationId, p_learner_id: command.learnerId, p_expected_revision: 4, p_writes: writes, p_probe: false });
  });
  it("probes the same command receipt before calculating a new plan", async () => {
    await applyLearnerTransaction(command, { probe: true });
    await applyLearnerTransaction(command, { expectedRevision: 4, writes: [], result: {} });
    const [probe, save] = transport.fetch.mock.calls.map((call) => JSON.parse(call[2].body));
    expect(probe.p_request_id).toBe(save.p_request_id);
    expect(probe).toMatchObject({ p_probe: true, p_writes: [], p_expected_revision: null, p_result: null });
  });
  it("binds generated retry keys to role identity, tenant, learner, action and original input", () => {
    const keys = [command, { ...command, actorId: "other-actor" }, { ...command, organisationId: "other-tenant" }, { ...command, learnerId: "other-learner" }, { ...command, action: "review" }, { ...command, input: [] }].map(learnerCommandKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(learnerCommandKey(command)).toMatch(/^[a-f0-9]{64}$/);
    expect(learnerCommandKey({ ...command, idempotencyKey: "retained-ui-key" })).toBe("retained-ui-key");
  });
  it("keeps concurrent request plans separate", async () => {
    const left = { writes: [], synchronise: false };
    const right = { writes: [], synchronise: true };
    await Promise.all([learnerWritePlan.run(left, async () => { await Promise.resolve(); expect(learnerWritePlan.getStore()).toBe(left); }), learnerWritePlan.run(right, async () => { await Promise.resolve(); expect(learnerWritePlan.getStore()).toBe(right); })]);
    expect(learnerWritePlan.getStore()).toBeUndefined();
  });
  it("requires a real scoped revision record", async () => {
    expect(await learnerRevision(command.organisationId, command.learnerId)).toBe(4);
    expect(transport.select.mock.calls[0][2].get("organisation_id")).toBe(`eq.${command.organisationId}`);
    transport.select.mockResolvedValue([]);
    await expect(learnerRevision(command.organisationId, command.learnerId)).rejects.toMatchObject({ status: 404 });
  });
  it.each([["PT409",409], ["PT403",403], ["PT404",404], ["PT422",422], ["23505",409], ["private-error",503]])("maps %s without leaking provider internals", async (code,status) => {
    transport.fetch.mockRejectedValue(new Error(`${code}: secret private-table credential`));
    await expect(applyLearnerTransaction(command)).rejects.toMatchObject({ status });
    await expect(applyLearnerTransaction(command)).rejects.not.toThrow(/secret|credential|private-table/);
  });
});
