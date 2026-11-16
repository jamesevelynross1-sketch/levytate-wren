import { describe, expect, it } from 'vitest';
import { analyseOperationsAutopilot, type AutopilotAnalysisInput, type AutopilotReviewInput } from '@/lib/levytate/autopilot/operations-autopilot';

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
});
