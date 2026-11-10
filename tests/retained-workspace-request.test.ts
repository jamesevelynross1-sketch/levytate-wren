import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedClientFetch } from "@/lib/levytate/client-session";
import { createRetainedWorkspaceRequest } from "@/lib/levytate/retained-workspace-request";

const original = () => ({ email: "lead@example.invalid", organisationId: "10000000-0000-4000-8000-000000000001" });
describe("retained learner request identity", () => {
  it("keeps the identity that opened the form even if caller metadata changes", async () => {
    const identity = original(), wire = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const request = createRetainedWorkspaceRequest(identity, createAuthenticatedClientFetch(wire));
    identity.email = "changed@example.invalid"; identity.organisationId = "different";
    await request("/api/levytate-learners", { method: "GET" });
    const options = wire.mock.calls[0][1] as RequestInit, headers = new Headers(options.headers);
    expect(headers.get("X-LevyTate-Account")).toBe(original().email);
    expect(headers.get("X-LevyTate-Organisation")).toBe(original().organisationId);
  });
  it("rejects a changed-account refresh before replaying the learner write", async () => {
    const wire = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ identity: { ...original(), email: "different@example.invalid" } }));
    const request = createRetainedWorkspaceRequest(original(), createAuthenticatedClientFetch(wire));
    const result = await request("/api/levytate-learners/synthetic/outcome", { method: "POST", body: "original-command" });
    expect(result.status).toBe(409); expect(wire).toHaveBeenCalledTimes(2);
    expect(wire.mock.calls[1][0]).toBe("/api/levytate-auth/session");
  });
  it("preserves the exact original command and identity through authorised refresh", async () => {
    const wire = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ identity: original() })).mockResolvedValueOnce(Response.json({ ok: true }));
    const request = createRetainedWorkspaceRequest(original(), createAuthenticatedClientFetch(wire));
    await request("/api/levytate-learners/synthetic/reviews", { method: "POST", body: "exact-retained-command" });
    expect(wire).toHaveBeenCalledTimes(3);
    expect(wire.mock.calls[0][1]).toEqual(wire.mock.calls[2][1]);
  });
  it.each([null, { ...original(), email: "" }, { ...original(), organisationId: "" }])("makes no request without the original verified identity", async (identity) => {
    const wire = vi.fn(), request = createRetainedWorkspaceRequest(identity, wire);
    await expect(request("/api/levytate-learners")).rejects.toThrow("account could not be verified");
    expect(wire).not.toHaveBeenCalled();
  });
  it("does not retry an uncertain response or allow outgoing origin changes", async () => {
    const wire = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const request = createRetainedWorkspaceRequest(original(), createAuthenticatedClientFetch(wire));
    expect((await request("/api/levytate-learners/synthetic/progress", { method: "POST", body: "same-command" })).status).toBe(503);
    await expect(request("//untrusted.example.invalid/collect")).rejects.toThrow("application origin");
    expect(wire).toHaveBeenCalledOnce();
  });
});
