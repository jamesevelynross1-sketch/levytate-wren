import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
describe("Self-hosted LevyTate typeface",()=>{
  it("ships the pinned licensed variable font instead of relying on installed system fonts",()=>{
    const bytes=readFileSync(new URL("../public/fonts/levytate-inter-variable.woff2",import.meta.url));
    const digest=createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    expect(bytes.subarray(0,4).toString()).toBe("wOF2");
    expect(digest).toBe("5a8d3e72ad7ffb62af3b146e1b1f54ab5813a212");
    expect(readFileSync(new URL("../public/fonts/levytate-inter-LICENSE.txt",import.meta.url),"utf8")).toContain("SIL OPEN FONT LICENSE");
    const css=readFileSync(new URL("../app/levytate/design-system.css",import.meta.url),"utf8");
    expect(css).toContain('font-family: "LevyTate Inter"');
    expect(css).toContain('url("/fonts/levytate-inter-variable.woff2")');
    const planner=readFileSync(new URL("../components/levytate-mvp/LevyFundingPlanner.tsx",import.meta.url),"utf8");
    expect(planner).toContain('aria-label="Apprenticeship programme"');
  });
});
