export type IntelligenceMetricAvailability = "available" | "unavailable" | "suppressed";

export type IntelligenceSignal = {
  metricId: string;
  label: string;
  value: number | string | null;
  detail: string;
  availability: IntelligenceMetricAvailability;
  evidenceAt: string | null;
};

export type IntelligencePriority = {
  id: string;
  level: "Critical" | "High" | "Medium" | "Low";
  title: string;
  why: string;
  subject: string;
  owner: string;
  nextStep: string;
  href: string;
};

export type WorkforceIntelligenceReport = {
  campaignId: string;
  campaignTitle: string;
  campaignPurpose: string;
  frameworkTitle: string;
  questionnaireVersion: string;
  campaignStatus: "draft" | "open" | "closed";
  closingDate: string | null;
  createdAt: string;
  definition: string;
  invited: number;
  submitted: number;
  nonResponse: number;
  participationPercent: number;
  suppressionThreshold: number;
  suppressed: boolean;
  profiles: Array<{ label: string; count: number }>;
  dimensions: Array<{ id: string; label: string; value: number }>;
  barriers: Array<{ label: string; count: number }>;
  useCases: Array<{ label: string; count: number }>;
  cohorts: Array<{ label: string; count: number }>;
  groups: Array<{
    department: string;
    invited: number;
    submitted: number;
    participationPercent: number;
    suppressed: boolean;
    recurringNeeds: Array<{ label: string; count: number }>;
    blockers: Array<{ label: string; count: number }>;
  }>;
  priorities: Array<{
    id: string;
    finding: string;
    evidence: string;
    group: string;
    intervention: string;
    rationale: string;
    owner: string;
    review: string;
    href: string;
  }>;
  limitation: string;
};

export type FinanceIntelligence = {
  availability: IntelligenceMetricAvailability;
  currentBalancePence: number | null;
  balanceSource: "reported" | "manual" | "unavailable";
  balanceEvidenceAt: string | null;
  importedPeriod: { from: string; to: string } | null;
  latestImportAt: string | null;
  contributionsPence: number | null;
  apprenticeshipSpendPence: number | null;
  expiredPence: number | null;
  unclassifiedCount: number;
  unclassifiedPence: number;
  providerSpend: Array<{ label: string; amountPence: number }>;
  programmeSpend: Array<{ label: string; amountPence: number }>;
  missingInformation: string[];
};

export type IntelligenceMetricDefinition = {
  id: string;
  displayLabel: string;
  source: string;
  population: string;
  calculation: string;
  reportingPeriod: string;
  timestamp: string;
  roleAuthorisation: string;
  missingData: string;
  privacy: string;
};

export type EmployerIntelligenceResponse = {
  generatedAt: string;
  organisation: { id: string; name: string };
  role: "Apprenticeship Lead" | "Employer Admin";
  overview: {
    signals: IntelligenceSignal[];
    priorities: IntelligencePriority[];
    recentActivityCount: number | null;
    sourceStatus: Array<{ source: string; available: boolean; message: string }>;
  };
  workforce: {
    reports: WorkforceIntelligenceReport[];
    sourceAvailable: boolean;
    message: string;
  };
  finance: FinanceIntelligence;
  metricCatalogue: IntelligenceMetricDefinition[];
  limitations: string[];
};
