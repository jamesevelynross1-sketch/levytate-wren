import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as debugHistory } from "@/app/api/stocks/debug-history/route";
import { GET as debugLive } from "@/app/api/stocks/debug-live/route";
import { GET as liveCheck } from "@/app/api/stocks/live-check/route";
import { POST as generateStrategy } from "@/app/api/strategy-builder/generate/route";
import { POST as refineStrategy } from "@/app/api/strategy-builder/refine/route";
import { createLevyTateBetaSession, levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("protected routes reject unauthenticated requests", () => {
  it("disables stock debug routes in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FINNHUB_API_KEY", "");
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");

    const routes = [
      debugLive(new Request("https://example.test/api/stocks/debug-live?symbol=NVDA")),
      debugHistory(new Request("https://example.test/api/stocks/debug-history?symbol=NVDA")),
      liveCheck(new Request("https://example.test/api/stocks/live-check")),
    ];
    const responses = await Promise.all(routes);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
  });

  it("rejects strategy generation and refinement without a signed session", async () => {
    const generateResponse = await generateStrategy(jsonRequest("/api/strategy-builder/generate", {}));
    const refineResponse = await refineStrategy(jsonRequest("/api/strategy-builder/refine", {
      currentStrategy: "Current position",
      instruction: "Make it shorter",
    }));

    expect(generateResponse.status).toBe(401);
    expect(refineResponse.status).toBe(401);
  });

  it("rejects strategy routes when the session cookie is invalid", async () => {
    const request = jsonRequest("/api/strategy-builder/generate", {}, `${levytateBetaSessionCookie}=not-a-valid-session`);
    const response = await generateStrategy(request);
    expect(response.status).toBe(401);
  });

  it("accepts a valid signed session as far as the strategy input check", async () => {
    vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", "test-only-session-secret");
    const token = await createLevyTateBetaSession("learner.demo@levytate.test", "beta_user");
    const response = await generateStrategy(jsonRequest(
      "/api/strategy-builder/generate",
      {},
      `${levytateBetaSessionCookie}=${token}`,
    ));

    expect(response.status).toBe(400);
  });
});

function jsonRequest(path: string, body: unknown, cookie?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`https://levytate.co.uk${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
