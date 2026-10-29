import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as limits from "@/lib/server/levytate-auth-rate-limit";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({
  readRuntimeEnv: (key: string) => process.env[key] ?? "",
  getLevyTateSupabaseConfig: () => ({ url: "http://127.0.0.1:1", serviceRoleKey: "synthetic-test-only" }),
  supabaseFetchJson: rpc,
}));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("rate-limit client / reviewed SQL input contract", () => {
  it("all consumers send taxonomy accepted by the actual migration (no wildcard route)", async () => {
    vi.stubEnv("LEVYTATE_AUTH_RATE_LIMIT_SECRET", "synthetic-unit-secret-not-a-credential");
    const sql = readFileSync("supabase/migrations/021_create_distributed_auth_rate_limits.sql", "utf8");
    const patterns = Object.fromEntries(["action", "route", "event_type"].map((field) => {
      const match = sql.match(new RegExp(`p_${field} !~ '([^']+)'`));
      expect(match).not.toBeNull();
      return [field, new RegExp(match![1])];
    }));
    rpc.mockImplementation(async (_config, path, init) => {
      if (path === "rpc/levytate_check_auth_callback_failures") {
        const body = JSON.parse(init.body);
        expect(Object.keys(body).sort()).toEqual(["p_environment_namespace", "p_key_hash"]);
        expect(body.p_key_hash).toMatch(/^[a-f0-9]{64}$/);
        return [{ allowed: true, reset_at: "2026-10-29T16:00:00Z" }];
      }
      expect(path).toBe("rpc/levytate_consume_auth_rate_limit");
      const body = JSON.parse(init.body);
      for (const field of Object.keys(patterns)) expect(body[`p_${field}`]).toMatch(patterns[field]);
      expect(body.p_key_hash).toMatch(/^[a-f0-9]{64}$/);
      return [{ allowed: true, request_count: 1, remaining: 1, reset_at: "2026-10-29T16:00:00Z" }];
    });
    const request = new Request("http://localhost:3107/api/levytate-workspace");
    await limits.checkMagicLinkRequestLimits(request, "synthetic@example.invalid");
    await limits.checkCallbackAttemptLimit(request);
    await limits.recordInvalidCallback(request);
    await limits.checkBetaLoginLimits(request, "synthetic@example.invalid");
    await limits.checkSessionRefreshLimit(request);
    await limits.checkAuthenticatedWriteLimit(request, "synthetic@example.invalid");
    await limits.checkLevyTateCopilotLimits(request, "synthetic@example.invalid");
    await limits.checkMicrosoftCopilotPreAuthenticationLimit(request);
    await limits.checkMicrosoftCopilotRequestLimits(request, "synthetic-tenant", "synthetic-object");
    await limits.checkStrategyBuilderLimits(request, "synthetic@example.invalid", "/api/strategy-builder/generate");
    await limits.checkPublicSubmissionLimits(request, "synthetic@example.invalid", "/api/opportunity-review/submit");
    await limits.checkEarlyAccessSubmissionLimits(request, "synthetic@example.invalid");
    await limits.checkDeliveryWebhookLimit(request);
    expect(rpc).toHaveBeenCalledTimes(29);
  });
});
