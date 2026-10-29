import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/levytate-supabase", () => ({
  getLevyTateSupabaseConfig: () => ({ url: "http://localhost:54321", serviceRoleKey: "fictional-only" }),
  supabaseFetchJson: rpc,
}));
import { applyAtomicWorkspaceCommand } from "@/lib/server/levytate-workspace-commands";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { parseWorkspaceMutation } from "@/lib/server/levytate-mutation-input";

const mutation = { type: "archiveRole", id: "role-a", status: "Archived", expectedRevision: 4 } as const;
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ entityKey: "levytate_roles:role-a", revision: 5 }); });
describe("actual atomic workspace service boundary", () => {
  it("uses one closed command with actor, tenant, explicit state and observed revision", async () => {
    await applyAtomicWorkspaceCommand("org-a", "actor-a", mutation, { status: "Archived" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toBe("rpc/levytate_workspace_command");
    expect(JSON.parse(rpc.mock.calls[0][2].body)).toEqual({ p_organisation_id: "org-a", p_actor_user_id: "actor-a", p_action: "archiveRole", p_entity_id: "role-a", p_expected_revision: 4, p_record: { status: "Archived" } });
  });
  it.each([undefined, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid revision %s before transport", async (revision) => {
    await expect(applyAtomicWorkspaceCommand("org-a", "actor-a", { ...mutation, expectedRevision: revision }, { status: "Archived" })).rejects.toMatchObject({ status: 409 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["PT403: private actor detail", 403], ["PT404: private record detail", 404], ["PT409: private revision detail", 409],
    ["23505: private duplicate detail", 409], ["PT422: private row detail", 422], ["23514: private constraint detail", 422], ["55000: private audit outage", 503],
  ])("maps database failure %s without leaking diagnostic data", async (message, status) => {
    rpc.mockRejectedValue(new Error(message as string));
    const failure = await applyAtomicWorkspaceCommand("org-a", "actor-a", mutation, { status: "Archived" }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ClientRequestError);
    expect(failure).toMatchObject({ status });
    expect((failure as Error).message).not.toContain("private");
  });
  it.each([null, { entityKey: "levytate_roles:foreign", revision: 5 }, { entityKey: "levytate_roles:role-a", revision: 4 }, { entityKey: "levytate_roles:role-a", revision: 5.5 }])("does not report success without a valid advanced receipt", async (receipt) => {
    rpc.mockResolvedValue(receipt);
    await expect(applyAtomicWorkspaceCommand("org-a", "actor-a", mutation, { status: "Archived" })).rejects.toMatchObject({ status: 503 });
  });
  it("requires observed revisions for role saves and selection changes at the public envelope", () => {
    for (const body of [{ type: "saveRole", role: {} }, { type: "saveOrganisationProvider", selection: {} }, { type: "saveOrganisationProgramme", selection: {} }]) {
      expect(() => parseWorkspaceMutation(body)).toThrow(ClientRequestError);
      expect(parseWorkspaceMutation({ ...body, expectedRevision: 0 })).toMatchObject({ expectedRevision: 0 });
    }
  });
});
