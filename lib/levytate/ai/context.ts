import { mvpProviderCatalogue } from "@/lib/levytate/data/mvp";
import type { LevyTateAiRequest } from "@/lib/levytate/ai/types";

const withdrawnManagementPattern = /\b(team leader|operations manager|operations\/?departmental manager|departmental manager)\b/i;

const specialistPathways = [
  { title: "Data Technician", standard: "Level 3 Data Technician", status: "Available for role-fit review" },
  { title: "Data Analyst", standard: "Level 4 Data Analyst", status: "Available for role-fit review" },
  { title: "Business Analyst", standard: "Level 4 Business Analyst", status: "Available for role-fit review" },
  { title: "Improvement Practitioner", standard: "Level 4 Improvement Practitioner", status: "Available for role-fit review" },
  { title: "Associate Project Manager", standard: "Level 4 Associate Project Manager", status: "Available for role-fit review" },
  { title: "Commercial Procurement and Supply", standard: "Level 4 Commercial Procurement and Supply", status: "Available for role-fit review" },
  { title: "Customer Service Specialist", standard: "Level 3 Customer Service Specialist", status: "Available for role-fit review" },
  { title: "Engineering Technician", standard: "Level 3 Engineering Technician", status: "Available for role-fit review" },
  { title: "Construction Site Supervisor", standard: "Level 3 Construction Site Supervisor", status: "Available for role-fit review" },
  { title: "Safety, Health and Environment Technician", standard: "Level 3 Safety, Health and Environment Technician", status: "Available for role-fit review" },
];

const productRules = [
  "Approval flow: Employee -> Line Manager -> Apprenticeship Lead -> Approved for Enrolment.",
  "Employees may have only one active apprenticeship application at a time.",
  "An active application blocks a second submission, not exploration, comparison, saved interest or manager-message preparation.",
  "Department Heads receive analytics support only and never approval actions.",
  "Generic withdrawn management standards must not be recommended for new starts.",
  "Management progression must be mapped through the relevant specialist role, sector, technical discipline and business objective.",
  "Provider matching is a LevyTate-led service, not an open marketplace.",
  "Provider records are catalogue candidates and must not be described as commercial partners unless that status is supplied explicitly.",
  "Never claim an apprenticeship is fully funded. Use potentially levy-funded or potentially funded through levy/co-investment.",
  "No application, approval, provider request or admin task is created until the user confirms the deterministic workflow action.",
];

function catalogueContext(request: LevyTateAiRequest) {
  if (request.role !== "Apprenticeship Lead" && request.role !== "LevyTate Admin") return [];

  const supplied = request.providerCatalogue?.length
    ? request.providerCatalogue
    : mvpProviderCatalogue.slice(0, 16).map((provider) => ({
        providerName: provider.providerName,
        sectors: provider.sectors,
        deliveryModel: provider.deliveryModel,
        verificationStatus: provider.verificationStatus,
      }));

  return supplied.slice(0, 16).map((provider) => ({
    ...provider,
    relationshipStatus: "Catalogue candidate; suitability and relationship status require LevyTate review",
  }));
}

function pathwayContext(request: LevyTateAiRequest) {
  const supplied = request.availablePathways?.length ? request.availablePathways : specialistPathways;
  return supplied.filter((pathway) => !withdrawnManagementPattern.test(`${pathway.title} ${pathway.standard ?? ""}`)).slice(0, 24);
}

export function buildLevyTateAiContext(request: LevyTateAiRequest) {
  return {
    workspace: request.currentWorkspace ?? {
      employerName: request.employerContext,
      selectedSite: request.selectedSite,
      activeModule: request.currentSection,
    },
    role: request.role,
    selectedEmployee: request.selectedEmployee ?? request.contextData?.selectedPersona?.name ?? null,
    employeePersona: request.contextData?.selectedPersona ?? null,
    currentApplication: request.currentApplication ?? request.contextData?.activeApplication ?? null,
    visibleApplications: request.contextData?.requests?.slice(0, 20) ?? [],
    roleMappings: request.roleMappings?.slice(0, 20) ?? [],
    availablePathways: pathwayContext(request),
    providerCatalogue: catalogueContext(request),
    productRules,
  };
}
