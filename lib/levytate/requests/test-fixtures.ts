import type {
  EmployerRequestActor,
  OrganisationRequestCapability,
  ProviderMembership,
  ProviderResponseContent,
  ServiceRequestContent,
  ServiceRequestPrivateContext,
} from "@/lib/levytate/requests/domain";

/** Explicit fictional fixtures for local/automated validation only. */
export const requestsTestIds = {
  employerA: "10000000-0000-4000-8000-000000000001",
  employerB: "10000000-0000-4000-8000-000000000002",
  employerAUser: "20000000-0000-4000-8000-000000000001",
  employerBUser: "20000000-0000-4000-8000-000000000002",
  lineManagerUser: "20000000-0000-4000-8000-000000000003",
  employeeUser: "20000000-0000-4000-8000-000000000004",
  platformAdminUser: "20000000-0000-4000-8000-000000000005",
  providerAMembership: "30000000-0000-4000-8000-000000000001",
  providerBMembership: "30000000-0000-4000-8000-000000000002",
  providerCMembership: "30000000-0000-4000-8000-000000000003",
  providerAAuthSubject: "40000000-0000-4000-8000-000000000001",
  providerBAuthSubject: "40000000-0000-4000-8000-000000000002",
  providerCAuthSubject: "40000000-0000-4000-8000-000000000003",
} as const;

export const requestsTestProviders = [
  { providerId: "provider-qa", providerName: "QA" },
  { providerId: "provider-baltic", providerName: "Baltic Apprenticeships" },
  { providerId: "provider-apprentify", providerName: "Apprentify" },
] as const;

export const requestsTestProgramme = {
  programmeId: "programme-qa-data-analyst",
  providerId: "provider-qa",
  programmeTitle: "Data Analyst",
} as const;

export const requestsTestCapabilities: OrganisationRequestCapability[] = [
  { organisationId: requestsTestIds.employerA, requestsEnabled: true },
  { organisationId: requestsTestIds.employerB, requestsEnabled: true },
];

export const requestsTestEmployerActors: Record<string, EmployerRequestActor> = {
  leadA: {
    userId: requestsTestIds.employerAUser,
    email: "apprenticeship-lead@founding-employer-requests.test",
    organisationId: requestsTestIds.employerA,
    role: "Apprenticeship Lead",
  },
  leadB: {
    userId: requestsTestIds.employerBUser,
    email: "apprenticeship-lead@second-employer-requests.test",
    organisationId: requestsTestIds.employerB,
    role: "Apprenticeship Lead",
  },
  lineManagerA: {
    userId: requestsTestIds.lineManagerUser,
    email: "line-manager@founding-employer-requests.test",
    organisationId: requestsTestIds.employerA,
    role: "Line Manager",
  },
  employeeA: {
    userId: requestsTestIds.employeeUser,
    email: "employee@founding-employer-requests.test",
    organisationId: requestsTestIds.employerA,
    role: "Employee",
  },
  platformAdmin: {
    userId: requestsTestIds.platformAdminUser,
    email: "platform-admin@levytate.test",
    organisationId: requestsTestIds.employerA,
    role: "Platform Admin",
  },
};

