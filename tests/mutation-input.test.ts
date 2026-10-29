import { describe, expect, it } from "vitest";
import { parseFinanceAction, parseWorkspaceMutation } from "@/lib/server/levytate-mutation-input";

const transaction = {
  transactionId: "synthetic-row-1", transactionDate: "2026-10-01", description: "Fictional levy entry",
  category: "levy_in", amountPence: 1200, sourceRow: 2, fingerprint: "recalculated-on-server",
};
const importAction = () => ({ action: "import", fileName: "synthetic.csv", result: { transactions: [transaction], sourceRows: 1, dateRange: { from: "2026-10-01", to: "2026-10-01" } } });

describe("Finance input contract", () => {
  it("accepts the actual UI import and explicit zero balance", () => {
    expect(parseFinanceAction(importAction()).action).toBe("import");
    const balance = { action: "balance", amountPence: 0, expectedConfirmedAt: null, requestId: "7b8aa254-57cb-4079-a4bd-9c462cb6bf5b" };
    expect(parseFinanceAction(balance)).toEqual(balance);
  });
  it.each([NaN, Infinity, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, "12"])("rejects unsafe balance %s", (amountPence) => {
    expect(() => parseFinanceAction({ action: "balance", amountPence })).toThrow();
  });
  it.each([
    { transactionDate: "2026-02-30" }, { transactionDate: "2026-13-01" }, { amountPence: 1.5 },
    { reportedBalancePence: Number.MAX_SAFE_INTEGER + 1 }, { category: "made-up" }, { description: " " },
    { organisation_id: "other-tenant" }, { sourceRow: 0 }, { providerName: { forged: true } },
  ])("rejects invalid transaction fields without echoing input", (change) => {
    const body = importAction();
    body.result.transactions = [{ ...transaction, ...change }];
    expect(() => parseFinanceAction(body)).toThrow("A valid finance action is required.");
  });
  it("rejects forged tenancy, inconsistent row count and reversed evidence range", () => {
    expect(() => parseFinanceAction({ ...importAction(), organisationId: "other-tenant" })).toThrow();
    const body = importAction(); body.result.sourceRows = 0;
    expect(() => parseFinanceAction(body)).toThrow();
    body.result.sourceRows = 1; body.result.dateRange.from = "2026-10-02";
    expect(() => parseFinanceAction(body)).toThrow();
  });
  it("requires a balance version and stable retry identity", () => {
    expect(() => parseFinanceAction({ action: "balance", amountPence: 0 })).toThrow();
    expect(() => parseFinanceAction({ action: "balance", amountPence: 0, expectedConfirmedAt: "yesterday", requestId: "not-a-uuid" })).toThrow();
  });
});

describe("workspace action envelope", () => {
  it.each(["archiveEmployee", "archiveRole", "archiveProvider", "archiveProviderProgramme"])("%s requires an explicit retry-safe target state", (type) => {
    expect(parseWorkspaceMutation({ type, id: "synthetic-record", status: "Archived" })).toEqual({ type, id: "synthetic-record", status: "Archived" });
    expect(() => parseWorkspaceMutation({ type, id: "synthetic-record" })).toThrow();
    expect(() => parseWorkspaceMutation({ type, id: "synthetic-record", status: "Deleted" })).toThrow();
  });
  it("accepts a bounded People import with a stable receipt and rejects malformed envelopes", () => {
    const body = { type: "importEmployees", importId: "7b8aa254-57cb-4079-a4bd-9c462cb6bf5b", employees: [{ id: "synthetic-person" }] };
    expect(parseWorkspaceMutation(body)).toEqual(body);
    for (const change of [{ importId: "invalid" }, { employees: [] }, { employees: Array(501).fill({}) }, { employees: [null] }, { employees: [[]] }, { organisationId: "other-tenant" }]) {
      expect(() => parseWorkspaceMutation({ ...body, ...change })).toThrow();
    }
  });
  it("keeps expected revision and retry key for authoritative commands", () => {
    const body = { type: "updateApplicationStatus", id: "app-1", status: "Approved by Line Manager", note: "Synthetic review", expectedRevision: 3, idempotencyKey: "synthetic-retry-key" };
    expect(parseWorkspaceMutation(body)).toEqual(body);
  });
  it.each([
    { type: "pretend" }, { type: "archiveEmployee", id: "" }, { type: "archiveEmployee", id: "one", organisationId: "other" },
    { type: "saveEmployee", employee: [] }, { type: "saveEmployee", employee: null },
    { type: "updateMatchingStatus", id: "one", status: "Approved" },
    { type: "saveApplication", application: {}, expectedRevision: -1 },
    { type: "saveApplication", application: {}, idempotencyKey: "" },
  ])("rejects invalid action %j", (body) => { expect(() => parseWorkspaceMutation(body)).toThrow(); });
  it("rejects deeply nested, oversized and prototype-like payload values", () => {
    let nested: unknown = "value";
    for (let i = 0; i < 15; i++) nested = { nested };
    for (const employee of [{ nested }, { name: "x".repeat(20001) }, JSON.parse('{"__proto__":{"role":"Platform Admin"}}')]) {
      expect(() => parseWorkspaceMutation({ type: "saveEmployee", employee })).toThrow();
    }
  });
});
