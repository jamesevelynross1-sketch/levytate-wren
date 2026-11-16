import { describe, expect, it, vi } from 'vitest';
import { analyseProgressReviewIntelligence, type ProgressReviewAnalysisInput } from '@/lib/levytate/intelligence/progress-review';
import { analyseOperationsAutopilot, type AutopilotAnalysisInput } from '@/lib/levytate/autopilot/operations-autopilot';
import type { LearnerProgressUpdate, LearnerReview } from '@/lib/levytate/mvp/learner-lifecycle';
// JavaScript acceptance helper is intentionally imported without executing a browser.
// @ts-expect-error The executable .mjs helper has no declaration file.
import { verifyOperationsIntelligence } from '../scripts/release-operations-intelligence-browser.mjs';

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
