import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { createLevyTateBetaSession, levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";

const sessionSecret = "test-only-session-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

function levytateRequest(path: string, cookie?: string) {
  const headers = new Headers({ host: "app.levytate.co.uk" });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`https://app.levytate.co.uk${path}`, { headers });
}

function clearedSessionCookie(response: Response) {
  return response.headers.getSetCookie().join("\n");
}

describe("LevyTate middleware session gate", () => {
  it("lets a request with a valid signed session through to /app", async () => {
    vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", sessionSecret);
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const token = await createLevyTateBetaSession("learner.demo@levytate.test", "beta_user");

    const response = await middleware(levytateRequest("/app", `${levytateBetaSessionCookie}=${token}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toContain("/levytate/app");
    expect(clearedSessionCookie(response)).not.toContain(`${levytateBetaSessionCookie}=;`);
  });

  it("redirects a missing session to /login and clears the cookie", async () => {
    vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", sessionSecret);
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");

    const response = await middleware(levytateRequest("/app"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.levytate.co.uk/login");
    expect(clearedSessionCookie(response).toLowerCase()).toContain(levytateBetaSessionCookie);
    expect(clearedSessionCookie(response).toLowerCase()).toContain("domain=app.levytate.co.uk");
    expect(clearedSessionCookie(response).toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
  });

  it("redirects an invalid session to /login and clears the cookie", async () => {
    vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", sessionSecret);
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");

    const response = await middleware(
      levytateRequest("/app", `${levytateBetaSessionCookie}=not-a-valid-session`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.levytate.co.uk/login");
    expect(clearedSessionCookie(response).toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
  });
});
