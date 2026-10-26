import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/levytate-beta-login/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("beta sign-in", () => {
  it("fails closed when LEVYTATE_BETA_CODE is unset", async () => {
    vi.stubEnv("LEVYTATE_BETA_LOGIN_ENABLED", "true");
    vi.stubEnv("LEVYTATE_BETA_CODE", "");

    const response = await POST(new Request("https://levytate.co.uk/api/levytate-beta-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "learner.demo@levytate.test", code: "any-code" }),
    }));
    const body = await response.json() as { ok?: boolean; message?: string };

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.message).toBe("Internal demonstration sign-in is not available.");
  });
});
