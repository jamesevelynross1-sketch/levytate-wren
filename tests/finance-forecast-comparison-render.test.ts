import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinanceForecastComparison } from "@/components/levytate-mvp/FinanceForecastComparison";
import { forecastLevy, type PlannerInputs, type PlannedCohort } from "@/lib/levytate/finance/levy-planner";

const base: PlannerInputs = {
  openingMonth:"2026-08",openingPence:70_972_600,openingFunds:[],horizon:12,
  monthlyReceiptsPence:9_571_700,monthlyExistingPence:7_333_767,
  existingMonths:24,existingShortfallRate:5,monthlyTransferPence:0,transferMonths:0,cohorts:[],
};
const cohort: PlannedCohort = {
  id:"ai-23",name:"AI practitioner starts",standardId:"ST1512",
  standardTitle:"Artificial intelligence (AI) and automation practitioner",
  level:4,startMonth:"2027-03",learners:23,pricePence:1_100_000,bandPence:1_800_000,
  durationMonths:18,assessmentMonths:3,ageAtStart:25,exception:"none",route:"levy",
  fundingChecked:false,department:"Operations",
};

describe("levy-only forecast comparison UI",()=>{
  it("defaults to co-investment cash chart when eligible starts exceed the available levy",()=>{
    const empty={...base,openingPence:0,monthlyReceiptsPence:0,monthlyExistingPence:0,existingMonths:0};
    const html=renderToStaticMarkup(createElement(FinanceForecastComparison,{
      baseline:forecastLevy(empty,false),planned:forecastLevy({...empty,cohorts:[cohort]}),
      horizon:12,unknownOpeningPence:0,
    }));
    expect(html).toContain("finance-forecast-chart-cash");
    expect(html).toContain("Compare the financial impact");
    expect(html).toContain("Both levy-balance curves match");
    expect(html).toContain("co-investment");
    expect(html).toContain("Employer cash");
    expect(html).toContain("chart-mobile-scale");
    expect(html).toContain("chart-mobile-months");
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Employer cash<\/button>/);
  });
  it("defaults to levy balance when an indicative, real approved standard changes projected DAS",()=>{
    const html=renderToStaticMarkup(createElement(FinanceForecastComparison,{
      baseline:forecastLevy(base,false),planned:forecastLevy({...base,cohorts:[cohort]}),
      horizon:12,unknownOpeningPence:base.openingPence,
    }));
    expect(html).toContain("finance-forecast-chart-levy");
    expect(html).toContain("Levy balance");
    expect(html).not.toContain("Both levy-balance curves match");
  });
  it("explains why test-only standards cannot affect levy or employer contribution",()=>{
    const invalid={...cohort,standardId:"ST1490",standardTitle:"Synthetic acceptance standard record",bandPence:0};
    const html=renderToStaticMarkup(createElement(FinanceForecastComparison,{
      baseline:forecastLevy(base,false),planned:forecastLevy({...base,cohorts:[invalid]}),
      horizon:12,unknownOpeningPence:base.openingPence,excludedCohorts:1,
    }));
    expect(html).toContain("finance-excluded-cohorts");
    expect(html).toContain("excluded from both charts");
    expect(html).not.toContain("Both levy-balance curves match");
  });
});
