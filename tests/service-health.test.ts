import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { classifyReadiness, createReadinessCache, evaluateReadinessChecks } from "@/lib/levytate/service-health-contract";
import { createSupabaseHealthAdapter, getPublicReadiness } from "@/lib/server/levytate-service-health";

const checkedAt = "2026-10-27T12:00:00.000Z";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("LevyTate public readiness", () => {
  it("reports healthy critical and optional checks as operational", async () => {
    const critical = vi.fn(async () => undefined);
    const optional = vi.fn(async () => undefined);

    const result = await evaluateReadinessChecks({
      checkedAt,
      criticalChecks: [critical],
      optionalChecks: [optional],
      timeoutMs: 50,
    });

    expect(result).toEqual({ status: "operational", checkedAt });
    expect(critical).toHaveBeenCalledOnce();
    expect(optional).toHaveBeenCalledOnce();
  });

  it("fails readiness without running optional checks or exposing dependency errors", async () => {
    const optional = vi.fn(async () => undefined);
    const result = await evaluateReadinessChecks({
      checkedAt,
      criticalChecks: [async () => { throw new Error("provider table and credential detail"); }],
      optionalChecks: [optional],
      timeoutMs: 50,
    });

    expect(result).toEqual({
      status: "unavailable",
      checkedAt,
      message: "A critical service dependency is unavailable.",
    });
    expect(optional).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/provider|table|credential/i);
  });

  it("distinguishes an optional-check failure as degraded", async () => {
    const result = await evaluateReadinessChecks({
      checkedAt,
      criticalChecks: [async () => undefined],
      optionalChecks: [async () => { throw new Error("optional detail"); }],
      timeoutMs: 50,
    });

    expect(result.status).toBe("degraded");
    expect(result.message).toBe("The service is available with a limited supporting check.");
  });

  it("bounds a stalled critical check and returns unavailable", async () => {
    vi.useFakeTimers();
    const resultPromise = evaluateReadinessChecks({
      checkedAt,
      criticalChecks: [() => new Promise<void>(() => undefined)],
      optionalChecks: [],
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(25);

    await expect(resultPromise).resolves.toMatchObject({ status: "unavailable", checkedAt });
  });

  it("shares one deadline across critical and optional groups", async () => {
    vi.useFakeTimers();
    const resultPromise = evaluateReadinessChecks({
      checkedAt,
      criticalChecks: [() => new Promise<void>((resolve) => setTimeout(resolve, 15))],
      optionalChecks: [() => new Promise<void>(() => undefined)],
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(24);
    let settled = false;
    void resultPromise.finally(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toMatchObject({ status: "degraded", checkedAt });
  });

  it("caches a failure, then rechecks and records recovery after expiry", async () => {
    let now = 1_000;
    let evaluations = 0;
    const transitions: Array<[string | null, string]> = [];
    const cache = createReadinessCache({
      cacheMs: 10_000,
      now: () => now,
      evaluate: async () => {
        evaluations += 1;
        return classifyReadiness({ checkedAt: new Date(now).toISOString(), criticalAvailable: evaluations > 1, optionalAvailable: true });
      },
      onResult: (result, previous) => transitions.push([previous, result.status]),
    });

    expect((await cache.get()).status).toBe("unavailable");
    expect((await cache.get()).status).toBe("unavailable");
    expect(evaluations).toBe(1);

    now += 10_001;

    expect((await cache.get()).status).toBe("operational");
    expect(evaluations).toBe(2);
    expect(transitions).toContainEqual(["unavailable", "operational"]);
  });
});

describe("authentication rate-limit readiness probe", () => {
  it("is a critical check in the public readiness path", async () => {
    stubRequiredEnvironment();
    const observed: string[] = [];

    const result = await getPublicReadiness({
      bypassCache: true,
      now: new Date(checkedAt),
      timeoutMs: 50,
      adapter: async (input) => {
        observed.push(input.key);
        if (input.key === "rate-limit-operation") throw new Error("unavailable");
      },
    });

    expect(result.status).toBe("unavailable");
    expect(observed).toContain("rate-limit-operation");
    expect(observed).not.toContain("delivery");
  });

  it("fails readiness when the active 039 schema marker is unavailable", async () => {
    stubRequiredEnvironment();
    const result = await getPublicReadiness({
      bypassCache: true,
      now: new Date(checkedAt),
      timeoutMs: 50,
      adapter: async (input) => {
        if (input.key === "migration-baseline") throw new Error("missing");
      },
    });

    expect(result).toMatchObject({ status: "unavailable", checkedAt });
  });

  it("uses a bounded health-only bucket rather than a normal user bucket", async () => {
    stubRequiredEnvironment();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ allowed: true, request_count: 1 }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await createSupabaseHealthAdapter()({
      key: "rate-limit-operation",
      label: "Authentication rate-limit operation",
      kind: "auth-rate-limit",
      timeoutMs: 50,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(url).toBe("https://health-test.supabase.co/rest/v1/rpc/levytate_consume_auth_rate_limit");
    expect(init.method).toBe("POST");
    expect(body).toMatchObject({
      p_action: "health.readiness",
      p_window_seconds: 60,
      p_limit: 10_000,
      p_route: "/api/levytate-health/ready",
    });
    expect(body.p_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toMatch(/email|network|callback|session_refresh/i);
  });
});

function stubRequiredEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://health-test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
  vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", "readiness-test-secret");
}
