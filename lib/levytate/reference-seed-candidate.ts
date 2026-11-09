/** Offline review artifact only. This module never imports application seeds,
 * reads credentials, connects to a database or changes verification dates. */
import { createHash } from "node:crypto";

type Row = Record<string, unknown>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Reference object required");
  return value as Row;
}
function records(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error("Reference record array required");
  return value.map(object);
}
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Recorded source date required");
  return value;
}
function https(value: unknown, official = false) {
  const parsed = new URL(text(value));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (official && (parsed.hostname !== "skillsengland.education.gov.uk" || !/^\/apprenticeships\/[a-z]{2}\d{4}(?:-|\/|$)/i.test(parsed.pathname)))) throw new Error("Valid source evidence URL required");
}
function unique(rows: Row[], key: string) {
  const ids = rows.map((row) => text(row[key]));
  if (ids.some((id, index) => !id || id !== rows[index][key]) || new Set(ids).size !== rows.length) throw new Error("Unique non-empty reference identifiers required");
}

export function buildReferenceSeedCandidate(standardsBytes: string, providersBytes: string) {
  const source = object(JSON.parse(standardsBytes)), providerSource = object(JSON.parse(providersBytes));
  const metadata = object(source.metadata), providerMetadata = object(providerSource.metadata);
  const standardsDate = date(metadata.snapshotDate), providersDate = date(providerMetadata.verifiedAt);
  const excluded: Array<{ sourceRecord: number; reason: string; recordSha256: string }> = [];
  const standards = records(source.standards).filter((row, index) => {
    const reason = !text(row.id) || !text(row.title)
      ? "Missing identifier or title; quarantined, never silently repaired"
      : row.sourceStatus === "Withdrawn" && row.level === 0
        ? "Withdrawn source has unknown level encoded as zero; resolve the missing evidence before import"
        : null;
    if (!reason) return true;
    excluded.push({ sourceRecord: index + 1, reason, recordSha256: hash(JSON.stringify(row)) }); return false;
  });
  unique(standards, "id");
  const statuses = new Set(["Approved for delivery", "Approved for delivery - paused", "In development", "Retired", "Withdrawn", "Proposal in development"]);
  const types = new Set(["Apprenticeship standard", "Apprenticeship unit", "Foundation apprenticeship"]);
  for (const row of standards) {
    if (!/^(ST|AU|FA)\d{4}$/.test(text(row.id)) || row.referenceCode !== row.id || !statuses.has(text(row.sourceStatus)) || !types.has(text(row.programmeType))
      || !Number.isInteger(row.level) || Number(row.level) < 2 || Number(row.level) > 8 || !text(row.version)
      || (row.fundingBand !== null && (!Number.isSafeInteger(row.fundingBand) || Number(row.fundingBand) < 0))) throw new Error("Invalid standard identity, status or numeric evidence");
    https(row.officialUrl, true); date(row.lastVerified);
    if (!new RegExp(`^/apprenticeships/${text(row.id).toLowerCase()}(?:-|/|$)`).test(new URL(text(row.officialUrl)).pathname.toLowerCase())) throw new Error("Official source URL must identify its standard");
    if (row.lastVerified !== standardsDate) throw new Error("Standard source date differs from the declared snapshot");
  }
  const providers = records(providerSource.providers), programmes = records(providerSource.programmes);
  if (!standards.length || !providers.length || !programmes.length) throw new Error("A populated reference candidate is required");
  unique(providers, "providerId"); unique(programmes, "id");
  for (const row of providers) { if (!text(row.providerName)) throw new Error("Provider name required"); https(row.providerCatalogueUrl); }
  const providerIds = new Set(providers.map((row) => row.providerId)), byStandard = new Map(standards.map((row) => [row.id, row]));
  for (const row of programmes) {
    if (!providerIds.has(row.providerId) || !text(row.providerProgrammeName) || date(row.verifiedAt) !== providersDate) throw new Error("Programme provider, name and recorded date required");
    if (!Array.isArray(row.sourceUrls) || !row.sourceUrls.length) throw new Error("Programme source evidence required");
    row.sourceUrls.forEach((url) => https(url));
    if (text(row.standardCode)) {
      const standard = byStandard.get(row.standardCode);
      if (!standard || standard.title !== row.standardTitle || standard.version !== row.standardVersion || standard.level !== row.standardLevel) throw new Error("Programme standard mapping does not match the recorded source");
    }
  }
  const byId = (key: string) => (a: Row, b: Row) => String(a[key]).localeCompare(String(b[key]), "en");
  return {
    formatVersion: 1, purpose: "Reference seed review candidate", executionAuthorised: false,
    currentSourceVerification: "NOT RUN; historical snapshots require refresh and accountable approval before import",
    importPolicy: "No automatic import, status promotion, destructive replacement or runtime fallback. Review existing database conflicts before any separately approved additive import.",
    sources: [
      { path: "lib/levytate/data/mvp/apprenticeship-standards.generated.json", sha256: hash(standardsBytes), recordedDate: standardsDate },
      { path: "data/provider-programme-verification-2026-08.json", sha256: hash(providersBytes), recordedDate: providersDate },
    ],
    counts: { standards: standards.length, providers: providers.length, programmes: programmes.length, excluded: excluded.length,
      historicallyApprovedRecords: standards.filter((row) => row.sourceStatus === "Approved for delivery").length,
      historicallyApprovedApprenticeshipStandards: standards.filter((row) => row.sourceStatus === "Approved for delivery" && row.programmeType === "Apprenticeship standard").length,
      programmesWithoutStandardMapping: programmes.filter((row) => !text(row.standardCode)).length },
    excluded, standards: standards.sort(byId("id")), providers: providers.sort(byId("providerId")), programmes: programmes.sort(byId("id")),
  };
}
