import type { ProviderCatalogueRecord, ProviderProgramme } from "./types";

export const providerTaxonomy = {
  sectors: [
    "Digital & AI",
    "Business & Professional Services",
    "Marketing & Creative",
    "Procurement & Supply Chain",
    "Engineering & Manufacturing",
    "Construction & Built Environment",
    "Health & Social Care",
    "Education & Learning",
    "Project & Change",
    "ESG & Sustainability",
    "Health & Safety",
    "Customer Service & Sales",
  ],
  technologies: [
    "AI",
    "Automation",
    "Business Analysis",
    "Cloud",
    "Cyber Security",
    "Data & Analytics",
    "Digital Marketing",
    "Digital Support",
    "IT Support",
    "Networking",
    "Software Development",
    "DevOps",
    "Microsoft",
    "Embedded Systems",
    "Electronics",
    "Manufacturing Systems",
    "Procurement Systems",
    "Sustainability",
  ],
  businessChallenges: [
    "AI adoption",
    "Business administration",
    "Business analysis",
    "Bid development",
    "Campaign delivery",
    "Customer experience",
    "Data reporting",
    "Digital transformation",
    "Engineering capability",
    "Health and safety compliance",
    "Process improvement",
    "Procurement capability",
    "Project delivery",
    "Service design",
    "Supply chain performance",
    "Sustainability and ESG",
    "Teaching support",
  ],
  deliveryModels: [
    "Online",
    "Blended",
    "Workplace learning",
    "University delivery",
    "Bootcamp",
    "Corporate training",
  ],
  regions: [
    "England",
    "Yorkshire and the Humber",
  ],
  employerTypes: [
    "SME",
    "Mid-market",
    "Large enterprise",
    "Public sector",
    "Education employer",
    "Technology employer",
    "Operational employer",
  ],
} as const;

const aliases: Record<string, string> = {
  "ai": "AI",
  "ai adoption": "AI adoption",
  "ai enablement": "AI",
  "ai programmes": "AI",
  "ai upskilling": "AI",
  "artificial intelligence": "AI",
  "automation confidence": "Automation",
  "business analysis": "Business Analysis",
  "business services": "Business & Professional Services",
  "business support": "Business & Professional Services",
  "bid & commercial": "Bid development",
  "bid & proposal": "Bid development",
  "campaign delivery": "Campaign delivery",
  "content": "Digital Marketing",
  "customer service": "Customer Service & Sales",
  "customer service & sales": "Customer Service & Sales",
  "cyber security": "Cyber Security",
  "data": "Data & Analytics",
  "data & ai": "Digital & AI",
  "data & it": "Digital & AI",
  "data capability": "Data & Analytics",
  "data pathways": "Data & Analytics",
  "digital": "Digital & AI",
  "digital & it": "Digital & AI",
  "digital businesses": "Digital & AI",
  "digital marketing": "Digital Marketing",
  "digital skills": "Digital Support",
  "digital support": "Digital Support",
  "digital technology": "Digital & AI",
  "digital transformation": "Digital transformation",
  "electronics": "Electronics",
  "embedded systems": "Embedded Systems",
  "engineering": "Engineering & Manufacturing",
  "esg & sustainability": "ESG & Sustainability",
  "health & care": "Health & Social Care",
  "health & safety": "Health & Safety",
  "healthcare": "Health & Social Care",
  "ict": "IT Support",
  "it": "IT Support",
  "it support": "IT Support",
  "machine learning": "AI",
  "manufacturing": "Engineering & Manufacturing",
  "marketing": "Marketing & Creative",
  "marketing & creative": "Marketing & Creative",
  "microsoft": "Microsoft",
  "networking": "Networking",
  "process improvement": "Process improvement",
  "procurement": "Procurement & Supply Chain",
  "procurement & supply chain": "Procurement & Supply Chain",
  "procurement capability": "Procurement capability",
  "project delivery": "Project delivery",
  "professional services": "Business & Professional Services",
  "public sector": "Public sector",
  "service design": "Service design",
  "software": "Software Development",
  "software delivery": "Software Development",
  "supply chain": "Procurement & Supply Chain",
  "supply chain capability": "Supply chain performance",
  "technology": "Technology employer",
  "tech careers": "Digital & AI",
  "teaching assistant": "Teaching support",
  "transport & logistics": "Procurement & Supply Chain",
  "university delivery": "University delivery",
  "workplace learning": "Workplace learning",
  "workforce ai literacy": "AI",
};

