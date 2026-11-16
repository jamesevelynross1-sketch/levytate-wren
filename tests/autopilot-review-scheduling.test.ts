import { describe, expect, it } from 'vitest';
import { analyseOperationsAutopilot, type AutopilotAnalysisInput, type AutopilotReviewInput } from '@/lib/levytate/autopilot/operations-autopilot';
import { completedReviewEvidence, selectReviewPlan } from '@/lib/levytate/mvp/review-planning';
import { deriveBreakAttention, deriveLearnerAttention, deriveLearnerEnrolmentReadiness, deriveReviewSummaries, type LearnerRecordDetail } from '@/lib/levytate/mvp/learner-record-view';
import { deriveAssessmentReadiness } from '@/lib/levytate/mvp/assessment-readiness';
import { buildOrganisationOperationalItems } from '@/lib/levytate/mvp/operations-centre';
import { analyseProgressReviewIntelligence } from '@/lib/levytate/intelligence/progress-review';
import { getLatestReviewByType, type LearnerReview } from '@/lib/levytate/mvp/learner-lifecycle';

const now = '2026-11-16T12:00:00Z';
const planned: AutopilotReviewInput & { createdAt: string } = {
  id: 'first-provider-review', type: 'provider_review', status: 'scheduled',
  reviewDate: '2026-12-16', nextReviewDate: '', createdAt: '2026-11-16T09:00:00Z',
};
const completed: AutopilotReviewInput & { createdAt: string } = {
  id: 'completed-current-review', type: 'provider_review', status: 'completed',
  reviewDate: '2026-11-16', nextReviewDate: '2026-11-23', createdAt: '2026-11-16T11:00:00Z',
};
function analyse(reviews: AutopilotReviewInput[]) {
  const input: AutopilotAnalysisInput = {
    organisationId: 'synthetic-organisation', now, actions: [], applications: [],
    learners: [{ learnerRecordId: 'synthetic-learner', learnerName: 'Fictional learner', providerId: 'synthetic-provider', providerName: 'Fictional provider', programmeId: 'synthetic-programme', programmeName: 'Fictional programme', reviews }],
  };
  return analyseOperationsAutopilot(input);
}
describe('Autopilot review scheduling uses the real enrolment source shape', () => {
  it.each([false, true])('a newly recorded completed review supersedes the earlier future enrolment plan, reversed=%s', reverse => {
    const reviews = [planned, completed];
    const result = analyse(reverse ? reviews.reverse() : reviews);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ signalType: 'review_upcoming', entityId: completed.id, learnerRecordId: 'synthetic-learner', suggestedDueDate: '2026-11-23' });
    expect(result[0].evidence).toEqual([expect.objectContaining({ sourceType: 'learner_review', sourceId: completed.id, sourceDate: '2026-11-23' })]);
  });
  it('a first scheduled review uses its actual appointment date without implying completion', () => {
    const result = analyse([{ ...planned, reviewDate: '2026-11-23' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ signalType: 'review_upcoming', entityId: planned.id, suggestedDueDate: '2026-11-23' });
  });
  it('a newly cancelled plan does not issue a reminder from its retained next-date field', () => {
    expect(analyse([{ ...completed, status: 'cancelled' }])).toEqual([]);
  });
  it('a genuine future appointment outside the reminder window remains quiet', () => {
    expect(analyse([planned])).toEqual([]);
  });
  it.each(['', 'invalid', undefined])('unknown creation metadata %s cannot make a future appointment override a recorded plan', createdAt => {
    const unknown = { ...planned, createdAt } as AutopilotReviewInput;
    expect(selectReviewPlan([unknown, completed]).latest?.id).toBe(completed.id);
    expect(selectReviewPlan([completed, unknown]).latest?.id).toBe(completed.id);
  });
  it('keeps epoch-zero creation metadata and uses deterministic ties independent of input order', () => {
    const a = { ...planned, createdAt: '1970-01-01T00:00:00Z' }, b = { ...completed, createdAt: '1969-12-31T23:59:59Z' };
    expect(selectReviewPlan([b, a]).latest?.id).toBe(a.id);
    const scheduled = { ...planned, createdAt: completed.createdAt }, cancelled = { ...completed, id: 'cancellation', status: 'cancelled' };
    for (const records of [[scheduled, completed], [completed, scheduled]]) expect(selectReviewPlan(records).latest?.id).toBe(completed.id);
    for (const records of [[cancelled, completed], [completed, cancelled]]) expect(selectReviewPlan(records).nextDate).toBe('');
    const tied = { ...completed, id: 'z-record' };
    for (const records of [[completed, tied], [tied, completed]]) expect(selectReviewPlan(records).latest?.id).toBe(tied.id);
  });
  it('separates a later appointment or cancellation from actual completed evidence', () => {
    const rescheduled = { ...planned, reviewDate: '2026-11-25', createdAt: '2026-11-16T11:30:00Z' };
    expect(selectReviewPlan([completed, rescheduled])).toMatchObject({ latest: rescheduled, nextDate: '2026-11-25' });
    expect(completedReviewEvidence([rescheduled, completed])).toEqual([completed]);
    const cancelled = { ...rescheduled, status: 'cancelled' };
    expect(selectReviewPlan([completed, cancelled]).nextDate).toBe('');
    expect(completedReviewEvidence([cancelled, completed])).toEqual([completed]);
  });
  it('completed evidence follows actual review dates even when an older review is entered later', () => {
    const backfilled = { ...completed, id: 'backfilled', reviewDate: '2026-11-01', createdAt: '2026-11-16T11:50:00Z' };
    expect(completedReviewEvidence([backfilled, completed]).map(item => item.id)).toEqual([completed.id, backfilled.id]);
  });
});

