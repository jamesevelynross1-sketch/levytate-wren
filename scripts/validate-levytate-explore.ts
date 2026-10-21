import assert from "node:assert/strict";
import { createExploreCatalogue, searchExploreCatalogue } from "../lib/levytate/explore/catalogue";
import { normaliseExploreSource } from "../lib/levytate/explore/source-evidence";
import type { ApprenticeshipStandard } from "../lib/levytate/domain/types";

function record(code: string, status: string, type = "Apprenticeship standard"): ApprenticeshipStandard {
  return {
    id: code, referenceCode: code, title: code === "ST0118" ? "Data analyst" : "A test standard",
    level: 4, occupationalRoute: "Digital", fundingBand: 10000, typicalDuration: "24",
    status: status === "Approved for delivery" ? "Live" : "Defunded",
    sourceStatus: status, programmeType: type, version: "1.0",
    officialUrl: "https://skillsengland.education.gov.uk/apprenticeships/" + code.toLowerCase(),
    lastVerified: "2026-07-02", lastSyncedAt: "2026-07-02", jobTitles: [],
  };
}

const input = [
  record("ST0118", "Approved for delivery"),
  record("ST0118", "Approved for delivery"),
  record("ST0117", "Withdrawn"),
  record("ST0384", "Approved for delivery - paused"),
  record("AU0010", "Approved for delivery", "Apprenticeship unit"),
];
const catalogue = createExploreCatalogue(input);
assert.deepEqual(catalogue.map(x => x.code), ["ST1512", "ST0118"]);
assert.equal(catalogue.find(x => x.code === "ST0118")?.duration, "24 months");
assert.equal(catalogue.find(x => x.code === "ST0118")?.story?.outcomes.length, 3);
assert.equal(catalogue.find(x => x.code === "ST1512")?.version, "2.1");
assert.equal(searchExploreCatalogue(catalogue, "data analyst").length, 1);
assert.equal(searchExploreCatalogue(catalogue, "", "ai").some(x => x.code === "ST1512"), true);
assert.equal(searchExploreCatalogue(catalogue, "", undefined, 3).length, 0);
assert.equal(catalogue.some(x => x.code === "AU0010" || x.code === "ST0117"), false);
assert.equal(searchExploreCatalogue(catalogue, "data analyst", "people").length, 0);
assert.equal(catalogue.find(x => x.code === "ST0118")?.sourceVerified, "2026-07-02");
const officialRecord = {
  results: [
    {
      stdCode: "OCC0123",
      name: "An occupational title that need not match the apprenticeship title",
      statusName: "Approved for delivery",
      summary: "<p>Employees support meaningful workplace improvements by understanding processes and practical data needs across many departments and organisations.</p>",
      products: [{ productCode: "ST0999", versionNo: "1.0" }],
      duties: [
        { dutyDetail: "Understand the context of work" },
        { dutyDetail: "Work with stakeholders" },
        { dutyDetail: "Document relevant outcomes" },
      ],
    },
  ],
};
assert.equal(normaliseExploreSource("ST0118", officialRecord), null, "Must reject title-only and unrelated product matches");
officialRecord.results[0].products[0].productCode = "ST0118";
const evidence = normaliseExploreSource("ST0118", officialRecord);
assert.equal(evidence?.occupationCode, "OCC0123", "Must map ST apprenticeship to linked OCC record");
assert.equal(evidence?.duties.length, 3);
assert.ok(evidence?.summary.includes("workplace improvements"));
console.log("Explore catalogue and official-source validation passed.");
