import { describe, expect, it } from "vitest";
import { compareForecastScenarios } from "@/lib/levytate/finance/forecast-comparison";
import { forecastLevy, cohortEligibility, cohortPayments, type PlannerInputs, type PlannedCohort } from "@/lib/levytate/finance/levy-planner";

const base: PlannerInputs = {
  openingMonth:"2026-08", openingPence:70_972_600, openingFunds:[], horizon:12,
  monthlyReceiptsPence:9_571_700, monthlyExistingPence:7_333_767,
  existingMonths:24, existingShortfallRate:5, monthlyTransferPence:0, transferMonths:0, cohorts:[],
};
const real: PlannedCohort = {
  id:"ai-real", name:"Indicative levy cohort", standardId:"ST1512",
  standardTitle:"Artificial intelligence (AI) and automation practitioner",
  level:4, startMonth:"2027-03", learners:23, pricePence:1_100_000, bandPence:1_800_000,
  durationMonths:18, assessmentMonths:3, ageAtStart:25,
  exception:"none", route:"levy", fundingChecked:false, department:"Operations",
};
const synthetic: PlannedCohort = {...real,standardId:"ST1490",standardTitle:"Synthetic acceptance standard record",bandPence:0};

describe("levy-only forecast comparison",()=>{
  it("treats a plausible unconfirmed apprenticeship as an indicative levy projection, not private training",()=>{
    const status=cohortEligibility(real);
    expect(status.eligible).toBe(false);
    expect(status.forecastable).toBe(true);
    expect(status.reason).toContain("Indicative levy");
    const compared=compareForecastScenarios(forecastLevy(base,false),forecastLevy({...base,cohorts:[real]}));
    expect(compared.levyLinesMatch).toBe(false);
    expect(compared.preferredView).toBe("levy");
    expect(compared.levyBalanceDifferencePence).toBeGreaterThan(0);
    expect(compared.extraCashPence).toBe(0);
  });
  it("does not charge the full price as private cash for a synthetic or missing-band standard",()=>{
    expect(cohortEligibility(synthetic).forecastable).toBe(false);
    expect(cohortPayments(synthetic)).toEqual([]);
    const baseline=forecastLevy(base,false), proposed=forecastLevy({...base,cohorts:[synthetic]});
    const compared=compareForecastScenarios(baseline,proposed);
    expect(compared.levyLinesMatch).toBe(true);
    expect(compared.cashLinesMatch).toBe(true);
    expect(compared.extraCashPence).toBe(0);
    expect(compared.levyBalanceDifferencePence).toBe(0);
    expect(proposed.proposedDue).toBe(0);
    expect(proposed.futureProposedDue).toBe(0);
  });
  it("displays employer co-investment only when the levy-paying employer has insufficient DAS funds",()=>{
    const depleted={...base,openingPence:0,monthlyReceiptsPence:0,monthlyExistingPence:0,existingMonths:0};
    const baseline=forecastLevy(depleted,false);
    const proposed=forecastLevy({...depleted,cohorts:[real]});
    const compared=compareForecastScenarios(baseline,proposed);
    expect(compared.levyLinesMatch).toBe(true);
    expect(compared.cashLinesMatch).toBe(false);
    expect(compared.preferredView).toBe("cash");
    expect(compared.extraCashPence).toBeGreaterThan(0);
    expect(compared.rows.find(row=>row.month==="2027-03")?.cashDifferencePence).toBe(0);
    expect(compared.rows.find(row=>row.month==="2027-04")?.cashDifferencePence).toBeGreaterThan(0);
    expect(compared.extraCashPence).toBe(proposed.proposedCash);
    expect(compared.extraCashPence).toBeLessThan(23*1_100_000);
    expect(compared.rows).toHaveLength(12);
  });
  it("keeps above-band employer costs separate from levy-funded amounts",()=>{
    const overBand={...real,standardId:"ST0070",standardTitle:"Business administrator",bandPence:500_000,ageAtStart:24};
    const projected=forecastLevy({...base,cohorts:[overBand]});
    expect(projected.proposedDue).toBeGreaterThan(0);
    expect(projected.proposedCash).toBeGreaterThan(0);
    expect(compareForecastScenarios(forecastLevy(base,false),projected).levyLinesMatch).toBe(false);
  });
  it("blocks withdrawn standards even if a user checks the funding declaration",()=>{
    const blocked={...real,standardId:"ST0385",standardTitle:"Operations manager",fundingChecked:true};
    expect(cohortEligibility(blocked).forecastable).toBe(false);
    expect(cohortPayments(blocked)).toEqual([]);
    expect(forecastLevy({...base,cohorts:[blocked]}).proposedCash).toBe(0);
  });
  it("consumes aged funds before funds whose expiry age is unknown",()=>{
    const dated={...base,openingMonth:"2026-07",openingPence:100_000,openingFunds:[{receiptMonth:"2024-08",amountPence:50_000}],monthlyReceiptsPence:0,monthlyExistingPence:50_000,existingMonths:1,cohorts:[]};
    const row=forecastLevy(dated).rows[0];
    expect(row.levyUsed).toBe(50_000);
    expect(row.expired).toBe(0);
    expect(row.unaged).toBe(50_000);
  });
  it("keeps all 12/24/36/48-month comparisons aligned and rejects mismatched timelines",()=>{
    for(const horizon of [12,24,36,48] as const){
      const input={...base,horizon};
      const view=compareForecastScenarios(forecastLevy(input,false),forecastLevy({...input,cohorts:[real]}));
      expect(view.rows).toHaveLength(horizon);
      expect(view.levyPlanned.at(-1)).toBeLessThanOrEqual(view.levyBaseline.at(-1)!);
      for(const row of view.rows)expect(row.cashPlannedPence).toBeGreaterThanOrEqual(row.cashBaselinePence);
    }
    expect(()=>compareForecastScenarios(forecastLevy(base,false),forecastLevy({...base,horizon:24},false))).toThrow("different monthly timelines");
  });
});
