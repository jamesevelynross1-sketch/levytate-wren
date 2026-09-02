import type {
  CareerLevel,
  DeliveryPreference,
  FundingRoute,
  ProgrammeCommercialProfile,
  ProviderCatalogueRecord,
  ProviderCommercialProfile,
  ProviderEmployerSize,
  ProviderProgramme,
  RequestStatus,
} from "@/lib/levytate/domain";
import {
  emptyProgrammeCommercialProfile,
  emptyProviderCommercialProfile,
  getApprenticeshipStandard,
  normaliseProgrammeCommercialProfile,
  normaliseProviderCommercialProfile,
  parseProgrammeRecordNotes,
  parseProviderRecordNotes,
  resolveApprenticeshipStandardId,
} from "@/lib/levytate/domain";
import type {
  LevyTateConversationMessage,
  LevyTateConversationProfile,
  LevyTateRecommendationResult,
} from "@/lib/levytate/ai/types";
import type { LearnerLifecycleCollections } from "@/lib/levytate/mvp/learner-lifecycle";
import { emptyLearnerLifecycleCollections } from "@/lib/levytate/mvp/learner-lifecycle";
import { mvpProviderCatalogue, mvpProviderProgrammes } from "@/lib/levytate/data/mvp";

export type MvpRecordStatus = "Active" | "Archived";

export const mvpEmployerPriorityOptions = [
  "Introduce AI into the business",
  "Increase productivity",
  "Improve data capability",
  "Reduce manual administration",
  "Improve customer service",
  "Digital transformation",
  "Succession planning",
  "Develop future managers",
  "Improve engineering capability",
  "Compliance",
  "Other",
] as const;

export type MvpEmployerPriorityName = (typeof mvpEmployerPriorityOptions)[number];
export type MvpEmployerPriorityImportance = "Critical" | "High" | "Medium";

export type MvpEmployerPriority = {
  id: string;
  name: MvpEmployerPriorityName;
  importance: MvpEmployerPriorityImportance;
  detail: string;
};

export type MvpWorkspaceProfile = {
  employerName: string;
  workspaceName: string;
  primaryContact: string;
  contactEmail: string;
  defaultSite: string;
  sites: string[];
  departments: string[];
  priorities: MvpEmployerPriority[];
};

export type MvpEmployee = {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  jobTitle: string;
  roleId: string;
  managerId: string;
  managerName?: string;
  department: string;
  site: string;
  platformRole: "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead";
  status: MvpRecordStatus;
  startDate: string;
  createdAt: string;
  updatedAt: string;
};

export type MvpEmployeeDiscoveryStage = "role_context" | "future_capability" | "recommendation_ready";

export type MvpEmployeeDevelopmentProfile = {
  employeeId: string;
  stage: MvpEmployeeDiscoveryStage;
  responsibilities: string[];
  currentSkills: string[];
  businessFunctions: string[];
  currentCapabilities: string[];
  apprenticeshipIndicators: string[];
  aiOpportunities: string[];
  dataOpportunities: string[];
  automationOpportunities: string[];
  futureCapabilities: string[];
  conversationHistory: LevyTateConversationMessage[];
  conversationProfile: LevyTateConversationProfile | null;
  recommendationResult: LevyTateRecommendationResult | null;
  preferredStandardId: string;
  updatedAt: string;
};

export type MvpPathwayMapping = {
  id: string;
  apprenticeshipStandardId: string;
  recommendationType: "Primary" | "Alternative";
  priority: number;
  businessRationale: string;
  fundingRoute: FundingRoute;
  deliveryPreference: DeliveryPreference;
};

