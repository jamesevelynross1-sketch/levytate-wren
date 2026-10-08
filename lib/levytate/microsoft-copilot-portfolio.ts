import { activeApplicationStatuses, type MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";

const activeLearnerStatuses = new Set(["enrolled", "break_in_learning", "assessment_preparation", "in_assessment"]);
const programmeMixLimit = 20;

export type MicrosoftCopilotOperationsPortfolio = {
  activeLearners: number;
  preEnrolmentApplications: number;
  providerReviewsDueNext14Days: number;
  selectedProviderCount: number;
  selectedProgrammeCount: number;
  programmeMix: Array<{ programmeName: string; activeLearnerCount: number }>;
};

export function buildMicrosoftCopilotOperationsPortfolio(
  data: Pick<MvpWorkspaceData,
    "applications" | "learnerRecords" | "learnerReviews" | "organisationProviders" | "organisationProgrammes" | "providerProgrammes"
  >,
  today = new Date().toISOString().slice(0, 10),
): MicrosoftCopilotOperationsPortfolio {
  const activeLearners = data.learnerRecords.filter((record) =>
    record.recordStatus === "Active" && activeLearnerStatuses.has(record.lifecycleStatus)
  );
  const liveApplicationIds = new Set(activeLearners.map((record) => record.applicationId).filter(Boolean));
  const preEnrolmentApplications = data.applications.filter((application) =>
    activeApplicationStatuses().includes(application.status) && !liveApplicationIds.has(application.id)
  ).length;
  const activeLearnerIds = new Set(activeLearners.map((record) => record.id));
  const latestProviderReviewByLearner = new Map<string, (typeof data.learnerReviews)[number]>();
  for (const review of data.learnerReviews) {
    if (review.reviewType !== "provider_review" || !activeLearnerIds.has(review.learnerRecordId)) continue;
    const previous = latestProviderReviewByLearner.get(review.learnerRecordId);
    if (!previous || review.reviewDate > previous.reviewDate || (review.reviewDate === previous.reviewDate && review.updatedAt > previous.updatedAt)) {
      latestProviderReviewByLearner.set(review.learnerRecordId, review);
    }
  }
  const dueThrough = addUtcDays(today, 14);
  const providerReviewsDueNext14Days = [...latestProviderReviewByLearner.values()].filter((review) =>
    review.status !== "cancelled" && review.nextReviewDate >= today && review.nextReviewDate <= dueThrough
  ).length;

  const programmeNames = new Map(data.providerProgrammes.map((programme) => [programme.id, programme.programmeName]));
  const programmeCounts = new Map<string, number>();
  for (const learner of activeLearners) {
    const programmeName = programmeNames.get(learner.programmeId)?.trim();
    if (!programmeName) continue;
    programmeCounts.set(programmeName, (programmeCounts.get(programmeName) ?? 0) + 1);
  }
  const programmeMix = [...programmeCounts.entries()]
    .map(([programmeName, activeLearnerCount]) => ({ programmeName, activeLearnerCount }))
    .sort((left, right) => right.activeLearnerCount - left.activeLearnerCount || left.programmeName.localeCompare(right.programmeName))
    .slice(0, programmeMixLimit);

  return {
    activeLearners: activeLearners.length,
    preEnrolmentApplications,
    providerReviewsDueNext14Days,
    selectedProviderCount: new Set(data.organisationProviders.filter((item) => item.status === "Active").map((item) => item.providerId)).size,
    selectedProgrammeCount: new Set(data.organisationProgrammes.filter((item) => item.status === "Active").map((item) => item.programmeId)).size,
    programmeMix,
  };
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
