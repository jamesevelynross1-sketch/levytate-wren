import { beforeEach, describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", async (original) => ({ ...await original<typeof import("@/lib/server/levytate-supabase")>(), getLevyTateSupabaseConfig: () => ({}), supabaseSelect: transport.select }));
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
const session = { email: "lead@fictional.invalid" } as LevyTateBetaSession;
beforeEach(() => vi.resetAllMocks());
describe("late lifecycle/Insights context authority", () => {
  it("requires active membership and active organisation on every context read", async () => {
    transport.select.mockResolvedValueOnce([{ id: "lead", organisation_id: "fictional-a", email: session.email, role: "Apprenticeship Lead" }]).mockResolvedValueOnce([{ id: "fictional-a", name: "Fictional A" }]);
    expect((await getLearnerLifecycleServerContext(session)).organisation.id).toBe("fictional-a");
    expect(transport.select.mock.calls[0][2].get("active")).toBe("eq.true");
    expect(transport.select.mock.calls[1][2].get("status")).toBe("eq.Active");
  });
  it("denies an inactive membership before reading tenant data", async () => {
    transport.select.mockResolvedValue([]);
    await expect(getLearnerLifecycleServerContext(session)).rejects.toThrow("not linked"); expect(transport.select).toHaveBeenCalledTimes(1);
  });
  it("denies suspended or missing organisations", async () => {
    transport.select.mockResolvedValueOnce([{ id: "lead", organisation_id: "fictional-a", email: session.email, role: "Apprenticeship Lead" }]).mockResolvedValueOnce([]);
    await expect(getLearnerLifecycleServerContext(session)).rejects.toThrow("could not be found");
  });
});
