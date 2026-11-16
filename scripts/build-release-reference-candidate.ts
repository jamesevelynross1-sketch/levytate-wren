// Offline only; output is a review artifact, never executable SQL.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { buildReferenceSeedCandidate } from "../lib/levytate/reference-seed-candidate";

async function main() {
const output = process.argv[2];
if (!output || process.argv.length !== 3) throw new Error("Provide one new output JSON path; no database or environment options are accepted");
const [standards, providers] = await Promise.all([
  readFile(resolve("lib/levytate/data/mvp/apprenticeship-standards.generated.json"), "utf8"),
  readFile(resolve("data/provider-programme-verification-2026-08.json"), "utf8"),
]);
const candidate = buildReferenceSeedCandidate(standards, providers), bytes = `${JSON.stringify(candidate, null, 2)}\n`;
await writeFile(resolve(output), bytes, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ sha256: createHash("sha256").update(bytes).digest("hex"), counts: candidate.counts, sources: candidate.sources, executionAuthorised: false }));
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Reference artifact preparation failed"); process.exitCode = 1; });
