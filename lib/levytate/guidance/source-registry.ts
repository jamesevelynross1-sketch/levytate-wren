export const guidanceAuthorityLevels = [
  "Primary authority",
  "Official operational guidance",
  "Verified provider evidence",
  "LevyTate interpretation",
] as const;

export const guidanceSourceTypes = [
  "Funding rules",
  "Policy",
  "Employer guidance",
  "Apprentice guidance",
  "Provider register",
  "Inspection report",
  "Apprenticeship standard",
  "Revision report",
  "Agreement",
  "Legislation",
  "Provider website",
  "Provider document",
] as const;

export const guidanceCategories = [
  "Funding and levy",
  "Employer responsibilities",
  "Learner responsibilities",
  "Provider selection",
  "Apprenticeship standards",
  "AI and future skills",
  "Apprenticeship myths",
] as const;

export const guidanceReviewStatuses = [
  "Unreviewed",
  "Review required",
  "Reviewed",
  "Approved",
  "Superseded",
  "Archived",
] as const;

export const guidanceSourceStatuses = [
  "Active",
  "Changed",
  "Superseded",
  "Unavailable",
  "Archived",
] as const;

export type GuidanceAuthorityLevel = typeof guidanceAuthorityLevels[number];
export type GuidanceSourceType = typeof guidanceSourceTypes[number];
export type GuidanceCategory = typeof guidanceCategories[number];
export type GuidanceReviewStatus = typeof guidanceReviewStatuses[number];
export type GuidanceSourceStatus = typeof guidanceSourceStatuses[number];

export type GuidanceRefreshFrequency =
  | "Weekly"
  | "Monthly"
  | "Quarterly"
  | "Annual"
  | "On policy change";

