import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  isLevyTateAuthCookieHost,
  levytateAuthCookieOptions,
  levytateLegacySessionCookieDomain,
} from "@/lib/levytate/hosts";
import {
  expireLevyTateAuthCookies,
  setLevyTateAuthCookies,
} from "@/lib/server/levytate-auth-cookies";

afterEach(() => {
  vi.unstubAllEnvs();
});

function applySequentialSetCookieHeaders(headers: readonly string[], requestHost: string) {
  const jar = new Map<string, string>();

  for (const header of headers) {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    const domain = attributes
      .find((attribute) => /^domain=/i.test(attribute))
      ?.slice("domain=".length)
      .replace(/^\./, "")
      .toLowerCase() ?? requestHost.toLowerCase();
    const path = attributes.find((attribute) => /^path=/i.test(attribute))?.slice("path=".length) ?? "/";
    const maxAge = Number(attributes.find((attribute) => /^max-age=/i.test(attribute))?.slice("max-age=".length));
    const key = `${name}\u0000${domain}\u0000${path}`;

    if (maxAge <= 0) jar.delete(key);
    else jar.set(key, value);
  }

  return jar;
}

describe("LevyTate host-only authentication cookies", () => {
  it("never adds Domain to a newly issued cookie and preserves SameSite policy", () => {
    vi.stubEnv("NODE_ENV", "production");

    for (const host of [
      "app.levytate.co.uk",
      "www.levytate.co.uk",
      "unintended.app.levytate.co.uk",
      "preview-branch.vercel.app",
      "localhost:3000",
    ]) {
      expect(levytateAuthCookieOptions(60, host)).toEqual({
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60,
      });
      expect(levytateAuthCookieOptions(60, host, "strict")).toMatchObject({ sameSite: "strict" });
    }
  });

  it("allows only the app, local development and the exact configured Preview hosts", () => {
    expect(isLevyTateAuthCookieHost("app.levytate.co.uk")).toBe(true);
    expect(isLevyTateAuthCookieHost("localhost:3000")).toBe(true);
    expect(isLevyTateAuthCookieHost("127.0.0.1:3000")).toBe(true);
    expect(isLevyTateAuthCookieHost("levytate.co.uk")).toBe(false);
    expect(isLevyTateAuthCookieHost("www.levytate.co.uk")).toBe(false);
    expect(isLevyTateAuthCookieHost("unintended.app.levytate.co.uk")).toBe(false);

    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "branch-preview.vercel.app");
    vi.stubEnv("VERCEL_URL", "deployment-preview.vercel.app");
    expect(isLevyTateAuthCookieHost("branch-preview.vercel.app")).toBe(true);
    expect(isLevyTateAuthCookieHost("deployment-preview.vercel.app")).toBe(true);
    expect(isLevyTateAuthCookieHost("other-preview.vercel.app")).toBe(false);
  });

  it("issues host-only app cookies and retains exact legacy-domain expiries", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = NextResponse.json({ ok: true });

    setLevyTateAuthCookies(response, "app.levytate.co.uk", [
      { name: "levytate_beta_session", value: "signed-session", maxAge: 3600 },
      { name: "levytate_demo_controller", value: "signed-controller", maxAge: 1800, sameSite: "strict" },
    ]);

    const headers = response.headers.getSetCookie();
    const current = headers.filter((cookie) => !/Domain=/i.test(cookie));
    const legacy = headers.filter((cookie) => /Domain=/i.test(cookie));
    expect(headers).toHaveLength(4);
    expect(current).toHaveLength(2);
    expect(current.every((cookie) => /HttpOnly/i.test(cookie) && /Secure/i.test(cookie))).toBe(true);
    expect(current.find((cookie) => cookie.startsWith("levytate_beta_session="))).toMatch(/SameSite=lax/i);
    expect(current.find((cookie) => cookie.startsWith("levytate_demo_controller="))).toMatch(/SameSite=strict/i);
    expect(legacy).toHaveLength(2);
    expect(legacy.every((cookie) => /Domain=app\.levytate\.co\.uk/i.test(cookie))).toBe(true);
    expect(legacy.every((cookie) => /Max-Age=0/i.test(cookie) && /Expires=Thu, 01 Jan 1970/i.test(cookie))).toBe(true);

    // RFC cookie identity excludes the host-only flag, so the replacement
    // cookies must be processed after the same-domain legacy expiries.
    expect(headers.slice(0, 2).every((cookie) => /Domain=/i.test(cookie))).toBe(true);
    expect(headers.slice(2).every((cookie) => !/Domain=/i.test(cookie))).toBe(true);
    expect([...applySequentialSetCookieHeaders(headers, "app.levytate.co.uk").values()].sort()).toEqual([
      "signed-controller",
      "signed-session",
    ]);
  });

  it("refuses authenticated cookies on marketing and unintended subdomains", () => {
    for (const host of ["levytate.co.uk", "www.levytate.co.uk", "unintended.app.levytate.co.uk"]) {
      const response = NextResponse.json({ ok: true });
      expect(() => setLevyTateAuthCookies(response, host, [
        { name: "levytate_beta_session", value: "signed-session", maxAge: 3600 },
      ])).toThrow(/cannot be issued/i);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(levytateLegacySessionCookieDomain(host)).toBeUndefined();
    }
  });

  it("issues one host-only cookie on the exact Preview deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "candidate-123.vercel.app");
    const response = NextResponse.json({ ok: true });

    setLevyTateAuthCookies(response, "candidate-123.vercel.app", [
      { name: "levytate_beta_session", value: "preview-session", maxAge: 3600 },
    ]);

    expect(response.headers.getSetCookie()).toHaveLength(1);
    expect(response.headers.getSetCookie()[0]).not.toMatch(/Domain=/i);
    expect(response.headers.getSetCookie()[0]).toMatch(/Secure/i);
  });

  it("never adds a parent Domain while clearing marketing, sibling or Preview hosts", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "candidate-123.vercel.app");

    for (const host of [
      "www.levytate.co.uk",
      "unintended.app.levytate.co.uk",
      "candidate-123.vercel.app",
    ]) {
      const response = NextResponse.json({ ok: true });
      expireLevyTateAuthCookies(response, host, ["levytate_beta_session"]);
      expect(response.headers.getSetCookie()).toHaveLength(1);
      expect(response.headers.getSetCookie()[0]).not.toMatch(/Domain=/i);
      expect(response.headers.getSetCookie()[0]).toMatch(/Max-Age=0/i);
    }
  });

  it("clears both host-only and legacy-domain variants on app logout", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = NextResponse.redirect("https://app.levytate.co.uk/login", 303);

    expireLevyTateAuthCookies(response, "app.levytate.co.uk", [
      "levytate_beta_session",
      "levytate_auth_access",
      "levytate_auth_refresh",
      "levytate_demo_controller",
    ]);

    const headers = response.headers.getSetCookie();
    expect(headers).toHaveLength(8);
    expect(headers.every((cookie) => /Max-Age=0/i.test(cookie) && /Path=\//i.test(cookie))).toBe(true);
    expect(headers.filter((cookie) => /Domain=/i.test(cookie))).toHaveLength(4);
    expect(headers.filter((cookie) => !/Domain=/i.test(cookie))).toHaveLength(4);
  });
});