function reviewRecord(source: AutopilotReviewInput): LearnerReview {
  return { id: source.id, organisationId: 'synthetic-organisation', learnerRecordId: 'synthetic-learner', reviewType: source.type,
    reviewDate: source.reviewDate, nextReviewDate: source.nextReviewDate, status: source.status as LearnerReview['status'], createdAt: source.createdAt, updatedAt: source.createdAt,
    reviewerName: 'Fictional reviewer', reviewerUserId: 'synthetic-reviewer', providerId: 'synthetic-provider', summary: 'On track: fictional provider review.', actions: [], supportRequired: '' };
}
function learnerDetail(reviews: LearnerReview[]): LearnerRecordDetail {
  const today = now.slice(0, 10), reviewSummaries = deriveReviewSummaries(reviews, today);
  const latestProviderReview = getLatestReviewByType(reviews, 'synthetic-learner', 'provider_review');
  return {
    learnerRecordId: 'synthetic-learner', activityVersion: 'synthetic-version', updatedAt: now,
    learner: { id: 'synthetic-person', name: 'Fictional learner', email: 'learner@example.invalid', jobTitle: '', department: '', team: '', site: '', managerName: '' },
    programme: { programmeId: 'synthetic-programme', providerId: 'synthetic-provider', applicationReference: 'synthetic-application', programmeName: 'Fictional programme', apprenticeshipStandardId: 'ST0118', apprenticeshipStandardTitle: 'Fictional standard', apprenticeshipStandardReference: 'ST0118', providerName: 'Fictional provider' },
    lifecycleStatus: 'enrolled', lifecycleStatusLabel: 'Enrolled', employmentRoute: 'existing_employee_upskill', employmentRouteLabel: 'Upskill', expectedStartDate: today, actualStartDate: today, expectedEndDate: '2028-11-16', actualEndDate: '',
    latestProgress: null, progressPosition: 'No progress data', latestProviderReview, latestLAndDCheckIn: null, latestManagerCheckIn: null,
    reviewSummaries, activeBreak: null, latestBreak: null, breakAttention: deriveBreakAttention(null, null, reviews, today),
    attention: deriveLearnerAttention({ lifecycleStatus: 'enrolled', eligibilityDeclaration: null, preEnrolmentChecks: null, latestProgress: null, latestProviderReview, latestLAndDCheckIn: null, latestManagerCheckIn: null, reviewSummaries, activeBreak: null, assessmentReadiness: null, operationalActions: [], today }),
    eligibilityDeclaration: null, preEnrolmentChecks: null, assessmentReadiness: null,
    assessmentReadinessResult: deriveAssessmentReadiness({ asOf: today, lifecycleStatus: 'enrolled', activeBreak: false, programmeId: 'synthetic-programme', providerId: 'synthetic-provider', readiness: null, latestProgress: null, latestProviderReview }),
    progressHistory: [], reviewHistory: reviews, breaksInLearning: [], lifecycleTimeline: [], operationalActions: [],
    enrolmentReadiness: deriveLearnerEnrolmentReadiness({ employmentRoute: 'existing_employee_upskill', eligibilityDeclaration: null, preEnrolmentChecks: null, programmeId: 'synthetic-programme', providerId: 'synthetic-provider', actualStartDate: today, expectedEndDate: '2028-11-16' }), withdrawal: null, achievement: null,
  };
}
describe('Learners, derived Operations and Progress evidence share the review contract', () => {
  it('lifecycle summaries keep actual completed observations separate from later appointments and another learner', () => {
    const future = reviewRecord({ ...planned, createdAt: '2026-11-16T11:30:00Z' });
    const actual = reviewRecord(completed);
    const foreign = { ...actual, id: 'foreign-review', learnerRecordId: 'another-learner', reviewDate: '2026-11-17' };
    const detail = learnerDetail([future, foreign, actual]);
    expect(detail.latestProviderReview?.id).toBe(actual.id);
    expect(getLatestReviewByType([future], 'synthetic-learner', 'provider_review')).toBeNull();
    expect(getLatestReviewByType([{ ...actual, status: 'action_required' }, future], 'synthetic-learner', 'provider_review')?.status).toBe('action_required');
    expect(deriveReviewSummaries([future, actual], now.slice(0, 10)).provider).toMatchObject({ latest: { id: planned.id, status: 'scheduled' }, nextDate: '2026-12-16' });
  });
  it('derives the same current follow-up date and canonical review source as Autopilot', () => {
    const detail = learnerDetail([reviewRecord(planned), reviewRecord(completed)]);
    expect(detail.reviewSummaries.provider).toMatchObject({ latest: { id: completed.id }, nextDate: '2026-11-23', overdue: false });
    const reviews = buildOrganisationOperationalItems([detail], new Date(now)).items.filter(item => item.queueType === 'reviews');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ learnerRecordId: 'synthetic-learner', dueDate: '2026-11-23', persistentActionType: 'record_provider_review' });
    expect(analyse([planned, completed])[0].suggestedDueDate).toBe(reviews[0].dueDate);
  });
  it('keeps scheduled-only and cancelled summaries truthful', () => {
    const scheduled = { ...planned, reviewDate: '2026-11-23' };
    const summary = deriveReviewSummaries([reviewRecord(scheduled)], now.slice(0, 10)).provider;
    expect(summary).toMatchObject({ latest: { status: 'scheduled', reviewDate: '2026-11-23', nextReviewDate: '' }, nextDate: '2026-11-23' });
    const cancelled = { ...scheduled, id: 'cancelled-plan', status: 'cancelled', createdAt: '2026-11-16T12:00:00Z' };
    expect(buildOrganisationOperationalItems([learnerDetail([reviewRecord(scheduled), reviewRecord(cancelled)])], new Date(now)).items.filter(item => item.queueType === 'reviews')).toEqual([]);
  });
  it.each(['completed', 'action_required'] as const)('retains genuine %s evidence while ignoring future scheduled and cancelled narratives', status => {
    const actual = reviewRecord({ ...completed, status });
    const progress = { id: 'synthetic-progress', organisationId: 'synthetic-organisation', learnerRecordId: 'synthetic-learner', updateDate: '2026-11-16', targetProgressPercentage: 30, actualProgressPercentage: 5, variancePercentage: -25, progressSource: 'provider_report' as const, sourceReference: 'Fictional evidence', summary: '', supportAction: '', updatedBy: 'lead@example.invalid', createdAt: now };
    const input = { organisationId: 'synthetic-organisation', learnerRecordId: 'synthetic-learner', providerId: 'synthetic-provider', programmeId: 'synthetic-programme', now, progressUpdates: [progress], reviews: [reviewRecord(planned), reviewRecord({ ...planned, id: 'cancelled', status: 'cancelled' }), actual] };
    const result = analyseProgressReviewIntelligence(input);
    expect(result.facts.providerReviews.map(item => item.id)).toEqual([completed.id]);
    expect(result.signals.find(item => item.signalType === 'review_progress_inconsistency')?.evidence.map(item => item.sourceId)).toEqual([completed.id, progress.id]);
    input.reviews.pop();
    expect(analyseProgressReviewIntelligence(input).signals.some(item => item.signalType === 'review_progress_inconsistency')).toBe(false);
  });
});
