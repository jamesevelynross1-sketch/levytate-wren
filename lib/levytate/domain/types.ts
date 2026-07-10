export type Role = "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead" | "Admin Console";
export type DemandScenario = "Low" | "Medium" | "High";
export type RequestStatus = "Draft" | "Submitted to Line Manager" | "Awaiting Manager Review" | "More information requested" | "Declined by Line Manager" | "Approved by Line Manager" | "Submitted to Apprenticeship Lead" | "Awaiting Final Approval" | "Declined by Apprenticeship Lead" | "Approved for Enrolment" | "Withdrawn" | "Completed" | "Cancelled";
export type LearnerStatus = "New interest" | "Manager review" | "Lead review" | "Provider introduction" | "Enrolment" | "Live learner";
export type MappingStatus = "Live" | "Ready" | "Review";

export type Pathway = {
  title: string;
  standard: string;
  audience: string;
  businessBenefit: string;
  learnerBenefit: string;
  status: "Live" | "Ready";
  deliveryPartner: string;
  duration: string;
  commitment: string;
  cohort: string;
  departments: string[];
};
export type RoleRecordStatus = "Active" | "Archived";
export type CareerLevel = "Entry" | "Experienced" | "Supervisor" | "Manager" | "Senior Manager";
export type PathwayRecommendationType = "Primary" | "Alternative";
export type FundingRoute = "Potentially levy-funded" | "Potentially funded through levy/co-investment" | "Commercial training budget";
export type DeliveryPreference = "Blended" | "Site based" | "Remote workshops" | "Hybrid" | "Online + coaching";
export type PathwayFundingStatus = "funded" | "defunded_for_new_starts";
export type ManagementContext =
  | "people_management"
  | "operational_management"
  | "technical_management"
  | "project_management"
  | "commercial_management"
  | "data_management"
  | "customer_management";
export type RoleCapabilityTag =
  | "People coordination"
  | "Technical"
  | "Digital"
  | "AI"
  | "Compliance"
  | "People management"
  | "Customer facing"
  | "Operational"
  | "Commercial"
  | "Procurement";

export type ApprenticeshipPathway = {
  id: string;
  title: string;
  standard: string;
  level: string;
  family: string;
  summary: string;
  typicalDuration: string;
  fundingStatus?: PathwayFundingStatus;
  availableForNewApplications?: boolean;
  fundingNote?: string;
};

export type RolePathwayMapping = {
  id: string;
  pathwayId: string;
  recommendationType: PathwayRecommendationType;
  priority: number;
  businessRationale: string;
  fundingRoute: FundingRoute;
  deliveryPreference: DeliveryPreference;
  internalNotes: string;
  managementCapabilitySupported?: ManagementContext;
  specialistPathwayRationale?: string;
};

export type RoleLibraryRole = {
  id: string;
  roleTitle: string;
  department: string;
  businessArea: string;
  siteApplicability: string[];
  careerLevel: CareerLevel;
  typicalProgression: string[];
  futureProgressionRoleIds: string[];
  skillsTags: string[];
  aiTags: RoleCapabilityTag[];
  businessOutcomes: string[];
  overview: string;
  managementContext?: ManagementContext[];
  specialistPathwayRationale?: string;
  recommendations: RolePathwayMapping[];
  status: RoleRecordStatus;
  lastUpdated: string;
};

export type RequestItem = {
  id: number;
  name: string;
  role: string;
  department: string;
  team: string;
  site: string;
  pathway: string;
  manager: string;
  status: RequestStatus;
  note: string;
  careerGoal: string;
  supportRequired: string;
  submittedDate: string;
  decisionNotes: string;
};

export type Learner = {
  name: string;
  role: string;
  department: string;
  site: string;
  programme: string;
  status: LearnerStatus;
  progress: number;
  lineManager: string;
  startDate: string;
};

export type ProviderMapping = {
  roleFamily: string;
  pathway: string;
  standard: string;
  partner: string;
  alternativePartner: string;
  providerEmail: string;
  deliveryModel: string;
  fit: number;
  status: MappingStatus;
  nextAction: string;
  whyRecommended: string;
};

