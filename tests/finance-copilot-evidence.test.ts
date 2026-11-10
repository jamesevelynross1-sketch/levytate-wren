import { afterEach, describe, expect, it, vi } from "vitest";
import { financeCopilotUnavailable, loadFinanceCopilotEvidence } from "@/lib/levytate/finance/copilot-evidence";
import { answerLevyFinanceQuestion } from "@/lib/levytate/finance/copilot";

const original = { email: "lead@fictional.example", organisationId: "10000000-0000-4000-8000-000000000001" };
const tenantB = "20000000-0000-4000-8000-000000000002";
const payload = () => ({ ok: true, state: {
  version: 1, mode: "persistent", imports: [], transactions: [{
    transactionId: "synthetic-transaction", fingerprint: "synthetic-fingerprint", transactionDate: "2026-10-31",
    description: "Synthetic levy receipt", category: "levy_in", amountPence: 123400, sourceRow: 1,
  }],
} });
afterEach(() => vi.unstubAllGlobals());

describe("Finance Copilot account-bound evidence (unit transport, not hosted acceptance)", () => {
  it("sends the mounted account and employer on its first read and retains the Finance answer", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json(payload())); vi.stubGlobal("fetch", transport);
    const state = await loadFinanceCopilotEvidence(original);
    const [path, options] = transport.mock.calls[0];
    expect(path).toBe("/api/levytate-finance");
    expect(new Headers(options.headers).get("X-LevyTate-Account")).toBe(original.email);
    expect(new Headers(options.headers).get("X-LevyTate-Organisation")).toBe(original.organisationId);
    expect(options).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store" });
    expect(answerLevyFinanceQuestion("What was received?", state).message).toBe("Levy received in October 2026 was £1,234.");
  });
  it.each([{ ...original, email: "different@fictional.example" }, { ...original, organisationId: tenantB }])("never consumes a different signed-in account or employer on the first read", async current => {
    // Emulates the route's current canonical-membership check. An unpinned raw
    // fetch would receive B's data; the original headers force a conflict instead.
    const readOtherTenant = vi.fn();
    const transport = vi.fn(async (_path: string, options?: RequestInit) => {
      const headers = new Headers(options?.headers);
      if (headers.get("X-LevyTate-Account") !== current.email || headers.get("X-LevyTate-Organisation") !== current.organisationId) return new Response(null, { status: 409 });
      readOtherTenant(); return Response.json(payload());
    }); vi.stubGlobal("fetch", transport);
    await expect(loadFinanceCopilotEvidence(original)).rejects.toThrow("account or employer changed");
    expect(readOtherTenant).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledOnce();
  });
  it.each([{ ...original, email: "different@fictional.example" }, { ...original, organisationId: tenantB }])("does not fetch Finance after refresh changes the identity", async current => {
    const transport = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ identity: current }));
    vi.stubGlobal("fetch", transport);
    await expect(loadFinanceCopilotEvidence(original)).rejects.toThrow("account or employer changed");
    expect(transport).toHaveBeenCalledTimes(2); expect(transport.mock.calls[1][0]).toBe("/api/levytate-auth/session");
  });
  it("replays exactly the original pins after a same-account refresh", async () => {
    const transport = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ identity: original })).mockResolvedValueOnce(Response.json(payload()));
    vi.stubGlobal("fetch", transport); await loadFinanceCopilotEvidence(original);
    expect(transport.mock.calls[0]).toEqual(transport.mock.calls[2]);
  });
  it("refuses a read without a mounted authenticated workspace", async () => {
    const transport = vi.fn(); vi.stubGlobal("fetch", transport);
    await expect(loadFinanceCopilotEvidence(null)).rejects.toThrow("Reload your workspace"); expect(transport).not.toHaveBeenCalled();
  });
  it.each([403, 409, 429, 503])("does not consume an error body's Finance-shaped data at status %s", async status => {
    const response = Response.json(payload(), { status }); const parse = vi.spyOn(response, "json");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(loadFinanceCopilotEvidence(original)).rejects.toThrow(); expect(parse).not.toHaveBeenCalled();
  });
  it.each([
    {}, { ...payload(), ok: false }, { ...payload(), state: { ...payload().state, mode: "fixture" } },
    { ...payload(), state: { ...payload().state, transactions: null } },
    { ...payload(), state: { ...payload().state, transactions: [{ ...payload().state.transactions[0], amountPence: "123400" }] } },
    { ...payload(), state: { ...payload().state, transactions: [{ ...payload().state.transactions[0], transactionDate: "2026-02-30" }] } },
  ])("does not turn malformed or fixture HTTP200 into a Finance answer", async invalid => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(invalid)));
    await expect(loadFinanceCopilotEvidence(original)).rejects.toThrow(financeCopilotUnavailable);
  });
  it("accepts actual persistent import and optional balance wire fields", async () => {
    const value = payload(); Object.assign(value.state, {
      imports: [{ id: "synthetic-import", importedAt: "2026-10-31T10:00:00+00:00", fileName: "fictional.csv", sourceRows: 1, newTransactions: 1, duplicateRows: 0, reviewRows: 0, dateRange: { from: "2026-10-31", to: "2026-10-31" } }],
      manualBalancePence: 987600, manualBalanceConfirmedAt: "2026-10-31T10:01:00.123Z",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(value)));
    expect(await loadFinanceCopilotEvidence(original)).toEqual(value.state);
  });
});
