import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), detail: vi.fn(), list: vi.fn(), create: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({
  createLearnerRecord: mocks.create, getOrganisationLearnerLifecycleRecordDetail: mocks.detail, listOrganisationLearnerLifecycleSummaries: mocks.list,
  LevyTateLearnerLifecyclePermissionError: class extends Error {}, LevyTateLearnerLifecycleError: class extends Error {},
  LevyTateLearnerLifecycleConflictError: class extends Error {}, LevyTateLearnerLifecycleValidationError: class extends Error {},
}));
import { GET, POST } from "@/app/api/levytate-learners/route";
import { LevyTateLearnerLifecycleError, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ email: "lead@fictional.invalid" }); mocks.list.mockResolvedValue([]); mocks.detail.mockResolvedValue({ id: "fictional" }); });
afterEach(() => vi.restoreAllMocks());
describe("Learner API unavailable-state boundary (unit)", () => {
  it.each(["list", "detail"] as const)("does not expose dependency errors on %s", async (source) => {
    mocks[source].mockRejectedValue(new Error("private provider URL, record or credential"));
    const response = await GET(new Request(`https://candidate.vercel.app/api/levytate-learners${source === "detail" ? "?learnerRecordId=fictional" : ""}`));
    expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toContain("no-store"); expect(await response.text()).not.toContain("private provider");
  });
  it.each([GET, POST])("handles authentication outages inside the HTTP error boundary", async (handler) => {
    mocks.session.mockRejectedValue(new Error("private authentication detail"));
    const response = await handler(new Request("https://candidate.vercel.app/api/levytate-learners"));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private authentication"); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("retains not-found and forbidden distinctions without raw diagnostics", async () => {
    for (const [error, status] of [[new LevyTateLearnerLifecycleError("internal diagnostic"), 404], [new LevyTateLearnerLifecyclePermissionError("internal diagnostic"), 403]] as const) {
      mocks.list.mockRejectedValueOnce(error); const response = await GET(new Request("https://candidate.vercel.app/api/levytate-learners"));
      expect(response.status).toBe(status); expect(await response.text()).not.toContain("internal diagnostic");
    }
  });
  it("does not cache successful detail or unauthenticated responses", async () => {
    const detail = await GET(new Request("https://candidate.vercel.app/api/levytate-learners?learnerRecordId=fictional"));
    expect(detail.status).toBe(200); expect(detail.headers.get("cache-control")).toContain("no-store");
    mocks.session.mockResolvedValue(null); const denied = await GET(new Request("https://candidate.vercel.app/api/levytate-learners"));
    expect(denied.status).toBe(401); expect(denied.headers.get("cache-control")).toContain("no-store");
  });
});
