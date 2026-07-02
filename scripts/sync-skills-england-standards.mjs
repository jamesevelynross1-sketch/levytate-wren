import fs from "node:fs/promises";
import path from "node:path";

const sourceUrl = "https://skillsengland.education.gov.uk/apprenticeships/";
const cwd = process.cwd();
const argPath = process.argv[2];
const outputPath = path.join(cwd, "lib", "levytate", "data", "mvp", "apprenticeship-standards.generated.json");

const decoder = new Map([
  ["&quot;", '"'],
  ["&amp;", "&"],
  ["&pound;", "£"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&#x2013;", "–"],
  ["&#x2014;", "—"],
  ["&#x2019;", "’"],
  ["&#x2018;", "‘"],
  ["&#x2026;", "…"],
  ["&#x27;", "'"],
]);

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;/gi, (entity) => decoder.get(entity) ?? entity);
}

function stripTags(value) {
  return decodeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function toStatus(sourceStatus) {
  switch (sourceStatus) {
    case "ApprovedForDelivery":
      return "Live";
    case "ApprovedForDelivery-Paused":
      return "Paused";
    case "Withdrawn":
      return "Defunded";
    case "Retired":
      return "Retired";
    case "ProposalInDevelopment":
      return "Proposed";
    case "InDevelopment":
      return "In development";
    default:
      return "Retired";
  }
}

function toOfficialUrl(referenceCode, href) {
  if (href?.startsWith("http")) return href;
  if (!referenceCode) return sourceUrl;
  if (href?.startsWith("/")) {
    return new URL(href, sourceUrl).toString();
  }
  return new URL(`/apprenticeships/${referenceCode.toLowerCase()}`, sourceUrl).toString();
}

function readValue(block, pattern) {
  const match = block.match(pattern);
  return match ? stripTags(match[1]) : "";
}

async function loadHtml() {
  if (argPath) {
    return fs.readFile(path.resolve(cwd, argPath), "utf8");
  }
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Skills England source: ${response.status}`);
  }
  return response.text();
}

const html = await loadHtml();
const cardPattern = /<div class="standard[\s\S]*?data-standard="([\s\S]*?)">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<\/div>/g;
const records = [];

for (const match of html.matchAll(cardPattern)) {
  const jsonPayload = decodeHtml(match[1]).replace(/\r|\n/g, "");
  let data;
  try {
    data = JSON.parse(jsonPayload);
  } catch {
    continue;
  }
  if (data.type !== "ApprenticeshipStandard") continue;

  const block = match[3];
  const title = readValue(block, /<h2 class="details__heading[^"]*">([\s\S]*?)<\/h2>/i);
  const levelText = readValue(block, /<span title="Apprenticeship Level" class="level">([\s\S]*?)<\/span>/i);
  const duration = readValue(block, /<span title="Typical Duration" class="duration">([\s\S]*?)<\/span>/i) || "Duration to confirm";
  const fundingText = readValue(block, /<span title="Maximum Funding" class="funding">([\s\S]*?)<\/span>/i);
  const version = readValue(block, /<span class="details__version" title="Version">([\s\S]*?)<\/span>/i).replace(/^Version:\s*/i, "") || "Current";
  const fundingBandMatch = fundingText.replace(/,/g, "").match(/(\d+)/);
  const routes = Array.isArray(data.route) ? data.route.filter(Boolean) : [];

  records.push({
    id: data.referenceNumber,
    title,
    referenceCode: data.referenceNumber,
    level: Number.parseInt(String(data.level), 10) || 0,
    occupationalRoute: routes[0] ?? "Unknown",
    fundingBand: fundingBandMatch ? Number.parseInt(fundingBandMatch[1], 10) : null,
    typicalDuration: duration,
    status: toStatus(data.status),
    officialUrl: toOfficialUrl(data.referenceNumber, match[2]),
    version,
    lastVerified: new Date().toISOString().slice(0, 10),
    sourceStatus: data.status,
    approvedDate: data.approvedDate,
    keywords: Array.isArray(data.keywords) ? data.keywords.filter((item) => typeof item === "string") : [],
    jobRoles: Array.isArray(data.jobRoles) ? data.jobRoles.filter((item) => typeof item === "string") : [],
    sourceType: data.type,
  });
}

const unique = Array.from(new Map(records.map((record) => [record.id, record])).values())
  .sort((a, b) => a.title.localeCompare(b.title) || a.referenceCode.localeCompare(b.referenceCode));

const payload = {
  metadata: {
    sourceName: "Skills England apprenticeship finder",
    sourceUrl,
    snapshotDate: new Date().toISOString().slice(0, 10),
    importVersion: 2,
    totalStandards: unique.length,
    activeStandards: unique.filter((record) => record.status === "Live").length,
  },
  standards: unique,
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${unique.length} apprenticeship standards to ${path.relative(cwd, outputPath)}`);
