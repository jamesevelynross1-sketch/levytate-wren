import { calculateLevyFinance, formatGbp } from "./calculations";
import type { LevyFinanceState } from "./types";

export type LevyFinanceCopilotIntent = "spend" | "received" | "balance" | "expired" | "comparison" | "summary";

export function resolveLevyFinanceIntent(message: string): LevyFinanceCopilotIntent {
  const text = message.toLowerCase();
  if (/balanc|available/.test(text)) return "balance";
  if (/expir|lost/.test(text)) return "expired";
  if (/compar|versus|vs|difference/.test(text)) return "comparison";
  if (/receiv|contribut|paid in/.test(text)) return "received";
  if (/spend|spent|payment/.test(text)) return "spend";
  return "summary";
}

export function answerLevyFinanceQuestion(message: string, state: LevyFinanceState) {
  const intent = resolveLevyFinanceIntent(message);
  const summary = calculateLevyFinance(state);
  const latest = summary.latest;
  if (!latest) return { intent, message: "There is no imported DAS transaction data to summarise yet. Upload a DAS CSV in Finance first." };
  const period = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${latest.month}-01T00:00:00Z`));
  if (intent === "balance") return { intent, message: summary.currentBalance.amountPence === undefined ? "The current DAS balance has not been reported or manually confirmed yet." : `The current levy balance is ${formatGbp(summary.currentBalance.amountPence)}, based on the ${summary.currentBalance.source === "reported" ? "latest reported DAS balance" : "manually confirmed DAS balance"}.` };
  if (intent === "expired") return { intent, message: `${formatGbp(latest.expiredPence)} expired in ${period}. Across the imported period, ${formatGbp(summary.expiredImportedPeriodPence)} has expired.` };
  if (intent === "comparison") return { intent, message: `In ${period}, levy received was ${formatGbp(latest.levyReceivedPence)} and apprenticeship spend was ${formatGbp(latest.apprenticeshipSpendPence)}. The difference was ${formatGbp(latest.spendVsContributionsPence)}.` };
  if (intent === "received") return { intent, message: `Levy received in ${period} was ${formatGbp(latest.levyReceivedPence)}.` };
  if (intent === "spend") return { intent, message: `Apprenticeship spend in ${period} was ${formatGbp(latest.apprenticeshipSpendPence)}.` };
  return { intent, message: `For ${period}: ${formatGbp(latest.levyReceivedPence)} was received, ${formatGbp(latest.apprenticeshipSpendPence)} was spent and ${formatGbp(latest.expiredPence)} expired. The monthly difference was ${formatGbp(latest.spendVsContributionsPence)}.` };
}
