import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ refresh: vi.fn(), rate: vi.fn(), cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: fake.cookies }));
vi.mock("@/lib/server/levytate-auth", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/server/levytate-auth")>(), refreshEmployerAuth: fake.refresh }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkSessionRefreshLimit: fake.rate, LevyTateRateLimitStoreError: class extends Error {} }));
import { POST } from "../app/api/levytate-auth/session/route";
import { LevyTateRateLimitStoreError } from "../lib/server/levytate-auth-rate-limit";
import { LevyTateAuthError } from "../lib/server/levytate-auth";
import { AuthenticationDependencyError } from "../lib/server/levytate-auth-provider-request";
import { createLevyTateBetaSession, levytateBetaSessionCookie } from "../lib/levytate/config/beta-access";

const request = (origin = "http://localhost:3000") => new Request("http://localhost:3000/api/levytate-auth/session", { method: "POST", headers: { origin, host: "localhost:3000" } });
beforeEach(async () => {
  vi.clearAllMocks();
  const token = await createLevyTateBetaSession("fictional@example.test", "beta_user", { authMode: "supabase_email", authSubject: "subject" });
  fake.cookies.mockResolvedValue({ get: (name: string) => ({ value: name === levytateBetaSessionCookie ? token : "synthetic-refresh" }) });
  fake.rate.mockResolvedValue({ allowed: true });
  fake.refresh.mockResolvedValue({ sessionToken: "synthetic-session", access_token: "synthetic-access", refresh_token: "synthetic-next-refresh", expires_in: 3600, membership: { email: "fictional@example.test", organisation_id: "tenant" } });
});
describe("refresh request boundary", () => {
  it("returns dependency unavailable without contacting provider when rate-limit store fails", async () => {
    fake.rate.mockRejectedValueOnce(new LevyTateRateLimitStoreError());
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(fake.refresh).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });
  it("denies sibling origin before reading credentials", async () => {
    expect((await POST(request("http://sibling.localhost:3000"))).status).toBe(403);
    expect(fake.cookies).not.toHaveBeenCalled();
  });
  it("denies revoked refresh without writing cookies", async () => {
    fake.refresh.mockRejectedValueOnce(new LevyTateAuthError("unauthorised", "revoked", 401));
    const response = await POST(request());
    expect(response.status).toBe(401); expect(response.headers.getSetCookie()).toEqual([]);
  });
  it("requires the signed application session as well as a provider refresh credential", async () => {
    fake.cookies.mockResolvedValue({ get: (name: string) => name === levytateBetaSessionCookie ? undefined : { value: "synthetic-refresh" } });
    expect((await POST(request())).status).toBe(401); expect(fake.refresh).not.toHaveBeenCalled();
  });
  it.each([new Error("private database detail"), new AuthenticationDependencyError()])("preserves the existing session during a dependency outage", async (error) => {
    fake.refresh.mockRejectedValueOnce(error);
    const response = await POST(request());
    expect(response.status).toBe(503); expect(response.headers.getSetCookie()).toEqual([]);
    expect(await response.text()).not.toContain("private database detail");
  });
  it("reports provider throttling without logging the user out", async () => {
    fake.refresh.mockRejectedValueOnce(new AuthenticationDependencyError(429));
    const response = await POST(request());
    expect(response.status).toBe(429); expect(response.headers.getSetCookie()).toEqual([]);
  });
  it("rotates provider and application cookies with host-only attributes", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toHaveLength(3);
    expect(response.headers.getSetCookie().every((header) => /HttpOnly/.test(header) && /SameSite=lax/i.test(header) && !/Domain=/i.test(header))).toBe(true);
  });
});
