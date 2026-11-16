import { describe, expect, it, vi } from 'vitest';
import { analyseProgressReviewIntelligence, type ProgressReviewAnalysisInput } from '@/lib/levytate/intelligence/progress-review';
import { analyseOperationsAutopilot, type AutopilotAnalysisInput } from '@/lib/levytate/autopilot/operations-autopilot';
import type { LearnerProgressUpdate, LearnerReview } from '@/lib/levytate/mvp/learner-lifecycle';
// JavaScript acceptance helper is intentionally imported without executing a browser.
// @ts-expect-error The executable .mjs helper has no declaration file.
import { verifyOperationsIntelligence, matchesCanonicalEnrolment, validApplicationReference, matchesRecordedObservation, matchesStoredObservation } from '../scripts/release-operations-intelligence-browser.mjs';

const today = '2026-11-16', now = `${today}T12:00:00Z`, organisationId = '10000000-0000-4000-8000-000000000001', learnerRecordId = 'learner-one';
const progress = (id: string, target: number, actual: number, createdAt: string): LearnerProgressUpdate => ({ id, organisationId, learnerRecordId, updateDate: today, targetProgressPercentage: target, actualProgressPercentage: actual, variancePercentage: actual - target, progressSource: 'provider_report', sourceReference: 'Synthetic acceptance observation only', summary: 'Fictional progress observation', supportAction: '', updatedBy: 'lead@fictional.invalid', createdAt });
const review = (id: string, nextReviewDate: string, summary: string, createdAt: string): LearnerReview => ({ id, organisationId, learnerRecordId, reviewType: 'provider_review', reviewDate: today, nextReviewDate, reviewerName: 'Fictional acceptance reviewer', reviewerUserId: '', providerId: 'provider-one', summary, actions: [], supportRequired: '', status: 'completed', createdAt, updatedAt: createdAt });
function scenario(): ProgressReviewAnalysisInput {
  // The real lifecycle DTO sorts same-date observations by createdAt descending.
  // These are generator tests, not evidence that the browser or persistence ran.
  return { organisationId, learnerRecordId, providerId: 'provider-one', programmeId: 'programme-one', now,
    progressUpdates: [progress('measured', 30, 5, `${today}T11:00:00Z`), progress('core-enrolment', 0, 0, `${today}T10:00:00Z`)],
    reviews: [review('current-review', '2026-11-23', 'Fictional acceptance review: on track. Synthetic scenario only; no real provider report.', `${today}T11:01:00Z`), review('core-scheduled-review', '2026-12-16', 'Initial scheduled review', `${today}T10:00:00Z`)],
  };
}
function autopilot(input = scenario()): AutopilotAnalysisInput {
  return { organisationId, now, applications: [], actions: [], learners: [{ learnerRecordId, learnerName: 'Fictional learner', providerId: 'provider-one', providerName: 'Fictional provider', programmeId: 'programme-one', programmeName: 'Fictional programme', reviews: input.reviews.map(item => ({ id: item.id, type: 'provider_review', nextReviewDate: item.nextReviewDate, reviewDate: item.reviewDate, status: item.status })) }] };
}
describe('current-date Operations acceptance scenario uses actual deterministic analysers', () => {
  it('identifies the stated narrative/metric inconsistency from exact persisted-source identities', () => {
    const result = analyseProgressReviewIntelligence(scenario());
    const signal = result.signals.find(item => item.signalType === 'review_progress_inconsistency');
    expect(signal?.confidence).toBe('High');
    expect(signal?.evidence.map(item => [item.sourceType, item.sourceId])).toEqual([['provider_review', 'current-review'], ['progress_update', 'measured']]);
    expect(result.signals.some(item => item.signalType === 'assessment_or_completion_opportunity')).toBe(false);
  });
  it('does not invent inconsistency without either positive narrative or below-target progress', () => {
    const withoutNarrative = scenario(); withoutNarrative.reviews[0].summary = 'Recorded fictional review';
    const aligned = scenario(); aligned.progressUpdates[0] = progress('measured', 30, 30, `${today}T11:00:00Z`);
    for (const input of [withoutNarrative, aligned]) expect(analyseProgressReviewIntelligence(input).signals.some(item => item.signalType === 'review_progress_inconsistency')).toBe(false);
  });
  it('produces a task-eligible upcoming review without backdated evidence or inserted signals', () => {
    const signals = analyseOperationsAutopilot(autopilot());
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ signalType: 'review_upcoming', entityType: 'review', entityId: 'current-review', learnerRecordId, suggestedActionType: 'record_provider_review' });
    expect(signals[0].linkedOperationalActionId).toBeUndefined();
    expect(signals[0].evidence.map(item => item.sourceId)).toEqual(['current-review']);
  });
  it('names the separate due-with-actions rule if real prior work already exists', () => {
    const input = autopilot();
    input.actions = [{ id: 'existing-work', learnerRecordId, applicationId: 'application-one', employeeId: 'person-one', title: 'Existing fictional support action', description: 'Recorded through the application', actionType: 'address_progress_exception', ownerType: 'Apprenticeship Lead', dueDate: '2026-11-23', status: 'open', sourceUrl: '/levytate/app?module=Operations', updatedAt: now }];
    const signals = analyseOperationsAutopilot(input);
    expect(signals[0]).toMatchObject({ signalType: 'review_due_with_outstanding_actions', entityId: 'current-review', suggestedActionType: 'record_provider_review' });
    expect(signals[0].evidence.map(item => item.sourceId)).toEqual(['current-review', 'existing-work']);
  });
  it('keeps the canonical task already derived by the real review workflow', () => {
    const input = autopilot();
    input.actions = [{ id: 'derived-review-task', learnerRecordId, applicationId: 'application-one', employeeId: 'person-one', title: 'Recorded provider review task', description: 'Existing canonical task from the learner workflow', actionType: 'record_provider_review', ownerType: 'Shared', dueDate: '2026-11-23', status: 'open', sourceUrl: '/levytate/app?module=Learners', updatedAt: now }];
    const reviewSignal = analyseOperationsAutopilot(input).find(signal => signal.entityId === 'current-review');
    expect(reviewSignal).toMatchObject({ signalType: 'review_due_with_outstanding_actions', linkedOperationalActionId: 'derived-review-task', suggestedActionType: 'record_provider_review' });
    expect(input.actions).toHaveLength(1); // Analysis points at existing work; it never writes a duplicate task.
  });
  it('does not create an aged-application signal for a newly started workflow', () => {
    const input = autopilot(); input.learners = [];
    input.applications = [{ id: 'current-application', employeeId: 'person-one', employeeName: 'Fictional person', status: 'Awaiting Final Approval', currentOwner: 'Apprenticeship Lead', updatedAt: now }];
    expect(analyseOperationsAutopilot(input)).toEqual([]);
  });
});