export type EnrolmentSubmission = {
  requestId: number;
  provider: string;
  providerEmail: string;
  programme: string;
  submittedAt: string;
  emailStatus: "Sent";
};

export type EmployeePersona = {
  name: string;
  role: string;
  department: string;
  site: string;
  manager: string;
  careerGoal: string;
  recommendedPathways: number;
  savedOpportunities: number;
  passportActivities: number;
  currentRange: string;
  nextRange: string;
  futureOpportunity: string;
  progression: string[];
  skills: Array<[string, number]>;
};

export type EmployeeRecordStatus = "Active" | "Archived";

export type EmployeeRecord = {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  role: string;
  assignedRoleId: string;
  platformRole: Role;
  manager: string;
  department: string;
  site: string;
  applicationStatus: RequestStatus | "No active application";
  status: EmployeeRecordStatus;
  startDate: string;
  lastUpdated: string;
};
export type AdviceStandard = {
  name: string;
  level: string;
  suitability: number;
  why: string;
  bestFor: string;
  delivery: string;
};

export type ApprenticeshipAdvice = {
  interpretedRole: string;
  workforceNeed: string;
  recommendedStandards: AdviceStandard[];
  alternativeStandards: string[];
  businessRationale: string;
  fundingRoute: string;
  providerMatchingPrompt: string;
};

export type ApprenticeshipStandardStatus = "Live" | "Paused" | "In development" | "Proposed" | "Retired" | "Defunded";

export type ApprenticeshipStandard = {
  id: string;
  title: string;
  referenceCode: string;
  level: number;
  occupationalRoute: string;
  fundingBand: number | null;
  typicalDuration: string;
  status: ApprenticeshipStandardStatus;
  officialUrl: string;
  version: string;
  lastVerified: string;
  lastSyncedAt: string;
  programmeType?: string;
  sourceStatus?: string;
  integratedDegree?: string;
  professionalRecognition?: string;
  lastUpdated?: string;
  jobTitles?: string[];
  overview?: string;
};

export type ProviderVerificationStatus = "verified" | "needs_verification";
export type ProviderRecordStatus = "Active" | "Archived";
export type ProviderType = "Independent training provider" | "University" | "College" | "Specialist consultancy" | "Employer programme partner" | "National provider" | "Regional provider" | "Employer Provider";
export type ProviderProgrammeStatus = "Active" | "Needs verification" | "Paused" | "Not available" | "Defunded / unavailable for new starts";
export type ProviderProgrammeVerificationStatus = "Verified from provider website" | "Needs manual verification" | "Provider confirmed" | "LevyTate reviewed";
export type ProviderProgrammeSeniority = "Entry" | "Early career" | "Experienced" | "Supervisor" | "Manager" | "Mixed";
export type ProviderEmployerSize = "SME" | "Mid-market" | "Large enterprise" | "Mixed employer base";
export type CommercialLinkKind = "Download" | "Brochure" | "Case study" | "Video" | "FAQ";

export type CommercialLink = {
  label: string;
  url: string;
  kind: CommercialLinkKind;
};

export type ProviderCommercialProfile = {
  organisationDescription: string;
  positioningStatement: string;
  logoUrl: string;
  bannerUrl: string;
  primaryContactTitle: string;
  commercialContactName: string;
  commercialContactEmail: string;
  commercialContactTitle: string;
  commercialContactPhone: string;
  yearsEstablished: string;
  learnerNumbers: string;
  employerPartners: string;
  achievementRate: string;
  learnerSatisfaction: string;
  employerSatisfaction: string;
  googleReviewSignal: string;
  awards: string[];
  accreditations: string[];
  caseStudies: string[];
  successStories: string[];
  testimonials: string[];
  videoUrl: string;
  downloads: CommercialLink[];
  pricingNotes: string;
  commercialNotes: string;
  employerSizesSupported: string[];
};

export type ProgrammeCommercialProfile = {
  tagline: string;
  idealAudience: string;
  typicalDepartments: string[];
  futureSkillsDeveloped: string[];
  keyOutcomes: string[];
  locations: string[];
  fundingOptions: string[];
  employerCommitment: string;
  assessmentApproach: string;
  progressionRoutes: string[];
  caseStudies: string[];
  faqs: string[];
  downloads: CommercialLink[];
  employerBenefits: string[];
  futureCapabilityImpact: string[];
  confidenceLabel: string;
};

