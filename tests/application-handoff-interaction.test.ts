import { beforeEach, expect, it, vi } from 'vitest';
import { createEmptyMvpWorkspace } from '@/lib/levytate/mvp/workspace';
const harness = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, store: {} as Record<string, unknown> }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual, useEffect: () => {}, useMemo: <T,>(factory: () => T) => factory(), useState: <T,>(initial: T | (() => T)) => { const index = harness.cursor++; if (!(index in harness.cells)) harness.cells[index] = typeof initial === 'function' ? (initial as () => T)() : initial; return [harness.cells[index], (next: T) => { harness.cells[index] = next; }]; } };
});
vi.mock('@/components/levytate-mvp/MvpWorkspaceStore', () => ({ useMvpWorkspace: () => harness.store, WorkspaceSessionRecovery: () => null }));
import { ApplicationsModule } from '@/components/levytate-mvp/ApplicationsModule';
import { ApplicationPreEnrolmentModal } from '@/components/levytate-mvp/ApplicationPreEnrolmentModal';
type Element = { type: unknown; props: Record<string, unknown> };
function descendants(tree: unknown): Element[] { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(descendants); const item = tree as Element; return [item, ...descendants(item.props?.children)]; }
function named(tree: unknown, name: string) { return descendants(tree).find(item => typeof item.type === 'function' && item.type.name === name); }
function invoke(item: Element) { return (item.type as (props: Record<string, unknown>) => unknown)(item.props); }
beforeEach(() => {
  harness.cells = []; harness.cursor = 0;
  const data = createEmptyMvpWorkspace(); data.applications = [{ id: 'approved-fixture', employeeId: 'person', apprenticeshipStandardId: 'ST0118', status: 'Approved for Enrolment', currentOwner: 'Provider Partner', reason: '', careerGoal: '', supportRequired: '', managerNote: '', submittedAt: '2026-11-10', updatedAt: '2026-11-10', history: [] }];
  harness.store = { data, meta: { storageMode: 'supabase', userRole: 'Apprenticeship Lead', userEmail: 'lead@fictional.invalid' }, saveApplication: vi.fn() };
});
it('the real deep-link handoff button closes detail and opens the existing guarded pre-enrolment form for the exact application', () => {
  function render() { harness.cursor = 0; return ApplicationsModule({ initialApplicationId: 'approved-fixture' }); }
  const detail = named(render(), 'ApplicationDetailModal'); expect(detail).toBeDefined();
  const controls = named(invoke(detail!), 'ApplicationHandoffControls'); expect(controls).toBeDefined();
  const button = descendants(invoke(controls!)).find(item => item.type === 'button' && item.props.children === 'Start pre-enrolment'); expect(button).toBeDefined();
  (button!.props.onClick as () => void)();
  const next = render(); expect(named(next, 'ApplicationDetailModal')).toBeUndefined();
  const handoff = descendants(next).find(item => item.type === ApplicationPreEnrolmentModal); expect(handoff).toBeDefined();
  expect(handoff!.props.application).toBe((harness.store.data as ReturnType<typeof createEmptyMvpWorkspace>).applications[0]);
  expect(harness.store.saveApplication).not.toHaveBeenCalled();
});
