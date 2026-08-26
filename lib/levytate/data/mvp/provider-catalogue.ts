import type { ProviderCatalogueRecord, ProviderProgramme } from "@/lib/levytate/domain";
import verificationManifest from "@/data/provider-programme-verification-2026-08.json";
import {
  emptyProgrammeCommercialProfile,
  emptyProviderCommercialProfile,
  normaliseProviderProgrammeTaxonomy,
  normaliseProviderRecordTaxonomy,
} from "@/lib/levytate/domain";
import { normaliseProviderProgramme, normaliseProviderRecord } from "@/lib/levytate/mvp/workspace";

type ProviderSeed = Omit<Partial<ProviderCatalogueRecord>, "commercialProfile"> & {
  providerId: string;
  providerName: string;
  description: string;
  positioningStatement: string;
  accreditations?: string[];
  employerSizesSupported?: string[];
};

type ProgrammeSeed = Omit<Partial<ProviderProgramme>, "commercialProfile"> & {
  id: string;
  providerId: string;
  programmeName: string;
  tagline?: string;
  idealAudience?: string;
  employerBenefits?: string[];
};

const verifiedDate = "2026-08-26";
const programmeTimestamp = "2026-08-26T00:00:00.000Z";
const allEmployerSizes = ["SME", "Mid-market", "Large enterprise"];

function provider(seed: ProviderSeed): ProviderCatalogueRecord {
  return normaliseProviderRecordTaxonomy(normaliseProviderRecord({
    providerType: "Independent training provider",
    sectors: [],
    industries: [],
    technologies: [],
    deliveryModels: [],
    regions: [],
    employerTypes: allEmployerSizes,
    specialisms: [],
    contactName: "",
    contactEmail: "",
    ofstedRating: "Requires verification",
    status: "Active",
    sourceUrls: [],
    notes: "",
    lastVerified: verifiedDate,
    verificationStatus: "verified",
    ...seed,
    commercialProfile: {
      ...emptyProviderCommercialProfile(),
      organisationDescription: seed.description,
      positioningStatement: seed.positioningStatement,
      accreditations: seed.accreditations ?? [],
      employerSizesSupported: seed.employerSizesSupported ?? allEmployerSizes,
    },
  }));
}

function programme(seed: ProgrammeSeed): ProviderProgramme {
  const linkedStandardIds = seed.linkedStandardIds ?? (seed.linkedStandardId ? [seed.linkedStandardId] : []);
  const sourceUrl = seed.sourceUrl ?? "";
  const expectedOutcomes = seed.expectedOutcomes ?? [];
  return normaliseProviderProgrammeTaxonomy(normaliseProviderProgramme({
    status: linkedStandardIds.length ? "Active" : "Needs verification",
    verificationStatus: linkedStandardIds.length ? "Verified from provider website" : "Needs manual verification",
    targetOrganisations: [],
    targetIndustries: [],
    targetJobRoles: [],
    seniority: "Mixed",
    employerSize: "Mixed employer base",
    businessProblemsSolved: [],
    skillsDeveloped: [],
    technologiesCovered: [],
    expectedOutcomes,
    deliveryModels: [],
    regions: [],
    duration: "",
    cohortOptions: [],
    commercialNotes: linkedStandardIds.length
      ? "Public provider page confirms programme availability."
      : "Programme naming is public, but linked standard or delivery detail still needs manual verification.",
    fundingRoute: "Potentially funded through levy/co-investment",
    sourceUrl,
    notes: linkedStandardIds.length ? "" : "Needs verification before LevyTate can treat this as a fully mapped apprenticeship route.",
    recordStatus: "Active",
    createdAt: programmeTimestamp,
    updatedAt: programmeTimestamp,
    ...seed,
    linkedStandardIds,
    commercialProfile: {
      ...emptyProgrammeCommercialProfile(),
      tagline: seed.tagline ?? seed.shortDescription ?? "",
      idealAudience: seed.idealAudience ?? "",
      employerBenefits: seed.employerBenefits ?? expectedOutcomes,
      locations: seed.regions ?? [],
      fundingOptions: [seed.fundingRoute ?? "Potentially funded through levy/co-investment"],
      futureCapabilityImpact: expectedOutcomes,
    },
  }));
}