export type GuidanceSource = {
  id: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  authorityLevel: GuidanceAuthorityLevel;
  sourceType: GuidanceSourceType;
  guidanceCategories: GuidanceCategory[];
  jurisdiction: "England" | "UK";
  fundingYear?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  applicableStartDateFrom?: string;
  applicableStartDateTo?: string;
  refreshFrequency: GuidanceRefreshFrequency;
  lastCheckedAt?: string;
  lastChangedAt?: string;
  lastReviewedAt?: string;
  reviewedBy?: string;
  reviewStatus: GuidanceReviewStatus;
  copilotApproved: boolean;
  sourceStatus: GuidanceSourceStatus;
  contentHash?: string;
  lastChangeSummary?: string;
  automatedCheckEnabled: boolean;
  monitoringNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type GuidanceItem = {
  id: string;
  title: string;
  summary: string;
  guidanceCategory: GuidanceCategory;
  body: string;
  reviewStatus: GuidanceReviewStatus;
  copilotApproved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuidanceItemSource = {
  id: string;
  guidanceItemId: string;
  guidanceSourceId: string;
  sourceRole: "Primary" | "Supporting" | "Interpretation";
  createdAt: string;
};

export const copilotGuidanceUnavailableMessage =
  "I cannot confirm this from the approved LevyTate guidance library yet. This should be reviewed by your apprenticeship lead or LevyTate adviser.";

const checkedAt = "2026-07-10T00:00:00.000Z";
const reviewedBy = "LevyTate source registry seed";

function approvedSource(input: Omit<GuidanceSource, "createdAt" | "updatedAt" | "lastCheckedAt" | "lastReviewedAt" | "reviewedBy" | "reviewStatus" | "copilotApproved" | "sourceStatus" | "automatedCheckEnabled">): GuidanceSource {
  return {
    ...input,
    reviewStatus: "Approved",
    copilotApproved: true,
    sourceStatus: "Active",
    automatedCheckEnabled: false,
    lastCheckedAt: checkedAt,
    lastReviewedAt: checkedAt,
    reviewedBy,
    createdAt: checkedAt,
    updatedAt: checkedAt,
  };
}

function reviewRequiredSource(input: Omit<GuidanceSource, "createdAt" | "updatedAt" | "lastCheckedAt" | "lastReviewedAt" | "reviewedBy" | "reviewStatus" | "copilotApproved" | "sourceStatus" | "automatedCheckEnabled">): GuidanceSource {
  return {
    ...input,
    reviewStatus: "Review required",
    copilotApproved: false,
    sourceStatus: "Active",
    automatedCheckEnabled: false,
    lastCheckedAt: checkedAt,
    createdAt: checkedAt,
    updatedAt: checkedAt,
  };
}

export const trustedGuidanceSources: GuidanceSource[] = [
  approvedSource({
    id: "guidance-source-funding-rules-2025-2026",
    title: "Apprenticeship funding rules 2025 to 2026",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/government/publications/apprenticeship-funding-rules-2025-to-2026",
    authorityLevel: "Primary authority",
    sourceType: "Funding rules",
    guidanceCategories: ["Funding and levy", "Employer responsibilities", "Learner responsibilities"],
    jurisdiction: "England",
    fundingYear: "2025-2026",
    effectiveFrom: "2025-08-01",
    effectiveTo: "2026-07-31",
    applicableStartDateFrom: "2025-08-01",
    applicableStartDateTo: "2026-07-31",
    refreshFrequency: "On policy change",
    notes: "Primary funding rule source for new starts in the 2025 to 2026 funding year.",
  }),
  reviewRequiredSource({
    id: "guidance-source-funding-rules-2026-2027",
    title: "Apprenticeship funding rules and assessment plan guidance 2026 to 2027",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/government/publications/apprenticeship-funding-rules-and-assessment-plan-guidance-2026-to-2027",
    authorityLevel: "Primary authority",
    sourceType: "Funding rules",
    guidanceCategories: ["Funding and levy", "Employer responsibilities", "Learner responsibilities"],
    jurisdiction: "England",
    fundingYear: "2026-2027",
    effectiveFrom: "2026-08-01",
    effectiveTo: "2027-07-31",
    applicableStartDateFrom: "2026-08-01",
    applicableStartDateTo: "2027-07-31",
    refreshFrequency: "On policy change",
    notes: "Future funding-year rules. Requires LevyTate review before Copilot use.",
  }),
  approvedSource({
    id: "guidance-source-funding-rules-index",
    title: "Apprenticeship funding rules",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/guidance/apprenticeship-funding-rules",
    authorityLevel: "Primary authority",
    sourceType: "Policy",
    guidanceCategories: ["Funding and levy"],
    jurisdiction: "England",
    refreshFrequency: "On policy change",
    notes: "Index of current and historical apprenticeship funding rules.",
  }),
  reviewRequiredSource({
    id: "guidance-source-2026-2027-summary-of-changes",
    title: "Apprenticeship funding rules summary of changes 2026 to 2027",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/government/publications/apprenticeship-funding-rules-and-assessment-plan-guidance-2026-to-2027/apprenticeship-funding-rules-summary-of-changes-version-1",
    authorityLevel: "Primary authority",
    sourceType: "Revision report",
    guidanceCategories: ["Funding and levy", "Employer responsibilities"],
    jurisdiction: "England",
    fundingYear: "2026-2027",
    refreshFrequency: "On policy change",
    notes: "Change note for 2026 to 2027 rules. Not Copilot approved until reviewed.",
  }),
  approvedSource({
    id: "guidance-source-2025-assessment-changes",
    title: "Changes to apprenticeship assessment 2025 to 2026",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/government/publications/apprenticeship-funding-rules-2025-to-2026/changes-to-apprenticeship-assessment-2025-to-2026",
    authorityLevel: "Primary authority",
    sourceType: "Revision report",
    guidanceCategories: ["Funding and levy", "Employer responsibilities", "Apprenticeship standards"],
    jurisdiction: "England",
    fundingYear: "2025-2026",
    refreshFrequency: "On policy change",
  }),
  approvedSource({
    id: "guidance-source-manage-apprenticeship-funds",
    title: "Manage apprenticeship funds",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/guidance/manage-apprenticeship-funds",
    authorityLevel: "Official operational guidance",
    sourceType: "Employer guidance",
    guidanceCategories: ["Funding and levy", "Employer responsibilities"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-apprenticeship-service-sign-in",
    title: "Sign in to your apprenticeship service account",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/sign-in-apprenticeship-service-account",
    authorityLevel: "Official operational guidance",
    sourceType: "Employer guidance",
    guidanceCategories: ["Funding and levy", "Employer responsibilities"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-employers-hire-apprentice",
    title: "Employing an apprentice",
    publisher: "HM Government",
    sourceUrl: "https://www.gov.uk/employing-an-apprentice",
    authorityLevel: "Official operational guidance",
    sourceType: "Employer guidance",
    guidanceCategories: ["Employer responsibilities", "Provider selection", "Apprenticeship standards"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-training-your-apprentice",
    title: "Training your apprentice",
    publisher: "Apprenticeships.gov.uk",
    sourceUrl: "https://www.apprenticeships.gov.uk/employers/training-your-apprentice",
    authorityLevel: "Official operational guidance",
    sourceType: "Employer guidance",
    guidanceCategories: ["Employer responsibilities", "Learner responsibilities"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-apprenticeship-agreement-template",
    title: "Apprenticeship agreement template",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/government/publications/apprenticeship-agreement-template",
    authorityLevel: "Primary authority",
    sourceType: "Agreement",
    guidanceCategories: ["Employer responsibilities", "Learner responsibilities"],
    jurisdiction: "England",
    refreshFrequency: "Annual",
  }),
  approvedSource({
    id: "guidance-source-employing-apprentice-agreement",
    title: "Apprenticeship agreement and training plan",
    publisher: "HM Government",
    sourceUrl: "https://www.gov.uk/employing-an-apprentice/apprenticeship-agreement",
    authorityLevel: "Official operational guidance",
    sourceType: "Agreement",
    guidanceCategories: ["Employer responsibilities", "Learner responsibilities"],
    jurisdiction: "England",
    refreshFrequency: "Annual",
  }),
  approvedSource({
    id: "guidance-source-choose-training-provider",
    title: "Choose a training provider",
    publisher: "Apprenticeships.gov.uk",
    sourceUrl: "https://www.apprenticeships.gov.uk/employers/choose-training-provider",
    authorityLevel: "Official operational guidance",
    sourceType: "Employer guidance",
    guidanceCategories: ["Provider selection", "Employer responsibilities"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-find-apprenticeship-training",
    title: "Find apprenticeship training if you're an employer",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/employers-find-apprenticeship-training",
    authorityLevel: "Official operational guidance",
    sourceType: "Provider register",
    guidanceCategories: ["Provider selection", "Apprenticeship standards"],
    jurisdiction: "England",
    refreshFrequency: "Monthly",
  }),
  approvedSource({
    id: "guidance-source-training-courses-service",
    title: "Find apprenticeship training courses",
    publisher: "Department for Education",
    sourceUrl: "https://findapprenticeshiptraining.apprenticeships.education.gov.uk/courses",
    authorityLevel: "Official operational guidance",
    sourceType: "Apprenticeship standard",
    guidanceCategories: ["Provider selection", "Apprenticeship standards"],
    jurisdiction: "England",
    refreshFrequency: "Monthly",
  }),
  approvedSource({
    id: "guidance-source-apar-download",
    title: "Apprenticeship provider and assessment register",
    publisher: "Department for Education",
    sourceUrl: "https://download.apprenticeships.education.gov.uk/",
    authorityLevel: "Primary authority",
    sourceType: "Provider register",
    guidanceCategories: ["Provider selection"],
    jurisdiction: "England",
    refreshFrequency: "Monthly",
  }),
  approvedSource({
    id: "guidance-source-apar-application",
    title: "Apply to the APAR as an apprenticeship training provider",
    publisher: "Department for Education",
    sourceUrl: "https://www.gov.uk/guidance/apply-to-the-apar-as-an-apprenticeship-training-provider",
    authorityLevel: "Primary authority",
    sourceType: "Provider register",
    guidanceCategories: ["Provider selection"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-find-ofsted-inspection-report",
    title: "Find an Ofsted inspection report",
    publisher: "Ofsted",
    sourceUrl: "https://www.gov.uk/find-ofsted-inspection-report",
    authorityLevel: "Primary authority",
    sourceType: "Inspection report",
    guidanceCategories: ["Provider selection"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-ofsted-reports-service",
    title: "Ofsted inspection reports",
    publisher: "Ofsted",
    sourceUrl: "https://reports.ofsted.gov.uk/",
    authorityLevel: "Primary authority",
    sourceType: "Inspection report",
    guidanceCategories: ["Provider selection"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-skills-england-home",
    title: "Skills England",
    publisher: "Skills England",
    sourceUrl: "https://skillsengland.education.gov.uk/",
    authorityLevel: "Primary authority",
    sourceType: "Policy",
    guidanceCategories: ["Apprenticeship standards", "AI and future skills"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-occupational-maps",
    title: "Occupational maps",
    publisher: "Skills England",
    sourceUrl: "https://occupational-maps.skillsengland.education.gov.uk/",
    authorityLevel: "Primary authority",
    sourceType: "Apprenticeship standard",
    guidanceCategories: ["Apprenticeship standards", "AI and future skills"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  approvedSource({
    id: "guidance-source-skills-england-gov-organisation",
    title: "Skills England organisation profile",
    publisher: "HM Government",
    sourceUrl: "https://www.gov.uk/government/organisations/skills-england",
    authorityLevel: "Primary authority",
    sourceType: "Policy",
    guidanceCategories: ["Apprenticeship standards", "AI and future skills"],
    jurisdiction: "England",
    refreshFrequency: "Quarterly",
  }),
  reviewRequiredSource({
    id: "guidance-source-growth-and-skills-levy",
    title: "Growth and Skills Levy",
    publisher: "Department for Education",
    sourceUrl: "https://find-employer-schemes.education.gov.uk/interim/growth-and-skills-levy",
    authorityLevel: "Primary authority",
    sourceType: "Policy",
    guidanceCategories: ["Funding and levy", "AI and future skills"],
    jurisdiction: "England",
    refreshFrequency: "On policy change",
    notes: "Policy source added for monitoring. Requires manual review before Copilot use.",
  }),
];

export function isGuidanceCategory(value: string): value is GuidanceCategory {
  return guidanceCategories.includes(value as GuidanceCategory);
}

export function normaliseGuidanceCategories(values: unknown): GuidanceCategory[] {
  const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : [];
  return Array.from(new Set(list.map((value) => String(value).trim()).filter(isGuidanceCategory)));
}

function dateIsBeforeOrEqual(left?: string, right?: string) {
  if (!left || !right) return true;
  return Date.parse(left) <= Date.parse(right);
}

function dateIsAfterOrEqual(left?: string, right?: string) {
  if (!left || !right) return true;
  return Date.parse(left) >= Date.parse(right);
}

export function guidanceSourceAppliesTo(source: GuidanceSource, criteria: { fundingYear?: string; startDate?: string; asOf?: string } = {}) {
  if (criteria.fundingYear && source.fundingYear && source.fundingYear !== criteria.fundingYear) return false;
  if (criteria.startDate) {
    if (!dateIsBeforeOrEqual(source.applicableStartDateFrom, criteria.startDate)) return false;
    if (!dateIsAfterOrEqual(source.applicableStartDateTo, criteria.startDate)) return false;
  }
  const asOf = criteria.asOf;
  if (asOf) {
    if (!dateIsBeforeOrEqual(source.effectiveFrom, asOf)) return false;
    if (!dateIsAfterOrEqual(source.effectiveTo, asOf)) return false;
  }
  return true;
}

export function isGuidanceSourceCopilotSafe(source: GuidanceSource, criteria: { fundingYear?: string; startDate?: string; asOf?: string } = {}) {
  return source.sourceStatus === "Active"
    && source.reviewStatus === "Approved"
    && source.copilotApproved
    && guidanceSourceAppliesTo(source, criteria);
}

export function retrieveCopilotSafeGuidanceSources(
  sources: GuidanceSource[],
  criteria: { category?: GuidanceCategory; fundingYear?: string; startDate?: string; asOf?: string } = {},
) {
  return sources
    .filter((source) => isGuidanceSourceCopilotSafe(source, criteria))
    .filter((source) => !criteria.category || source.guidanceCategories.includes(criteria.category))
    .sort((a, b) => guidanceAuthorityLevels.indexOf(a.authorityLevel) - guidanceAuthorityLevels.indexOf(b.authorityLevel));
}

export function buildGuidanceAuthorityBreakdown(sources: GuidanceSource[]) {
  return guidanceAuthorityLevels.map((level) => ({
    authorityLevel: level,
    count: sources.filter((source) => source.authorityLevel === level).length,
  }));
}

export function buildGuidanceCategoryBreakdown(sources: GuidanceSource[]) {
  return guidanceCategories.map((category) => ({
    category,
    count: sources.filter((source) => source.guidanceCategories.includes(category)).length,
  }));
}
