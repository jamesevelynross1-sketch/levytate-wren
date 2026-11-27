/** Bind imported DAS evidence to forecast assumptions without overwriting
 * a user's in-progress plan. No inferred current balance or fund expiry.
 * The latest recorded amount is always anchored to its evidence month. */
import type { LevyFinanceSummary } from "./types";
import { addMonths, estimateMonthly, type PlannerInputs } from "./levy-planner";

export function initialPlanFromEvidence(summary: LevyFinanceSummary, currentMonth: string): PlannerInputs {
  const evidenceMonth = summary.currentBalance.asOf?.slice(0, 7);
  const openingMonth = evidenceMonth && evidenceMonth >= "2026-07" && evidenceMonth <= currentMonth
    ? evidenceMonth : addMonths(currentMonth, -1);
  // Historic top-up policy can differ from the current levy rules. Only recent
  // post-August 2026 receipts seed an indicative future monthly value.
  const history = summary.monthly.filter(month => month.month < currentMonth);
  return {
    openingMonth,
    openingPence: evidenceMonth === openingMonth ? Math.max(0, summary.currentBalance.amountPence ?? 0) : 0,
    openingFunds: [],
    horizon: 24,
    monthlyReceiptsPence: estimateMonthly(history.filter(month => month.month >= "2026-08").slice(-3).map(month => month.levyReceivedPence)),
    monthlyExistingPence: estimateMonthly(history.slice(-3).map(month => month.apprenticeshipSpendPence)),
    existingMonths: 24,
    existingShortfallRate: 5,
    monthlyTransferPence: 0,
    transferMonths: 0,
    cohorts: [],
  };
}

/** Automatic reconciliation is only safe before the user edits their plan.
 * Keep the chosen horizon and preserve cohorts and other inputs if editing. */
export function reconcileImportedEvidence(
  plan: PlannerInputs,
  summary: LevyFinanceSummary,
  currentMonth: string,
  hasUserEdits: boolean,
): { plan: PlannerInputs; applied: boolean } {
  if (hasUserEdits) return { plan, applied: false };
  const suggested = initialPlanFromEvidence(summary, currentMonth);
  return { plan: { ...suggested, horizon: plan.horizon }, applied: true };
}

/** User-initiated rebase: only update source-derived balance/date and receipts.
 * Never discard cohorts, existing commitments, transfers or the horizon. */
export function applyLatestDasEvidence(
  plan: PlannerInputs,
  summary: LevyFinanceSummary,
  currentMonth: string,
): PlannerInputs {
  const suggested = initialPlanFromEvidence(summary, currentMonth);
  return {
    ...plan,
    openingMonth: suggested.openingMonth,
    openingPence: suggested.openingPence,
    openingFunds: [],
    monthlyReceiptsPence: suggested.monthlyReceiptsPence,
  };
}
