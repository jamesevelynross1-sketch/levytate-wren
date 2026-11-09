import { beforeEach, describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ select: vi.fn(), apply: vi.fn(), revision: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", async (original) => ({
  ...await original<typeof import("@/lib/server/levytate-supabase")>(),
  getLevyTateSupabaseConfig: () => ({}), supabaseSelect: transport.select, supabaseSelectAll: transport.select,
}));
vi.mock("@/lib/server/levytate-learner-transaction", async (original) => ({
  ...await original<typeof import("@/lib/server/levytate-learner-transaction")>(),
  applyLearnerTransaction: transport.apply, learnerRevision: transport.revision,
}));
import { confirmEmployeeEligibility } from "@/lib/server/levytate-learner-lifecycle";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
const session = { email: "manager@example.test" } as LevyTateBetaSession;
// Model an untrusted JSON request to exercise the runtime confirmation guard.
const input = { confirmed: false, expectedUpdatedAt: "synthetic-version", expectedEnglandWorkingHoursPercentage: 100, idempotencyKey: "personal-declaration-command" } as unknown as Parameters<typeof confirmEmployeeEligibility>[2];
function fixture(role = "Line Manager", target = "manager", targetEmail = `${target}@example.test`) {
  transport.select.mockImplementation(async (_config, table: string, query: URLSearchParams) => {
    if (table === "levytate_users") return [{ id: "manager-user", organisation_id: "synthetic-org", email: session.email, role }];
    if (table === "levytate_organisations") return [{ id: "synthetic-org", name: "Synthetic employer" }];
    if (table === "levytate_learner_records") return [{ id: "synthetic-learner", organisation_id: "synthetic-org", employee_id: target, lifecycle_status: "pre_enrolment", record_status: "Active" }];
    if (table === "levytate_employees") {
      if (query.has("id")) return [{ id: target, email: targetEmail, status: "Active", manager_id: "manager" }];
      return [{ id: "manager", email: session.email, status: "Active", manager_id: "senior" }, { id: "report", email: "report@example.test", status: "Active", manager_id: "manager" }];
    }
    throw new Error(`Unexpected test read: ${table}`);
  });
}
beforeEach(() => { vi.resetAllMocks(); transport.apply.mockResolvedValue(null); transport.revision.mockResolvedValue(0); fixture(); });
describe("personal learner declaration service authority (transport isolated)", () => {
  it("allows the manager's own identity to reach explicit-confirmation validation", async () => {
    await expect(confirmEmployeeEligibility(session, "synthetic-learner", input)).rejects.toThrow("Confirm your declaration during pre-enrolment");
    expect(transport.apply).toHaveBeenCalledTimes(1); // receipt probe only; no invalid plan was saved
    expect(transport.apply.mock.calls[0][0]).toMatchObject({ actorId: "manager-user", organisationId: "synthetic-org", action: "employee_declaration" });
  });
  it("denies a direct report declaration despite the manager's valid read scope", async () => {
    fixture("Line Manager", "report");
    await expect(confirmEmployeeEligibility(session, "synthetic-learner", input)).rejects.toThrow("Only the employee may make their own declaration");
    expect(transport.apply).toHaveBeenCalledTimes(1);
  });
  it("rechecks the target People email rather than trusting its prior read result", async () => {
    fixture("Line Manager", "manager", "changed@example.test");
    await expect(confirmEmployeeEligibility(session, "synthetic-learner", input)).rejects.toThrow("Only the employee may make their own declaration");
    const targetRead = transport.select.mock.calls.find(([, table, query]) => table === "levytate_employees" && query.has("id"));
    expect(targetRead?.[2].get("organisation_id")).toBe("eq.synthetic-org");
    expect(targetRead?.[2].get("status")).toBe("eq.Active");
  });
  it("does not extend personal declaration authority to the Apprenticeship Lead", async () => {
    fixture("Apprenticeship Lead");
    await expect(confirmEmployeeEligibility(session, "synthetic-learner", input)).rejects.toThrow("Only the employee may make their own declaration");
    expect(transport.select.mock.calls.some(([, table]) => table === "levytate_learner_records")).toBe(false);
  });
});
