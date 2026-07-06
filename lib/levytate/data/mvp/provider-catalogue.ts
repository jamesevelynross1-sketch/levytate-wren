import type { ProviderCatalogueRecord, ProviderProgramme } from "@/lib/levytate/domain";
import { emptyProgrammeCommercialProfile, emptyProviderCommercialProfile } from "@/lib/levytate/domain";
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

const verifiedDate = "2026-07-06";
const programmeTimestamp = "2026-07-06T00:00:00.000Z";
const allEmployerSizes = ["SME", "Mid-market", "Large enterprise"];

function provider(seed: ProviderSeed): ProviderCatalogueRecord {
  return normaliseProviderRecord({
    providerType: "Independent training provider",
    sectors: [],
    industries: [],
    technologies: [],
    deliveryModels: [],
    regions: [],
    employerTypes: [],
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
  });
}

function programme(seed: ProgrammeSeed): ProviderProgramme {
  const linkedStandardIds = seed.linkedStandardIds ?? (seed.linkedStandardId ? [seed.linkedStandardId] : []);
  const sourceUrl = seed.sourceUrl ?? "";
  const expectedOutcomes = seed.expectedOutcomes ?? [];
  return normaliseProviderProgramme({
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
  });
}

const providerSeeds: ProviderCatalogueRecord[] = [
  provider({
    providerId: "provider-primary-goal",
    providerName: "Primary Goal",
    website: "https://www.primarygoal.co.uk/",
    providerType: "Independent training provider",
    sectors: ["Digital & IT"],
    industries: ["Education", "Schools", "Colleges"],
    technologies: ["Digital skills"],
    specialisms: ["Digital apprenticeships"],
    description: "Provider record retained for research continuity. LevyTate could not verify a live official provider page during the July 2026 review.",
    positioningStatement: "Provider record held for manual verification before marketplace publication.",
    notes: "Official public website could not be confirmed from a functioning provider page on 2026-07-06. Do not promote programmes or standards until manually verified.",
    sourceUrls: ["https://www.primarygoal.co.uk/"],
    verificationStatus: "needs_verification",
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
      "https://www.qa.com/apprenticeships/data/business-analyst-level-4/",
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
    sourceUrls: ["https://www.apprentify.com/"],
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
    website: "https://theaicore.com/",
    providerType: "Specialist consultancy",
    sectors: ["Data & AI"],
    industries: ["Technology", "Professional services"],
    technologies: ["AI", "Data", "Machine learning"],
    deliveryModels: ["Bootcamp", "Corporate training", "Online"],
    regions: ["England"],
    specialisms: ["AI upskilling", "Data capability", "Workforce AI literacy"],
    description: "AiCore publicly positions itself around AI and data training for individuals and businesses, but apprenticeship-standard mappings were not evidenced on the reviewed public pages.",
    positioningStatement: "AI capability partner that needs apprenticeship-route verification before formal matching use.",
    notes: "Use for research context only until apprenticeship programme evidence is confirmed directly from the provider.",
    sourceUrls: ["https://theaicore.com/"],
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
      "https://themarketingtrainer.co.uk/",
      "https://themarketingtrainer.co.uk/apprenticeships/multi-channel-marketer/"
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
    sourceUrls: ["https://www.hbtc.co.uk/"],
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
    sectors: ["Business & Professional Services", "Customer Service & Sales"],
    industries: ["Business services", "Customer service", "Sales"],
    deliveryModels: ["Online", "Blended", "Workplace learning"],
    regions: ["England"],
    specialisms: ["Business administration", "Customer service and sales"],
    description: "Learning Skills Partnership publishes customer service and sales plus business and administration apprenticeship categories, but the exact linked standards are not fully exposed on the public page reviewed.",
    positioningStatement: "Operational skills provider with public category coverage that still needs standard-level verification.",
    notes: "Keep standards and detailed programme mapping under manual review until the provider confirms exact standards and delivery detail.",
    sourceUrls: ["https://www.learningskillspartnership.com/apprenticeships-available"],
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

const programmeSeeds: ProviderProgramme[] = [
  programme({ id: "programme-qa-business-analyst", providerId: "provider-qa", programmeName: "Business Analyst", linkedStandardId: "ST0117", shortDescription: "Level 4 business analyst apprenticeship published by QA.", fullDescription: "QA publishes a dedicated business analyst apprenticeship focused on analysis, requirements and business change support.", tagline: "Business analysis capability for change and transformation teams.", idealAudience: "Employers building analysis capability across change, digital and operational teams.", targetIndustries: ["Technology", "Professional services"], targetJobRoles: ["Business Analyst"], skillsDeveloped: ["Requirements gathering", "Stakeholder analysis", "Process mapping"], technologiesCovered: ["Business analysis"], expectedOutcomes: ["Stronger analysis capability", "Better change delivery"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.qa.com/apprenticeships/data/business-analyst-level-4/" }),
  programme({ id: "programme-qa-data-analyst", providerId: "provider-qa", programmeName: "Data Analyst", linkedStandardId: "ST0118", shortDescription: "Level 4 data analyst apprenticeship published by QA.", fullDescription: "QA publishes a data analyst apprenticeship covering data, insight, reporting and business decision support.", tagline: "Data and reporting capability for modern business teams.", idealAudience: "Employers needing stronger analytics, reporting and data confidence.", targetIndustries: ["Technology", "Financial services"], targetJobRoles: ["Data Analyst"], skillsDeveloped: ["Data analysis", "Reporting", "Insight generation"], technologiesCovered: ["Data", "Analytics"], expectedOutcomes: ["Improved reporting", "Better business insight"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.qa.com/apprenticeships/data/data-analyst-level-4/" }),
  programme({ id: "programme-baltic-ai-enablement", providerId: "provider-baltic", programmeName: "AI Enablement", shortDescription: "Baltic branded AI Enablement programme.", fullDescription: "Baltic publishes AI Enablement as a branded programme focused on practical AI capability for employers and learners.", tagline: "AI capability development with employer-facing branding.", idealAudience: "Teams exploring practical AI adoption and digital productivity.", targetIndustries: ["Technology", "Professional services"], targetJobRoles: ["Digital Team Member", "Operations Coordinator"], technologiesCovered: ["AI"], expectedOutcomes: ["Greater AI confidence", "Improved digital productivity"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.balticapprenticeships.com/programmes/ai-enablement/" }),
  programme({ id: "programme-baltic-data-business-insights", providerId: "provider-baltic", programmeName: "Data & Business Insights", shortDescription: "Baltic branded data and business insights programme.", fullDescription: "Baltic publishes Data & Business Insights as a branded programme for analytics and business reporting capability.", tagline: "Reporting and insight capability for operational teams.", idealAudience: "Employers looking to strengthen business insight and reporting skills.", targetIndustries: ["Technology", "Professional services"], targetJobRoles: ["Data Analyst", "Reporting Coordinator"], technologiesCovered: ["Data", "Reporting"], expectedOutcomes: ["Better insight", "Improved data confidence"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.balticapprenticeships.com/programmes/data-and-business-insights/" }),
  programme({ id: "programme-baltic-multi-channel-marketer", providerId: "provider-baltic", programmeName: "Multi-Channel Marketer", linkedStandardId: "ST1031", shortDescription: "Baltic marketing apprenticeship route.", fullDescription: "Baltic publishes Multi-Channel Marketer within its branded digital programme portfolio.", tagline: "Digital marketing route within Baltic's branded programme family.", idealAudience: "Marketing teams needing campaign and channel capability.", targetIndustries: ["Marketing", "Creative"], targetJobRoles: ["Marketing Executive", "Digital Marketing Assistant"], skillsDeveloped: ["Campaign delivery", "Content planning", "Channel management"], technologiesCovered: ["Digital marketing"], expectedOutcomes: ["Stronger campaign delivery", "Better channel execution"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.balticapprenticeships.com/" }),
  programme({ id: "programme-apprentify-ai-leadership", providerId: "provider-apprentify", programmeName: "AI Leadership", shortDescription: "Apprentify AI Leadership programme.", fullDescription: "Apprentify publicly lists AI Leadership as part of its AI programme range.", tagline: "Employer-facing AI leadership development.", idealAudience: "Leaders exploring AI adoption and organisational capability.", technologiesCovered: ["AI"], expectedOutcomes: ["Stronger AI leadership", "Clearer AI adoption plans"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-apprentify-ai-activator", providerId: "provider-apprentify", programmeName: "AI Activator", shortDescription: "Apprentify AI Activator programme.", fullDescription: "Apprentify publicly lists AI Activator within its AI-focused programme range.", tagline: "Entry route for applied AI confidence and activation.", idealAudience: "Teams beginning to adopt AI in day-to-day workflows.", technologiesCovered: ["AI"], expectedOutcomes: ["More confident AI use", "Improved digital adoption"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-apprentify-ai-automation-practitioner", providerId: "provider-apprentify", programmeName: "AI Automation Practitioner", shortDescription: "Apprentify AI Automation Practitioner programme.", fullDescription: "Apprentify publicly lists AI Automation Practitioner in its AI and digital offer.", tagline: "Workflow automation capability with an AI lens.", idealAudience: "Operational and digital teams exploring automation.", technologiesCovered: ["AI", "Automation"], expectedOutcomes: ["Process improvement", "Automation confidence"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-apprentify-business-analyst", providerId: "provider-apprentify", programmeName: "Business Analyst", linkedStandardId: "ST0117", shortDescription: "Apprentify business analyst apprenticeship.", fullDescription: "Apprentify lists Business Analyst within its digital programme catalogue.", tagline: "Analysis capability for change, systems and service improvement.", targetJobRoles: ["Business Analyst"], skillsDeveloped: ["Requirements gathering", "Stakeholder analysis"], technologiesCovered: ["Business analysis"], expectedOutcomes: ["Better requirements definition", "Improved project readiness"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-apprentify-data-technician", providerId: "provider-apprentify", programmeName: "Data Technician", linkedStandardId: "ST0795", shortDescription: "Apprentify data technician apprenticeship.", fullDescription: "Apprentify lists Data Technician within its data and digital programme range.", tagline: "Operational data capability for reporting and data quality work.", targetJobRoles: ["Data Technician", "Data Administrator"], skillsDeveloped: ["Data quality", "Reporting", "Data handling"], technologiesCovered: ["Data", "Reporting"], expectedOutcomes: ["Improved data quality", "Stronger reporting processes"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-apprentify-data-analyst", providerId: "provider-apprentify", programmeName: "Data Analyst", linkedStandardId: "ST0118", shortDescription: "Apprentify data analyst apprenticeship.", fullDescription: "Apprentify lists Data Analyst within its digital programme catalogue.", tagline: "Insight and analytics capability for modern employers.", targetJobRoles: ["Data Analyst"], skillsDeveloped: ["Analysis", "Insight", "Reporting"], technologiesCovered: ["Data", "Analytics"], expectedOutcomes: ["Better insight generation", "Stronger analytics capability"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-apprentify-digital-support-technician", providerId: "provider-apprentify", programmeName: "Digital Support Technician", linkedStandardId: "ST0120", shortDescription: "Apprentify digital support technician apprenticeship.", fullDescription: "Apprentify lists Digital Support Technician within its digital support and IT portfolio.", tagline: "Digital support route for service and technical operations.", targetJobRoles: ["Digital Support Technician", "IT Support Technician"], technologiesCovered: ["IT support", "Digital support"], expectedOutcomes: ["Stronger support capability", "Improved user support"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-apprentify-network-engineer", providerId: "provider-apprentify", programmeName: "Network Engineer", linkedStandardId: "ST0127", shortDescription: "Apprentify network engineer apprenticeship.", fullDescription: "Apprentify lists Network Engineer within its technical infrastructure pathways.", tagline: "Networking capability for infrastructure and support teams.", targetJobRoles: ["Network Engineer", "Infrastructure Engineer"], technologiesCovered: ["Networking", "Infrastructure"], expectedOutcomes: ["Stronger infrastructure capability", "Improved network support"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.apprentify.com/" }),
  programme({ id: "programme-learning-curve-project-manager", providerId: "provider-learning-curve-group", programmeName: "Associate Project Manager", linkedStandardId: "ST0310", shortDescription: "Learning Curve Group project management apprenticeship.", fullDescription: "Learning Curve Group publishes Associate Project Manager within its apprenticeship programme range.", tagline: "Project coordination and delivery capability.", targetJobRoles: ["Project Coordinator", "Project Officer"], expectedOutcomes: ["Better project delivery", "Stronger planning discipline"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.learningcurvegroup.co.uk/employers/staff-training/apprenticeships/apprenticeship-programmes/" }),
  programme({ id: "programme-learning-curve-business-admin", providerId: "provider-learning-curve-group", programmeName: "Business Administrator", linkedStandardId: "ST0070", shortDescription: "Learning Curve Group business administration apprenticeship.", fullDescription: "Learning Curve Group publishes Business Administrator within its business professions offer.", tagline: "Administrative capability for business support teams.", targetJobRoles: ["Administrator", "Business Support Coordinator"], expectedOutcomes: ["Stronger administration", "Better business support processes"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.learningcurvegroup.co.uk/employers/staff-training/apprenticeships/apprenticeship-programmes/" }),
  programme({ id: "programme-learning-curve-customer-service-practitioner", providerId: "provider-learning-curve-group", programmeName: "Customer Service Practitioner", linkedStandardId: "ST0072", shortDescription: "Learning Curve Group customer service practitioner apprenticeship.", fullDescription: "Learning Curve Group publishes Customer Service Practitioner within its apprenticeship programme range.", tagline: "Customer-facing capability for front-line service teams.", targetJobRoles: ["Customer Service Practitioner", "Customer Advisor"], expectedOutcomes: ["Improved service delivery", "Better customer interactions"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.learningcurvegroup.co.uk/employers/staff-training/apprenticeships/apprenticeship-programmes/" }),
  programme({ id: "programme-learning-curve-customer-service-specialist", providerId: "provider-learning-curve-group", programmeName: "Customer Service Specialist", linkedStandardId: "ST0071", shortDescription: "Learning Curve Group customer service specialist apprenticeship.", fullDescription: "Learning Curve Group publishes Customer Service Specialist within its programme range.", tagline: "Advanced customer experience capability.", targetJobRoles: ["Customer Service Specialist", "Senior Customer Advisor"], expectedOutcomes: ["Stronger customer experience", "Improved service quality"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.learningcurvegroup.co.uk/employers/staff-training/apprenticeships/apprenticeship-programmes/" }),
  programme({ id: "programme-aicore-ai-upskilling", providerId: "provider-aicore", programmeName: "AI Upskilling for Business Teams", shortDescription: "AiCore business AI upskilling programme.", fullDescription: "AiCore publicly promotes AI and data training for businesses, but apprenticeship-standard alignment was not evidenced on the reviewed public pages.", tagline: "AI capability partner pending apprenticeship-route verification.", idealAudience: "Teams developing AI literacy and applied business AI confidence.", technologiesCovered: ["AI", "Data"], expectedOutcomes: ["Improved AI literacy", "Stronger AI adoption confidence"], deliveryModels: ["Online"], regions: ["England"], sourceUrl: "https://theaicore.com/" }),
  programme({ id: "programme-rhg-multi-channel-marketer", providerId: "provider-rhg-consult", programmeName: "Multi-Channel Marketer", linkedStandardId: "ST1031", shortDescription: "RHG Consult multi-channel marketer apprenticeship.", fullDescription: "RHG Consult publishes Multi-Channel Marketer within its specialist apprenticeship offer.", tagline: "Marketing capability from a specialist consultancy provider.", targetJobRoles: ["Marketing Executive", "Content Executive"], technologiesCovered: ["Digital marketing"], expectedOutcomes: ["Better campaign delivery", "Stronger digital marketing capability"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.rhgconsult.co.uk/apprenticeships/" }),
  programme({ id: "programme-rhg-she-tech", providerId: "provider-rhg-consult", programmeName: "Safety, Health and Environment Technician", linkedStandardId: "ST0550", shortDescription: "RHG Consult SHE technician apprenticeship.", fullDescription: "RHG Consult publishes Safety, Health and Environment Technician within its apprenticeship range.", tagline: "Health, safety and environmental capability for regulated operations.", targetJobRoles: ["SHE Technician", "HSE Coordinator"], expectedOutcomes: ["Improved compliance capability", "Stronger safety culture"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.rhgconsult.co.uk/apprenticeships/" }),
  programme({ id: "programme-rhg-bid-proposal", providerId: "provider-rhg-consult", programmeName: "Bid and Proposal Co-ordinator", linkedStandardId: "ST0056", shortDescription: "RHG Consult bid and proposal co-ordinator apprenticeship.", fullDescription: "RHG Consult publishes Bid and Proposal Co-ordinator as part of its specialist employer offer.", tagline: "Commercial writing and bid capability for growth teams.", targetJobRoles: ["Bid Coordinator", "Proposal Coordinator"], expectedOutcomes: ["Stronger bid capability", "Improved proposal process"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.rhgconsult.co.uk/apprenticeships/" }),
  programme({ id: "programme-rhg-corporate-responsibility", providerId: "provider-rhg-consult", programmeName: "Corporate Responsibility and Sustainability", linkedStandardId: "ST0934", shortDescription: "RHG Consult corporate responsibility and sustainability apprenticeship.", fullDescription: "RHG Consult publishes a corporate responsibility and sustainability apprenticeship route within its specialist portfolio.", tagline: "ESG and sustainability capability for responsible growth agendas.", targetJobRoles: ["Sustainability Coordinator", "ESG Officer"], expectedOutcomes: ["Stronger sustainability capability", "Improved ESG delivery"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.rhgconsult.co.uk/apprenticeships/" }),
  programme({ id: "programme-rhg-service-designer", providerId: "provider-rhg-consult", programmeName: "Service Innovation Leader (Service Designer)", linkedStandardId: "ST0894", shortDescription: "RHG Consult service innovation leader pathway.", fullDescription: "RHG Consult publishes Service Innovation Leader with service designer wording on the reviewed apprenticeship page.", tagline: "Service design and service improvement capability.", targetJobRoles: ["Service Designer", "Service Improvement Lead"], expectedOutcomes: ["Better service design", "Improved customer journeys"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://www.rhgconsult.co.uk/apprenticeships/", status: "Needs verification", verificationStatus: "Needs manual verification", notes: "Public wording suggests a service designer route, but the exact standard title should be confirmed directly with RHG Consult." }),
  programme({ id: "programme-marketing-trainer-multi-channel-marketer", providerId: "provider-the-marketing-trainer", programmeName: "Multi-Channel Marketer", linkedStandardId: "ST1031", shortDescription: "The Marketing Trainer multi-channel marketer apprenticeship.", fullDescription: "The Marketing Trainer publishes a Multi-Channel Marketer apprenticeship with embedded CIM professional development.", tagline: "Marketing apprenticeship route with CIM-aligned enrichment.", targetJobRoles: ["Marketing Assistant", "Marketing Executive"], technologiesCovered: ["Digital marketing", "Content"], expectedOutcomes: ["Stronger marketing capability", "Better channel execution"], deliveryModels: ["Online", "Blended"], regions: ["England"], sourceUrl: "https://themarketingtrainer.co.uk/apprenticeships/multi-channel-marketer/" }),
  programme({ id: "programme-hbtc-business-admin", providerId: "provider-hbtc", programmeName: "Business Administration", linkedStandardId: "ST0070", shortDescription: "HBTC business administration apprenticeship.", fullDescription: "HBTC publishes Level 3 Business Administration Apprenticeship within its employer offer.", tagline: "Business support capability for regional employers.", targetJobRoles: ["Administrator", "Office Coordinator"], expectedOutcomes: ["Improved administration", "Stronger operational support"], deliveryModels: ["Workplace learning", "Blended"], regions: ["Yorkshire and the Humber"], sourceUrl: "https://www.hbtc.co.uk/" }),
  programme({ id: "programme-hbtc-customer-service-practitioner", providerId: "provider-hbtc", programmeName: "Customer Service Practitioner", linkedStandardId: "ST0072", shortDescription: "HBTC customer service apprenticeship.", fullDescription: "HBTC publishes Level 2 and 3 customer service apprenticeships as part of its regional offer.", tagline: "Front-line customer service route for service employers.", targetJobRoles: ["Customer Service Practitioner", "Customer Advisor"], expectedOutcomes: ["Improved service delivery", "Better customer confidence"], deliveryModels: ["Workplace learning", "Blended"], regions: ["Yorkshire and the Humber"], sourceUrl: "https://www.hbtc.co.uk/" }),
  programme({ id: "programme-hbtc-multi-channel-marketer", providerId: "provider-hbtc", programmeName: "Multi-Channel Marketer", linkedStandardId: "ST1031", shortDescription: "HBTC marketing apprenticeship.", fullDescription: "HBTC publishes a Level 3 Multi-Channel Marketer apprenticeship within its public programme list.", tagline: "Regional marketing apprenticeship route.", targetJobRoles: ["Marketing Assistant", "Digital Marketing Assistant"], technologiesCovered: ["Digital marketing"], expectedOutcomes: ["Stronger campaign support", "Improved marketing capability"], deliveryModels: ["Workplace learning", "Blended"], regions: ["Yorkshire and the Humber"], sourceUrl: "https://www.hbtc.co.uk/" }),
  programme({ id: "programme-hbtc-digital-support-technician", providerId: "provider-hbtc", programmeName: "Digital Support Technician", linkedStandardId: "ST0120", shortDescription: "HBTC digital support technician apprenticeship.", fullDescription: "HBTC publishes a Level 3 Digital Support Technician apprenticeship within its digital offer.", tagline: "Regional digital support route for operational teams.", targetJobRoles: ["Digital Support Technician", "IT Support Technician"], technologiesCovered: ["Digital support", "IT"], expectedOutcomes: ["Improved user support", "Stronger digital operations"], deliveryModels: ["Workplace learning", "Blended"], regions: ["Yorkshire and the Humber"], sourceUrl: "https://www.hbtc.co.uk/" }),
  programme({ id: "programme-hbtc-information-communications-technician", providerId: "provider-hbtc", programmeName: "Information Communications Technician", linkedStandardId: "ST0973", shortDescription: "HBTC information communications technician apprenticeship.", fullDescription: "HBTC publishes a Level 3 Information Communication Technician apprenticeship in its public programme list.", tagline: "ICT route for support and infrastructure capability.", targetJobRoles: ["ICT Technician", "IT Technician"], technologiesCovered: ["IT", "ICT"], expectedOutcomes: ["Improved ICT support", "Stronger technical operations"], deliveryModels: ["Workplace learning", "Blended"], regions: ["Yorkshire and the Humber"], sourceUrl: "https://www.hbtc.co.uk/" }),
  programme({ id: "programme-hbtc-teaching-assistant", providerId: "provider-hbtc", programmeName: "Teaching Assistant", linkedStandardId: "ST0454", shortDescription: "HBTC teaching assistant apprenticeship.", fullDescription: "HBTC publishes a Level 3 Teaching Assistant apprenticeship within its employer-facing programme list.", tagline: "Teaching support route for education settings.", targetJobRoles: ["Teaching Assistant"], expectedOutcomes: ["Improved classroom support", "Stronger learner support"], deliveryModels: ["Workplace learning", "Blended"], regions: ["Yorkshire and the Humber"], sourceUrl: "https://www.hbtc.co.uk/" }),
  programme({ id: "programme-staffs-dtsp", providerId: "provider-staffordshire-university", programmeName: "Digital & Technology Solutions Professional Degree Apprenticeship", linkedStandardId: "ST0119", shortDescription: "Staffordshire University digital and technology solutions professional degree apprenticeship.", fullDescription: "Staffordshire University publishes Digital & Technology Solutions Professional within its apprenticeship course portfolio.", tagline: "Degree-level digital and technology route for advanced technical capability.", targetJobRoles: ["Digital & Technology Solutions Professional", "Technology Analyst"], technologiesCovered: ["Digital technology"], expectedOutcomes: ["Advanced technical capability", "Stronger digital workforce readiness"], deliveryModels: ["Blended", "University delivery"], regions: ["England"], sourceUrl: "https://www.staffs.ac.uk/apprenticeships/courses" }),
  programme({ id: "programme-staffs-project-manager", providerId: "provider-staffordshire-university", programmeName: "Project Manager Degree Apprenticeship", linkedStandardId: "ST0411", shortDescription: "Staffordshire University project manager degree apprenticeship.", fullDescription: "Staffordshire University publishes a Project Manager degree apprenticeship within its course portfolio.", tagline: "Degree-level project delivery capability.", targetJobRoles: ["Project Manager", "Project Lead"], expectedOutcomes: ["Stronger project leadership", "Improved delivery governance"], deliveryModels: ["Blended", "University delivery"], regions: ["England"], sourceUrl: "https://www.staffs.ac.uk/apprenticeships/courses" }),
  programme({ id: "programme-staffs-embedded-electronic-systems", providerId: "provider-staffordshire-university", programmeName: "Embedded Electronic Systems Design and Development Engineer Degree Apprenticeship", linkedStandardId: "ST0151", shortDescription: "Staffordshire University embedded electronic systems engineering degree apprenticeship.", fullDescription: "Staffordshire University publishes Embedded Electronic Systems Design and Development Engineer within its engineering apprenticeship course portfolio.", tagline: "Degree-level engineering route for electronics and systems capability.", targetJobRoles: ["Embedded Systems Engineer", "Electronics Engineer"], technologiesCovered: ["Electronics", "Embedded systems"], expectedOutcomes: ["Advanced engineering capability", "Improved design and development capacity"], deliveryModels: ["Blended", "University delivery"], regions: ["England"], sourceUrl: "https://www.staffs.ac.uk/apprenticeships/courses" }),
  programme({ id: "programme-staffs-manufacturing-engineer", providerId: "provider-staffordshire-university", programmeName: "Manufacturing Engineer Degree Apprenticeship", linkedStandardId: "ST0025", shortDescription: "Staffordshire University manufacturing engineer degree apprenticeship.", fullDescription: "Staffordshire University publishes Manufacturing Engineer within its engineering apprenticeship course portfolio.", tagline: "Degree-level manufacturing route for advanced production capability.", targetJobRoles: ["Manufacturing Engineer", "Production Engineer"], technologiesCovered: ["Manufacturing", "Engineering"], expectedOutcomes: ["Improved engineering capability", "Stronger manufacturing performance"], deliveryModels: ["Blended", "University delivery"], regions: ["England"], sourceUrl: "https://www.staffs.ac.uk/apprenticeships/courses" }),
  programme({ id: "programme-lsp-customer-service-sales", providerId: "provider-learning-skills-partnership", programmeName: "Customer Service and Sales", shortDescription: "Learning Skills Partnership customer service and sales programme category.", fullDescription: "Learning Skills Partnership publicly lists customer service and sales apprenticeships, but the reviewed page did not expose exact standard-level mappings.", tagline: "Operational customer service and sales capability pending standard-level verification.", targetJobRoles: ["Customer Service Advisor", "Sales Support"], expectedOutcomes: ["Improved customer handling", "Stronger sales support"], deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"], sourceUrl: "https://www.learningskillspartnership.com/apprenticeships-available" }),
  programme({ id: "programme-lsp-business-administration", providerId: "provider-learning-skills-partnership", programmeName: "Business and Administration", shortDescription: "Learning Skills Partnership business and administration programme category.", fullDescription: "Learning Skills Partnership publicly lists business and administration apprenticeships, but the reviewed page did not expose exact standard-level mappings.", tagline: "Business support capability pending standard-level verification.", targetJobRoles: ["Administrator", "Business Support"], expectedOutcomes: ["Improved administration", "Better operational support"], deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"], sourceUrl: "https://www.learningskillspartnership.com/apprenticeships-available" }),
  programme({ id: "programme-srscc-procurement-supply-assistant", providerId: "provider-srscc", programmeName: "Procurement and Supply Assistant", linkedStandardId: "ST0810", shortDescription: "SRSCC procurement and supply assistant apprenticeship.", fullDescription: "SRSCC publishes Level 3 Procurement and Supply Assistant Apprenticeship within its specialist public offer.", tagline: "Procurement support capability for commercial teams.", targetJobRoles: ["Procurement Assistant", "Supply Assistant"], expectedOutcomes: ["Improved procurement support", "Better commercial operations"], deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"], sourceUrl: "https://www.srscc.co.uk/apprenticeships/" }),
  programme({ id: "programme-srscc-supply-chain-practitioner", providerId: "provider-srscc", programmeName: "Supply Chain Practitioner", shortDescription: "SRSCC level 3 supply chain practitioner route.", fullDescription: "SRSCC publicly lists a Level 3 Supply Chain Practitioner apprenticeship, but the exact active standard mapping should be confirmed directly.", tagline: "Supply chain capability route requiring final standard confirmation.", targetJobRoles: ["Supply Chain Practitioner", "Logistics Coordinator"], expectedOutcomes: ["Improved supply chain understanding", "Stronger operational flow"], deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"], sourceUrl: "https://www.srscc.co.uk/apprenticeships/" }),
  programme({ id: "programme-srscc-procurement-supply-chain-practitioner", providerId: "provider-srscc", programmeName: "Procurement and Supply Chain Practitioner", linkedStandardId: "ST0313", shortDescription: "SRSCC procurement and supply chain practitioner apprenticeship.", fullDescription: "SRSCC publishes Level 4 Procurement and Supply Chain Practitioner Apprenticeship within its specialist offer.", tagline: "Mid-level procurement capability for commercial and supply chain teams.", targetJobRoles: ["Buyer", "Procurement Lead"], expectedOutcomes: ["Better procurement capability", "Improved supply chain decision-making"], deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"], sourceUrl: "https://www.srscc.co.uk/apprenticeships/" }),
  programme({ id: "programme-srscc-senior-procurement-supply-chain-professional", providerId: "provider-srscc", programmeName: "Senior Procurement and Supply Chain Professional", linkedStandardId: "ST0811", shortDescription: "SRSCC senior procurement and supply chain professional apprenticeship.", fullDescription: "SRSCC publishes Level 6 Senior Procurement and Supply Chain Professional Apprenticeship within its public programme set.", tagline: "Senior commercial capability for procurement leadership roles.", targetJobRoles: ["Senior Buyer", "Procurement Manager"], expectedOutcomes: ["Stronger senior procurement capability", "Improved commercial leadership"], deliveryModels: ["Online", "Blended", "Workplace learning"], regions: ["England"], sourceUrl: "https://www.srscc.co.uk/apprenticeships/" }),
];

export const mvpProviderCatalogue = providerSeeds;
export const mvpProviderProgrammes = programmeSeeds;
