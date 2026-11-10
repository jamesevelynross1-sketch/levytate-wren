import { afterEach, describe, expect, it, vi } from "vitest";
import { authProviderRequest } from "@/lib/server/levytate-auth-provider-request";
afterEach(() => vi.unstubAllGlobals());
const run = () => authProviderRequest("http://127.0.0.1/auth/v1/verify", { method: "POST" });
describe("Auth provider availability (transport unit tests)", () => {
  it.each(["otp_expired", "invite_not_found", "refresh_token_not_found", "refresh_token_already_used", "session_not_found"])("recognises explicit invalid credential code %s", async (code) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error_code: code }, { status: 400 })));
    expect((await run()).ok).toBe(false);
  });
  it.each([500, 502, 503, 504])("reports provider status %s as unavailable, never expired identity", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "unexpected_failure" }, { status })));
    await expect(run()).rejects.toMatchObject({ status: 503 });
  });
  it.each([400, 403, 422])("recognises GoTrue numeric status %s with an explicit expired-link code", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: status, error_code: "otp_expired" }, { status })));
    expect((await run()).status).toBe(status);
  });
  it("accepts the legacy string code format", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "invalid_credentials" }, { status: 400 })));
    expect((await run()).status).toBe(400);
  });
  it("does not ignore an unknown explicit error_code in favour of a legacy code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "otp_expired", error_code: "unexpected_failure" }, { status: 403 })));
    await expect(run()).rejects.toMatchObject({ status: 503 });
  });
  it("keeps provider rate limits distinct", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));
    await expect(run()).rejects.toMatchObject({ status: 429 });
  });
  it.each([new Response("broken", { status: 400 }), Response.json({ code: "invalid_api_key" }, { status: 401 }), new Response("x".repeat(17000), { status: 400 })])("fails closed on unexpected or oversized error replies", async (response) => {
    vi.stubGlobal("fetch", vi.fn(async () => response));
    await expect(run()).rejects.toMatchObject({ status: 503 });
  });
  it("bounds requests and suppresses network diagnostic details", async () => {
    const request = vi.fn(async () => { throw new Error("private URL/key detail"); });
    vi.stubGlobal("fetch", request);
    await expect(run()).rejects.toMatchObject({ status: 503, message: "Secure sign-in is temporarily unavailable. Please try again shortly." });
    expect(request.mock.calls[0]).toEqual([expect.any(String), expect.objectContaining({ signal: expect.any(AbortSignal) })]);
  });
});
