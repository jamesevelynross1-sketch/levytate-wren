/** Review dates describe appointments/evidence; creation dates order changes to
 * the follow-up plan. A future appointment is not a completed observation.
 * Recording a backfilled review still records a new plan instruction, including
 * an explicitly empty next date; completed evidence keeps its actual chronology. */
type ReviewPlanningRecord = {
  id: string;
  status: string;
  reviewDate: string;
  nextReviewDate: string;
  createdAt: string;
};

function recordedTime(review: ReviewPlanningRecord) {
  const created = Date.parse(review.createdAt);
  return Number.isFinite(created) ? created : null;
}
const statusOrder = (status: string) => status === 'cancelled' ? 3 : status === 'completed' || status === 'action_required' ? 2 : status === 'scheduled' ? 1 : 0;
function recordedNewest(left: ReviewPlanningRecord, right: ReviewPlanningRecord) {
  const leftTime = recordedTime(left), rightTime = recordedTime(right);
  // Untyped historical/demo records may omit creation metadata. An unknown
  // instruction cannot supersede a known one merely by naming a future date.
  if (leftTime === null && rightTime !== null) return 1;
  if (rightTime === null && leftTime !== null) return -1;
  return (leftTime !== null && rightTime !== null ? rightTime - leftTime : 0)
    || statusOrder(right.status) - statusOrder(left.status)
    || right.reviewDate.localeCompare(left.reviewDate)
    || right.id.localeCompare(left.id);
}

export function completedReviewEvidence<T extends ReviewPlanningRecord>(reviews: readonly T[]): T[] {
  return reviews.filter(review => review.status === 'completed' || review.status === 'action_required')
    .sort((left, right) => right.reviewDate.localeCompare(left.reviewDate) || recordedNewest(left, right));
}

export function selectReviewPlan<T extends ReviewPlanningRecord>(reviews: readonly T[]) {
  const latest = [...reviews].sort(recordedNewest)[0] ?? null;
  const nextDate = latest?.status === 'scheduled' ? latest.reviewDate
    : latest?.status === 'completed' || latest?.status === 'action_required' ? latest.nextReviewDate : '';
  return { latest, nextDate };
}