const providerSeeds: ProviderCatalogueRecord[] = [
  provider({
    providerId: "provider-primary-goal",
    providerName: "Primary Goal",
    website: "https://primarygoal.ac.uk/",
    providerType: "Independent training provider",
    sectors: ["Digital & IT"],
    industries: ["Education", "Schools", "Colleges"],
    technologies: ["Digital skills"],
    specialisms: ["Digital apprenticeships"],
    description: "Primary Goal publishes digital apprenticeship programmes for employers and education settings, including Microsoft 365 and information communications pathways.",
    positioningStatement: "Digital apprenticeship provider focused on practical workplace and education technology capability.",
    notes: "Current official course catalogue verified on 2026-08-26; one commercially named pathway still needs an explicit standard confirmation.",
    sourceUrls: ["https://primarygoal.ac.uk/", "https://primarygoal.ac.uk/courses"],
    verificationStatus: "verified",
    lastVerified: verifiedDate,
  }),
  provider({
    providerId: "provider-qa",
    providerName: "QA",
    website: "https://www.qa.com/apprenticeships/",
    providerType: "National provider",
    sectors: ["Digital & IT", "Data & AI", "Project & Change"],
    industries: ["Technology", "Financial services", "Professional services", "Public sector"],
    technologies: ["AI", "Business analysis", "Cloud", "Cyber security", "Data", "DevOps", "Digital marketing", "IT support", "Software"],
    deliveryModels: ["Online", "Blended", "Workplace learning"],
    regions: ["England"],
    specialisms: ["Business analysis", "Data", "Digital transformation", "Technology apprenticeships"],
    description: "QA publishes a national apprenticeship portfolio across AI, data, business analysis, cloud, cyber, software and project delivery disciplines.",
    positioningStatement: "National digital apprenticeship provider with broad technology and change coverage.",
    accreditations: ["Ofsted Good"],
    sourceUrls: [
      "https://www.qa.com/apprenticeships/",
      "https://www.qa.com/apprenticeships/product-apprenticeships/business-analyst-level-4/",
      "https://www.qa.com/apprenticeships/data/data-analyst-level-4/"
    ],
  }),
  provider({
    providerId: "provider-baltic",
    providerName: "Baltic Apprenticeships",
    website: "https://www.balticapprenticeships.com/",
    providerType: "National provider",
    sectors: ["Digital & IT", "Data & AI", "Marketing"],
    industries: ["Technology", "Creative", "Professional services"],
    technologies: ["AI", "Data", "IT support", "Marketing", "Microsoft"],
    deliveryModels: ["Online", "Blended"],
    regions: ["England"],
    specialisms: ["AI enablement", "Digital apprenticeships", "Marketing", "Tech careers"],
    description: "Baltic Apprenticeships publishes branded digital and AI programmes including AI Enablement, Data & Business Insights and marketing pathways.",
    positioningStatement: "Digital-first apprenticeship specialist with a strong branded programme story.",
    accreditations: ["Ofsted Outstanding"],
    sourceUrls: [
      "https://www.balticapprenticeships.com/",
      "https://www.balticapprenticeships.com/programmes/ai-enablement/",
      "https://www.balticapprenticeships.com/programmes/data-and-business-insights/"
    ],
  }),
  provider({
    providerId: "provider-apprentify",
    providerName: "Apprentify",
    website: "https://www.apprentify.com/",
    providerType: "National provider",
    sectors: ["Digital & IT", "Data & AI"],
    industries: ["Technology", "Professional services", "Digital businesses"],
    technologies: ["AI", "Business analysis", "Cyber security", "Data", "Networking", "Software"],
    deliveryModels: ["Online", "Blended"],
    regions: ["England"],
    specialisms: ["AI programmes", "Data pathways", "Digital support", "Software delivery"],
    description: "Apprentify publishes a wide employer-facing portfolio across AI, business analysis, cyber, data, networking and software apprenticeships.",
    positioningStatement: "AI and digital apprenticeship provider with a broad programme catalogue for tech-enabled employers.",
    sourceUrls: ["https://www.apprentify.com/", "https://www.apprentify.com/courses/"],
  }),
  provider({
    providerId: "provider-learning-curve-group",
    providerName: "Learning Curve Group",
    website: "https://www.learningcurvegroup.co.uk/employers/staff-training/apprenticeships/apprenticeship-programmes/",
    providerType: "National provider",
    sectors: ["Business & Professional Services", "Construction", "Data & IT", "Health & Social Care", "Transport & Logistics"],
    industries: ["Business services", "Construction", "Housing", "Health & care", "Logistics"],
    technologies: ["Data", "Digital", "IT"],
    deliveryModels: ["Online", "Blended", "Workplace learning"],
    regions: ["England"],
    specialisms: ["Business administration", "Customer service", "Project delivery"],
    description: "Learning Curve Group publishes apprenticeship programme categories across business professions, construction, data and digital, housing and logistics.",
    positioningStatement: "National provider with a broad employer portfolio across operational and professional functions.",
    sourceUrls: ["https://www.learningcurvegroup.co.uk/employers/staff-training/apprenticeships/apprenticeship-programmes/"],
  }),
  provider({
    providerId: "provider-aicore",
    providerName: "AiCore",
    website: "https://theaicore.com/employers",
    providerType: "Specialist consultancy",
    sectors: ["Data & AI"],
    industries: ["Technology", "Professional services"],
    technologies: ["AI", "Data", "Machine learning"],
    deliveryModels: ["Bootcamp", "Corporate training", "Online"],
    regions: ["England"],
    specialisms: ["AI upskilling", "Data capability", "Workforce AI literacy"],
    description: "AiCore publicly positions itself around AI and data training for individuals and businesses, but apprenticeship-standard mappings were not evidenced on the reviewed public pages.",
    positioningStatement: "AI capability partner that needs apprenticeship-route verification before formal matching use.",
    notes: "No current apprenticeship offer was evidenced on the official site during the 2026-08-26 review. Retain for research continuity only.",
    sourceUrls: ["https://theaicore.com/employers"],
  }),
  provider({
    providerId: "provider-rhg-consult",
    providerName: "RHG Consult",
    website: "https://www.rhgconsult.co.uk/apprenticeships/",
    providerType: "Specialist consultancy",
    sectors: ["Marketing", "ESG & Sustainability", "Health & Safety", "Bid & Commercial"],
    industries: ["Professional services", "Bid management", "Sustainability"],
    technologies: ["Marketing", "Sustainability"],
    deliveryModels: ["Online", "Blended", "Workplace learning"],
    regions: ["England"],
    specialisms: ["Bid & proposal", "Corporate responsibility", "Marketing", "Safety"],
    description: "RHG Consult publishes specialist apprenticeship routes spanning marketing, health and safety, bid management, sustainability and service design.",
    positioningStatement: "Specialist provider for niche commercial, ESG and service innovation capability gaps.",
    sourceUrls: [
      "https://www.rhgconsult.co.uk/",
      "https://www.rhgconsult.co.uk/apprenticeships/"
    ],
  }),
  provider({
    providerId: "provider-the-marketing-trainer",
    providerName: "The Marketing Trainer",
    website: "https://themarketingtrainer.co.uk/",
    providerType: "Specialist consultancy",
    sectors: ["Marketing & Creative"],
    industries: ["Marketing", "Creative", "Professional services"],
    technologies: ["Digital marketing", "Content", "Social media"],
    deliveryModels: ["Online", "Blended"],
    regions: ["England"],
    specialisms: ["Marketing apprenticeships", "CIM-aligned development"],
    description: "The Marketing Trainer publishes apprenticeship routes built around marketing capability and embedded CIM professional development.",
    positioningStatement: "Marketing specialist with a focused employer offer around modern digital marketing capability.",
    accreditations: ["CIM embedded qualifications"],
    sourceUrls: [
      "https://www.themarketingtrainer.co.uk/",
      "https://www.themarketingtrainer.co.uk/cim-apprenticeships"
    ],
  }),
  provider({
    providerId: "provider-hbtc",
    providerName: "HBTC",
    website: "https://www.hbtc.co.uk/",
    providerType: "Regional provider",
    sectors: ["Business & Professional Services", "Customer Service", "Digital & IT", "Education"],
    industries: ["Business services", "Customer service", "Education"],
    technologies: ["Digital support", "IT"],
    deliveryModels: ["Workplace learning", "Blended"],
    regions: ["Yorkshire and the Humber"],
    specialisms: ["Business administration", "Customer service", "Digital support", "Teaching assistant"],
    description: "HBTC publishes apprenticeship routes across business administration, customer service, digital support, ICT and teaching assistant provision.",
    positioningStatement: "Regional apprenticeship provider covering customer-facing, admin and digital support roles.",
    sourceUrls: ["https://www.hbtc.co.uk/", "https://www.hbtc.co.uk/product-category/training-provider/"],
  }),
  provider({
    providerId: "provider-staffordshire-university",
    providerName: "Staffordshire University Apprenticeships",
    website: "https://www.staffs.ac.uk/apprenticeships",
    providerType: "University",
    sectors: ["Digital & IT", "Engineering", "Professional services", "Healthcare"],
    industries: ["Engineering", "Healthcare", "Public sector", "Technology"],
    technologies: ["Digital technology", "Electronics", "Manufacturing"],
    deliveryModels: ["Blended", "University delivery"],
    regions: ["England"],
    specialisms: ["Degree apprenticeships", "Engineering", "Digital technology", "Project delivery"],
    description: "Staffordshire University publishes degree apprenticeship routes across digital technology, engineering, healthcare and professional services.",
    positioningStatement: "University partner for degree-level digital, engineering and project apprenticeships.",
    sourceUrls: [
      "https://www.staffs.ac.uk/apprenticeships",
      "https://www.staffs.ac.uk/apprenticeships/courses"
    ],
  }),
  provider({
    providerId: "provider-learning-skills-partnership",
    providerName: "Learning Skills Partnership",
    website: "https://www.learningskillspartnership.com/apprenticeships-available",
    providerType: "Regional provider",
    sectors: ["Accounting", "Business & Professional Services", "Construction", "Customer Service", "Leadership"],
    industries: ["Business services", "Construction", "Customer service", "Engineering", "Finance"],
    deliveryModels: ["Online", "Blended", "Workplace learning"],
    regions: ["England"],
    specialisms: ["Accountancy", "Business administration", "Construction", "Customer service", "Leadership", "Project management"],
    description: "Learning Skills Partnership publishes standard-specific apprenticeships across accountancy, business, construction, customer service, leadership and project delivery.",
    positioningStatement: "Workplace apprenticeship provider spanning operational, commercial and built-environment roles.",
    notes: "Standard-specific programme pages and the current apprenticeship index were verified on 2026-08-26.",
    sourceUrls: [
      "https://www.learningskillspartnership.com/apprenticeships-available",
      "https://www.learningskillspartnership.com/accountancy",
      "https://www.learningskillspartnership.com/construction-apprenticeships",
      "https://www.learningskillspartnership.com/project-management"
    ],
  }),
  provider({
    providerId: "provider-srscc",
    providerName: "SRSCC",
    website: "https://www.srscc.co.uk/apprenticeships/",
    providerType: "Specialist consultancy",
    sectors: ["Procurement & Supply Chain"],
    industries: ["Procurement", "Supply chain", "Commercial"],
    technologies: ["Procurement", "Supply chain"],
    deliveryModels: ["Online", "Blended", "Workplace learning"],
    regions: ["England"],
    specialisms: ["Procurement apprenticeships", "Supply chain capability"],
    description: "SRSCC publicly positions procurement and supply chain apprenticeships as its core specialist offer.",
    positioningStatement: "Procurement and supply chain specialist for commercial capability development.",
    sourceUrls: ["https://www.srscc.co.uk/apprenticeships/"],
  }),
];

