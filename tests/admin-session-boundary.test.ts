import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLevyTateBetaSession, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
const secret = "synthetic-unit-session-signing-key-not-a-runtime-credential";
beforeEach(() => vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());
function signed(overrides: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify({ email: "independent-admin@example.test", accessLevel: "beta_admin", issuedAt: Date.now(), expiresAt: Date.now() + 60_000, ...overrides })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
describe("internal and genuine administrator session boundaries", () => {
  it("round-trips a signed genuine identity independently of the internal email list", async () => {
    const token = await createLevyTateBetaSession("independent-admin@example.test", "beta_admin", { authMode: "supabase_email", authSubject: "synthetic-verified-subject" });
    expect(await readLevyTateBetaSession(token)).toMatchObject({ accessLevel: "beta_admin", authMode: "supabase_email", authSubject: "synthetic-verified-subject" });
  });
  it("still refuses an internal administrator outside its allowlist", async () => {
    await expect(createLevyTateBetaSession("independent-admin@example.test", "beta_admin", { authMode: "internal_beta" })).rejects.toThrow("not approved");
    await expect(createLevyTateBetaSession("independent-admin@example.test", "beta_admin")).rejects.toThrow("not approved");
  });
  it("preserves the approved internal administrator path", async () => {
    expect(await readLevyTateBetaSession(await createLevyTateBetaSession("hello@levytate.co.uk", "beta_admin"))).toMatchObject({ accessLevel: "beta_admin", authMode: "internal_beta" });
  });
  it.each([undefined, "", "   "])("refuses a missing or empty genuine subject (%s)", async (authSubject) => {
    await expect(createLevyTateBetaSession("independent-admin@example.test", "beta_admin", { authMode: "supabase_email", authSubject })).rejects.toThrow("subject");
    expect(await readLevyTateBetaSession(signed({ authMode: "supabase_email", authSubject }))).toBeNull();
  });
  it.each([undefined, "internal_beta", "unknown"])("does not use legacy/internal/unknown mode to bypass administrator restrictions (%s)", async (authMode) => {
    expect(await readLevyTateBetaSession(signed({ authMode, authSubject: "synthetic-subject" }))).toBeNull();
  });
  it("rejects an unsigned edit promoting a genuine user to administrator", async () => {
    const token = await createLevyTateBetaSession("employee@example.test", "beta_user", { authMode: "supabase_email", authSubject: "synthetic-subject" });
    const [payload, signature] = token.split(".");
    const edited = JSON.parse(Buffer.from(payload, "base64url").toString()); edited.accessLevel = "beta_admin";
    expect(await readLevyTateBetaSession(`${Buffer.from(JSON.stringify(edited)).toString("base64url")}.${signature}`)).toBeNull();
  });
});
