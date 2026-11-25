import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEmptyMvpWorkspace } from "@/lib/levytate/mvp/workspace";
import { calculateLevyFinance } from "@/lib/levytate/finance/calculations";
vi.mock("@/components/levytate-mvp/MvpWorkspaceStore",()=>({useMvpWorkspace:()=>({data:createEmptyMvpWorkspace()})}));
vi.mock("@/components/levytate-mvp/LevyTateStandardsProvider",()=>({useLevyTateStandards:()=>({selectableStandards:[],loading:false})}));
import { LevyFundingPlanner } from "@/components/levytate-mvp/LevyFundingPlanner";
describe("Funding planner actual initial render",()=>{
  it("renders a usable planner with dated DAS evidence and explicit unknown-age warning",()=>{
    const summary=calculateLevyFinance({version:1,mode:"persistent",transactions:[],imports:[],manualBalancePence:70_000_000,manualBalanceConfirmedAt:"2026-08-31"});
    const markup=renderToStaticMarkup(createElement(LevyFundingPlanner,{summary,actuals:createElement("p",null,"Historical reporting retained")}));
    expect(markup).toContain("Plan your next investment");
    expect(markup).toContain("£700,000");
    expect(markup).toContain("opening funds have no confirmed age");
    expect(markup).toContain("Existing commitments only");
    expect(markup).toContain("Planned enrolments");
    expect(markup).toContain("Forecast inputs");
    expect(markup).toContain("Assumptions &amp; funding evidence");
    expect(markup).not.toContain("Funding planner views");
    expect(markup).not.toContain("NaN");
    expect(markup).toContain("Historical reporting retained");
    expect(markup).toContain("historical-das-evidence");
    expect(markup).toContain("DAS history");
    expect(markup).toContain("Saved plans");
    expect(markup).toContain("stroke-dasharray=\"5 4\"");
  });
});