type VerifiedProgrammeManifestItem = {
  id: string;
  providerId: string;
  providerName: string;
  providerProgrammeName: string;
  standardCode: string;
  programmeUrl: string;
  providerCatalogueUrl: string;
  status: ProviderProgramme["status"];
  recordStatus: ProviderProgramme["recordStatus"];
  deliveryModels: string[];
  regions: string[];
  programmeDescription: string;
  sourceUrls: string[];
  verifiedAt: string;
  verificationStatus: "Verified" | "Probable" | "Needs manual review";
};

const verifiedProgrammeManifest = verificationManifest.programmes as VerifiedProgrammeManifestItem[];

const programmeSeeds: ProviderProgramme[] = verifiedProgrammeManifest.map((item) => programme({
  id: item.id,
  providerId: item.providerId,
  programmeName: item.providerProgrammeName,
  linkedStandardId: item.standardCode,
  shortDescription: item.programmeDescription,
  fullDescription: item.programmeDescription,
  tagline: item.programmeDescription,
  deliveryModels: item.deliveryModels,
  regions: item.regions,
  sourceUrl: item.programmeUrl || item.providerCatalogueUrl,
  status: item.status,
  recordStatus: item.recordStatus,
  verificationStatus: item.verificationStatus === "Verified"
    ? "Verified from provider website"
    : "Needs manual verification",
  notes: [
    `Verified on ${item.verifiedAt}.`,
    item.verificationStatus === "Verified" ? "" : `Mapping confidence: ${item.verificationStatus}.`,
    `Evidence: ${item.sourceUrls.join(" | ")}`,
  ].filter(Boolean).join(" "),
  updatedAt: `${item.verifiedAt}T00:00:00.000Z`,
}));

export const mvpProviderCatalogue = providerSeeds;
export const mvpProviderProgrammes = programmeSeeds;