export const requestsTestProviderMemberships: ProviderMembership[] = [
  {
    id: requestsTestIds.providerAMembership,
    providerId: "provider-qa",
    email: "opportunities@qa-provider.test",
    displayName: "QA Opportunities Test",
    authSubject: requestsTestIds.providerAAuthSubject,
    authBindingStatus: "bound",
    authBoundAt: "2026-09-10T08:00:00.000Z",
    role: "Provider Admin",
    active: true,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    id: requestsTestIds.providerBMembership,
    providerId: "provider-baltic",
    email: "opportunities@baltic-provider.test",
    displayName: "Baltic Opportunities Test",
    authSubject: requestsTestIds.providerBAuthSubject,
    authBindingStatus: "bound",
    authBoundAt: "2026-09-10T08:00:00.000Z",
    role: "Provider User",
    active: true,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    id: requestsTestIds.providerCMembership,
    providerId: "provider-apprentify",
    email: "opportunities@apprentify-provider.test",
    displayName: "Apprentify Opportunities Test",
    authSubject: requestsTestIds.providerCAuthSubject,
    authBindingStatus: "bound",
    authBoundAt: "2026-09-10T08:00:00.000Z",
    role: "Provider User",
    active: true,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
];

export const requestsTestNeedLedContent: ServiceRequestContent = {
  title: "Data and automation development",
  requestMode: "need_led",
  requirement:
    "Develop around 12 people across Finance and Operations to improve reporting and automate repetitive work.",
  readiness: "planning",
  learnerVolume: { kind: "approximate", count: 12 },
  workplaceLocation: {
    kind: "sites",
    siteIds: ["site-finance", "site-operations"],
    labels: ["Finance office", "Operations centre"],
  },
  deliveryPreferences: ["Blended", "Online"],
  preferredStart: { kind: "month", value: "2027-01" },
  responseDeadline: "2026-10-01",
  departments: ["Finance", "Operations"],
  targetRoles: ["Analysts", "Operational specialists"],
  workforceMix: "existing_employees",
  businessOutcome: "Improve reporting and reduce repetitive administration.",
  workplaceProjectRequirements: "Providers should explain suitable workplace project requirements.",
  additionalNotes: "Address programme fit, delivery commitment, availability and price assumptions.",
};

export const requestsTestPrivateContext: ServiceRequestPrivateContext = {
  privateNotes: "Internal sourcing note that providers must not receive.",
  employeeIds: ["private-employee-1"],
  learnerIds: ["private-learner-1"],
  applicationIds: ["private-application-1"],
  financeReference: "private-finance-reference",
  intelligenceSignalIds: ["private-intelligence-signal"],
  privateProviderConcern: "Private relationship concern.",
};

export const requestsTestProviderResponses: Record<"providerA" | "providerB", ProviderResponseContent> = {
  providerA: {
    proposedProgramme: {
      kind: "canonical_programme",
      programmeId: requestsTestProgramme.programmeId,
      programmeTitle: requestsTestProgramme.programmeTitle,
    },
    whyThisFits: "The programme develops applied data analysis and workplace automation capability.",
    earliestAvailableStart: "January 2027",
    deliveryApproach: { models: ["Blended", "Online"], notes: "Employer workshops plus online learning." },
    cohortCapacity: { kind: "can_accommodate" },
    workplaceRequirements: "Access to relevant data and an accountable workplace manager.",
    learningCommitment: "Protected learning time and an applied workplace project.",
    employerReportingSupport: "Monthly progress reporting and quarterly employer governance reviews.",
    proposedTrainingAssessmentPricePence: 1500000,
    priceBasisAndAssumptions: "Per learner; subject to final eligibility and scope confirmation.",
    additionalCommercialCosts: "None stated.",
    relevantEvidence: "A factual provider reference is available for employer review.",
    exceptionsOrClarifications: "Data access arrangements should be confirmed before start.",
  },
  providerB: {
    proposedProgramme: {
      kind: "alternative_to_discuss",
      description: "Data and AI pathway to be confirmed with the employer",
    },
    whyThisFits: "A discovery phase would establish the appropriate pathway for both functions.",
    earliestAvailableStart: "February 2027",
    deliveryApproach: { models: ["Online"], notes: "Remote workshops and workplace coaching." },
    cohortCapacity: { kind: "minimum_required", value: 15 },
    workplaceRequirements: "Named sponsors and suitable improvement projects in both functions.",
    learningCommitment: "Protected learning time subject to pathway confirmation.",
    employerReportingSupport: "Monthly cohort reporting with exception escalation.",
    proposedTrainingAssessmentPricePence: 1425000,
    priceBasisAndAssumptions: "Indicative per learner pending pathway confirmation.",
    relevantEvidence: "Relevant delivery evidence can be supplied during commercial discussions.",
    exceptionsOrClarifications: "Minimum cohort of 15 is required.",
  },
};

export function createRequestsAcceptanceFixture() {
  return {
    organisationNames: {
      employerA: "Founding Employer Requests Test",
      employerB: "Second Employer Requests Test",
    },
    ids: { ...requestsTestIds },
    capabilities: structuredClone(requestsTestCapabilities),
    employerActors: structuredClone(requestsTestEmployerActors),
    providerMemberships: structuredClone(requestsTestProviderMemberships),
    providers: structuredClone(requestsTestProviders),
    programme: { ...requestsTestProgramme },
    requestContent: structuredClone(requestsTestNeedLedContent),
    privateContext: structuredClone(requestsTestPrivateContext),
    providerResponses: structuredClone(requestsTestProviderResponses),
  };
}
