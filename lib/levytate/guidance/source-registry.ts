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

export const guidanceItemReviewStatuses = [
  "Draft",
  ...guidanceReviewStatuses,
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
export type GuidanceItemReviewStatus = typeof guidanceItemReviewStatuses[number];
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
  body: GuidanceItemBody;
  reviewStatus: GuidanceItemReviewStatus;
  copilotApproved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuidanceItemBody = {
  plainEnglishExplanation: string;
  whyItMatters: string;
  employerAction: string;
  practicalChecklist: string[];
  commonMistake: string;
  applicableFundingYear: string;
  effectiveDate: string;
  applicableStartDateFrom: string;
  applicableStartDateTo: string;
  lastReviewedDate: string;
  reviewer: string;
  status: GuidanceItemReviewStatus;
};

export type GuidanceItemWithSources = GuidanceItem & {
  sources: GuidanceSource[];
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

const commonItemDates = {
  applicableFundingYear: "2025-2026",
  effectiveDate: "2025-08-01",
  applicableStartDateFrom: "2025-08-01",
  applicableStartDateTo: "2026-07-31",
  lastReviewedDate: "2026-07-10",
  reviewer: "LevyTate guidance review",
  status: "Approved" as GuidanceItemReviewStatus,
};

export const approvedGuidanceItemSeeds: Array<GuidanceItem & { sourceIds: string[] }> = [
  {
    id: "guidance-item-how-apprenticeship-levy-funding-works",
    title: "How apprenticeship levy funding works",
    summary: "Levy-paying employers use their apprenticeship service account to access funds for eligible apprenticeship training and assessment.",
    guidanceCategory: "Funding and levy",
    reviewStatus: "Approved",
    copilotApproved: true,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    sourceIds: ["guidance-source-funding-rules-2025-2026", "guidance-source-manage-apprenticeship-funds"],
    body: {
      ...commonItemDates,
      plainEnglishExplanation: "If an employer pays the apprenticeship levy, funds are accessed through the apprenticeship service. The amount entering the account is based on levy declared through payroll, adjusted for the proportion of the pay bill paid to employees living in England, with the government top-up applied through the service.",
      whyItMatters: "Employers need to understand the funding position before approving starts, agreeing provider costs or planning cohorts.",
      employerAction: "Keep finance, payroll, HR and apprenticeship leads aligned on the levy position before confirming a programme start.",
      practicalChecklist: [
        "Confirm the organisation has access to the apprenticeship service.",
        "Check who can approve apprenticeship data and training costs.",
        "Confirm the planned start date falls in the correct funding year.",
        "Check that the selected programme and provider are eligible before committing.",
      ],
      commonMistake: "Treating levy as a general training budget. Levy funds can only be used within the apprenticeship funding rules.",
    },
  },
  {
    id: "guidance-item-employer-co-investment-explained",
    title: "Employer co-investment explained",
    summary: "Non-levy employers usually share the cost of apprenticeship training and assessment with government up to the funding band maximum.",
    guidanceCategory: "Funding and levy",
    reviewStatus: "Approved",
    copilotApproved: true,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    sourceIds: ["guidance-source-funding-rules-2025-2026", "guidance-source-manage-apprenticeship-funds"],
    body: {
      ...commonItemDates,
      plainEnglishExplanation: "Co-investment applies where the employer does not pay the apprenticeship levy or where levy funds are not available for the full cost. For starts on or after 1 April 2019, the employer contribution is normally 5% of eligible training and assessment costs, with government paying the remainder up to the funding band maximum.",
      whyItMatters: "Approvers need to understand whether an apprenticeship requires an employer cash contribution before committing a department or site.",
      employerAction: "Confirm the likely funding route, funding band and any price above the band before approving the application.",
      practicalChecklist: [
        "Confirm whether the employer pays the levy.",
        "Check whether funds are available or need to be reserved.",
        "Confirm the negotiated provider price and funding band maximum.",
        "Record any employer contribution before final approval.",
      ],
      commonMistake: "Assuming every apprenticeship is fully funded. LevyTate should describe routes as potentially levy-funded or potentially funded through levy/co-investment.",
    },
  },
  {
    id: "guidance-item-employer-responsibilities-before-start",
    title: "Employer responsibilities before an apprentice starts",
    summary: "Before training begins, employers need the right account access, agreements, training plan and role readiness in place.",
    guidanceCategory: "Employer responsibilities",
    reviewStatus: "Approved",
    copilotApproved: true,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    sourceIds: [
      "guidance-source-manage-apprenticeship-funds",
      "guidance-source-apprenticeship-agreement-template",
      "guidance-source-employing-apprentice-agreement",
      "guidance-source-training-your-apprentice",
    ],
    body: {
      ...commonItemDates,
      plainEnglishExplanation: "Before an apprentice starts, the employer should have apprenticeship service access, authority to accept the employer agreement, a signed apprenticeship agreement, a training plan with the provider and apprentice, and a role that can support the required training.",
      whyItMatters: "Incomplete setup causes delayed starts, funding risk and a poor learner experience.",
      employerAction: "Use a start-readiness check before submitting an approved learner to a provider for enrolment.",
      practicalChecklist: [
        "Confirm apprenticeship service access and account permissions.",
        "Confirm the apprenticeship agreement is ready for signature.",
        "Agree the training plan with the provider and apprentice.",
        "Check the line manager can support time, supervision and progress reviews.",
      ],
      commonMistake: "Approving a start before the role, manager and documentation are ready.",
    },
  },
  {
    id: "guidance-item-off-the-job-training-employer-need-to-know",
    title: "Off-the-job training: what employers need to know",
    summary: "Off-the-job training is protected learning time during normal working hours, focused on the knowledge, skills and behaviours in the apprenticeship standard.",
    guidanceCategory: "Employer responsibilities",
    reviewStatus: "Approved",
    copilotApproved: true,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    sourceIds: ["guidance-source-funding-rules-2025-2026", "guidance-source-training-your-apprentice"],
    body: {
      ...commonItemDates,
      plainEnglishExplanation: "Off-the-job training is delivered during the apprentice's normal working hours and must build new knowledge, skills and behaviours directly relevant to the apprenticeship standard. It can be delivered flexibly, including workplace, provider, online or block delivery.",
      whyItMatters: "Managers need to plan operational release time. Without protected learning time, the apprentice and provider may not be able to deliver the programme properly.",
      employerAction: "Agree the expected training pattern with the provider and line manager before approval.",
      practicalChecklist: [
        "Confirm the delivery model and expected learning pattern.",
        "Make sure training time is planned into the employee's workload.",
        "Confirm what does and does not count as off-the-job training.",
        "Review the training plan before the apprentice starts.",
      ],
      commonMistake: "Assuming off-the-job training must always mean one full day away from work each week.",
    },
  },
  {
    id: "guidance-item-prior-learning-and-why-it-matters",
    title: "Prior learning and why it matters",
    summary: "Relevant prior learning helps set the right starting point and may reduce training content, duration or price.",
    guidanceCategory: "Learner responsibilities",
    reviewStatus: "Approved",
    copilotApproved: true,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    sourceIds: [
      "guidance-source-funding-rules-2025-2026",
      "guidance-source-training-your-apprentice",
      "guidance-source-employing-apprentice-agreement",
    ],
    body: {
      ...commonItemDates,
      plainEnglishExplanation: "Prior learning means relevant existing education, training, qualifications, previous apprenticeships or work experience. It should be considered before training starts so the programme is not duplicating what the apprentice already knows.",
      whyItMatters: "Good prior-learning checks improve engagement and may reduce unnecessary training or cost.",
      employerAction: "Ask the provider to complete an initial assessment and explain any impact on training, duration or price before enrolment.",
      practicalChecklist: [
        "Ask the employee about relevant qualifications and previous training.",
        "Capture relevant work experience before provider onboarding.",
        "Confirm the provider's initial assessment outcome.",
        "Record any agreed reduction in content, duration or price.",
      ],
      commonMistake: "Ignoring prior experience and funding a full programme when a tailored route is needed.",
    },
  },
  {
    id: "guidance-item-how-to-choose-training-provider",
    title: "How to choose an apprenticeship training provider",
    summary: "Provider choice should consider the apprenticeship course, delivery fit, employer reviews, learner needs, Ofsted evidence and ways of working.",
    guidanceCategory: "Provider selection",
    reviewStatus: "Approved",
    copilotApproved: true,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    sourceIds: [
      "guidance-source-choose-training-provider",
      "guidance-source-find-apprenticeship-training",
      "guidance-source-find-ofsted-inspection-report",
      "guidance-source-training-courses-service",
    ],
    body: {
      ...commonItemDates,
      plainEnglishExplanation: "Once the employer knows the apprenticeship needed, it should choose a training provider that can support the business, learner and delivery model. Official services can help employers find training by course and learner work location, and Ofsted reports can support quality checks.",
      whyItMatters: "Provider fit affects learner experience, manager confidence, operational release and completion outcomes.",
      employerAction: "Shortlist providers against the business need, programme fit, location, delivery model, evidence and working relationship before requesting an introduction.",
      practicalChecklist: [
        "Confirm the apprenticeship course and level.",
        "Check provider availability for the learner's work location.",
        "Review delivery model and communication expectations.",
        "Consider employer reviews, apprentice feedback and Ofsted evidence where available.",
      ],
      commonMistake: "Choosing a provider because they are familiar rather than because they fit the role, learner and business outcome.",
    },
  },
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
