import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyMvpWorkspace, type MvpApplication } from '@/lib/levytate/mvp/workspace';
import { createDefaultApplicationWorkflow } from '@/lib/levytate/application-workflows/domain';
const store = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/components/levytate-mvp/MvpWorkspaceStore', () => ({ useMvpWorkspace: () => store.current, WorkspaceSessionRecovery: () => null }));
import { ApplicationsModule } from '@/components/levytate-mvp/ApplicationsModule';
const at = '2026-11-10T00:00:00Z';
function application(status: MvpApplication['status'] = 'Approved for Enrolment'): MvpApplication {
  return { id: 'application-fixture', employeeId: 'person-fixture', apprenticeshipStandardId: 'ST0118', status, currentOwner: 'Provider Partner', reason: 'Fictional business case', careerGoal: 'Recorded career goal', supportRequired: '', managerNote: '', submittedAt: at, updatedAt: at, history: [{ id: 'approved-event', status, owner: 'Provider Partner', note: 'Recorded approval', createdAt: at }] };
}
function dataFor(app = application()) {
  const data = createEmptyMvpWorkspace(); data.applications = [app]; data.employees = [{ id: app.employeeId, name: 'Fictional Applicant', email: 'person@fictional.invalid', employeeNumber: 'fixture', jobTitle: 'Fictional role', roleId: '', managerId: '', department: 'Test', site: 'Test', platformRole: 'Employee', status: 'Active', startDate: '', createdAt: at, updatedAt: at }]; return data;
}
function modal() { const html = renderToStaticMarkup(createElement(ApplicationsModule, { initialApplicationId: 'application-fixture' })); const start = html.indexOf('role="dialog"'); expect(start).toBeGreaterThan(-1); return html.slice(start); }
beforeEach(() => { store.current = { data: dataFor(), meta: { storageMode: 'supabase', userEmail: 'lead@fictional.invalid', userRole: 'Apprenticeship Lead' }, saveApplication: vi.fn(), updateApplicationStatus: vi.fn() }; });
describe('actual deep-linked Application modal handoff (rendered component, no persistence claim)', () => {
  it('offers the already-authorised pre-enrolment journey inside the approved application detail', () => { expect(modal()).toContain('Start pre-enrolment'); });
  it('also offers handoff from the completed configured-workflow detail', () => {
    const app = application(), version = createDefaultApplicationWorkflow('fictional-tenant', at);
    app.workflow = { version, instance: { id: 'workflow-instance', organisationId: version.organisationId, applicationId: app.id, workflowVersionId: version.id, currentStepId: version.steps.at(-1)!.id, state: 'completed', lockVersion: 3, lastProgressedAt: at } };
    store.current.data = dataFor(app); expect(modal()).toContain('Start pre-enrolment');
  });
  it('opens the existing learner instead of proposing duplicate pre-enrolment', () => {
    const data = dataFor(); data.learnerRecords = [{ id: 'learner-fixture', applicationId: 'application-fixture', recordStatus: 'Active', lifecycleStatus: 'pre_enrolment' }] as typeof data.learnerRecords; store.current.data = data;
    const html = modal(); expect(html).toContain('Open learner record'); expect(html).toContain('module=Learners&amp;learner=learner-fixture'); expect(html).not.toContain('Start pre-enrolment');
  });
  it.each(['Employee', 'Department Head'])('does not grant handoff controls to %s', role => { store.current.meta = { storageMode: 'supabase', userEmail: 'other@fictional.invalid', userRole: role }; expect(modal()).not.toContain('Start pre-enrolment'); });
  it.each(['Draft', 'Awaiting Final Approval', 'Declined by Apprenticeship Lead', 'Cancelled', 'Withdrawn'] as const)('does not offer handoff for %s', status => { store.current.data = dataFor(application(status)); expect(modal()).not.toContain('Start pre-enrolment'); });
});
