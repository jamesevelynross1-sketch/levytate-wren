import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedClientFetch } from "../lib/levytate/client-session";
const identity = { email: "person@example.test", organisationId: "tenant-a" };
describe("browser session recovery", () => {
  it("refreshes once after401 and replays the exact not-authorised write", async () => {
    const transport = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ ok: true, identity })).mockResolvedValueOnce(Response.json({ ok: true }));
    const request = createAuthenticatedClientFetch(transport);
    expect((await request("/api/levytate-workspace", { method: "POST", body: "stable-input" }, identity)).status).toBe(200);
    expect(transport.mock.calls[0]).toEqual(transport.mock.calls[2]); expect(transport.mock.calls[1][0]).toBe("/api/levytate-auth/session");
  });
  it.each([403, 409, 429, 500, 503])("never replays a failed or uncertain %s write", async (status) => {
    const transport = vi.fn().mockResolvedValue(new Response(null, { status }));
    expect((await createAuthenticatedClientFetch(transport)("/api/levytate-workspace", { method: "POST", body: "stable-input" }, identity)).status).toBe(status);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("does not replay network failures", async () => {
    const transport = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(createAuthenticatedClientFetch(transport)("/api/levytate-workspace", { method: "POST" }, identity)).rejects.toThrow("offline");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("reports dependency unavailable truthfully and never loops after refresh fails", async () => {
    const transport = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ message: "unavailable" }, { status: 503 }));
    expect((await createAuthenticatedClientFetch(transport)("/api/levytate-workspace", {}, identity)).status).toBe(503); expect(transport).toHaveBeenCalledTimes(2);
  });
  it("does not replay another account's retained form", async () => {
    const transport = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ identity: { ...identity, organisationId: "tenant-b" } }));
    const response = await createAuthenticatedClientFetch(transport)("/api/levytate-workspace", { method: "POST", body: "old-account-form" }, identity);
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "account_changed" }); expect(transport).toHaveBeenCalledTimes(2);
  });
  it("never sends authenticated requests to an external origin", async () => {
    const transport = vi.fn(); const request = createAuthenticatedClientFetch(transport);
    await expect(request("https://example.test/api")).rejects.toThrow(); await expect(request("//example.test/api")).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
  });
});