function clean(value: string) {
  return value.toLowerCase().replace(/&/g, "&").replace(/\s+/g, " ").trim();
}

export function canonicalProviderTaxonomyTerm(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const key = clean(trimmed);
  return aliases[key] ?? trimmed;
}

export function normaliseProviderTaxonomy(values: string[]) {
  return [...new Set(values.map(canonicalProviderTaxonomyTerm).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function normaliseProviderRecordTaxonomy(provider: ProviderCatalogueRecord) {
  const commercialProfile = {
    ...provider.commercialProfile,
    employerSizesSupported: normaliseProviderTaxonomy(provider.commercialProfile.employerSizesSupported),
  };

  return {
    ...provider,
    sectors: normaliseProviderTaxonomy(provider.sectors),
    industries: normaliseProviderTaxonomy(provider.industries),
    technologies: normaliseProviderTaxonomy(provider.technologies),
    deliveryModels: normaliseProviderTaxonomy(provider.deliveryModels),
    regions: normaliseProviderTaxonomy(provider.regions),
    employerTypes: normaliseProviderTaxonomy(provider.employerTypes),
    specialisms: normaliseProviderTaxonomy(provider.specialisms),
    commercialProfile,
  } satisfies ProviderCatalogueRecord;
}

export function normaliseProviderProgrammeTaxonomy(programme: ProviderProgramme) {
  return {
    ...programme,
    targetIndustries: normaliseProviderTaxonomy(programme.targetIndustries),
    targetJobRoles: normaliseProviderTaxonomy(programme.targetJobRoles),
    businessProblemsSolved: normaliseProviderTaxonomy(programme.businessProblemsSolved),
    skillsDeveloped: normaliseProviderTaxonomy(programme.skillsDeveloped),
    technologiesCovered: normaliseProviderTaxonomy(programme.technologiesCovered),
    expectedOutcomes: normaliseProviderTaxonomy(programme.expectedOutcomes),
    deliveryModels: normaliseProviderTaxonomy(programme.deliveryModels),
    regions: normaliseProviderTaxonomy(programme.regions),
    commercialProfile: {
      ...programme.commercialProfile,
      typicalDepartments: normaliseProviderTaxonomy(programme.commercialProfile.typicalDepartments),
      futureSkillsDeveloped: normaliseProviderTaxonomy(programme.commercialProfile.futureSkillsDeveloped),
      keyOutcomes: normaliseProviderTaxonomy(programme.commercialProfile.keyOutcomes),
      locations: normaliseProviderTaxonomy(programme.commercialProfile.locations),
      employerBenefits: normaliseProviderTaxonomy(programme.commercialProfile.employerBenefits),
      futureCapabilityImpact: normaliseProviderTaxonomy(programme.commercialProfile.futureCapabilityImpact),
    },
  } satisfies ProviderProgramme;
}

export function programmeLevelLabel(programme: ProviderProgramme) {
  return typeof programme.level === "number" ? `Level ${programme.level}` : "Needs verification";
}

export function taxonomyValuesForProvider(provider: ProviderCatalogueRecord, programmes: ProviderProgramme[]) {
  return {
    sectors: normaliseProviderTaxonomy([
      ...provider.sectors,
      ...provider.industries,
      ...programmes.flatMap((programme) => programme.targetIndustries),
    ]),
    technologies: normaliseProviderTaxonomy([
      ...provider.technologies,
      ...programmes.flatMap((programme) => programme.technologiesCovered),
    ]),
    businessChallenges: normaliseProviderTaxonomy([
      ...provider.specialisms,
      ...programmes.flatMap((programme) => programme.businessProblemsSolved),
      ...programmes.flatMap((programme) => programme.expectedOutcomes),
      ...programmes.flatMap((programme) => programme.commercialProfile.employerBenefits),
    ]),
    deliveryModels: normaliseProviderTaxonomy([
      ...provider.deliveryModels,
      ...programmes.flatMap((programme) => programme.deliveryModels),
    ]),
    regions: normaliseProviderTaxonomy([
      ...provider.regions,
      ...programmes.flatMap((programme) => programme.regions),
    ]),
    employerTypes: normaliseProviderTaxonomy([
      ...provider.employerTypes,
      ...provider.commercialProfile.employerSizesSupported,
      ...programmes.map((programme) => programme.employerSize),
    ]),
    programmeLevels: normaliseProviderTaxonomy(programmes.map(programmeLevelLabel)),
  };
}
