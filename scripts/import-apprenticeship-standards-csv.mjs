import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const csvPathArg = process.argv[2];
const writeFallback = process.argv.includes("--write-fallback");
const importSupabase = process.argv.includes("--import-supabase");

if (!csvPathArg) {
  throw new Error("Usage: node scripts/import-apprenticeship-standards-csv.mjs <csv-path> [--write-fallback] [--import-supabase]");
}

const fallbackOutputPath = path.join(cwd, "lib", "levytate", "data", "mvp", "apprenticeship-standards.generated.json");
const existingCataloguePath = fallbackOutputPath;
const csvPath = path.resolve(cwd, csvPathArg);

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells.map((value) => value.trim());
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseEnv(value) {
  const cleaned = String(value ?? "").trim().replace(/^["'']|["'']$/g, "");
  if (!cleaned || cleaned === "\"\"" || cleaned === "''") return "";
  return cleaned;
}

function normaliseSupabaseUrl(value) {
  return normaliseEnv(value)
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/$/, "");
}

function parseNumber(value) {
  const cleaned = normaliseText(value).replace(/,/g, "");
  if (!cleaned || cleaned.toUpperCase() === "TBC") return null;
  const numeric = Number.parseInt(cleaned, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseDate(value, fallback = "") {
  const cleaned = normaliseText(value);
  if (!cleaned) return fallback;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

function splitJobTitles(value) {
  return normaliseText(value).split(";").map((item) => item.trim()).filter(Boolean);
}

function officialUrl(referenceCode) {
  return `https://skillsengland.education.gov.uk/apprenticeships/${referenceCode.toLowerCase()}`;
}

function sourceStatusLabel(value) {
  switch (normaliseText(value)) {
    case "ApprovedForDelivery":
      return "Approved for delivery";
    case "ApprovedForDelivery-Paused":
      return "Approved for delivery - paused";
    case "Withdrawn":
      return "Withdrawn";
    case "Retired":
      return "Retired";
    case "ProposalInDevelopment":
      return "Proposal in development";
    case "InDevelopment":
      return "In development";
    default:
      return normaliseText(value);
  }
}

function domainStatus(sourceStatus) {
  switch (normaliseText(sourceStatus).toLowerCase()) {
    case "approved for delivery":
      return "Live";
    case "approved for delivery - paused":
      return "Paused";
    case "withdrawn":
      return "Defunded";
    case "retired":
      return "Retired";
    case "proposal in development":
      return "Proposed";
    case "in development":
      return "In development";
    default:
      return "Live";
  }
}

const csvText = await fs.readFile(csvPath, "utf8");
const rawLines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
if (rawLines.length < 2) {
  throw new Error("CSV does not contain a title row and header row.");
}

const headers = parseCsvLine(rawLines[1]);
const rows = rawLines.slice(2).map((line) => {
  const values = parseCsvLine(line);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
});

const existingCatalogue = JSON.parse(await fs.readFile(existingCataloguePath, "utf8"));
const existingByReference = new Map(existingCatalogue.standards.map((record) => [record.referenceCode, record]));
const today = new Date().toISOString().slice(0, 10);

const importedRows = rows.map((row) => {
  const referenceCode = normaliseText(row.Reference);
  const enrichment = existingByReference.get(referenceCode) ?? {};
  const programmeType = normaliseText(row["Programme Type"]) || normaliseText(enrichment.programmeType) || "Apprenticeship standard";
  const rawStatus = normaliseText(row.Status)
    || sourceStatusLabel(enrichment.sourceStatus)
    || (programmeType === "Apprenticeship standard" ? "Approved for delivery" : "Approved for delivery");
  const lastUpdated = parseDate(row["Last Updated"], parseDate(enrichment.lastUpdated, parseDate(enrichment.lastVerified, today)));

  return {
    id: referenceCode,
    title: normaliseText(row.Name),
    reference_code: referenceCode,
    version: normaliseText(row["Version Number"]) || normaliseText(enrichment.version) || "Current",
    status: rawStatus,
    route: normaliseText(row.Route) || normaliseText(enrichment.occupationalRoute),
    level: (parseNumber(row.Level) ?? Number.parseInt(String(enrichment.level ?? 0), 10) ?? 0),
    funding_band: parseNumber(row["Maximum Funding (£)"]) ?? enrichment.fundingBand ?? null,
    typical_duration: normaliseText(row["Typical Duration"]) || normaliseText(enrichment.typicalDuration) || "Duration to confirm",
    official_url: normaliseText(row.Link) || normaliseText(enrichment.officialUrl) || officialUrl(referenceCode),
    last_updated: lastUpdated,
    job_titles: splitJobTitles(row["Job Titles"] || enrichment.jobTitles?.join(";")),
    overview: normaliseText(row["Overview of role"]) || normaliseText(enrichment.overview),
    programme_type: programmeType,
    integrated_degree: normaliseText(row["Integrated Degree"]),
    professional_recognition: normaliseText(row["Professional recognition"]),
  };
});

const counts = {
  totalRecords: importedRows.length,
  apprenticeshipStandards: importedRows.filter((row) => row.programme_type === "Apprenticeship standard").length,
  approvedForDelivery: importedRows.filter((row) => row.programme_type === "Apprenticeship standard" && row.status === "Approved for delivery").length,
};

const validations = ["Network Engineer", "Digital Support Technician", "Data Technician", "Procurement", "Business Analyst", "Engineering"]
  .map((term) => ({
    term,
    found: importedRows.some((row) => `${row.title} ${row.job_titles.join(" ")} ${row.route}`.toLowerCase().includes(term.toLowerCase())),
  }));

if (writeFallback) {
  const payload = {
    metadata: {
      sourceName: "Skills England apprenticeship CSV",
      sourceUrl: path.basename(csvPath),
      snapshotDate: today,
      importVersion: 3,
      totalStandards: counts.apprenticeshipStandards,
      activeStandards: counts.approvedForDelivery,
      totalRecords: counts.totalRecords,
      approvedForDelivery: counts.approvedForDelivery,
    },
    standards: importedRows.map((row) => ({
      id: row.id,
      title: row.title,
      referenceCode: row.reference_code,
      level: row.level,
      occupationalRoute: row.route || "Unknown",
      fundingBand: row.funding_band,
      typicalDuration: row.typical_duration,
      status: domainStatus(row.status),
      officialUrl: row.official_url,
      version: row.version,
      lastVerified: row.last_updated || today,
      programmeType: row.programme_type,
      sourceStatus: row.status,
      integratedDegree: row.integrated_degree,
      professionalRecognition: row.professional_recognition,
      lastUpdated: row.last_updated || today,
      jobTitles: row.job_titles,
      overview: row.overview,
    })),
  };

  await fs.writeFile(fallbackOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

let importedCount = 0;
if (importSupabase) {
  const url = normaliseSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = normaliseEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const chunkSize = 200;
  for (let index = 0; index < importedRows.length; index += chunkSize) {
    const chunk = importedRows.slice(index, index + chunkSize);
    const response = await fetch(`${url}/rest/v1/levytate_apprenticeship_standards?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase import failed at row ${index + 1}: ${response.status} ${detail}`);
    }

    importedCount += chunk.length;
  }
}

console.log(JSON.stringify({
  counts,
  importedCount,
  validations,
  fallbackWritten: writeFallback,
  supabaseImported: importSupabase,
}, null, 2));

