import { describe, expect, it } from "vitest";
import { marketplaceComparisonLimit,toggleMarketplaceComparison } from "@/lib/levytate/mvp/marketplace-comparison";

describe("Marketplace comparison shortlist",()=>{
  it("adds selections in the order selected and removes an existing choice",()=>{
    const list=toggleMarketplaceComparison(toggleMarketplaceComparison([],"a"),"b");
    expect(list).toEqual(["a","b"]);
    expect(toggleMarketplaceComparison(list,"a")).toEqual(["b"]);
  });
  it("never silently evicts a selected programme",()=>{
    const current=["a","b","c"];
    expect(marketplaceComparisonLimit).toBe(3);
    expect(toggleMarketplaceComparison(current,"d")).toBe(current);
    expect(toggleMarketplaceComparison(toggleMarketplaceComparison(current,"b"),"d")).toEqual(["a","c","d"]);
    expect(current).toEqual(["a","b","c"]);
  });
});
