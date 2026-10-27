import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OPTIONS, POST } from "@/app/api/levytate-early-access/route";
import { middleware } from "@/middleware";
import { createLevyTateBetaSession, levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import {
  levyTateAuthCallbackUrl,
  levyTateEmployerSignInUrl,
  levyTatePublicSitemap,
  levytateSessionCookieDomain,
} from "@/lib/levytate/hosts";
import { levytateManifestForHost } from "@/lib/levytate/pwa-manifest";

const sessionSecret = "test-only-session-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

function requestFor(host: string, path: string, cookie?: string) {
  const headers = new Headers({ host });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`https://${host}${path}`, { headers });
}

async function signedCookie() {
  vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", sessionSecret);
  const token = await createLevyTateBetaSession("learner.demo@levytate.test", "beta_user");
  return `${levytateBetaSessionCookie}=${token}`;
}

describe("app.levytate.co.uk platform routing", () => {
  it("sends an anonymous visitor from / to /login", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const response = await middleware(requestFor("app.levytate.co.uk", "/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.levytate.co.uk/login");
  });

  it("sends a signed-in visitor from / to /app", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const response = await middleware(requestFor("app.levytate.co.uk", "/", await signedCookie()));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.levytate.co.uk/app");
  });

  it("keeps /login and redirects a signed-in visitor to /app", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const anonymous = await middleware(requestFor("app.levytate.co.uk", "/login"));
    const signedIn = await middleware(requestFor("app.levytate.co.uk", "/login", await signedCookie()));

    expect(anonymous.status).toBe(200);
    expect(anonymous.headers.get("x-middleware-rewrite")).toContain("/levytate/login");
    expect(signedIn.status).toBe(307);
    expect(signedIn.headers.get("location")).toBe("https://app.levytate.co.uk/app");
  });

  it("redirects public pages to the configurable website and keeps the path", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    vi.stubEnv("LEVYTATE_WEBSITE_URL", "https://marketing.example.test");

    const privacy = await middleware(requestFor("app.levytate.co.uk", "/privacy?from=app"));
    const earlyAccess = await middleware(requestFor("app.levytate.co.uk", "/early-access"));
    const solution = await middleware(requestFor("app.levytate.co.uk", "/solutions/employers"));
    const company = await middleware(requestFor("app.levytate.co.uk", "/company/about"));
    const internalHome = await middleware(requestFor("app.levytate.co.uk", "/levytate"));

    expect(privacy.status).toBe(301);
    expect(privacy.headers.get("location")).toBe("https://marketing.example.test/privacy?from=app");
    expect(earlyAccess.headers.get("location")).toBe("https://marketing.example.test/early-access");
    expect(solution.headers.get("location")).toBe("https://marketing.example.test/solutions/employers");
    expect(company.headers.get("location")).toBe("https://marketing.example.test/company/about");
    expect(internalHome.headers.get("location")).toBe("https://marketing.example.test/levytate");
  });

  it("leaves platform callbacks, provider routes and APIs on the app host", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const callback = await middleware(requestFor("app.levytate.co.uk", "/levytate/auth/callback"));
    const provider = await middleware(requestFor("app.levytate.co.uk", "/levytate/provider/login"));
    const health = await middleware(requestFor("app.levytate.co.uk", "/api/levytate-health/live"));

    expect(callback.status).toBe(200);
    expect(callback.headers.get("location")).toBeNull();
    expect(provider.headers.get("location")).toBeNull();
    expect(health.status).toBe(200);
    expect(health.headers.get("location")).toBeNull();
  });
});

describe("levytate.co.uk transition routing", () => {
  it.each(["levytate.co.uk", "www.levytate.co.uk"])("sends %s sign-in and app paths to the platform host", async (host) => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const login = await middleware(requestFor(host, "/login?auth=invalid-link"));
    const app = await middleware(requestFor(host, "/app/my-team"));

    expect(login.status).toBe(307);
    expect(login.headers.get("location")).toBe("https://app.levytate.co.uk/login?auth=invalid-link");
    expect(app.status).toBe(307);
    expect(app.headers.get("location")).toBe("https://app.levytate.co.uk/app/my-team");
    expect(login.headers.getSetCookie()).toEqual([]);
  });

  it("keeps the current public site rewrites on the marketing hosts", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const home = await middleware(requestFor("www.levytate.co.uk", "/"));
    const privacy = await middleware(requestFor("levytate.co.uk", "/privacy"));
    const earlyAccess = await middleware(requestFor("www.levytate.co.uk", "/early-access"));
    const solution = await middleware(requestFor("www.levytate.co.uk", "/solutions/employers"));

    expect(home.headers.get("x-middleware-rewrite")).toContain("/levytate");
    expect(privacy.headers.get("x-middleware-rewrite")).toContain("/levytate/privacy");
    expect(earlyAccess.headers.get("x-middleware-rewrite")).toContain("/levytate/early-access");
    expect(solution.status).toBe(200);
    expect(solution.headers.get("x-middleware-rewrite")).toBeNull();
    expect(solution.headers.get("location")).toBeNull();
  });

  it("follows LEVYTATE_APP_BASE_URL when the platform host is overridden", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    vi.stubEnv("LEVYTATE_APP_BASE_URL", "https://platform.example.test");

    const fromMarketing = await middleware(requestFor("levytate.co.uk", "/login"));
    const onPlatform = await middleware(requestFor("platform.example.test", "/privacy"));

    expect(fromMarketing.headers.get("location")).toBe("https://platform.example.test/login");
    expect(onPlatform.status).toBe(301);
    expect(onPlatform.headers.get("location")).toBe("https://www.levytate.co.uk/privacy");
  });
});

