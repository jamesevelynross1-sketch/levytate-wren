import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({ url: "http://localhost:54321", serviceRoleKey: "synthetic-unit-only" }), supabaseSelect: fake.select, supabaseInsert: vi.fn(), readRuntimeEnv: vi.fn() }));
vi.mock("@/lib/server/levytate-auth-rate-limit-config", () => ({ getLevyTateRateLimitEnvironment: () => "local-test", getLevyTateRateLimitSecret: () => "synthetic-unit-key" }));
import { getAuthenticationSendOutcome } from "../lib/server/levytate-auth-email-delivery";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.resetAllMocks(); });
describe("recoverable invitation send evidence", () => {
  it("uses exact server-written recipient/environment/request evidence, never webhook inference", async () => {
    fake.select.mockResolvedValue([{ provider_event_id: `accepted:${id}`, canonical_status: "accepted" }]);
    expect(await getAuthenticationSendOutcome("fictional@example.test", id)).toBe(true);
    const query = fake.select.mock.calls[0][2] as URLSearchParams;
    expect(Object.fromEntries(query)).toMatchObject({ provider: "eq.supabase", correlation_confidence: "eq.exact", environment_namespace: "eq.local-test", processing_status: "eq.processed", authentication_request_reference: `eq.${id}` });
    expect(query.get("recipient_hash")).toMatch(/^eq\.[a-f0-9]{64}$/);
    expect(query.toString()).not.toContain("fictional");
  });
  it.each([
    [[], null],
    [[{ provider_event_id: `failed:${id}`, canonical_status: "failed" }], false],
    [[{ provider_event_id: "webhook-event", canonical_status: "delivered" }], null],
    [[{ provider_event_id: "accepted:another-request", canonical_status: "accepted" }], null],
    [[{ provider_event_id: `accepted:${id}`, canonical_status: "failed" }], null],
    [[{ provider_event_id: `failed:${id}`, canonical_status: "failed" }, { provider_event_id: `accepted:${id}`, canonical_status: "accepted" }], true],
  ])("distinguishes known accepted/refused from unknown evidence", async (rows, outcome) => {
    fake.select.mockResolvedValue(rows);
    expect(await getAuthenticationSendOutcome("fictional@example.test", id)).toBe(outcome);
  });
  it("does not invent an outcome during a store outage", async () => {
    fake.select.mockRejectedValue(new Error("synthetic unavailable"));
    await expect(getAuthenticationSendOutcome("fictional@example.test", id)).rejects.toThrow();
  });
});
