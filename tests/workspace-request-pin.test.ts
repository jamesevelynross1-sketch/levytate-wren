import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), config: vi.fn(), limit: vi.fn(),
}));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: mocks.config, supabaseSelect: mocks.select }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({
  checkAuthenticatedWriteLimit: mocks.limit,
  LevyTateRateLimitStoreError: class extends Error {},
}));
import { assertAuthenticatedWrite, assertExpectedWorkspace } from "@/lib/server/levytate-request-boundary";
import { createAuthenticatedClientFetch } from "@/lib/levytate/client-session";

const originalOrganisation = "10000000-0000-4000-8000-000000000001";
const currentOrganisation = "20000000-0000-4000-8000-000000000002";
const email = "synthetic@example.invalid";
const origin = "https://candidate.vercel.app";
const member = () => ({ email, organisation_id: originalOrganisation, active: true });
function request(organisationId = originalOrganisation, method = "POST") {
  return new Request(`${origin}/api/levytate-workspace`, { method, headers: {
    origin, "X-LevyTate-Account": email, "X-LevyTate-Organisation": organisationId,
  } });
}
beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  mocks.select.mockReset(); mocks.config.mockReset(); mocks.limit.mockReset();
  mocks.config.mockReturnValue({ url: "https://synthetic.invalid", serviceRoleKey: "synthetic-not-a-credential" });
  mocks.limit.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("retained workspace first-request protection", () => {
  it("rejects a retained form after the same email moves to another tenant before any write budget", async () => {
    mocks.select.mockResolvedValue([{ id: "member", email, organisation_id: currentOrganisation, active: true }]);
    await expect(assertAuthenticatedWrite(request(), email)).rejects.toMatchObject({ status: 409 });
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("protects the first successful-session transport request without needing a 401 or refresh", async () => {
    mocks.select.mockResolvedValue([{ ...member(), organisation_id: currentOrganisation }]);
    const persist = vi.fn();
    const transport = vi.fn(async (path: string, init?: RequestInit) => {
      try {
        const headers = new Headers(init?.headers); headers.set("origin", origin);
        await assertAuthenticatedWrite(new Request(`${origin}${path}`, { ...init, headers }), email);
        persist(); return Response.json({ ok: true });
      } catch (error) { return Response.json({ message: (error as Error).message }, { status: (error as { status: number }).status }); }
    });
    const response = await createAuthenticatedClientFetch(transport)("/api/levytate-workspace", { method: "POST", body: "retained-command" }, { email, organisationId: originalOrganisation });
    expect(response.status).toBe(409); expect(persist).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(1);
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("accepts only the unique active canonical membership and queries by authenticated email", async () => {
    mocks.select.mockResolvedValue([member()]);
    await expect(assertAuthenticatedWrite(request(), email)).resolves.toBeUndefined();
    const query = mocks.select.mock.calls[0][2] as URLSearchParams;
    expect(query.get("email")).toBe(`eq.${email}`); expect(query.get("limit")).toBe("2");
    expect(query.get("organisation_id")).toBeNull(); expect(query.get("active")).toBeNull();
    expect(mocks.limit).toHaveBeenCalledTimes(1);
  });
  it.each([[], [member(), member()], [{ ...member(), active: false }], [{ ...member(), email: "other@example.invalid" }]].map((members) => ({ members })))("rejects unknown, ambiguous or inactive canonical membership", async ({ members }) => {
    mocks.select.mockResolvedValue(members);
    await expect(assertAuthenticatedWrite(request(), email)).rejects.toMatchObject({ status: 409 });
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it.each(["", "tenant-a", "00000000", `${originalOrganisation},${currentOrganisation}`, `eq.${originalOrganisation}`])("rejects malformed organisation header %s before any lookup", async (organisationId) => {
    await expect(assertAuthenticatedWrite(request(organisationId), email)).rejects.toMatchObject({ status: 409 });
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("rejects another email before resolving tenant membership", async () => {
    await expect(assertExpectedWorkspace(request(), "other@example.invalid")).rejects.toMatchObject({ status: 409 });
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("retains existing header-absent caller boundaries without looking up employer membership", async () => {
    await expect(assertAuthenticatedWrite(new Request(`${origin}/api/levytate-provider/opportunities`, { method: "POST", headers: { origin } }), email)).resolves.toBeUndefined();
    expect(mocks.config).not.toHaveBeenCalled(); expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.limit).toHaveBeenCalledTimes(1);
  });
  it("supports authorised read handlers without requiring a write origin or consuming write budget", async () => {
    mocks.select.mockResolvedValue([member()]);
    const read = request(originalOrganisation, "GET"); read.headers.delete("origin");
    await expect(assertExpectedWorkspace(read, email)).resolves.toBeUndefined(); expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("fails closed if required membership configuration is missing", async () => {
    mocks.config.mockReturnValue(null);
    await expect(assertAuthenticatedWrite(request(), email)).rejects.toMatchObject({ status: 503 });
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("does not expose upstream diagnostics when membership cannot be checked", async () => {
    mocks.select.mockRejectedValue(new Error("private synthetic upstream diagnostic"));
    await expect(assertAuthenticatedWrite(request(), email)).rejects.toMatchObject({ status: 503, message: "Account checks are temporarily unavailable. No change has been made." });
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it.each([null, {}, [null], [{ ...member(), organisation_id: null }], [{ ...member(), email: null }], [{ ...member(), active: "true" }]].map((members) => ({ members })))("rejects malformed membership responses without making a change", async ({ members }) => {
    mocks.select.mockResolvedValue(members);
    await expect(assertAuthenticatedWrite(request(), email)).rejects.toMatchObject({ status: 503 });
    expect(mocks.limit).not.toHaveBeenCalled();
  });
});