describe('browser helper remains bounded before any request', () => {
  const args = () => {
    const actors = new Map(['a:lead', 'a:manager', 'a:employee', 'b:employee'].map(key => [key, { user: { role: key === 'a:lead' ? 'Apprenticeship Lead' : key === 'a:manager' ? 'Line Manager' : 'Employee' }, tenant: { id: key.startsWith('a:') ? organisationId : '20000000-0000-4000-8000-000000000002' } }]));
    return { app: 'http://127.0.0.1:3000', noPaidModel: true, manifest: { synthetic: true, environment: 'local', run: '30000000-0000-4000-8000-000000000003', tenants: [{ id: organisationId }, { id: '20000000-0000-4000-8000-000000000002' }] }, contexts: actors, backend: vi.fn(() => { throw Error('No requests permitted in guard test'); }), check: vi.fn() };
  };
  it.each(['https://example.test', 'http://user:credential@127.0.0.1:3000'])('refuses non-local or credential-bearing origin %s', async app => {
    const input = { ...args(), app }; await expect(verifyOperationsIntelligence(input)).rejects.toThrow('credential-free loopback URL'); expect(input.backend).not.toHaveBeenCalled();
  });
  it.each([false, undefined])('requires observed no-paid-model launch evidence: %s', async noPaidModel => {
    const input = { ...args(), noPaidModel }; await expect(verifyOperationsIntelligence(input)).rejects.toThrow('Observed local no-paid-model launch evidence required'); expect(input.backend).not.toHaveBeenCalled();
  });
  it('rejects missing cross-tenant scope and an unexpected role before touching sources', async () => {
    const input = args(); input.contexts.get('b:employee')!.tenant.id = organisationId;
    await expect(verifyOperationsIntelligence(input)).rejects.toThrow('Reviewed local genuine four-role contexts required'); expect(input.backend).not.toHaveBeenCalled();
    const wrongRole = args(); wrongRole.contexts.get('a:lead')!.user.role = 'Employee';
    await expect(verifyOperationsIntelligence(wrongRole)).rejects.toThrow('Reviewed local genuine four-role contexts required'); expect(wrongRole.backend).not.toHaveBeenCalled();
  });
});


