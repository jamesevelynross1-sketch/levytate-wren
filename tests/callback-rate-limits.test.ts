import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { persistence } = vi.hoisted(() => ({ persistence: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({
  readRuntimeEnv: (key: string) => process.env[key] ?? "",
  getLevyTateSupabaseConfig: () => ({ url: "http://127.0.0.1", serviceRoleKey: "synthetic" }),
  supabaseFetchJson: persistence,
}));
import { checkCallbackAttemptLimit, recordInvalidCallback } from "@/lib/server/levytate-auth-rate-limit";
const counts = new Map<string, number>();
const request = (token: string) => new Request(`http://localhost/levytate/auth/callback?token_hash=${token}`, { headers: { "x-real-ip": "192.0.2.10" } });
beforeEach(() => {
  counts.clear(); persistence.mockReset(); vi.stubEnv("LEVYTATE_AUTH_RATE_LIMIT_SECRET", "synthetic-local-unit-test");
  persistence.mockImplementation(async (_config, path, init) => {
    if (path === "rpc/levytate_check_auth_callback_failures") {
      const body = JSON.parse(init.body);
      const count = counts.get(`magic_link.callback.failure:${body.p_key_hash}`) ?? 0;
      return [{ allowed: count < 10, reset_at: new Date(Date.now() + 900000).toISOString() }];
    }
    const body = JSON.parse(init.body);
    const key = `${body.p_action}:${body.p_key_hash}`;
    const count = (counts.get(key) ?? 0) + 1; counts.set(key, count);
    return [{ allowed: count <= body.p_limit, request_count: count, remaining: Math.max(0, body.p_limit - count), reset_at: new Date(Date.now() + body.p_window_seconds * 1000).toISOString() }];
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("callback budgets (modelled persistence, not hosted Auth evidence)", () => {
  it("eleven distinct legitimate links behind one employer NAT do not consume failed-link budget", async () => {
    for (let n = 0; n < 11; n++) expect((await checkCallbackAttemptLimit(request(`synthetic-${n}`))).allowed).toBe(true);
    expect([...counts.keys()].some((key) => key.startsWith("magic_link.callback.failure:"))).toBe(false);
  });
  it("denies a network after ten actual credential failures", async () => {
    for (let n = 0; n < 10; n++) {
      const value = request(`synthetic-${n}`);
      expect((await checkCallbackAttemptLimit(value)).allowed).toBe(true);
      await recordInvalidCallback(value);
    }
    expect((await checkCallbackAttemptLimit(request("new-token"))).allowed).toBe(false);
  });
  it("retains a pre-authentication transport cap and a separate per-token replay cap", async () => {
    const repeated = request("same-token");
    for (let n = 0; n < 3; n++) expect((await checkCallbackAttemptLimit(repeated)).allowed).toBe(true);
    expect((await checkCallbackAttemptLimit(repeated)).allowed).toBe(false);
    counts.clear();
    for (let n = 0; n < 30; n++) expect((await checkCallbackAttemptLimit(request(`unique-${n}`))).allowed).toBe(true);
    expect((await checkCallbackAttemptLimit(request("excess"))).allowed).toBe(false);
  });
  it("fails closed when the failed-only bucket read is unavailable or malformed", async () => {
    const realModel = persistence.getMockImplementation()!;
    persistence.mockImplementation(async (...args) => args[1] === "rpc/levytate_check_auth_callback_failures" ? [{ allowed: "true", reset_at: "invalid" }] : realModel(...args));
    await expect(checkCallbackAttemptLimit(request("one"))).rejects.toMatchObject({ name: "LevyTateRateLimitStoreError" });
  });
});
