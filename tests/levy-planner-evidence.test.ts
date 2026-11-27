import { describe, expect, it } from "vitest";
import { calculateLevyFinance } from "@/lib/levytate/finance/calculations";
import { initialPlanFromEvidence, reconcileImportedEvidence, applyLatestDasEvidence } from "@/lib/levytate/finance/levy-planner-evidence";
import { forecastLevy, type PlannedCohort } from "@/lib/levytate/finance/levy-planner";
import type { DasFinanceTransaction, LevyFinanceState } from "@/lib/levytate/finance/types";

function transaction(
  id: string, date: string, category: DasFinanceTransaction["category"], amountPence: number,
  reportedBalancePence?: number,
): DasFinanceTransaction {
  return { transactionId: id, transactionDate: date, description: "Fictional DAS " + id, category, amountPence, ...(reportedBalancePence === undefined ? {} : { reportedBalancePence }), sourceRow: 1, fingerprint: id };
}

const initialSummary = calculateLevyFinance({ version: 1, mode: "persistent", transactions: [], imports: [] });
const importedSummary = calculateLevyFinance({
  version: 1, mode: "persistent", imports: [],
  transactions: [
    transaction("a", "2026-06-18", "apprenticeship_spend", -5_371_200),
    transaction("b", "2026-07-18", "apprenticeship_spend", -7_180_600),
    transaction("c", "2026-08-01", "levy_in", 9_571_700),
    transaction("d", "2026-08-22", "apprenticeship_spend", -9_449_500),
    transaction("e", "2026-08-26", "levy_expiry", -1_185_900, 70_972_600),
  ],
} satisfies LevyFinanceState);

const plannedCohort: PlannedCohort = {
  id: "fictional-cohort", name: "Fictional data cohort",
  standardId: "ST0118", standardTitle: "Data analyst", level: 4,
  startMonth: "2026-12", learners: 2, pricePence: 1_200_000,
  bandPence: 1_200_000, durationMonths: 14, assessmentMonths: 2,
  ageAtStart: 24, exception: "none", route: "levy", fundingChecked: false, department: "Operations",
};

describe("DAS import to levy forecast reconciliation", () => {
  it("uses the August 2026 historical balance as its August opening anchor instead of £0", () => {
    const plan=initialPlanFromEvidence(importedSummary,"2026-11");
    expect(plan.openingMonth).toBe("2026-08");
    expect(plan.openingPence).toBe(70_972_600);
    expect(plan.monthlyReceiptsPence).toBe(9_571_700);
    expect(plan.monthlyExistingPence).toBeGreaterThan(0);
    expect(plan.openingFunds).toEqual([]);
    expect(forecastLevy(plan).closing).toBeGreaterThan(0);
    expect(forecastLevy(plan).openingUnaged).toBe(70_972_600);
    // Future receipts can have modelled expiry, but the imported opening balance has unknown ageing.
    expect(forecastLevy(plan).rows.length).toBe(24);
  });

  it("automatically updates an untouched default planner when the asynchronous DAS import arrives", () => {
    const empty=initialPlanFromEvidence(initialSummary,"2026-11");
    expect(empty.openingPence).toBe(0);
    const updated=reconcileImportedEvidence(empty,importedSummary,"2026-11",false);
    expect(updated.applied).toBe(true);
    expect(updated.plan.openingMonth).toBe("2026-08");
    expect(updated.plan.openingPence).toBe(70_972_600);
    expect(updated.plan.horizon).toBe(empty.horizon);
  });

  it("preserves user-defined cohorts, months, receipts and fund-age assumptions when evidence changes", () => {
    const empty=initialPlanFromEvidence(initialSummary,"2026-11");
    const userPlan={ ...empty, horizon: 36 as const, openingPence: 250_000, openingFunds: [{receiptMonth:"2026-09", amountPence:250_000}], monthlyReceiptsPence:85_000, monthlyExistingPence:40_000, existingMonths:12, monthlyTransferPence:12_000, cohorts:[plannedCohort] };
    const untouched=reconcileImportedEvidence(userPlan,importedSummary,"2026-11",true);
    expect(untouched.applied).toBe(false);
    expect(untouched.plan).toBe(userPlan);
    const applied=applyLatestDasEvidence(userPlan,importedSummary,"2026-11");
    expect(applied.openingPence).toBe(70_972_600);
    expect(applied.openingMonth).toBe("2026-08");
    expect(applied.openingFunds).toEqual([]);
    expect(applied.monthlyReceiptsPence).toBe(9_571_700);
    expect(applied.cohorts).toEqual([plannedCohort]);
    expect(applied.horizon).toBe(36);
    expect(applied.monthlyExistingPence).toBe(40_000);
    expect(applied.existingMonths).toBe(12);
    expect(applied.monthlyTransferPence).toBe(12_000);
  });

  it("does not mistake an earlier recorded balance for the current November balance", () => {
    const plan=initialPlanFromEvidence(importedSummary,"2026-11");
    expect(plan.openingMonth).not.toBe("2026-11");
    expect(importedSummary.currentBalance.asOf).toBe("2026-08-26");
  });
});
