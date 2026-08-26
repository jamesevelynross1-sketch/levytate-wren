import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifiedAt = "2026-08-26";
const standards = JSON.parse(fs.readFileSync(path.join(root, "lib/levytate/data/mvp/apprenticeship-standards.generated.json"), "utf8")).standards;
const standardById = new Map(standards.filter((standard) => standard.id).map((standard) => [standard.id, standard]));

const providers = {
  "provider-primary-goal": { name: "Primary Goal", key: "primary-goal", catalogue: "https://primarygoal.ac.uk/courses", deliveryModels: ["Online", "Blended"], regions: ["England"] },
  "provider-qa": { name: "QA", key: "qa", catalogue: "https://www.qa.com/apprenticeships/apprenticeships-for-employers/", deliveryModels: ["Online", "Blended"], regions: ["England"] },
  "provider-baltic": { name: "Baltic Apprenticeships", key: "baltic", catalogue: "https://www.balticapprenticeships.com/programmes/", deliveryModels: ["Online", "Blended"], regions: ["England"] },
  "provider-apprentify": { name: "Apprentify", key: "apprentify", catalogue: "https://www.apprentify.com/courses/", deliveryModels: ["Online"], regions: ["England"] },
  "provider-learning-curve-group": { name: "Learning Curve Group", key: "learning-curve", catalogue: "https://www.learningcurvegroup.co.uk/employers/staff-training/apprenticeships/apprenticeship-programmes/", deliveryModels: ["Blended", "Workplace learning"], regions: ["England"] },
  "provider-aicore": { name: "AiCore", key: "aicore", catalogue: "https://theaicore.com/employers", deliveryModels: ["Online"], regions: [] },
  "provider-rhg-consult": { name: "RHG Consult", key: "rhg", catalogue: "https://www.rhgconsult.co.uk/apprenticeships/", deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"] },
  "provider-the-marketing-trainer": { name: "The Marketing Trainer", key: "marketing-trainer", catalogue: "https://www.themarketingtrainer.co.uk/cim-apprenticeships", deliveryModels: ["Online"], regions: ["England"] },
  "provider-hbtc": { name: "HBTC", key: "hbtc", catalogue: "https://www.hbtc.co.uk/product-category/training-provider/", deliveryModels: ["Blended", "Workplace learning"], regions: ["Yorkshire and the Humber"] },
  "provider-staffordshire-university": { name: "Staffordshire University Apprenticeships", key: "staffs", catalogue: "https://www.staffs.ac.uk/apprenticeships/courses", deliveryModels: ["Blended", "University delivery"], regions: ["England"] },
  "provider-learning-skills-partnership": { name: "Learning Skills Partnership", key: "lsp", catalogue: "https://www.learningskillspartnership.com/apprenticeships-available", deliveryModels: ["Blended", "Workplace learning"], regions: ["England"] },
  "provider-srscc": { name: "SRSCC", key: "srscc", catalogue: "https://www.srscc.co.uk/apprenticeships/", deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"] },
};

const currentIds = new Map([
  ["provider-qa|Business Analyst", "programme-qa-business-analyst"],
  ["provider-qa|Data Analyst", "programme-qa-data-analyst"],
  ["provider-baltic|AI Enablement", "programme-baltic-ai-enablement"],
  ["provider-baltic|Data & Business Insights", "programme-baltic-data-business-insights"],
  ["provider-baltic|Multi-Channel Marketer", "programme-baltic-multi-channel-marketer"],
  ["provider-apprentify|AI Leadership", "programme-apprentify-ai-leadership"],
  ["provider-apprentify|AI Activator", "programme-apprentify-ai-activator"],
  ["provider-apprentify|AI & Automation Practitioner", "programme-apprentify-ai-automation-practitioner"],
  ["provider-apprentify|Business Analyst", "programme-apprentify-business-analyst"],
  ["provider-apprentify|Data Technician", "programme-apprentify-data-technician"],
  ["provider-apprentify|Data Analyst", "programme-apprentify-data-analyst"],
  ["provider-apprentify|Information Communications Technician", "programme-apprentify-digital-support-technician"],
  ["provider-apprentify|Network Engineer", "programme-apprentify-network-engineer"],
  ["provider-learning-curve-group|Associate Project Manager", "programme-learning-curve-project-manager"],
  ["provider-learning-curve-group|Business Administrator", "programme-learning-curve-business-admin"],
  ["provider-learning-curve-group|Customer Service Practitioner", "programme-learning-curve-customer-service-practitioner"],
  ["provider-learning-curve-group|Customer Service Specialist", "programme-learning-curve-customer-service-specialist"],
  ["provider-aicore|AI Upskilling for Business Teams", "programme-aicore-ai-upskilling"],
  ["provider-rhg-consult|Multi-Channel Marketer", "programme-rhg-multi-channel-marketer"],
  ["provider-rhg-consult|Safety, Health and Environment Technician", "programme-rhg-she-tech"],
  ["provider-rhg-consult|Bid and Proposal Co-ordinator", "programme-rhg-bid-proposal"],
  ["provider-rhg-consult|Corporate Responsibility and Sustainability Practitioner", "programme-rhg-corporate-responsibility"],
  ["provider-rhg-consult|Service Innovation Leader (Service Designer)", "programme-rhg-service-designer"],
  ["provider-the-marketing-trainer|Multi-Channel Marketer", "programme-marketing-trainer-multi-channel-marketer"],
  ["provider-hbtc|Business Administration", "programme-hbtc-business-admin"],
  ["provider-hbtc|Customer Service Practitioner", "programme-hbtc-customer-service-practitioner"],
  ["provider-hbtc|Multi-Channel Marketer", "programme-hbtc-multi-channel-marketer"],
  ["provider-hbtc|Digital Support Technician", "programme-hbtc-digital-support-technician"],
  ["provider-hbtc|Information Communications Technician", "programme-hbtc-information-communications-technician"],
  ["provider-hbtc|Teaching Assistant", "programme-hbtc-teaching-assistant"],
  ["provider-staffordshire-university|Digital & Technology Solutions Professional Degree Apprenticeship", "programme-staffs-dtsp"],
  ["provider-staffordshire-university|Project Manager Degree Apprenticeship", "programme-staffs-project-manager"],
  ["provider-staffordshire-university|Embedded Electronic Systems Design and Development Engineer Degree Apprenticeship", "programme-staffs-embedded-electronic-systems"],
  ["provider-staffordshire-university|Manufacturing Engineer Degree Apprenticeship", "programme-staffs-manufacturing-engineer"],
  ["provider-learning-skills-partnership|Customer Service and Sales", "programme-lsp-customer-service-sales"],
  ["provider-learning-skills-partnership|Business and Administration", "programme-lsp-business-administration"],
  ["provider-srscc|Procurement and Supply Assistant", "programme-srscc-procurement-supply-assistant"],
  ["provider-srscc|Supply Chain Practitioner", "programme-srscc-supply-chain-practitioner"],
  ["provider-srscc|Procurement and Supply Chain Practitioner", "programme-srscc-procurement-supply-chain-practitioner"],
  ["provider-srscc|Senior Procurement and Supply Chain Professional", "programme-srscc-senior-procurement-supply-chain-professional"],
]);

const rows = [];
function add(providerId, programmes) {
  for (const item of programmes) {
    const [providerProgrammeName, standardCode = "", options = {}] = item;
    rows.push({ providerId, providerProgrammeName, standardCode, ...options });
  }
}

add("provider-qa", [
  ["Digital and AI Support", "ST0120"], ["AI & Automation Specialist", "ST1512"], ["Databricks Engineer", "ST1386"],
  ["AI Engineer", "ST1398", { programmeUrl: "https://www.qa.com/apprenticeships/ai/ai-engineer-level-6/" }],
  ["NVIDIA AI Engineer", "ST1398", { programmeUrl: "https://www.qa.com/apprenticeships/ai/nvidia-ai-engineer-level-6/" }],
  ["AWS Cloud Support Specialist", "ST0973"], ["Cloud Network Specialist", "ST0973"], ["Microsoft Azure Cloud Support Specialist", "ST0973"],
  ["Data Essentials", "ST0795"], ["Data Analyst", "ST0118"], ["Data Engineer", "ST1386"],
  ["BSc (Hons) Digital Technology Solutions", "ST0119"], ["Multi-Channel Marketer", "ST1031"],
  ["Cyber Risk Analyst", "ST1021"], ["Cyber Defender & Responder", "ST1021"], ["Cyber Security Engineer", "ST1021"],
  ["DevOps Engineer", "ST0825"], ["Network Engineer", "ST0127"], ["Digital Product Manager", "ST0964"],
  ["Business Analyst", "ST0117", { programmeUrl: "https://www.qa.com/apprenticeships/product-apprenticeships/business-analyst-level-4/" }],
  ["BSc (Hons) Project Management", "ST0411"], ["Project Manager", "ST0310"], ["Junior Developer", "ST0128"], ["Software Engineer", "ST0116"],
]);

add("provider-baltic", [
  ["AI Enablement", "ST0120", { programmeUrl: "https://www.balticapprenticeships.com/programmes/ai-enablement/" }],
  ["Data & Business Insights", "ST0795", { programmeUrl: "https://www.balticapprenticeships.com/programmes/data-and-business-insights/" }],
  ["Microsoft IT Support Technician", "ST0973"], ["Multi-Channel Marketer", "ST1031"],
  ["AI & Digital Transformation", "ST0117"], ["AI for Business Automation", "ST1512"],
  ["Sustainability for Business Impact", "ST0934"], ["Data Analyst", "ST0118"],
  ["Infrastructure & Security Engineer", "ST0127"], ["Marketing Executive", "ST0596"],
  ["Software Developer", "ST0116"], ["Data Engineer", "ST1386"],
]);

add("provider-apprentify", [
  ["AI Leadership", "", { status: "Not available", recordStatus: "Archived", mappingVerification: "Needs manual review", notes: "The reviewed offer is an apprenticeship unit rather than a complete apprenticeship programme." }],
  ["AI Activator", "ST0120", { programmeUrl: "https://www.apprentify.com/course/ai-activator/" }],
  ["AI & Automation Practitioner", "ST1512"], ["Business Analyst", "ST0117"], ["Data Technician", "ST0795"],
  ["Data Analyst", "ST0118"], ["Cyber Security Technologist", "ST1021"],
  ["Information Communications Technician", "ST0973"],
  ["AI Catalyst", "ST0117", { programmeUrl: "https://www.apprentify.com/course/ai-catalyst/", status: "Needs verification", mappingVerification: "Probable", notes: "The provider confirms a Level 4 apprenticeship but does not identify the underlying standard on the reviewed page." }],
  ["Network Engineer", "ST0127"], ["Digital Learning Designer", "ST0974"], ["Fundraiser", "ST0887"],
  ["PR and Communications", "ST0311"], ["Multi-Channel Marketer", "ST1031"], ["Content Creator", "ST0105"],
]);

add("provider-learning-curve-group", [
  ["Associate Project Manager", "ST0310"], ["Business Administrator", "ST0070"],
  ["Customer Service Practitioner", "ST0072"], ["Customer Service Specialist", "ST0071"],
  ["Bricklayer", "ST0095"], ["Carpentry and Joinery", "ST0264"], ["Painter and Decorator", "ST0295"],
  ["Advanced and Creative Hair Professional", "ST0214"], ["Advanced Beauty Therapist", "ST0211"],
  ["Barbering Professional", "ST1273"], ["Beauty Therapist", "ST0630"], ["Hairdressing Professional", "ST0213"],
  ["Nail Services Technician", "ST0635"], ["Wellbeing and Holistic Therapist", "ST0685"],
  ["Adult Care Worker", "ST0005"], ["Early Years Educator", "ST0135"], ["Lead Adult Care Worker", "ST0006"], ["Leader in Adult Care", "ST0008"],
  ["Housing and Property Management Assistant", "ST0235"], ["Housing and Property Management", "ST0234"], ["Senior Housing and Property Management", "ST0236"],
  ["Content Creator", "ST0105"], ["Data Analyst", "ST0118"], ["Data Technician", "ST0795"], ["Digital Support Technician", "ST0120"],
  ["Information Communications Technician", "ST0973"], ["Multi-Channel Marketer", "ST1031"],
  ["Large Goods Vehicle (LGV) Driver C + E", "ST0257"], ["Supply Chain Warehouse Operative", "ST0259"],
  ["Transport and Warehouse Operations Supervisor", "ST0647"], ["Urban Driver", "ST1025"],
]);

add("provider-primary-goal", [
  ["Information Communication Technician", "ST0973", { programmeUrl: "https://primarygoal.ac.uk/courses/information-communication-technician" }],
  ["Microsoft 365 Digital Skills", "ST0120", { programmeUrl: "https://primarygoal.ac.uk/courses/microsoft-365-digital-skills", status: "Needs verification", mappingVerification: "Probable", notes: "The provider confirms an apprenticeship but the reviewed page does not explicitly name the underlying standard." }],
  ["Microsoft 365 Education Digital Skills", "ST0120", { programmeUrl: "https://primarygoal.ac.uk/courses/microsoft-365-education-digital-skills" }],
]);

add("provider-aicore", [
  ["AI Upskilling for Business Teams", "", { status: "Needs verification", recordStatus: "Archived", mappingVerification: "Needs manual review", notes: "No current official apprenticeship programme or standard mapping was evidenced on the reviewed provider site; the page describes commercial AI training." }],
]);

add("provider-rhg-consult", [
  ["Service Innovation Leader (Service Designer)", "ST0894"], ["AI and Automation Practitioner", "ST1512"],
  ["Multi-Channel Marketer", "ST1031"], ["Business Analyst", "ST0117"], ["Business Administrator", "ST0070"],
  ["Corporate Responsibility and Sustainability Practitioner", "ST0934"], ["Bid and Proposal Co-ordinator", "ST0056"],
  ["Junior Management Consultant", "ST0273"], ["Safety, Health and Environment Technician", "ST0550"],
]);

add("provider-the-marketing-trainer", [
  ["Multi-Channel Marketer", "ST1031"], ["Market Research Executive", "ST0883"],
]);

add("provider-hbtc", [
  ["Customer Service Practitioner", "ST0072"], ["Customer Service Specialist", "ST0071"],
  ["Business Administration", "ST0070"], ["Digital Support Technician", "ST0120"],
  ["Information Communications Technician", "ST0973"], ["Multi-Channel Marketer", "ST1031"],
  ["Teaching Assistant", "ST0454"], ["Team Leader", "ST0384"],
]);

add("provider-staffordshire-university", [
  ["Chartered Manager Degree Apprenticeship", "ST0272"], ["Project Manager Degree Apprenticeship", "ST0411"], ["Senior Leader Apprenticeship", "ST0480"],
  ["Digital & Technology Solutions Professional Degree Apprenticeship", "ST0119"],
  ["Social Worker Degree Apprenticeship", "ST0510"], ["Specialist Teaching Assistant Apprenticeship", "ST1414"],
  ["Teacher Apprenticeship Postgraduate", "ST0490"], ["Teacher Degree Apprenticeship Undergraduate Secondary Mathematics", "ST1502"],
  ["Biomedical Scientist Degree Apprenticeship", "ST1314"], ["Midwife Degree Apprenticeship", "ST0948"], ["Nursing Associate Apprenticeship", "ST0827"],
  ["Operating Department Practitioner Degree Apprenticeship", "ST0582"],
  ["Operating Department Practitioner Degree Apprenticeship Progression Route", "ST0582"],
  ["Paramedic Degree Apprenticeship", "ST0567"], ["Paramedic Degree Apprenticeship Progression Route", "ST0567"],
  ["Registered Nurse Degree Apprenticeship", "ST0781"], ["Registered Nurse Degree Apprenticeship Progression Route", "ST0781"],
  ["Embedded Electronic Systems Design and Development Engineer Degree Apprenticeship", "ST0151"],
  ["Manufacturing Engineer Degree Apprenticeship", "ST0025"],
  ["Police Constable Degree Apprenticeship", "ST0304"], ["Serious and Complex Crime Investigator Degree Apprenticeship", "ST0512"],
]);

add("provider-learning-skills-partnership", [
  ["Customer Service and Sales", "", { status: "Not available", recordStatus: "Archived", mappingVerification: "Needs manual review", notes: "Historical umbrella record replaced by standard-specific provider programmes." }],
  ["Business and Administration", "", { status: "Not available", recordStatus: "Archived", mappingVerification: "Needs manual review", notes: "Historical umbrella record replaced by standard-specific provider programmes." }],
  ["Professional Accounting Technician", "ST0003"], ["Operations Manager", "ST0385"], ["Accounts or Finance Assistant", "ST0608"],
  ["Assistant Accountant", "ST0002"], ["Business Administrator", "ST0070"], ["Team Leader", "ST0384"], ["Trade Supplier", "ST0334"],
  ["Customer Service Practitioner", "ST0072"], ["Customer Service Specialist", "ST0071"],
  ["Construction Quantity Surveying Technician", "ST0049"], ["Civil Engineering Senior Technician", "ST0046"],
  ["Construction Site Supervisor", "ST0048"], ["Construction Design and Build Technician", "ST0043"],
  ["Civil Engineering Technician", "ST0091"], ["Construction Support Technician", "ST0960"],
  ["Digital Engineering Technician", "ST0266"], ["Surveying Technician", "ST0332"],
  ["Associate Project Manager", "ST0310"], ["Project Controls Technician", "ST0163"],
]);

add("provider-srscc", [
  ["Procurement and Supply Assistant", "ST0810"], ["Supply Chain Practitioner", "ST0201"],
  ["Procurement and Supply Chain Practitioner", "ST0313"], ["Senior Procurement and Supply Chain Professional", "ST0811"],
]);

function slug(value) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const programmes = rows.map((row) => {
  const provider = providers[row.providerId];
  if (!provider) throw new Error(`Unknown provider ${row.providerId}`);
  const standard = row.standardCode ? standardById.get(row.standardCode) : undefined;
  if (row.standardCode && !standard) throw new Error(`Unknown standard ${row.standardCode} for ${row.providerProgrammeName}`);

  const officialStatus = standard?.status;
  const status = row.status
    ?? (officialStatus === "Retired" || officialStatus === "Defunded" ? "Defunded / unavailable for new starts"
      : officialStatus === "Paused" ? "Paused"
        : standard ? "Active" : "Needs verification");
  const mappingVerification = row.mappingVerification ?? (standard ? "Verified" : "Needs manual review");
  const programmeUrl = row.programmeUrl ?? provider.catalogue;
  const recordStatus = row.recordStatus ?? "Active";
  const id = currentIds.get(`${row.providerId}|${row.providerProgrammeName}`)
    ?? `programme-${provider.key}-${slug(row.providerProgrammeName)}`;
  const programmeDescription = row.notes
    ?? (standard
      ? `${provider.name} lists ${row.providerProgrammeName} in its current apprenticeship catalogue; LevyTate maps it to the ${standard.title} standard.`
      : `${provider.name} lists ${row.providerProgrammeName}, but the reviewed official source does not establish a complete apprenticeship-standard mapping.`);

  return {
    id,
    providerId: row.providerId,
    providerName: provider.name,
    providerProgrammeName: row.providerProgrammeName,
    standardTitle: standard?.title ?? "",
    standardCode: standard?.referenceCode ?? "",
    standardLevel: standard?.level ?? null,
    standardVersion: standard?.version ?? "",
    standardStatus: officialStatus ?? "Unmapped",
    programmeUrl,
    providerCatalogueUrl: provider.catalogue,
    status,
    recordStatus,
    deliveryModels: row.deliveryModels ?? provider.deliveryModels,
    regions: row.regions ?? provider.regions,
    programmeDescription,
    sourceUrls: [...new Set([programmeUrl, provider.catalogue])],
    verifiedAt,
    verificationStatus: mappingVerification,
  };
});

const duplicateKeys = new Map();
for (const programme of programmes) {
  const key = `${programme.providerId}|${programme.providerProgrammeName.toLowerCase().replace(/\blevel\s*\d\b/g, "").replace(/[^a-z0-9]+/g, " ").trim()}|${programme.standardCode}`;
  const ids = duplicateKeys.get(key) ?? [];
  ids.push(programme.id);
  duplicateKeys.set(key, ids);
}
const suspectedDuplicates = [...duplicateKeys.entries()].filter(([, ids]) => ids.length > 1);
if (suspectedDuplicates.length) throw new Error(`Suspected duplicate provider programmes: ${JSON.stringify(suspectedDuplicates)}`);
if (new Set(programmes.map((programme) => programme.id)).size !== programmes.length) throw new Error("Duplicate provider programme IDs detected.");

const manifest = {
  metadata: {
    verifiedAt,
    providerCount: Object.keys(providers).length,
    programmeCount: programmes.length,
    activeProgrammeCount: programmes.filter((programme) => programme.status === "Active" && programme.recordStatus === "Active").length,
    officialStandardSource: "Skills England apprenticeship standards snapshot held in LevyTate",
    duplicateRule: "A duplicate has the same provider, normalised commercial programme name and official standard code. Distinct named delivery or progression variants against one standard remain separate records.",
  },
  providers: Object.entries(providers).map(([providerId, provider]) => ({ providerId, providerName: provider.name, providerCatalogueUrl: provider.catalogue })),
  programmes,
};

const output = path.join(root, "data/provider-programme-verification-2026-08.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output, ...manifest.metadata, suspectedDuplicates: suspectedDuplicates.length }, null, 2));
