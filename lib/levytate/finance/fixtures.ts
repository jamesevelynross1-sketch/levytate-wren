import type { DasFinanceTransaction, LevyFinanceState } from "./types";

export function createIllustrativeFinanceFixture(): LevyFinanceState {
  const providers = ["Northstar Apprenticeships", "Forge Learning Group", "Harbour Skills Partnership"];
  const programmes = ["Data Analyst", "Operations Manager", "Improvement Practitioner"];
  const transactions: DasFinanceTransaction[] = [];
  for (let offset = 0; offset < 20; offset += 1) {
    const date = new Date(Date.UTC(2025, 0 + offset, 6));
    const month = date.toISOString().slice(0, 7);
    add(`${month}-06`, "Monthly levy contribution", "levy_in", 7600000 + (offset % 4) * 185000);
    add(`${month}-15`, "Apprenticeship payment to provider", "apprenticeship_spend", -(6150000 + (offset % 5) * 275000), providers[offset % 3], programmes[offset % 3], `Fictional learner ${offset + 1}`);
    if (offset % 4 === 2 || offset === 19) add(`${month}-24`, "Levy funds expired", "levy_expiry", -(420000 + offset * 12000));
    if (offset === 7) add(`${month}-19`, "Transfer sent to partner employer", "transfer_out", -900000);
    if (offset === 12) add(`${month}-21`, "Payment adjustment", "refund_or_adjustment", 185000);
  }
  function add(transactionDate: string, description: string, category: DasFinanceTransaction["category"], amountPence: number, providerName?: string, programmeName?: string, apprenticeName?: string) {
    const id = `fixture-${transactions.length + 1}`;
    transactions.push({ transactionId: id, transactionDate, description, category, amountPence, providerName, programmeName, apprenticeName, sourceRow: transactions.length + 2, fingerprint: id, reportedBalancePence: transactionDate === "2026-08-15" ? 42873000 : undefined });
  }
  return { version: 1, mode: "fixture", transactions, imports: [{ id: "fixture-import", importedAt: "2026-08-18T09:00:00.000Z", fileName: "illustrative-das-transactions.csv", sourceRows: transactions.length, newTransactions: transactions.length, duplicateRows: 0, reviewRows: 0, dateRange: { from: transactions[0].transactionDate, to: transactions.at(-1)?.transactionDate ?? transactions[0].transactionDate } }] };
}
