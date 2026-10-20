import type { AssessmentAnswerMap, WorkforceAssessmentResult } from "@/lib/levytate/assessments/domain";
import type { AssessmentQuestion } from "@/lib/levytate/assessments/framework";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";

export type AssessmentStatus = "draft" | "submitted" | "needs_clarification" | "reviewed" | "closed";

export type AssessmentView = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  roleTitle: string;
  campaignId: string | null;
  campaignTitle: string | null;
  questionnaireVersion: string;
  interpretationVersion: string;
  questions: AssessmentQuestion[];
  status: AssessmentStatus;
  visibility: "private" | "manager_shared" | "campaign_shared";
  currentRevision: number;
  activeSubmittedRevision: number | null;
  answers: AssessmentAnswerMap;
  result: WorkforceAssessmentResult | null;
  sharedWithManager: boolean;
  review: AssessmentReviewView | null;
  applicationId: string | null;
  updatedAt: string;
  isOwn: boolean;
};

export type AssessmentReviewView = {
  id: string;
  status: "clarification_requested" | "relevant" | "not_currently_relevant";
  businessContext: string;
  supportAvailable: string;
  constraints: string;
  recommendedAction: string;
  managerComment: string;
  reviewedAt: string;
};

export type AssessmentCampaignView = {
  id: string;
  title: string;
  purpose: string;
  frameworkTitle: string;
  questionnaireVersion: string;
  businessObjectives: string[];
  departments: string[];
  status: "draft" | "open" | "closed";
  closingDate: string | null;
  ownerName: string;
  sharingPolicy: "campaign_owner_summary" | "manager_and_campaign_owner";
  invited: number;
  submitted: number;
  participationPercent: number;
  participantEmployeeIds: string[];
  createdAt: string;
};

export type AssessmentWorkspace = {
  generatedAt: string;
  role: MvpUserRole;
  currentEmployeeId: string | null;
  canCompleteOwnAssessments: boolean;
  questions: AssessmentQuestion[];
  frameworks: Array<{
    frameworkKey: string;
    questionnaireVersion: string;
    interpretationVersion: string;
    title: string;
    shortTitle: string;
    purpose: string;
    audience: string;
    limitations: string[];
    estimatedMinutes: number;
    questionCount: number;
    availableForNew: boolean;
    sections: Array<{ id: string; label: string; introduction: string }>;
    dimensions: Array<{ id: string; label: string; description: string }>;
  }>;
  questionnaireVersion: string;
  interpretationVersion: string;
  disclosure: { private: string; campaign: string; guidance: string };
  assessments: AssessmentView[];
  campaigns: AssessmentCampaignView[];
  availableEmployees: Array<{ id: string; name: string; department: string; jobTitle: string }>;
  reporting: Array<{
    campaignId: string;
    definition: string;
    invited: number;
    submitted: number;
    participationPercent: number;
    suppressionThreshold: number;
    profiles: Array<{ label: string; count: number }>;
    dimensions: Array<{ id: string; label: string; value: number }>;
    barriers: Array<{ label: string; count: number }>;
    useCases: Array<{ label: string; count: number }>;
    cohorts: Array<{ label: string; count: number }>;
    groups: Array<{ department: string; invited: number; submitted: number; participationPercent: number; suppressed: boolean; recurringNeeds: Array<{ label: string; count: number }>; blockers: Array<{ label: string; count: number }> }>;
  }>;
};

type Idempotent = { idempotencyKey: string };

export type AssessmentAction = Idempotent & (
  | { action: "start_assessment"; campaignId?: string; questionnaireVersion?: string }
  | { action: "start_reassessment"; baselineAssessmentId: string }
  | { action: "save_answers"; assessmentId: string; answers: AssessmentAnswerMap; roleContext?: string }
  | { action: "submit"; assessmentId: string }
  | { action: "share_with_manager"; assessmentId: string }
  | { action: "create_campaign"; questionnaireVersion: string; title: string; purpose: string; businessObjectives: string[]; departments: string[]; employeeIds: string[]; closingDate?: string; sharingPolicy: AssessmentCampaignView["sharingPolicy"] }
  | { action: "open_campaign"; campaignId: string }
  | { action: "close_campaign"; campaignId: string }
  | { action: "reopen_campaign"; campaignId: string }
  | { action: "review"; assessmentId: string; status: AssessmentReviewView["status"]; businessContext: string; supportAvailable: string; constraints: string; recommendedAction: string; managerComment: string }
  | { action: "create_application_draft"; assessmentId: string; apprenticeshipStandardId: string }
);

export type AssessmentActionInput = AssessmentAction extends infer Action
  ? Action extends AssessmentAction ? Omit<Action, "idempotencyKey"> : never
  : never;
