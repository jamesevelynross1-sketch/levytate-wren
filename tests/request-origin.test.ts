import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationRequestOrigin, applicationRequestUrl } from "@/lib/server/levytate-request-origin";
import { assertBrowserOrigin } from "@/lib/server/levytate-request-boundary";
afterEach(() => vi.unstubAllEnvs());
describe("trusted application request authority", () => {
  it("handles Next internal localhost while preserving the actual127 browser authority", () => {
    const request = new Request("http://localhost:3107/api/write", { headers: { host: "127.0.0.1:3107", origin: "http://127.0.0.1:3107" } });
    expect(applicationRequestOrigin(request)).toBe("http://127.0.0.1:3107");
    expect(() => assertBrowserOrigin(request)).not.toThrow();
    expect(() => assertBrowserOrigin(new Request(request, { headers: { host: "127.0.0.1:3107", origin: "http://localhost:3107" } }))).toThrow();
  });
  it("accepts only exact configured Preview hosts and ignores Forwarded-Host", () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "exact-candidate.vercel.app");
    const headers = { host: "exact-candidate.vercel.app", "x-forwarded-host": "attacker.invalid" };
    expect(applicationRequestOrigin(new Request("http://internal:3000/", { headers }))).toBe("https://exact-candidate.vercel.app");
    for (const host of ["sibling.vercel.app", "www.levytate.co.uk", "exact-candidate.vercel.app.attacker.invalid", "user@exact-candidate.vercel.app", "exact-candidate.vercel.app,evil.invalid"]) {
      expect(() => applicationRequestOrigin(new Request("http://internal:3000/", { headers: { host } }))).toThrow();
    }
  });
  it("keeps callback path/query while moving to trusted authority", () => {
    expect(applicationRequestUrl(new Request("http://localhost:3107/levytate/auth/callback?type=email", { headers: { host: "127.0.0.1:3107" } })).href).toBe("http://127.0.0.1:3107/levytate/auth/callback?type=email");
  });
});
