import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDasCsv } from "@/lib/levytate/finance/das-import";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";

vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({
  getLearnerLifecycleServerContext: async () => ({ organisation: { id: "tenant-fixture" }, user: { id: "actor-fixture", email: "lead@example.test", role: "Apprenticeship Lead" } }),
  LevyTateLearnerLifecyclePermissionError: class extends Error {},
}));
import { confirmOrganisationFinanceBalance, getOrganisationFinanceState, importOrganisationFinance } from "@/lib/server/levytate-finance";

const session = {} as LevyTateBetaSession;
const imported = { id: "import-fixture", file_name: "fixture.csv", source_rows: 1, new_transactions: 1, duplicate_rows: 0, review_rows: 0, date_range_from: "2026-01-01", date_range_to: "2026-01-01", imported_at: "2026-10-29T12:00:00Z" };
const transaction = { transactionDate: "2026-01-01", description: "Levy credit", category: "levy_in" as const, amountPence: 100, sourceRow: 2, transactionId: "csv-id", fingerprint: "untrusted-client-fingerprint" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://finance.example.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fictional-test-key"); });

describe("Finance transport and data validation (not live authentication evidence)", () => {
  it("reads every page beyond the gateway default and retains stable ordering", async () => {
    const observed: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input); observed.push(url);
      let value: unknown = [];
      if (url.pathname.endsWith("levytate_finance_versions")) value = [{ revision: 3 }];
      if (url.pathname.endsWith("levytate_finance_transactions")) {
        const offset = Number(url.searchParams.get("offset"));
        value = Array.from({ length: offset === 0 ? 1000 : 1 }, (_, i) => ({ fingerprint: `row-${offset + i}`, transaction_date: "2026-01-01", description: "Synthetic credit", category: "levy_in", amount_pence: 100, source_row: i + 1, reported_balance_pence: null }));
      }
      const offset = Number(url.searchParams.get("offset"));
      const rows = value as unknown[];
      const total = url.pathname.endsWith("levytate_finance_transactions") ? 1001 : rows.length;
      return Response.json(value, { headers: { "Content-Range": rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : "*/0" } });
    }));
    const result = await getOrganisationFinanceState(session);
    expect(result.transactions).toHaveLength(1001);
    const pages = observed.filter((url) => url.pathname.endsWith("levytate_finance_transactions"));
    expect(pages.map((url) => url.searchParams.get("offset"))).toEqual(["0", "1000"]);
    expect(pages.every((url) => url.searchParams.get("order") === "transaction_date.asc,fingerprint.asc")).toBe(true);
  });

  it("refuses to describe repeatedly changing pages as reconciled totals", async () => {
    let revision = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string) => Response.json(input.includes("finance_versions") ? [{ revision: revision++ }] : [], { headers: { "Content-Range": input.includes("finance_versions") ? "0-0/1" : "*/0" } })));
    await expect(getOrganisationFinanceState(session)).rejects.toMatchObject({ status: 503 });
  });

  it("imports one transactionally bounded command and regenerates the fingerprint and retry key", async () => {
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (input.includes("rpc/")) { commands.push(JSON.parse(String(init?.body))); return Response.json(imported); }
      return Response.json([], { headers: { "Content-Range": "*/0" } });
    }));
    const result = { sourceRows: 1, transactions: [transaction], dateRange: { from: "1900-01-01", to: "2099-01-01" } };
    await importOrganisationFinance(session, "fixture.csv", result);
    await importOrganisationFinance(session, "fixture.csv", result);
    expect(commands[0]).toEqual(commands[1]);
    expect(commands[0].p_request_id).toMatch(/^[a-f0-9]{64}$/);
    expect(commands[0].p_input).not.toHaveProperty("dateRange");
    expect((commands[0].p_input as { transactions: Array<{ fingerprint: string }> }).transactions[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires balance CAS and rejects missing or malformed source rows before persistence", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(confirmOrganisationFinanceBalance(session, 100)).rejects.toMatchObject({ status: 409 });
    await expect(importOrganisationFinance(session, "fixture.csv", { sourceRows: 2, transactions: [transaction], dateRange: null })).rejects.toMatchObject({ status: 400 });
    await expect(importOrganisationFinance(session, "fixture.csv", { sourceRows: 1, transactions: [{ ...transaction, transactionDate: "2026-02-31" }], dateRange: null })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts nonblank CSV source rows and still reports malformed records", () => {
    const result = parseDasCsv("Date,Description,Amount\n01/01/2026,Levy credit,1\n\n31/02/2026,Invalid,1\n");
    expect(result.sourceRows).toBe(2); expect(result.transactions).toHaveLength(1); expect(result.issues).toHaveLength(1);
  });
});
