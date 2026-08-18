import type { DasFinanceTransaction, LevyFinanceMonth, LevyFinanceState, LevyFinanceSummary } from "./types";

export function calculateLevyFinance(state: LevyFinanceState, now = new Date()): LevyFinanceSummary {
  const grouped = new Map<string, DasFinanceTransaction[]>();
  state.transactions.forEach((transaction) => {
    const month = transaction.transactionDate.slice(0, 7);
    grouped.set(month, [...(grouped.get(month) ?? []), transaction]);
  });
  const monthly = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, transactions]) => calculateMonth(month, transactions));
  const latestMonth = monthly.at(-1)?.month ?? null;
  const reported = [...state.transactions].filter((item) => item.reportedBalancePence !== undefined).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))[0];
  const currentBalance = reported
    ? { amountPence: reported.reportedBalancePence, source: "reported" as const, asOf: reported.transactionDate }
    : state.manualBalancePence !== undefined
      ? { amountPence: state.manualBalancePence, source: "manual" as const, asOf: state.manualBalanceConfirmedAt }
      : { source: "unavailable" as const };
  const financialYearStart = `${now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1}-04-01`;
  const financialYearEnd = `${now.getUTCMonth() >= 3 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()}-03-31`;
  const expired = state.transactions.filter((item) => item.category === "levy_expiry");
  return {
    latestMonth, currentBalance, latest: monthly.at(-1) ?? null, monthly,
    expiredFinancialYearPence: totalAbsolute(expired.filter((item) => item.transactionDate >= financialYearStart && item.transactionDate <= financialYearEnd)),
    expiredImportedPeriodPence: totalAbsolute(expired),
    unknownTransactions: state.transactions.filter((item) => item.category === "other"),
  };
}

export function calculateMonth(month: string, transactions: DasFinanceTransaction[]): LevyFinanceMonth {
  const category = (name: DasFinanceTransaction["category"]) => transactions.filter((item) => item.category === name);
  const levyReceivedPence = totalAbsolute(category("levy_in"));
  const apprenticeshipSpendPence = totalAbsolute(category("apprenticeship_spend"));
  const expiredPence = totalAbsolute(category("levy_expiry"));
  const transferNetPence = sum(category("transfer_in")) + sum(category("transfer_out"));
  const adjustmentsPence = sum(category("refund_or_adjustment"));
  const reported = [...transactions].filter((item) => item.reportedBalancePence !== undefined).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))[0];
  return { month, levyReceivedPence, apprenticeshipSpendPence, spendVsContributionsPence: levyReceivedPence - apprenticeshipSpendPence, expiredPence, transferNetPence, adjustmentsPence, netMovementPence: levyReceivedPence - apprenticeshipSpendPence - expiredPence + transferNetPence + adjustmentsPence, closingBalancePence: reported?.reportedBalancePence };
}

export function formatGbp(pence: number, decimals = false) {
  const value = Math.abs(pence) / 100;
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 }).format(value);
  return pence < 0 ? `−${formatted}` : formatted;
}

export function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 1)));
}

function sum(items: DasFinanceTransaction[]) { return items.reduce((total, item) => total + item.amountPence, 0); }
function totalAbsolute(items: DasFinanceTransaction[]) { return items.reduce((total, item) => total + Math.abs(item.amountPence), 0); }
