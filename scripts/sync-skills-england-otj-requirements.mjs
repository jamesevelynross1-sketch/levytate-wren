#!/usr/bin/env node

/**
 * Refresh version-specific off-the-job minimum-hours references from the
 * official Skills England standard pages. Dry-run is the default. Pass
 * --apply only after reviewing output and with the approved Supabase target.
 */

const sources = [
  { standardId: "ST1512", version: "2.1", effectiveFrom: "2025-08-01", url: "https://skillsengland.education.gov.uk/apprenticeships/st1512-v2-1" },
  { standardId: "ST0118", version: "1.1", effectiveFrom: "2025-08-01", url: "https://skillsengland.education.gov.uk/apprenticeship-standards/st0118-v1-1" },
];

const apply = process.argv.includes("--apply");
const catalogueResponse = await fetch("https://skillsengland.education.gov.uk/apprenticeships/", { headers: { "User-Agent": "LevyTate official-source synchroniser/1.0" }, signal: AbortSignal.timeout(30_000) });
const catalogue = catalogueResponse.ok ? await catalogueResponse.text() : "";
const results = [];
for (const source of sources) {
  const response = await fetch(source.url, { headers: { "User-Agent": "LevyTate official-source synchroniser/1.0" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    results.push({ ...source, status: "unavailable", minimumMinutes: null, sourceUpdatedAt: null });
    continue;
  }
  const text = htmlToText(await response.text());
  const detailHours = firstNumber(text, [
    /minimum\s+hours\s+for\s+compliance\s*[:\-]?\s*(\d{2,4})/i,
    /minimum\s+hours\s+off[- ]the[- ]job\s+training\s*[:\-]?\s*(\d{2,4})/i,
    /off[- ]the[- ]job\s+training[^.]{0,120}?minimum[^.]{0,80}?(\d{2,4})\s+hours/i,
  ]);
  const catalogueRecord = catalogueStandard(catalogue, source.standardId);
  const catalogueHours = numberProperty(catalogueRecord, /minimum.*hours|hours.*compliance|off.*job.*hours/i);
  const minimumHours = detailHours ?? catalogueHours;
  const updated = text.match(/(?:last updated|date updated)\s*[:\-]?\s*(\d{1,2}(?:\/\d{1,2}\/|\s+[a-z]+\s+)\d{4})/i)?.[1] ?? null;
  results.push({ ...source, status: minimumHours ? "verified" : "needs_review", minimumMinutes: minimumHours ? minimumHours * 60 : null, sourceUpdatedAt: updated ? isoDate(updated) : null });
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", results }, null, 2));
if (!apply) process.exit(0);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRole) throw new Error("Approved Supabase URL and service-role environment are required for --apply.");
for (const result of results) {
  if (result.status !== "verified" || !result.minimumMinutes) continue;
  const response = await fetch(`${supabaseUrl}/rest/v1/levytate_standard_otj_requirements?on_conflict=standard_id,standard_version,policy_effective_from`, {
    method: "POST",
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ standard_id: result.standardId, standard_version: result.version, policy_effective_from: result.effectiveFrom, minimum_minutes: result.minimumMinutes, source_url: result.url, source_updated_at: result.sourceUpdatedAt, source_status: result.status, source_metadata: { synchroniser: "skills-england-standard-page-v1" } }]),
  });
  if (!response.ok) throw new Error(`Official-source synchronisation failed for ${result.standardId} ${result.version} (${response.status}).`);
}

function htmlToText(html) { return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " "); }
function firstNumber(text, patterns) { for (const pattern of patterns) { const value = Number(text.match(pattern)?.[1]); if (Number.isFinite(value) && value > 0) return value; } return null; }
function catalogueStandard(html, standardId) { for (const match of html.matchAll(/data-standard="([\s\S]*?)"/g)) { try { const item = JSON.parse(decodeHtml(match[1])); if (String(item.referenceNumber ?? "").toUpperCase() === standardId.toUpperCase()) return item; } catch {} } return null; }
function numberProperty(item, pattern) { if (!item || typeof item !== "object") return null; for (const [key, value] of Object.entries(item)) { if (pattern.test(key) && Number.isFinite(Number(value)) && Number(value) > 0) return Number(value); } return null; }
function decodeHtml(value) { return value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }
function isoDate(value) { const numeric = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`; const parsed = new Date(`${value} UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10); }
