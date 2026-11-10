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
  it.each(["application-contract", "learner-contract", "people-contract", "finance-contract", "lift-contract", "workspace-contract", "learning-time-contract", "personal-discovery-contract", "client-release-contract"])("does not report ready when the required release schema %s is absent", async (key) => {
    stubRequiredEnvironment();
    const result = await getPublicReadiness({ bypassCache: true, adapter: async (input) => { if (input.key === key) throw new Error("missing required release schema"); } });
    expect(result.status).toBe("unavailable");
  });
  it.each([null, [], {}, { version: "20261110085437", available: false }, { version: "20261027", available: true }, { version: "20261109182509", available: true }, { version: "20261110085437", available: "true" }, { version: "20261110085437", available: true, detail: "unexpected" }, "x".repeat(1025)])("rejects unavailable or malformed required release contract %#", async (body) => {
    stubRequiredEnvironment(); vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
    await expect(createSupabaseHealthAdapter()({ key: "client-release-contract", kind: "release-contract", label: "Client contracts", timeoutMs: 50 })).rejects.toThrow();
  });
  it("requires the exact current read-only release contract without a synthetic actor or customer write", async () => {
    stubRequiredEnvironment(); const transport = vi.fn(async () => Response.json({ version: "20261110085437", available: true })); vi.stubGlobal("fetch", transport);
    await createSupabaseHealthAdapter()({ key: "client-release-contract", kind: "release-contract", label: "Client contracts", timeoutMs: 50 });
    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/rpc/levytate_required_client_contracts");
    expect(init).toMatchObject({ method: "POST", body: "{}" });
  });
  it.each([
    { name: "old 24 contract even with reachable tables", body: { version: "20261109182509", available: true }, expected: "unavailable" },
    { name: "new contract with missing Manager learning permissions", body: { version: "20261110085437", available: false }, expected: "unavailable" },
    { name: "verified current contract", body: { version: "20261110085437", available: true }, expected: "operational" },
  ])("reports the $name truthfully through public readiness", async ({ body, expected }) => {
    stubRequiredEnvironment();
    const transport = vi.fn(async () => Response.json(body));
    vi.stubGlobal("fetch", transport);
    const realAdapter = createSupabaseHealthAdapter();
    const result = await getPublicReadiness({ bypassCache: true, adapter: async input => {
      // Other dependencies are explicitly healthy in this transport regression.
      if (input.kind === "release-contract") await realAdapter(input);
    } });
    expect(result.status).toBe(expected);
    expect(transport).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toMatch(/202611|learning_time|service_role/);
  });
  it.each([new Response("not a Data API response"), Response.json({ message: "wrong shape" }), new Response("x".repeat(17000))])("rejects a malformed successful schema response", async (response) => {
    stubRequiredEnvironment(); vi.stubGlobal("fetch", vi.fn(async () => response));
    await expect(createSupabaseHealthAdapter()({ key: "test", label: "test", kind: "table", table: "levytate_users", column: "id", timeoutMs: 50 })).rejects.toThrow();
  });
  it.each(["callback-budget-operation", "auth-provider"])("treats %s outage as critical without exposing diagnostics", async (key) => {
    stubRequiredEnvironment();
    const result = await getPublicReadiness({ bypassCache: true, adapter: async (input) => {
      if (input.key === key) throw new Error("private dependency detail");
    } });
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("private dependency detail");
  });
  it("checks the narrowly scoped callback RPC without direct table reads or consuming failures", async () => {
    stubRequiredEnvironment();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ allowed: true, reset_at: checkedAt }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await createSupabaseHealthAdapter()({ key: "callback-budget-operation", kind: "auth-callback-budget", label: "Callback budget", timeoutMs: 50 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith("/rpc/levytate_check_auth_callback_failures")).toBe(true);
    expect(Object.keys(JSON.parse(String(init.body))).sort()).toEqual(["p_environment_namespace", "p_key_hash"]);
  });
  it("probes the actual composite-key Lift framework schema rather than an invented id", async () => {
    stubRequiredEnvironment();
    const observed: unknown[] = [];
    await getPublicReadiness({ bypassCache: true, adapter: async (input) => { observed.push(input); } });
    expect(observed).toContainEqual(expect.objectContaining({ key: "migration-baseline", table: "levytate_lift_framework_versions", column: "framework_key" }));
  });
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
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ allowed: true, request_count: 1, remaining: 9999, reset_at: checkedAt }]), {
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
  it.each([
    { external: { email: false }, disable_signup: true },
    { external: { email: true }, disable_signup: false },
    { external: { email: "true" }, disable_signup: true }, null, {},
  ])("does not mistake a live Auth process for safe individual login settings", async (settings) => {
    stubRequiredEnvironment();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/health") ? Response.json({ version: "synthetic" }) : Response.json(settings)));
    await expect(createSupabaseHealthAdapter()({ key: "auth-provider", kind: "auth-provider", label: "Individual authentication service", timeoutMs: 50 })).rejects.toThrow();
  });
  it("checks live email capability and invitation-only access without sending email", async () => {
    stubRequiredEnvironment();
    const transport = vi.fn(async (url: string) => url.endsWith("/health") ? Response.json({ version: "synthetic" }) : Response.json({ external: { email: true }, disable_signup: true }));
    vi.stubGlobal("fetch", transport);
    await createSupabaseHealthAdapter()({ key: "auth-provider", kind: "auth-provider", label: "Individual authentication service", timeoutMs: 50 });
    expect(transport.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(["/auth/v1/health", "/auth/v1/settings"]);
  });
  it.each([
    [{ allowed: true, request_count: 10001, remaining: 0, reset_at: checkedAt }],
    [{ allowed: true, request_count: 1, remaining: 9999, reset_at: "0" }],
    [{ allowed: true, request_count: 1, remaining: 9999, reset_at: checkedAt }, { allowed: true }],
  ].map((rows) => ({ rows })))("fails readiness on contradictory or ambiguous security operation results", async ({ rows }) => {
    stubRequiredEnvironment(); vi.stubGlobal("fetch", vi.fn(async () => Response.json(rows)));
    await expect(createSupabaseHealthAdapter()({ key: "rate-limit-operation", kind: "auth-rate-limit", label: "Authentication rate-limit operation", timeoutMs: 50 })).rejects.toThrow();
  });
});

function stubRequiredEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://health-test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
  vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", "readiness-test-secret");
}