export type MvpRole = {
  id: string;
  title: string;
  department: string;
  businessArea: string;
  careerLevel: CareerLevel;
  skillsTags: string[];
  progression: string[];
  pathwayMappings: MvpPathwayMapping[];
  status: MvpRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type MvpApplicationOwner = "Employee" | "Line Manager" | "Apprenticeship Lead" | "Provider Partner" | "Completed";

export type MvpApplicationHistoryEntry = {
  id: string;
  status: RequestStatus;
  owner: MvpApplicationOwner;
  note: string;
  createdAt: string;
};

export type MvpApplication = {
  id: string;
  employeeId: string;
  apprenticeshipStandardId: string;
  status: RequestStatus;
  currentOwner: MvpApplicationOwner;
  reason: string;
  careerGoal: string;
  supportRequired: string;
  managerNote: string;
  submittedAt: string;
  updatedAt: string;
  history: MvpApplicationHistoryEntry[];
};

export type MvpProviderRelationshipCategory =
  | "Digital"
  | "Engineering"
  | "Business Improvement"
  | "Marketing"
  | "Leadership"
  | "Data"
  | "Customer"
  | "Procurement";

export type MvpProviderRelationshipStatus = "Preferred" | "Review due" | "Alternative required";

export type MvpProviderRelationship = {
  id: string;
  category: MvpProviderRelationshipCategory;
  preferredProviderId: string;
  backupProviderIds: string[];
  programmeIds: string[];
  status: MvpProviderRelationshipStatus;
  notes: string;
  reviewDate: string;
  lastUsedDate: string;
};

export type MvpMatchingStatus = "Submitted" | "Under Review" | "Provider Shortlist Being Prepared" | "Shortlist Ready";

export type MvpMatchingRequest = {
  id: string;
  roleNeed: string;
  department: string;
  futureCapability: string;
  employerSize: ProviderEmployerSize | "";
  programmeId: string;
  linkedStandardId: string;
  learnerCount: number;
  sites: string[];
  deliveryPreference: string;
  fundingPosition: string;
  urgency: string;
  notes: string;
  businessProblems: string[];
  targetRoles: string[];
  technologies: string[];
  industries: string[];
  status: MvpMatchingStatus;
  shortlistProviderIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type MvpEnrolmentStatus = "Ready for provider" | "Submitted to provider" | "Enrolment in progress" | "Live learner" | "Completed" | "Cancelled";

export type MvpEnrolment = {
  id: string;
  applicationId: string;
  employeeId: string;
  providerId: string;
  apprenticeshipStandardId: string;
  status: MvpEnrolmentStatus;
  startDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type MvpOrganisationProvider = {
  providerId: string;
  status: "Active" | "Inactive";
  selectedAt: string;
  updatedAt: string;
};

export type MvpOrganisationProgramme = {
  programmeId: string;
  providerId: string;
  status: "Active" | "Inactive";
  selectedAt: string;
  updatedAt: string;
};

export type MvpWorkspaceData = LearnerLifecycleCollections & {
  version: 6;
  profile: MvpWorkspaceProfile;
  employees: MvpEmployee[];
  employeeDevelopmentProfiles: MvpEmployeeDevelopmentProfile[];
  roles: MvpRole[];
  applications: MvpApplication[];
  providers: ProviderCatalogueRecord[];
  providerProgrammes: ProviderProgramme[];
  providerRelationships: MvpProviderRelationship[];
  organisationProviders: MvpOrganisationProvider[];
  organisationProgrammes: MvpOrganisationProgramme[];
  matchingRequests: MvpMatchingRequest[];
  enrolments: MvpEnrolment[];
};

export const mvpWorkspaceStorageKey = "levytate:mvp:workspace:v6";
export const previousMvpWorkspaceStorageKey = "levytate:mvp:workspace:v5";
export const legacyMvpWorkspaceStorageKey = "levytate:mvp:workspace:v4";
export const oldestMvpWorkspaceStorageKey = "levytate:mvp:workspace:v3";

export function createEmptyMvpWorkspace(): MvpWorkspaceData {
  return {
    version: 6,
    profile: {
      employerName: "",
      workspaceName: "LevyTate employer workspace",
      primaryContact: "",
      contactEmail: "hello@levytate.co.uk",
      defaultSite: "",
      sites: [],
      departments: [],
      priorities: [],
    },
    employees: [],
    employeeDevelopmentProfiles: [],
    roles: [],
    applications: [],
    providers: structuredClone(mvpProviderCatalogue).map(normaliseProviderRecord),
    providerProgrammes: structuredClone(mvpProviderProgrammes).map(normaliseProviderProgramme),
    providerRelationships: [],
    organisationProviders: [],
    organisationProgrammes: [],
    matchingRequests: [],
    enrolments: [],
    ...emptyLearnerLifecycleCollections(),
  };
}

export function createEmployeeDevelopmentProfile(employeeId: string): MvpEmployeeDevelopmentProfile {
  return {
    employeeId,
    stage: "role_context",
    responsibilities: [],
    currentSkills: [],
    businessFunctions: [],
    currentCapabilities: [],
    apprenticeshipIndicators: [],
    aiOpportunities: [],
    dataOpportunities: [],
    automationOpportunities: [],
    futureCapabilities: [],
    conversationHistory: [],
    conversationProfile: null,
    recommendationResult: null,
    preferredStandardId: "",
    updatedAt: nowIso(),
  };
}

export function createMvpId(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function splitMvpList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function normaliseTagValues(values: unknown) {
  if (Array.isArray(values)) {
    return [...new Set(values.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  }
  if (typeof values === "string") {
    return splitMvpList(values);
  }
  return [];
}

function mergeProviderCommercialProfile(
  provider: Partial<ProviderCatalogueRecord> & { providerName: string; website?: string; contactName?: string; contactEmail?: string },
  parsedProfile: ProviderCommercialProfile,
) {
  const base = emptyProviderCommercialProfile();
  return normaliseProviderCommercialProfile({
    ...base,
    ...parsedProfile,
    organisationDescription: parsedProfile.organisationDescription || provider.notes?.trim() || "",
    primaryContactTitle: parsedProfile.primaryContactTitle || "LevyTate relationship lead",
    commercialContactName: parsedProfile.commercialContactName || provider.contactName || "",
    commercialContactEmail: parsedProfile.commercialContactEmail || provider.contactEmail || "",
    accreditations: parsedProfile.accreditations.length ? parsedProfile.accreditations : normaliseTagValues(provider.specialisms),
    commercialNotes: parsedProfile.commercialNotes || provider.notes?.trim() || "",
    employerSizesSupported: parsedProfile.employerSizesSupported.length ? parsedProfile.employerSizesSupported : normaliseTagValues(provider.employerTypes),
  });
}

function buildProgrammeAudience(programme: Partial<ProviderProgramme>) {
  const roles = normaliseTagValues(programme.targetJobRoles).slice(0, 2).join(" and ");
  const industries = normaliseTagValues(programme.targetIndustries).slice(0, 2).join(" and ");
  if (roles && industries) return `${roles} across ${industries} employers`;
  if (roles) return `${roles} building stronger workforce capability`;
  if (industries) return `${industries} employers`;
  return "Employers building workforce capability through role-led development";
}

function mergeProgrammeCommercialProfile(
  programme: Partial<ProviderProgramme>,
  parsedProfile: ProgrammeCommercialProfile,
  primaryStandardTitle: string,
) {
  const base = emptyProgrammeCommercialProfile();
  const derivedFunding = programme.fundingRoute ? [programme.fundingRoute] : [];
  return normaliseProgrammeCommercialProfile({
    ...base,
    ...parsedProfile,
    tagline: parsedProfile.tagline || programme.shortDescription?.trim() || "",
    idealAudience: parsedProfile.idealAudience || buildProgrammeAudience(programme),
    typicalDepartments: parsedProfile.typicalDepartments.length ? parsedProfile.typicalDepartments : normaliseTagValues(programme.targetOrganisations),
    futureSkillsDeveloped: parsedProfile.futureSkillsDeveloped.length ? parsedProfile.futureSkillsDeveloped : normaliseTagValues(programme.skillsDeveloped),
    keyOutcomes: parsedProfile.keyOutcomes.length ? parsedProfile.keyOutcomes : normaliseTagValues(programme.expectedOutcomes),
    locations: parsedProfile.locations.length ? parsedProfile.locations : normaliseTagValues(programme.regions),
    fundingOptions: parsedProfile.fundingOptions.length ? parsedProfile.fundingOptions : derivedFunding,
    employerCommitment: parsedProfile.employerCommitment || (programme.duration ? `Typical duration ${programme.duration}. Delivery commitment confirmed during LevyTate matching.` : "Employer commitment confirmed during LevyTate matching."),
    assessmentApproach: parsedProfile.assessmentApproach || (primaryStandardTitle ? `${primaryStandardTitle} assessment and gateway requirements apply.` : "Assessment approach confirmed against the linked standard."),
    employerBenefits: parsedProfile.employerBenefits.length ? parsedProfile.employerBenefits : normaliseTagValues(programme.businessProblemsSolved),
    futureCapabilityImpact: parsedProfile.futureCapabilityImpact.length ? parsedProfile.futureCapabilityImpact : normaliseTagValues(programme.expectedOutcomes),
    confidenceLabel: parsedProfile.confidenceLabel || "High",
  });
}

export function normaliseProviderRecord(provider: Partial<ProviderCatalogueRecord> & {
  providerId: string;
  providerName: string;
}) {
  const parsedNotes = parseProviderRecordNotes(provider.notes);
  const notes = parsedNotes.notes || provider.notes?.trim() || "";
  return {
    providerId: provider.providerId,
    providerName: provider.providerName.trim(),
    website: provider.website?.trim() ?? "",
    providerType: provider.providerType ?? "Independent training provider",
    sectors: normaliseTagValues(provider.sectors),
    industries: normaliseTagValues(provider.industries),
    technologies: normaliseTagValues(provider.technologies),
    deliveryModels: normaliseTagValues((provider as { deliveryModels?: unknown }).deliveryModels ?? (provider as { deliveryModel?: unknown }).deliveryModel),
    regions: normaliseTagValues(provider.regions),
    employerTypes: normaliseTagValues(provider.employerTypes),
    specialisms: normaliseTagValues(provider.specialisms),
    contactName: provider.contactName?.trim() ?? "",
    contactEmail: provider.contactEmail?.trim() ?? "",
    ofstedRating: provider.ofstedRating?.trim() ?? "Requires verification",
    status: provider.status ?? "Active",
    sourceUrls: normaliseTagValues(provider.sourceUrls),
    notes,
    commercialProfile: mergeProviderCommercialProfile(provider, normaliseProviderCommercialProfile(provider.commercialProfile ?? parsedNotes.commercialProfile)),
    lastVerified: provider.lastVerified ?? todayIso(),
    verificationStatus: provider.verificationStatus ?? "needs_verification",
  } satisfies ProviderCatalogueRecord;
}

export function normaliseProviderProgramme(programme: Partial<ProviderProgramme> & {
  id: string;
  providerId: string;
  apprenticeshipStandardId?: string;
  deliveryMode?: string;
  deliveryModel?: string[] | string;
  programmeName?: string;
  marketingDescription?: string;
  targetAudience?: string;
  typicalJobRoles?: string[] | string;
  industriesServed?: string[] | string;
}): ProviderProgramme {
  const parsedNotes = parseProgrammeRecordNotes(programme.notes);
  const linkedStandardIds = normaliseTagValues(
    programme.linkedStandardIds
      ?? programme.linkedStandardId
      ?? programme.apprenticeshipStandardId,
  );
  const primaryStandardId = linkedStandardIds[0] ?? "";
  const primaryStandard = primaryStandardId ? getApprenticeshipStandard(primaryStandardId) : undefined;
  const notes = parsedNotes.notes || programme.notes?.trim() || "";

  return {
    id: programme.id,
    providerId: programme.providerId,
    programmeName: programme.programmeName?.trim() || primaryStandard?.title || "Provider programme",
    shortDescription: programme.shortDescription?.trim() || programme.marketingDescription?.trim() || notes || "Programme summary to confirm.",
    fullDescription: programme.fullDescription?.trim() || programme.shortDescription?.trim() || programme.marketingDescription?.trim() || notes || "Programme proposition to confirm.",
    status: programme.status ?? "Needs verification",
    verificationStatus: programme.verificationStatus ?? "Needs manual verification",
    targetOrganisations: normaliseTagValues(programme.targetOrganisations),
    targetIndustries: normaliseTagValues(programme.targetIndustries ?? programme.industriesServed),
    targetJobRoles: normaliseTagValues(programme.targetJobRoles ?? programme.typicalJobRoles),
    seniority: programme.seniority ?? "Mixed",
    employerSize: programme.employerSize ?? "Mixed employer base",
    businessProblemsSolved: normaliseTagValues(programme.businessProblemsSolved),
    skillsDeveloped: normaliseTagValues(programme.skillsDeveloped),
    technologiesCovered: normaliseTagValues(programme.technologiesCovered),
    expectedOutcomes: normaliseTagValues(programme.expectedOutcomes),
    deliveryModels: normaliseTagValues(programme.deliveryModels ?? programme.deliveryModel ?? programme.deliveryMode),
    regions: normaliseTagValues(programme.regions),
    duration: programme.duration?.trim() || primaryStandard?.typicalDuration || "Duration to confirm",
    cohortOptions: normaliseTagValues(programme.cohortOptions),
    commercialNotes: programme.commercialNotes?.trim() || "Commercial notes to confirm.",
    fundingRoute: programme.fundingRoute ?? "Potentially funded through levy/co-investment",
    linkedStandardId: primaryStandardId,
    linkedStandardIds,
    linkedStandardName: programme.linkedStandardName?.trim() || primaryStandard?.title || "",
    level: programme.level ?? primaryStandard?.level ?? null,
    route: programme.route?.trim() || primaryStandard?.occupationalRoute || "",
    fundingBand: programme.fundingBand ?? primaryStandard?.fundingBand ?? null,
    officialUrl: programme.officialUrl?.trim() || primaryStandard?.officialUrl || "",
    sourceUrl: programme.sourceUrl?.trim() || "",
    notes,
    commercialProfile: mergeProgrammeCommercialProfile(
      programme,
      normaliseProgrammeCommercialProfile(programme.commercialProfile ?? parsedNotes.commercialProfile),
      primaryStandard?.title || "",
    ),
    recordStatus: programme.recordStatus ?? "Active",
    createdAt: programme.createdAt ?? nowIso(),
    updatedAt: programme.updatedAt ?? nowIso(),
  };
}

export function normaliseProviderRelationship(relationship: Partial<MvpProviderRelationship> & {
  id: string;
  preferredProviderId: string;
  category: MvpProviderRelationshipCategory;
  apprenticeshipStandardIds?: string[];
}) {
  return {
    id: relationship.id,
    category: relationship.category,
    preferredProviderId: relationship.preferredProviderId,
    backupProviderIds: normaliseTagValues(relationship.backupProviderIds),
    programmeIds: normaliseTagValues(relationship.programmeIds ?? relationship.apprenticeshipStandardIds),
    status: relationship.status ?? "Preferred",
    notes: relationship.notes ?? "",
    reviewDate: relationship.reviewDate ?? todayIso(),
    lastUsedDate: relationship.lastUsedDate ?? todayIso(),
  } satisfies MvpProviderRelationship;
}

export function normaliseMatchingRequest(request: Partial<MvpMatchingRequest> & {
  roleNeed: string;
  id?: string;
  apprenticeshipStandardId?: string;
}) {
  return {
    id: request.id ?? createMvpId("match"),
    roleNeed: request.roleNeed,
    department: request.department?.trim() ?? "",
    futureCapability: request.futureCapability?.trim() ?? "",
    employerSize: request.employerSize ?? "",
    programmeId: request.programmeId ?? "",
    linkedStandardId: request.linkedStandardId ?? request.apprenticeshipStandardId ?? "",
    learnerCount: request.learnerCount ?? 1,
    sites: normaliseTagValues(request.sites),
    deliveryPreference: request.deliveryPreference ?? "Blended",
    fundingPosition: request.fundingPosition ?? "Potentially funded through levy/co-investment",
    urgency: request.urgency ?? "Exploring",
    notes: request.notes ?? "",
    businessProblems: normaliseTagValues(request.businessProblems),
    targetRoles: normaliseTagValues(request.targetRoles),
    technologies: normaliseTagValues(request.technologies),
    industries: normaliseTagValues(request.industries),
    status: request.status ?? "Submitted",
    shortlistProviderIds: normaliseTagValues(request.shortlistProviderIds),
    createdAt: request.createdAt ?? nowIso(),
    updatedAt: request.updatedAt ?? nowIso(),
  } satisfies MvpMatchingRequest;
}

function migrateLegacyWorkspace(parsed: LegacyWorkspace): MvpWorkspaceData {
  const empty = createEmptyMvpWorkspace();
  const legacyProviders = Array.isArray(parsed.providers) ? parsed.providers : [];

  const providerProgrammes = legacyProviders.flatMap((provider) =>
    (provider.programmes ?? []).flatMap((programme) => {
      const apprenticeshipStandardId = programme.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(programme.standardName ?? programme.programmeName ?? "");
      if (!apprenticeshipStandardId) return [];
      const standard = getApprenticeshipStandard(apprenticeshipStandardId);
      const historical = programme.fundingStatus === "defunded_for_new_starts";
      return [normaliseProviderProgramme({
        id: programme.programmeId ?? `${provider.providerId}-${apprenticeshipStandardId.toLowerCase()}`,
        providerId: provider.providerId,
        programmeName: programme.programmeName ?? standard?.title ?? "Provider programme",
        shortDescription: programme.notes ?? "Migrated from the previous provider catalogue.",
        fullDescription: programme.notes ?? "Migrated from the previous provider catalogue.",
        targetIndustries: provider.industries ?? provider.sectors ?? [],
        targetJobRoles: [],
        businessProblemsSolved: [],
        skillsDeveloped: [],
        technologiesCovered: provider.technologies ?? [],
        expectedOutcomes: [],
        deliveryModels: splitMvpList(programme.deliveryMode ?? "Provider confirmation required"),
        regions: programme.regions ?? provider.regions ?? ["England"],
        duration: standard?.typicalDuration ?? "Duration to confirm",
        fundingRoute: "Potentially funded through levy/co-investment",
        linkedStandardId: apprenticeshipStandardId,
        linkedStandardIds: [apprenticeshipStandardId],
        status: historical ? "Defunded / unavailable for new starts" as const : "Needs verification" as const,
        verificationStatus: programme.verificationStatus === "verified" ? "Verified from provider website" as const : "Needs manual verification" as const,
        sourceUrl: programme.sourceUrl ?? provider.website,
        notes: programme.notes ?? "Migrated from the previous provider catalogue.",
        recordStatus: "Active" as const,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })];
    }),
  );

  const roles = (parsed.roles ?? []).map((role) => ({
    ...role,
    pathwayMappings: (role.pathwayMappings ?? []).flatMap((mapping) => {
      const apprenticeshipStandardId = mapping.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(mapping.pathwayTitle ?? "");
      return apprenticeshipStandardId ? [{ ...mapping, apprenticeshipStandardId } as MvpPathwayMapping] : [];
    }),
  })) as MvpRole[];

  const employees = Array.isArray(parsed.employees)
    ? parsed.employees.map((employee) => ({
        ...employee,
        jobTitle: employee.jobTitle ?? roles.find((role) => role.id === employee.roleId)?.title ?? "",
      }))
    : [];

  const applications = (parsed.applications ?? []).flatMap((application) => {
    const apprenticeshipStandardId = application.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(application.pathwayTitle ?? "");
    if (!apprenticeshipStandardId || !application.id || !application.employeeId) return [];
    return [normaliseApplication({
      id: application.id,
      employeeId: application.employeeId,
      apprenticeshipStandardId,
      status: application.status ?? "Draft",
      currentOwner: application.currentOwner ?? applicationOwnerForStatus(application.status ?? "Draft"),
      reason: application.reason ?? application.note ?? "",
      careerGoal: application.careerGoal ?? "",
      supportRequired: application.supportRequired ?? "",
      managerNote: application.managerNote ?? application.decisionNotes ?? "",
      submittedAt: application.submittedAt ?? application.submittedDate ?? nowIso(),
      updatedAt: application.updatedAt ?? nowIso(),
      history: Array.isArray(application.history) ? application.history : [],
    })];
  });

  const matchingRequests = (parsed.matchingRequests ?? []).map((request) => {
    const apprenticeshipStandardId = request.linkedStandardId ?? request.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(request.programme ?? "");
    return normaliseMatchingRequest({
      ...request,
      linkedStandardId: apprenticeshipStandardId,
      roleNeed: request.roleNeed ?? request.programme ?? "",
    });
  });

  const enrolments = (parsed.enrolments ?? []).flatMap((enrolment) => {
    const apprenticeshipStandardId = enrolment.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(enrolment.programme ?? "");
    return apprenticeshipStandardId ? [{ ...enrolment, apprenticeshipStandardId } as MvpEnrolment] : [];
  });

  return {
    ...empty,
    profile: {
      ...empty.profile,
      ...(parsed.profile ?? {}),
      priorities: Array.isArray(parsed.profile?.priorities) ? parsed.profile.priorities : [],
    },
    employees,
    employeeDevelopmentProfiles: Array.isArray(parsed.employeeDevelopmentProfiles) ? parsed.employeeDevelopmentProfiles : [],
    roles,
    applications,
    providers: legacyProviders.length ? legacyProviders.map((provider) => {
      const migrated = { ...provider };
      delete migrated.programmes;
      return normaliseProviderRecord(migrated);
    }) : empty.providers,
    providerProgrammes: providerProgrammes.length ? providerProgrammes : empty.providerProgrammes,
    providerRelationships: Array.isArray(parsed.providerRelationships)
      ? parsed.providerRelationships.map((relationship) => normaliseProviderRelationship(relationship as Partial<MvpProviderRelationship> & { id: string; preferredProviderId: string; category: MvpProviderRelationshipCategory }))
      : [],
    organisationProviders: [],
    organisationProgrammes: [],
    matchingRequests,
    enrolments,
  };
}

type LegacyProgramme = {
  programmeId?: string;
  apprenticeshipStandardId?: string;
  programmeName?: string;
  standardName?: string;
  deliveryMode?: string;
  regions?: string[];
  sourceUrl?: string;
  notes?: string;
  verificationStatus?: string;
  fundingStatus?: string;
};

type LegacyProvider = Partial<ProviderCatalogueRecord> & { providerId: string; providerName: string; programmes?: LegacyProgramme[] };
type LegacyMapping = Partial<MvpPathwayMapping> & { pathwayTitle?: string };
type LegacyRole = Omit<MvpRole, "pathwayMappings"> & { pathwayMappings?: LegacyMapping[] };
type LegacyApplication = Partial<MvpApplication> & { apprenticeshipStandardId?: string; pathwayTitle?: string; note?: string; decisionNotes?: string; submittedDate?: string };
type LegacyMatchingRequest = Partial<MvpMatchingRequest> & { apprenticeshipStandardId?: string; programme?: string; roleNeed?: string };
type LegacyEnrolment = Omit<MvpEnrolment, "apprenticeshipStandardId"> & { apprenticeshipStandardId?: string; programme?: string };
type LegacyWorkspace = Partial<Omit<MvpWorkspaceData, "version" | "roles" | "applications" | "matchingRequests" | "enrolments" | "providers">> & {
  version?: number;
  providers?: LegacyProvider[];
  roles?: LegacyRole[];
  applications?: LegacyApplication[];
  matchingRequests?: LegacyMatchingRequest[];
  enrolments?: LegacyEnrolment[];
};

function parseStoredWorkspace(raw: string | null, previousRaw: string | null, legacyRaw: string | null, oldestRaw: string | null) {
  const source = raw ?? previousRaw ?? legacyRaw ?? oldestRaw;
  if (!source) return createEmptyMvpWorkspace();
  try {
    const parsed = JSON.parse(source) as LegacyWorkspace;
    if (parsed.version !== 6) return migrateLegacyWorkspace(parsed);
    const current = parsed as unknown as Partial<MvpWorkspaceData>;
    const empty = createEmptyMvpWorkspace();
    return {
      ...empty,
      ...current,
      version: 6,
      profile: {
        ...empty.profile,
        ...(current.profile ?? {}),
        priorities: Array.isArray(current.profile?.priorities) ? current.profile.priorities : [],
      },
      employees: Array.isArray(current.employees) ? current.employees : [],
      employeeDevelopmentProfiles: Array.isArray(current.employeeDevelopmentProfiles) ? current.employeeDevelopmentProfiles : [],
      roles: Array.isArray(current.roles) ? current.roles : [],
      applications: Array.isArray(current.applications) ? current.applications.map(normaliseApplication) : [],
      providers: Array.isArray(current.providers)
        ? current.providers.map((provider) => normaliseProviderRecord(provider as Partial<ProviderCatalogueRecord> & { providerId: string; providerName: string }))
        : empty.providers,
      providerProgrammes: Array.isArray(current.providerProgrammes)
        ? current.providerProgrammes.map((programme) => normaliseProviderProgramme(programme as Partial<ProviderProgramme> & { id: string; providerId: string }))
        : empty.providerProgrammes,
      providerRelationships: Array.isArray(current.providerRelationships)
        ? current.providerRelationships.map((relationship) => normaliseProviderRelationship(relationship as Partial<MvpProviderRelationship> & { id: string; preferredProviderId: string; category: MvpProviderRelationshipCategory }))
        : [],
      organisationProviders: Array.isArray(current.organisationProviders) ? current.organisationProviders : [],
      organisationProgrammes: Array.isArray(current.organisationProgrammes) ? current.organisationProgrammes : [],
      matchingRequests: Array.isArray(current.matchingRequests)
        ? current.matchingRequests.map((request) => normaliseMatchingRequest(request as Partial<MvpMatchingRequest> & { roleNeed: string; id?: string }))
        : [],
      enrolments: Array.isArray(current.enrolments) ? current.enrolments : [],
      learnerRecords: Array.isArray(current.learnerRecords) ? current.learnerRecords : [],
      eligibilityDeclarations: Array.isArray(current.eligibilityDeclarations) ? current.eligibilityDeclarations : [],
      preEnrolmentChecks: Array.isArray(current.preEnrolmentChecks) ? current.preEnrolmentChecks : [],
      breaksInLearning: Array.isArray(current.breaksInLearning) ? current.breaksInLearning : [],
      withdrawals: Array.isArray(current.withdrawals) ? current.withdrawals : [],
      learnerReviews: Array.isArray(current.learnerReviews) ? current.learnerReviews : [],
      progressUpdates: Array.isArray(current.progressUpdates) ? current.progressUpdates : [],
      assessmentReadiness: Array.isArray(current.assessmentReadiness) ? current.assessmentReadiness : [],
      achievements: Array.isArray(current.achievements) ? current.achievements : [],
      operationalActions: Array.isArray(current.operationalActions) ? current.operationalActions : [],
      lifecycleEvents: Array.isArray(current.lifecycleEvents) ? current.lifecycleEvents : [],
    } satisfies MvpWorkspaceData;
  } catch {
    return createEmptyMvpWorkspace();
  }
}

export function readLocalWorkspace() {
  if (typeof window === "undefined") return createEmptyMvpWorkspace();
  return parseStoredWorkspace(
    window.localStorage.getItem(mvpWorkspaceStorageKey),
    window.localStorage.getItem(previousMvpWorkspaceStorageKey),
    window.localStorage.getItem(legacyMvpWorkspaceStorageKey),
    window.localStorage.getItem(oldestMvpWorkspaceStorageKey),
  );
}

export function persistLocalWorkspace(data: MvpWorkspaceData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(mvpWorkspaceStorageKey, JSON.stringify(data));
}

export function activeApplicationStatuses(): RequestStatus[] {
  return [
    "Draft",
    "Submitted to Line Manager",
    "Awaiting Manager Review",
    "More information requested",
    "Approved by Line Manager",
    "Submitted to Apprenticeship Lead",
    "Awaiting Final Approval",
    "Approved for Enrolment",
  ];
}

export function applicationOwnerForStatus(status: RequestStatus): MvpApplicationOwner {
  if (status === "Approved for Enrolment") return "Provider Partner";
  if (status === "Approved by Line Manager" || status === "Submitted to Apprenticeship Lead" || status === "Awaiting Final Approval") return "Apprenticeship Lead";
  if (status === "Submitted to Line Manager" || status === "Awaiting Manager Review") return "Line Manager";
  if (status === "More information requested") return "Employee";
  if (status === "Completed" || status === "Cancelled") return "Completed";
  return "Employee";
}

export function buildApplicationHistoryEntry(status: RequestStatus, note: string, createdAt = nowIso()): MvpApplicationHistoryEntry {
  return {
    id: createMvpId("history"),
    status,
    owner: applicationOwnerForStatus(status),
    note,
    createdAt,
  };
}

export function normaliseApplication(application: MvpApplication): MvpApplication {
  const history = application.history?.length
    ? application.history
    : [buildApplicationHistoryEntry(application.status, application.reason || "Application record created.", application.submittedAt || nowIso())];
  return {
    ...application,
    currentOwner: application.currentOwner ?? applicationOwnerForStatus(application.status),
    supportRequired: application.supportRequired ?? "",
    history,
  };
}