describe('canonical handoff provenance uses real opaque application identifiers', () => {
  const run = '30000000-0000-4000-8000-000000000003';
  const fixture = (id = `browser-${run}`) => ({ detail: { learnerRecordId: 'learner-one', lifecycleStatus: 'enrolled', learner: { id: 'person-one' }, programme: { applicationReference: id } }, applications: [{ id, organisation_id: organisationId, employee_id: 'person-one' }], learners: [{ id: 'learner-one', organisation_id: organisationId, application_id: id, lifecycle_status: 'enrolled' }] });
  it.each([`browser-${run}`, `application-${run}`])('accepts actual same-tenant enrolment without inventing a prefix: %s', id => {
    const value = fixture(id); expect(matchesCanonicalEnrolment(value.detail, 'learner-one', value.applications, value.learners, organisationId)).toBe(true);
  });
  it('rejects a foreign application, wrong learner link or duplicate handoff', () => {
    const value = fixture();
    expect(matchesCanonicalEnrolment(value.detail, 'learner-one', [{ ...value.applications[0], organisation_id: 'other-tenant' }], value.learners, organisationId)).toBe(false);
    expect(matchesCanonicalEnrolment(value.detail, 'learner-one', [{ ...value.applications[0], employee_id: 'another-person' }], value.learners, organisationId)).toBe(false);
    expect(matchesCanonicalEnrolment(value.detail, 'learner-one', value.applications, [{ ...value.learners[0], application_id: 'another-application' }], organisationId)).toBe(false);
    expect(matchesCanonicalEnrolment(value.detail, 'learner-one', value.applications, [...value.learners, value.learners[0]], organisationId)).toBe(false);
  });
  it.each(['', ' padded', 'trailing ', 'control\nvalue', 'x'.repeat(161), undefined])('rejects unsafe application reference %# before constructing a request', id => {
    expect(validApplicationReference(id)).toBe(false);
  });
});


describe('recorded fictional observation requires the actual lifecycle event contract', () => {
  const before = [[], [], [], []];
  const progress = (): Array<Array<Record<string, unknown>>> => [[{ id: 'new-progress', summary: 'Fictional measurement' }], [], [{ request_id: 'one-command', actor_user_id: 'lead' }], [{ id: 'event-progress', event_type: 'progress_updated', actor_user_id: 'lead', metadata: { progressId: 'new-progress' } }, { id: 'event-behind', event_type: 'learner_identified_behind_target', actor_user_id: 'lead', metadata: { progressId: 'new-progress' } }]];
  it('requires the progress and behind-target events that the actual negative-variance transaction emits', () => {
    expect(matchesRecordedObservation('progress', before, progress(), 'Fictional measurement', 'lead')).toBe(true);
    const missing = progress(); missing[3].pop(); expect(matchesRecordedObservation('progress', before, missing, 'Fictional measurement', 'lead')).toBe(false);
    const duplicate = progress(); duplicate[3].push(duplicate[3][0]); expect(matchesRecordedObservation('progress', before, duplicate, 'Fictional measurement', 'lead')).toBe(false);
  });
  it('refuses counts that belong to another source or actor', () => {
    const otherSource = progress(); otherSource[3] = [{ id: 'event-progress', event_type: 'progress_updated', actor_user_id: 'lead', metadata: { progressId: 'wrong' } }, { id: 'event-behind', event_type: 'learner_identified_behind_target', actor_user_id: 'lead', metadata: { progressId: 'wrong' } }];
    expect(matchesRecordedObservation('progress', before, otherSource, 'Fictional measurement', 'lead')).toBe(false);
    expect(matchesRecordedObservation('progress', before, progress(), 'Fictional measurement', 'another-actor')).toBe(false);
  });
  it('requires exactly the completed provider review event and its own immutable source identity', () => {
    const after = [[], [{ id: 'new-review', summary: 'Fictional provider review' }], [{ request_id: 'one-command', actor_user_id: 'lead' }], [{ id: 'event-review', event_type: 'provider_review_recorded', actor_user_id: 'lead', metadata: { reviewId: 'new-review' } }]];
    expect(matchesRecordedObservation('review', before, after, 'Fictional provider review', 'lead')).toBe(true);
    expect(matchesRecordedObservation('progress', before, after, 'Fictional provider review', 'lead')).toBe(false);
  });
});


it('a bounded continuation checks the existing original receipt/events instead of writing another observation', () => {
  const id = 'learner-progress-learner-one-original-key', source = { id, summary: 'Recorded fictional progress' };
  const records: Array<Array<Record<string, unknown>>> = [[source], [], [{ request_id: 'original-key', actor_user_id: 'lead' }], [{ id: 'event-1', event_type: 'progress_updated', actor_user_id: 'lead', metadata: { progressId: id } }, { id: 'event-2', event_type: 'learner_identified_behind_target', actor_user_id: 'lead', metadata: { progressId: id } }]];
  expect(matchesStoredObservation('progress', source, records, 'lead', 'learner-one')).toBe(true);
  expect(matchesStoredObservation('progress', source, records, 'another', 'learner-one')).toBe(false);
  expect(matchesStoredObservation('progress', source, records, 'lead', 'other-learner')).toBe(false);
  records[2][0] = { request_id: 'different-key', actor_user_id: 'lead' };
  expect(matchesStoredObservation('progress', source, records, 'lead', 'learner-one')).toBe(false);
});