export type ProviderProgramme = {
  id: string;
  providerId: string;
  programmeName: string;
  shortDescription: string;
  fullDescription: string;
  status: ProviderProgrammeStatus;
  verificationStatus: ProviderProgrammeVerificationStatus;
  targetOrganisations: string[];
  targetIndustries: string[];
  targetJobRoles: string[];
  seniority: ProviderProgrammeSeniority;
  employerSize: ProviderEmployerSize;
  businessProblemsSolved: string[];
  skillsDeveloped: string[];
  technologiesCovered: string[];
  expectedOutcomes: string[];
  deliveryModels: string[];
  regions: string[];
  duration: string;
  cohortOptions: string[];
  commercialNotes: string;
  fundingRoute: FundingRoute;
  linkedStandardId: string;
  linkedStandardIds: string[];
  linkedStandardName: string;
  level: number | null;
  route: string;
  fundingBand: number | null;
  officialUrl: string;
  sourceUrl: string;
  notes: string;
  commercialProfile: ProgrammeCommercialProfile;
  recordStatus: ProviderRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProviderCatalogueRecord = {
  providerId: string;
  providerName: string;
  website: string;
  providerType: ProviderType;
  sectors: string[];
  industries: string[];
  technologies: string[];
  deliveryModels: string[];
  regions: string[];
  employerTypes: string[];
  specialisms: string[];
  contactName: string;
  contactEmail: string;
  ofstedRating: string;
  status: ProviderRecordStatus;
  sourceUrls: string[];
  notes: string;
  commercialProfile: ProviderCommercialProfile;
  lastVerified: string;
  verificationStatus: ProviderVerificationStatus;
};

export type ProviderCatalogueFilters = {
  search: string;
  sector: string;
  technology: string;
  businessChallenge: string;
  deliveryModel: string;
  region: string;
  employerType: string;
  programmeLevel: string;
  programme: string;
  status: ProviderRecordStatus | "All";
};
export type ProviderMatchingRequest = {
  id: number;
  date: string;
  need: string;
  programme: string;
  sites: string;
  learners: string;
  status: "Submitted" | "Under Review" | "Provider Shortlist Being Prepared" | "Shortlist Ready";
  delivery: string;
  funding: string;
  urgency: string;
};

export type ApplicationDraft = {
  name: string;
  role: string;
  department: string;
  team: string;
  site: string;
  pathway: string;
  manager: string;
  reason: string;
  careerGoal: string;
  supportRequired: string;
};

export type SectionKey =
  | "Dashboard"
  | "Recommended Pathways"
  | "Career Pathfinder"
  | "My Applications"
  | "Development Passport"
  | "My Team"
  | "Applications to Review"
  | "Team Skills"
  | "Team Development"
  | "Succession Planning"
  | "Department Analytics"
  | "Site Breakdown"
  | "Apprenticeship Participation"
  | "Department Overview"
  | "Future Demand"
  | "Site Performance"
  | "Organisation Overview"
  | "Levy Utilisation"
  | "Providers"
  | "Programmes"
  | "Compliance"
  | "Site Adoption"
  | "Applications for Final Approval"
  | "Approved for Enrolment"
  | "User Management"
  | "Role Management"
  | "Permission Management"
  | "Provider Management"
  | "Programme Catalogue"
  | "Employer Configuration"
  | "Site Configuration"
  | "Audit Logs"
  | "Platform Analytics"
  | "System Settings"
  | "Explore Pathways"
  | "Recommended Programmes"
  | "Skills Analysis"
  | "Requests"
  | "Approvals"
  | "Enrolments"
  | "Skills Map"
  | "Department Demand"
  | "Future Skills"
  | "Approved Providers"
  | "Performance"
  | "Levy Position"
  | "Forecast"
  | "Reporting"
  | "Learners by Site"
  | "Ask LevyTate AI"
  | "AI Assistant"
  | "Admin";

export type SnapshotMetric = {
  label: string;
  value: string | number;
  copy: string;
  trend: string;
  tooltip: string;
  actionLabel: string;
  target: SectionKey;
  progress: number;
  series: number[];
  accent?: string;
};
