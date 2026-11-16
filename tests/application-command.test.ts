import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ fetch: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: transport.config, supabaseFetchJson: transport.fetch }));

import { applyApplicationCommand } from "@/lib/server/levytate-application-commands";

const command = { applicationId: "application-fixture", action: "approve" as const, expectedRevision: 3, fields: { note: "Reviewed synthetic evidence." } };

beforeEach(() => { vi.clearAllMocks(); transport.config.mockReturnValue({}); transport.fetch.mockResolvedValue({ revision: 4 }); });

describe("application command transport contract (not hosted authentication acceptance)", () => {
  it("preserves the authoritative actor, revision and an identical retry key", async () => {
    await applyApplicationCommand("tenant-a", "manager-a", command);
    await applyApplicationCommand("tenant-a", "manager-a", command);
    const first = JSON.parse(transport.fetch.mock.calls[0][2].body);
    const retry = JSON.parse(transport.fetch.mock.calls[1][2].body);
    expect(first).toEqual(retry);
    expect(first).toMatchObject({ p_organisation_id: "tenant-a", p_actor_user_id: "manager-a", p_expected_revision: 3, p_action: "approve" });
    expect(first.p_idempotency_key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds generated keys to actor and content", async () => {
    await applyApplicationCommand("tenant-a", "manager-a", command);
    await applyApplicationCommand("tenant-a", "manager-b", command);
    await applyApplicationCommand("tenant-a", "manager-a", { ...command, fields: { note: "Different review." } });
    expect(new Set(transport.fetch.mock.calls.map((call) => JSON.parse(call[2].body).p_idempotency_key)).size).toBe(3);
  });

  it("fails before persistence for absent revisions", async () => {
    await expect(applyApplicationCommand("tenant-a", "manager-a", { ...command, expectedRevision: undefined as unknown as number })).rejects.toMatchObject({ status: 409 });
    expect(transport.fetch).not.toHaveBeenCalled();
  });

  it.each([["PT409",409], ["PT403",403], ["PT404",404], ["PT422",422], ["23505",409], ["private-provider-error",503]])("maps %s without disclosing database details", async (code, status) => {
    transport.fetch.mockRejectedValue(new Error(`${code}: private relation and credential detail`));
    try { await applyApplicationCommand("tenant-a", "manager-a", command); throw new Error("Expected rejection"); }
    catch (error) { expect(error).toMatchObject({ status }); expect((error as Error).message).not.toMatch(/private|credential|relation/); }
  });
});
