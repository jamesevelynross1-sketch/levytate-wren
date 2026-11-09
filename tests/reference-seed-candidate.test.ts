import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildReferenceSeedCandidate } from "@/lib/levytate/reference-seed-candidate";
const source = readFileSync("lib/levytate/data/mvp/apprenticeship-standards.generated.json", "utf8");
const providers = readFileSync("data/provider-programme-verification-2026-08.json", "utf8");
describe("offline reference approval artifact", () => {
  it("quarantines three malformed rows and one unknown level while preserving historic statuses/dates", () => {
    const result = buildReferenceSeedCandidate(source, providers);
    expect(result.counts).toMatchObject({ standards: 937, providers: 12, programmes: 151, excluded: 4 });
    expect(result.executionAuthorised).toBe(false);
    expect(result.sources.map((item) => item.recordedDate)).toEqual(["2026-07-02", "2026-08-26"]);
    expect(result.standards.some((row) => row.sourceStatus === "Withdrawn")).toBe(true);
    expect(buildReferenceSeedCandidate(source, providers)).toEqual(result);
    expect(createHash("sha256").update(`${JSON.stringify(result, null, 2)}\n`).digest("hex")).toBe("cb92a93ba5dfdd91347efac6faac2ff1445ea2a9f24c67614c8e379f42dbdb8c");
  });
  for (const change of ["duplicate", "badStatus", "fakeDate", "unsafeUrl", "differentStandardUrl", "invalidFunding"] as const) {
    it(`rejects ${change} instead of inventing valid reference evidence`, () => {
      const fixture = JSON.parse(source);
      if (change === "duplicate") fixture.standards.push(fixture.standards[0]);
      if (change === "badStatus") fixture.standards[0].sourceStatus = "Assumed approved";
      if (change === "fakeDate") fixture.standards[0].lastVerified = "2026-11-09";
      if (change === "unsafeUrl") fixture.standards[0].officialUrl = "https://skillsengland.education.gov.uk.example.test/apprenticeships/st1361";
      if (change === "differentStandardUrl") fixture.standards[0].officialUrl = "https://skillsengland.education.gov.uk/apprenticeships/st0001";
      if (change === "invalidFunding") fixture.standards[0].fundingBand = -1;
      expect(() => buildReferenceSeedCandidate(JSON.stringify(fixture), providers)).toThrow();
    });
  }
  for (const change of ["unknownProvider", "wrongStandard", "missingSource", "duplicateProgramme"] as const) {
    it(`rejects ${change} in provider/programme input`, () => {
      const fixture = JSON.parse(providers);
      if (change === "unknownProvider") fixture.programmes[0].providerId = "missing";
      if (change === "wrongStandard") fixture.programmes[0].standardVersion = "unverified";
      if (change === "missingSource") fixture.programmes[0].sourceUrls = [];
      if (change === "duplicateProgramme") fixture.programmes.push(fixture.programmes[0]);
      expect(() => buildReferenceSeedCandidate(source, JSON.stringify(fixture))).toThrow();
    });
  }
});
