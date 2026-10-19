import type { AssessmentReviewView } from "@/lib/levytate/assessments/api";

export type AssessmentReviewDraft = {
  status: AssessmentReviewView["status"];
  businessContext: string;
  supportAvailable: string;
  constraints: string;
  recommendedAction: string;
  managerComment: string;
};

export type AssessmentCampaignSharingPolicy = "campaign_owner_summary" | "manager_and_campaign_owner";

export async function runAssessmentSaveAndSubmit(
  save: () => Promise<boolean>,
  submit: () => Promise<boolean>,
) {
  const saved = await save();
  if (!saved) return false;
  return submit();
}

export function assessmentReviewDraft(review: AssessmentReviewView | null | undefined): AssessmentReviewDraft {
  return review
    ? {
        status: review.status,
        businessContext: review.businessContext,
        supportAvailable: review.supportAvailable,
        constraints: review.constraints,
        recommendedAction: review.recommendedAction,
        managerComment: review.managerComment,
      }
    : {
        status: "relevant",
        businessContext: "",
        supportAvailable: "",
        constraints: "",
        recommendedAction: "",
        managerComment: "",
      };
}

export function canManagerAccessAssessment(input: {
  currentDirectReport: boolean;
  visibility: "private" | "manager_shared" | "campaign_shared";
  activeShareAddressedToManager: boolean;
  campaignSharingPolicy: AssessmentCampaignSharingPolicy | null;
}) {
  if (!input.currentDirectReport || input.visibility === "private") return false;
  if (input.activeShareAddressedToManager) return true;
  return input.visibility === "campaign_shared" && input.campaignSharingPolicy === "manager_and_campaign_owner";
}

export function campaignSubmissionDisclosure(policy: AssessmentCampaignSharingPolicy) {
  if (policy === "manager_and_campaign_owner") {
    return "After submission, Apprenticeship Leads and Employer Admins can access your individual findings for this campaign. Your current Line Manager can also access them under the campaign policy.";
  }
  return "After submission, Apprenticeship Leads and Employer Admins can access your individual findings for this campaign. Your current Line Manager will only receive individual access if you explicitly share the submitted assessment.";
}
