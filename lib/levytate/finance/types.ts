export type DasFinanceCategory = "levy_in" | "apprenticeship_spend" | "levy_expiry" | "transfer_out" | "transfer_in" | "refund_or_adjustment" | "other";

export type DasFinanceTransaction = {
  transactionId: string;
  transactionDate: string;
  description: string;
  category: DasFinanceCategory;
  amountPence: number;
  providerName?: string;
  apprenticeName?: string;
  programmeName?: string;
  payeScheme?: string;
  payrollMonth?: string;
  reportedBalancePence?: number;
  sourceRow: number;
  fingerprint: string;
};

export type DasColumnKey = "date" | "description" | "amount" | "debit" | "credit" | "balance" | "provider" | "learner" | "programme" | "paye" | "payrollMonth";
export type DasColumnMapping = Partial<Record<DasColumnKey, string>>;
export type DasImportIssue = { sourceRow: number; field: string; message: string };

export type DasImportResult = {
  headers: string[];
  detectedMapping: DasColumnMapping;
  needsMapping: boolean;
  transactions: DasFinanceTransaction[];
  issues: DasImportIssue[];
  sourceRows: number;
  dateRange: { from: string; to: string } | null;
};

export type LevyFinanceImportRecord = {
  id: string;
  importedAt: string;
  fileName: string;
  sourceRows: number;
  newTransactions: number;
  duplicateRows: number;
  reviewRows: number;
  dateRange: { from: string; to: string } | null;
};

export type LevyFinanceState = {
  version: 1;
  mode: "fixture" | "local_import" | "session_import" | "persistent";
  transactions: DasFinanceTransaction[];
  imports: LevyFinanceImportRecord[];
  manualBalancePence?: number;
  manualBalanceConfirmedAt?: string;
};

export type LevyFinanceMonth = {
  month: string;
  levyReceivedPence: number;
  apprenticeshipSpendPence: number;
  spendVsContributionsPence: number;
  expiredPence: number;
  transferNetPence: number;
  adjustmentsPence: number;
  netMovementPence: number;
  closingBalancePence?: number;
};

export type LevyFinanceSummary = {
  latestMonth: string | null;
  currentBalance: { amountPence?: number; source: "reported" | "manual" | "unavailable"; asOf?: string };
  latest: LevyFinanceMonth | null;
  monthly: LevyFinanceMonth[];
  expiredFinancialYearPence: number;
  expiredImportedPeriodPence: number;
  unknownTransactions: DasFinanceTransaction[];
};
