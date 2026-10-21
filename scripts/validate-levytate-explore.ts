import assert from "node:assert/strict";
import { createExploreCatalogue, searchExploreCatalogue } from "../lib/levytate/explore/catalogue";
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
console.log("Explore catalogue validation passed: approved-only, deduplicated, source-aware, searchable.");
