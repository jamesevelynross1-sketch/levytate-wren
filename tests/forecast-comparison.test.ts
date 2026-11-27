import { describe, expect, it } from "vitest";
import { compareForecastScenarios } from "@/lib/levytate/finance/forecast-comparison";
import { forecastLevy, cohortEligibility, type PlannerInputs, type PlannedCohort } from "@/lib/levytate/finance/levy-planner";

const base:PlannerInputs={
  openingMonth:"2026-08",openingPence:70_972_600,openingFunds:[],horizon:12,
  monthlyReceiptsPence:9_571_700,monthlyExistingPence:7_333_767,
  existingMonths:24,existingShortfallRate:5,monthlyTransferPence:0,transferMonths:0,cohorts:[],
};
const privateCohort:PlannedCohort={
  id:"fictional-23",name:"Test 23 starts",standardId:"ST1490",standardTitle:"Synthetic acceptance standard record",
  level:4,startMonth:"2027-03",learners:23,pricePence:1_100_000,bandPence:1_100_000,
  durationMonths:12,assessmentMonths:3,ageAtStart:25,exception:"none",route:"levy",fundingChecked:false,department:"Operations",
};

describe("DAS outlook comparison integrity",()=>{
  it("shows cumulative employer cash when levy-balance scenarios are identical",()=>{
    const baseline=forecastLevy(base,false);
    const proposed=forecastLevy({...base,cohorts:[privateCohort]});
    const comparison=compareForecastScenarios(baseline,proposed);
    expect(comparison.levyLinesMatch).toBe(true);
    expect(comparison.cashLinesMatch).toBe(false);
    expect(comparison.preferredView).toBe("cash");
    expect(comparison.levyBaseline).toEqual(comparison.levyPlanned);
    expect(comparison.cashBaseline).not.toEqual(comparison.cashPlanned);
    expect(comparison.extraCashPence).toBeGreaterThan(10_000_000);
    expect(comparison.extraCashPence).toBeLessThan(11_000_000);
    expect(comparison.rows.at(-1)?.cashDifferencePence).toBe(comparison.extraCashPence);
    expect(comparison.rows.find(row=>row.month==="2027-03")?.cashDifferencePence).toBe(0);
    expect(comparison.rows.find(row=>row.month==="2027-04")?.cashDifferencePence).toBeGreaterThan(0);
    expect(comparison.rows).toHaveLength(12);
    expect(proposed.futureProposedDue).toBeGreaterThan(0);
  });
  it("plots funded-levy depletion with an explicitly checked real standard",()=>{
    const funded={...privateCohort,standardId:"ST0118",standardTitle:"Data analyst",fundingChecked:true};
    expect(cohortEligibility(funded).eligible).toBe(true);
    const compared=compareForecastScenarios(forecastLevy(base,false),forecastLevy({...base,cohorts:[funded]}));
    expect(compared.levyLinesMatch).toBe(false);
    expect(compared.preferredView).toBe("levy");
    expect(compared.levyBalanceDifferencePence).toBeGreaterThan(0);
    expect(compared.extraCashPence).toBe(0);
  });
  it("never treats a synthetic standard as eligible merely because it resembles ST1490",()=>{
    const fixture={...privateCohort,fundingChecked:true};
    expect(cohortEligibility(fixture).eligible).toBe(false);
    expect(cohortEligibility(fixture).reason).toContain("Test-only");
    const compared=compareForecastScenarios(forecastLevy(base,false),forecastLevy({...base,cohorts:[fixture]}));
    expect(compared.preferredView).toBe("cash");
  });
  it("consumes known funds before unknown-age opening funds",()=>{
    const dated={...base,openingMonth:"2026-07",openingPence:100_000,openingFunds:[{receiptMonth:"2024-08",amountPence:50_000}],monthlyReceiptsPence:0,monthlyExistingPence:50_000,existingMonths:1,cohorts:[]};
    const first=forecastLevy(dated).rows[0];
    expect(first.levyUsed).toBe(50_000);
    expect(first.expired).toBe(0);
    expect(first.unaged).toBe(50_000);
  });
  it("keeps scenarios aligned across 12/24/36/48 month horizons",()=>{
    for(const horizon of [12,24,36,48] as const){
      const plan={...base,horizon};
      const view=compareForecastScenarios(forecastLevy(plan,false),forecastLevy({...plan,cohorts:[privateCohort]}));
      expect(view.rows).toHaveLength(horizon);
      expect(view.cashPlanned.at(-1)).toBeGreaterThanOrEqual(view.cashBaseline.at(-1)!);
      for(const row of view.rows)expect(row.cashPlannedPence).toBeGreaterThanOrEqual(row.cashBaselinePence);
    }
    expect(()=>compareForecastScenarios(forecastLevy(base,false),forecastLevy({...base,horizon:24},false))).toThrow("different monthly timelines");
  });
});