describe("other hosts", () => {
  it("still hides legacy demos and leaves preview and MPR routes alone", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    const legacy = await middleware(requestFor("app.levytate.co.uk", "/levytate/ground-control"));
    const preview = await middleware(requestFor("preview.example.test", "/levytate/login"));
    const consultancy = await middleware(requestFor("mprconsulting.co.uk", "/"));

    expect(legacy.status).toBe(404);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("location")).toBeNull();
    expect(consultancy.status).toBe(200);
    expect(consultancy.headers.get("location")).toBeNull();
  });
});

describe("configurable platform URLs", () => {
  it("points magic links at the app host and keeps local and preview origins", () => {
    expect(levyTateAuthCallbackUrl("https://www.levytate.co.uk/api/levytate-auth/request", "/levytate/auth/callback"))
      .toBe("https://app.levytate.co.uk/levytate/auth/callback");
    expect(levyTateAuthCallbackUrl("https://levytate.co.uk/api/levytate-provider-auth/request", "/levytate/provider/auth/callback"))
      .toBe("https://app.levytate.co.uk/levytate/provider/auth/callback");
    expect(levyTateAuthCallbackUrl("http://localhost:3000/api/levytate-auth/request", "/levytate/auth/callback"))
      .toBe("http://localhost:3000/levytate/auth/callback");

    vi.stubEnv("LEVYTATE_APP_BASE_URL", "https://app.example.test");
    expect(levyTateAuthCallbackUrl("http://localhost:3000/api/levytate-auth/request", "/levytate/auth/callback"))
      .toBe("https://app.example.test/levytate/auth/callback");
  });

  it("uses the platform login URL in production sign-in emails and the internal route locally", () => {
    expect(levyTateEmployerSignInUrl()).toBe("http://localhost:3000/levytate/login");

    vi.stubEnv("VERCEL_ENV", "production");
    expect(levyTateEmployerSignInUrl()).toBe("https://app.levytate.co.uk/login");
  });

  it("publishes marketing sitemap URLs from the website origin and none from the app host", () => {
    expect(levyTatePublicSitemap("www.levytate.co.uk")).toContain("https://www.levytate.co.uk/privacy");
    expect(levyTatePublicSitemap("app.levytate.co.uk")).toEqual([]);
    expect(levyTatePublicSitemap("mprconsulting.co.uk")).toBeNull();

    vi.stubEnv("LEVYTATE_WEBSITE_URL", "https://marketing.example.test");
    expect(levyTatePublicSitemap("levytate.co.uk")).toContain("https://marketing.example.test/early-access");
  });

  it("scopes the installed app to the platform host and keeps preview installs on /levytate", () => {
    expect(levytateManifestForHost("app.levytate.co.uk")).toMatchObject({
      start_url: "/login",
      scope: "/",
      id: "/",
    });
    expect(levytateManifestForHost("preview.example.test")).toMatchObject({
      start_url: "/levytate/login",
      scope: "/levytate/",
    });
  });

  it("binds session cookies to the platform host and refuses a parent domain", async () => {
    vi.stubEnv("LEVYTATE_MCP_STAGING_ONLY", "");
    expect(levytateSessionCookieDomain("app.levytate.co.uk")).toBe("app.levytate.co.uk");
    expect(levytateSessionCookieDomain("www.levytate.co.uk")).toBeUndefined();

    vi.stubEnv("LEVYTATE_SESSION_COOKIE_DOMAIN", "levytate.co.uk");
    const response = await middleware(requestFor("app.levytate.co.uk", "/app"));
    expect(response.headers.getSetCookie().join("\n").toLowerCase()).not.toContain("domain=");
  });
});

describe("public early-access API", () => {
  it("allows the marketing site to call the early-access API", async () => {
    const allowed = await OPTIONS(new Request("https://app.levytate.co.uk/api/levytate-early-access", {
      method: "OPTIONS",
      headers: { origin: "https://www.levytate.co.uk" },
    }));
    const denied = await OPTIONS(new Request("https://app.levytate.co.uk/api/levytate-early-access", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }));
    const submitted = await POST(new Request("https://app.levytate.co.uk/api/levytate-early-access", {
      method: "POST",
      headers: { origin: "https://www.levytate.co.uk", "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    }));

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://www.levytate.co.uk");
    expect(allowed.headers.get("access-control-allow-methods")).toContain("POST");
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    expect(submitted.status).toBe(400);
    expect(submitted.headers.get("access-control-allow-origin")).toBe("https://www.levytate.co.uk");
  });
});
