import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewCard } from '@/components/levytate-mvp/LearnersModule';
import type { LearnerReview } from '@/lib/levytate/mvp/learner-lifecycle';
const review: LearnerReview = { id: 'fictional-review', organisationId: 'fictional-tenant', learnerRecordId: 'fictional-learner', reviewType: 'provider_review', reviewDate: '2026-11-23', nextReviewDate: '', status: 'scheduled', reviewerName: 'Fictional reviewer', reviewerUserId: '', providerId: 'fictional-provider', summary: 'First appointment planned; no completion implied.', actions: [], supportRequired: '', createdAt: '2026-11-16T12:00:00Z', updatedAt: '2026-11-16T12:00:00Z' };
const render = (change: Partial<LearnerReview> = {}) => renderToStaticMarkup(createElement(ReviewCard, { title: 'Provider review', review: { ...review, ...change }, empty: 'No review' }));
describe('actual learner review card distinguishes appointments from observations', () => {
  it('labels a real scheduled date without saying the appointment is unscheduled or completed', () => {
    const html = render(); expect(html).toContain('Scheduled appointment'); expect(html).toContain('23 Nov 2026');
    expect(html).not.toContain('Next not scheduled'); expect(html).not.toContain('Completed');
  });
  it('does not advertise a retained next-date field as a current plan after cancellation', () => {
    const html = render({ status: 'cancelled', nextReviewDate: '2026-12-23' }); expect(html).toContain('Cancelled'); expect(html).toContain('No active follow-up plan'); expect(html).not.toContain('Next 23 Dec');
  });
  it('preserves the completed review follow-up label', () => {
    const html = render({ status: 'completed', nextReviewDate: '2026-12-23' }); expect(html).toContain('Completed'); expect(html).toContain('Next 23 Dec 2026');
  });
});
