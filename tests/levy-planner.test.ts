import { describe, expect, it } from "vitest";
import { decodePlannerFile } from "@/lib/levytate/finance/levy-planner-file";
import { fundingRuleVersion, addMonths, expiryMonth, cohortEligibility, cohortPayments, forecastLevy, validatePlanner, withdrawnStandardIds, type PlannedCohort, type PlannerInputs } from "@/lib/levytate/finance/levy-planner";

const base: PlannerInputs={openingMonth:"2026-07",openingPence:0,openingFunds:[],horizon:24,monthlyReceiptsPence:0,monthlyExistingPence:0,existingMonths:0,existingShortfallRate:5,monthlyTransferPence:0,transferMonths:0,cohorts:[]};
const cohort: PlannedCohort={id:"c",name:"Data",standardId:"ST0118",standardTitle:"Data analyst",level:4,startMonth:"2026-08",learners:3,pricePence:1_200_001,bandPence:1_000_000,durationMonths:12,assessmentMonths:3,ageAtStart:30,exception:"none",route:"levy",fundingChecked:true,department:"Digital"};
describe("England levy planner policy and arithmetic",()=>{
  it("applies 24/12 month transitional expiry without retroactive shortening",()=>{
    expect(expiryMonth("2025-08")).toBe("2027-08");expect(expiryMonth("2026-07")).toBe("2028-07");expect(expiryMonth("2026-08")).toBe("2027-08");expect(addMonths("2026-12",1)).toBe("2027-01");
  });
  it("blocks all 16 withdrawn standards including current version IDs",()=>{
    expect(withdrawnStandardIds.size).toBe(16);
    for(const id of withdrawnStandardIds)expect(cohortEligibility({...cohort,standardId:id+"-v1-1",startMonth:"2026-09"}).eligible).toBe(false);
  });
  it("uses the age at start, level 7 exception and provisional later rules",()=>{
    expect(cohortEligibility({...cohort,ageAtStart:24}).shortfallRate).toBe(0);
    expect(cohortEligibility({...cohort,ageAtStart:25}).shortfallRate).toBe(25);
    expect(cohortEligibility({...cohort,level:7,ageAtStart:22}).eligible).toBe(false);
    expect(cohortEligibility({...cohort,level:7,ageAtStart:22,exception:"care-ehcp"}).eligible).toBe(true);
    expect(cohortEligibility({...cohort,level:7,ageAtStart:25,exception:"care-ehcp"}).eligible).toBe(false);
    expect(cohortEligibility({...cohort,startMonth:"2027-08"}).provisional).toBe(true);
  });
  it("does not assume unconfirmed funding, and preserves total pence across rounding",()=>{
    const items=cohortPayments(cohort);
    expect(items.reduce((n,p)=>n+p.eligiblePence,0)).toBe(3_000_000);
    expect(items.reduce((n,p)=>n+p.directPence,0)).toBe(600_003);
    expect(items.at(-1)?.eligiblePence).toBe(600_000);
    expect(items.at(-1)?.month).toBe("2027-11");
    expect(cohortPayments({...cohort,fundingChecked:false}).every(p=>p.eligiblePence===0)).toBe(true);
  });
  it("consumes older funds before expiry and honours transfer priority",()=>{
    const input={...base,openingPence:100000,openingFunds:[{receiptMonth:"2024-08",amountPence:100000}],monthlyExistingPence:40000,existingMonths:1,monthlyTransferPence:50000,transferMonths:1};
    const row=forecastLevy(input).rows[0];expect(row.levyUsed).toBe(90000);expect(row.expired).toBe(10000);expect(row.closing).toBe(0);
  });
  it("applies 25% or zero to eligible shortfalls, never the full price",()=>{
    const c={...cohort,learners:1,pricePence:120000,bandPence:120000};
    const full=forecastLevy({...base,cohorts:[c]});expect(full.proposedCash).toBe(30000);
    expect(forecastLevy({...base,cohorts:[{...c,ageAtStart:24}]}).proposedCash).toBe(0);
    expect(forecastLevy({...base,cohorts:[{...c,route:"private"}]}).proposedCash).toBe(120000);
  });
  it("retains unknown opening age, does not invent its expiry, and rejects excess buckets",()=>{
    const f=forecastLevy({...base,openingPence:50000});expect(f.openingUnaged).toBe(50000);expect(f.expiry).toBe(0);expect(f.closing).toBe(50000);
    expect(validatePlanner({...base,openingFunds:[{receiptMonth:"2026-07",amountPence:1}]})).not.toEqual([]);
  });
  it("reconciles every monthly closing balance and reports spend after the horizon",()=>{
    const input={...base,horizon:12 as const,monthlyReceiptsPence:20000,cohorts:[{...cohort,startMonth:"2027-05"}]};
    const result=forecastLevy(input);for(const r of result.rows)expect(r.closing).toBe(r.opening+r.receipts-r.levyUsed-r.expired);
    expect(result.futureProposedDue).toBeGreaterThan(0);expect(forecastLevy(input,false).proposedDue).toBe(0);
  });
});

describe("bounded scenario file reload",()=>{
  it("revalidates assumptions and resets imported funding confirmations",()=>{
    const result=decodePlannerFile({ruleVersion:fundingRuleVersion,scenarioName:"Test",plan:{...base,cohorts:[cohort]}});
    expect(result.plan.cohorts[0].fundingChecked).toBe(false);
    expect(()=>decodePlannerFile({ruleVersion:"obsolete",scenarioName:"Test",plan:base})).toThrow();
    expect(()=>decodePlannerFile({ruleVersion:fundingRuleVersion,scenarioName:"Test",plan:{...base,openingPence:-1}})).toThrow();
    expect(()=>decodePlannerFile({ruleVersion:fundingRuleVersion,scenarioName:"Test",plan:{...base,unexpected:"bad"}})).toThrow();
  });
});
