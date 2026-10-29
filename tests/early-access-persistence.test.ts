import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEarlyAccessRequest, listEarlyAccessRequests } from "@/lib/server/levytate-early-access";

const input = { organisation: "Fictional test", contactName: "Test Contact", email: "test@example.invalid", employeeCount: "1-10", consent: true };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-test-not-a-credential");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("early access persistence (mocked transport)", () => {
  it("never fabricates success from an empty write response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    await expect(createEarlyAccessRequest(input)).rejects.toMatchObject({ status: 503 });
  });
  it("requires the returned ID to confirm the requested write", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      const [row] = JSON.parse(String(init.body));
      return Response.json([{ ...row, id: "different-id" }]);
    }));
    await expect(createEarlyAccessRequest(input)).rejects.toMatchObject({ status: 503 });
  });
  it("returns a genuinely confirmed row and distinguishes storage outage from bad input", async () => {
    const fetch = vi.fn(async (_url, init: RequestInit) => Response.json(JSON.parse(String(init.body))));
    vi.stubGlobal("fetch", fetch);
    await expect(createEarlyAccessRequest(input)).resolves.toMatchObject({ organisation: input.organisation, consent: true, status: "New" });
    fetch.mockRejectedValueOnce(new Error("private transport details"));
    await expect(createEarlyAccessRequest(input)).rejects.toMatchObject({ status: 503 });
    await expect(createEarlyAccessRequest({ ...input, consent: false })).rejects.toMatchObject({ status: 400 });
  });
  it("does not invent consent, submission time or status for incomplete historical records", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: "test", organisation: "Synthetic", contact_name: "Test", email: input.email, employee_count: "1-10" }], { headers: { "content-range": "0-0/1" } })));
    await expect(listEarlyAccessRequests()).rejects.toMatchObject({ status: 503 });
  });
});
