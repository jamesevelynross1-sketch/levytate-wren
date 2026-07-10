import { mvpProviderCatalogue } from "@/lib/levytate/data/mvp";
import {
  copilotGuidanceUnavailableMessage,
  retrieveCopilotSafeGuidanceSources,
  trustedGuidanceSources,
} from "@/lib/levytate/guidance/source-registry";
import { getLiveApprenticeshipStandards } from "@/lib/levytate/domain";
import type { LevyTateAiRequest } from "@/lib/levytate/ai/types";

const withdrawnManagementPattern = /\b(team leader|operations manager|operations\/?departmental manager|departmental manager)\b/i;



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
  "GOV.UK and Skills England define apprenticeship rules. LevyTate explains them using approved trusted sources.",
  "When guidance is not backed by an Active, Approved and Copilot-approved trusted source, use the approved fallback wording and route to apprenticeship lead or LevyTate adviser review.",
];

function catalogueContext(request: LevyTateAiRequest) {
  if (request.role !== "Apprenticeship Lead" && request.role !== "LevyTate Admin") return [];

  const supplied = request.providerCatalogue?.length
    ? request.providerCatalogue
    : mvpProviderCatalogue.slice(0, 16).map((provider) => ({
        providerName: provider.providerName,
        sectors: provider.sectors,
        deliveryModels: provider.deliveryModels,
        verificationStatus: provider.verificationStatus,
      }));

  return supplied.slice(0, 16).map((provider) => ({
    ...provider,
    relationshipStatus: "Catalogue candidate; suitability and relationship status require LevyTate review",
  }));
}

function pathwayContext(request: LevyTateAiRequest) {
  const supplied = request.availablePathways?.length ? request.availablePathways : getLiveApprenticeshipStandards().map((standard) => ({
    title: standard.title,
    standard: "Level " + standard.level + " " + standard.title + " (" + standard.referenceCode + ")",
    status: "Available for role-fit review",
  }));
  return supplied.filter((pathway) => !withdrawnManagementPattern.test(`${pathway.title} ${pathway.standard ?? ""}`)).slice(0, 24);
}

export function buildLevyTateAiContext(request: LevyTateAiRequest) {
  const approvedGuidanceSources = retrieveCopilotSafeGuidanceSources(trustedGuidanceSources, {
    asOf: new Date().toISOString().slice(0, 10),
  }).slice(0, 12);

  return {
    workspace: request.currentWorkspace ?? {
      employerName: request.employerContext,
      selectedSite: request.selectedSite,
      activeModule: request.currentSection,
    },
    role: request.role,
    conversationProfile: request.conversationProfile ?? null,
    selectedEmployee: request.selectedEmployee ?? request.contextData?.selectedPersona?.name ?? null,
    workspaceEmployeeContext: request.workspaceEmployeeContext ?? null,
    employeePersona: request.contextData?.selectedPersona ?? null,
    currentApplication: request.currentApplication ?? request.contextData?.activeApplication ?? null,
    visibleApplications: request.contextData?.requests?.slice(0, 20) ?? [],
    roleMappings: request.roleMappings?.slice(0, 20) ?? [],
    availablePathways: pathwayContext(request),
    providerCatalogue: catalogueContext(request),
    trustedGuidance: {
      rule: "Only sources that are Active, Approved, Copilot approved, current for the relevant funding year or start date, and not superseded may be used as authoritative guidance.",
      fallbackMessage: copilotGuidanceUnavailableMessage,
      approvedSourceCount: approvedGuidanceSources.length,
      approvedSources: approvedGuidanceSources.map((source) => ({
        title: source.title,
        publisher: source.publisher,
        sourceUrl: source.sourceUrl,
        authorityLevel: source.authorityLevel,
        categories: source.guidanceCategories,
        fundingYear: source.fundingYear,
      })),
    },
    productRules,
  };
}

