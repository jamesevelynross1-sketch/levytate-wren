import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({
  readRuntimeEnv: (key: string) => process.env[key] ?? "",
  getLevyTateSupabaseConfig: () => ({ url: "http://127.0.0.1:1", serviceRoleKey: "synthetic-unit-only" }), supabaseFetchJson: rpc,
}));
import { checkLevyTateCopilotLimits, checkMagicLinkRequestLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
const request = () => new Request("http://localhost:3107/api/levytate-ai", { headers: { "x-real-ip": "192.0.2.10", cookie: "session=synthetic" } });
const valid = { allowed: true, request_count: 1, remaining: 11, reset_at: "2026-11-09 18:30:00.123456+00" };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("LEVYTATE_AUTH_RATE_LIMIT_SECRET", "synthetic-unit-secret-not-a-credential"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("persistent Auth and Copilot rate-limit response decoder (injected RPC, no hosted mutation)", () => {
  it("accepts the managed PostgreSQL timestamp format and keeps existing Copilot budgets", async () => {
    rpc.mockImplementation((_config, _path, init) => Promise.resolve([{ ...valid, remaining: JSON.parse(init.body).p_limit - 1 }]));
    expect((await checkLevyTateCopilotLimits(request(), "Synthetic@Example.invalid")).allowed).toBe(true);
    const bodies = rpc.mock.calls.map((call) => JSON.parse(call[2].body));
    expect(bodies.map((body) => [body.p_action, body.p_limit, body.p_window_seconds])).toEqual([
      ["copilot.identity.minute", 12, 60], ["copilot.identity.hour", 120, 3600], ["copilot.network.hour", 1200, 3600],
    ]);
    for (const body of bodies) { expect(body.p_key_hash).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(body)).not.toMatch(/Synthetic@|192\.0\.2\.10|session=/); }
    const firstKey = bodies[0].p_key_hash;
    rpc.mockClear(); await checkLevyTateCopilotLimits(new Request("http://localhost:3107/api/levytate-ai", { headers: { cookie: "session=changed" } }), "synthetic@example.invalid");
    expect(JSON.parse(rpc.mock.calls[0][2].body).p_key_hash).toBe(firstKey);
  });
  it("honours an explicit denial and does not consume further buckets", async () => {
    rpc.mockResolvedValue([{ ...valid, allowed: false, request_count: 13, remaining: 0 }]);
    expect((await checkLevyTateCopilotLimits(request(), "synthetic@example.invalid")).allowed).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("accepts the final permitted request with zero remaining in each bucket", async () => {
    rpc.mockImplementation((_config, _path, init) => Promise.resolve([{ allowed: true, request_count: JSON.parse(init.body).p_limit, remaining: 0, reset_at: "2028-02-29T18:30:00.000Z" }]));
    expect((await checkLevyTateCopilotLimits(request(), "synthetic@example.invalid")).allowed).toBe(true);
    expect((await checkMagicLinkRequestLimits(request(), "synthetic@example.invalid")).allowed).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(7);
  });
  const malformed = [
    { name: "missing response", value: null }, { name: "not an array", value: valid }, { name: "empty result", value: [] },
    { name: "ambiguous cardinality", value: [valid, valid] }, { name: "null row", value: [null] },
    { name: "coerced allow", value: [{ ...valid, allowed: "true" }] }, { name: "missing allow", value: [{ request_count: 1, remaining: 1, reset_at: valid.reset_at }] },
    { name: "fractional count", value: [{ ...valid, request_count: 1.5 }] }, { name: "negative count", value: [{ ...valid, request_count: -1 }] },
    { name: "overflowing count", value: [{ ...valid, request_count: Number.MAX_SAFE_INTEGER + 1 }] },
    { name: "unconsumed count", value: [{ ...valid, request_count: 0, remaining: 12 }] },
    { name: "allow above budget", value: [{ ...valid, request_count: 13, remaining: 0 }] },
    { name: "count above saturated budget", value: [{ ...valid, allowed: false, request_count: 14, remaining: 0 }] },
    { name: "denial below budget", value: [{ ...valid, allowed: false }] },
    { name: "inflated remaining", value: [{ ...valid, remaining: 12 }] },
    { name: "inconsistent remaining", value: [{ ...valid, remaining: 0 }] },
    { name: "coerced remaining", value: [{ ...valid, remaining: "11" }] }, { name: "negative remaining", value: [{ ...valid, remaining: -1 }] },
    { name: "invalid reset", value: [{ ...valid, reset_at: "not a date" }] }, { name: "numeric reset", value: [{ ...valid, reset_at: 0 }] },
    { name: "numeric-looking reset", value: [{ ...valid, reset_at: "0" }] },
    { name: "calendar rollover reset", value: [{ ...valid, reset_at: "2026-02-30T18:30:00Z" }] },
    { name: "timezone-free reset", value: [{ ...valid, reset_at: "2026-11-09T18:30:00" }] },
  ];
  it.each(malformed)("fails closed for Auth and Copilot on $name", async ({ value }) => {
    rpc.mockResolvedValue(value); const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(checkLevyTateCopilotLimits(request(), "synthetic@example.invalid")).rejects.toBeInstanceOf(LevyTateRateLimitStoreError);
    expect(rpc).toHaveBeenCalledTimes(2);
    rpc.mockClear();
    await expect(checkMagicLinkRequestLimits(request(), "synthetic@example.invalid")).rejects.toBeInstanceOf(LevyTateRateLimitStoreError);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic@example.invalid");
  });
});
