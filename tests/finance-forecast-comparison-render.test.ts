import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinanceForecastComparison } from "@/components/levytate-mvp/FinanceForecastComparison";
import { forecastLevy, type PlannerInputs, type PlannedCohort } from "@/lib/levytate/finance/levy-planner";

const base:PlannerInputs={
  openingMonth:"2026-08",openingPence:70_972_600,openingFunds:[],horizon:12,
  monthlyReceiptsPence:9_571_700,monthlyExistingPence:7_333_767,
  existingMonths:24,existingShortfallRate:5,monthlyTransferPence:0,transferMonths:0,cohorts:[]
};
const testCohort:PlannedCohort={
  id:"test-23",name:"Test starts",standardId:"ST1490",standardTitle:"Synthetic acceptance standard record",
  level:4,startMonth:"2027-03",learners:23,pricePence:1_100_000,bandPence:1_100_000,
  durationMonths:12,assessmentMonths:3,ageAtStart:25,exception:"none",route:"levy",fundingChecked:false,department:"Operations",
};

describe("readable, honest finance comparison UI",()=>{
  it("defaults to employer cash and explains identical levy lines when eligibility is unconfirmed",()=>{
    const baseline=forecastLevy(base,false);
    const planned=forecastLevy({...base,cohorts:[testCohort]});
    const html=renderToStaticMarkup(createElement(FinanceForecastComparison,{baseline,planned,horizon:12,unknownOpeningPence:base.openingPence}));
    expect(html).toContain("finance-forecast-chart-cash");
    expect(html).toContain("Compare the financial impact");
    expect(html).toContain("Forecast chart view");
    expect(html).toContain("Your levy-balance scenarios overlap");
    expect(html).toContain("Existing commitments only");
    expect(html).toContain("With proposed starts");
    expect(html).toContain("Explore forecast month");
    expect(html).toContain("Cash");
    expect(html).toContain("Unknown");
    const cashButton=html.match(/<button[^>]*aria-pressed="true"[^>]*>Employer cash<\/button>/);
    expect(cashButton).not.toBeNull();
  });
  it("defaults to the levy chart when explicitly confirmed funding changes the levy balance",()=>{
    const confirmed={...testCohort,standardId:"ST0118",standardTitle:"Data analyst",fundingChecked:true};
    const baseline=forecastLevy(base,false);
    const planned=forecastLevy({...base,cohorts:[confirmed]});
    const html=renderToStaticMarkup(createElement(FinanceForecastComparison,{baseline,planned,horizon:12,unknownOpeningPence:0}));
    expect(html).toContain("finance-forecast-chart-levy");
    expect(html).toContain("Levy balance");
    expect(html).not.toContain("Your levy-balance scenarios overlap");
  });
});
