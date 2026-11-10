import { beforeEach, expect, it, vi } from 'vitest';
import { operationalDetail } from './helpers/operational-action-fixture';
const harness = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, effects: [] as (() => void)[], request: vi.fn(), write: vi.fn() }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  function slot<T>(initial: () => T) { const index = harness.cursor++; if (!(index in harness.cells)) harness.cells[index] = initial(); return index; }
  function memo<T>(factory: () => T, deps?: unknown[]) { const index = slot(() => ({ value: factory(), deps })); const stored = harness.cells[index] as { value: T; deps?: unknown[] }; if (!deps || !stored.deps || deps.some((item, i) => item !== stored.deps?.[i])) { stored.value = factory(); stored.deps = deps; } return stored.value; }
  return { ...actual, useState: <T,>(initial: T | (() => T)) => { const index = slot(() => typeof initial === 'function' ? (initial as () => T)() : initial); return [harness.cells[index], (value: T | ((old: T) => T)) => { harness.cells[index] = typeof value === 'function' ? (value as (old: T) => T)(harness.cells[index] as T) : value; }]; }, useRef: <T,>(value: T) => { const index = slot(() => ({ current: value })); return harness.cells[index]; }, useMemo: memo, useCallback: <T,>(callback: T, deps?: unknown[]) => memo(() => callback, deps), useEffect: (effect: () => void, deps?: unknown[]) => { memo(() => { harness.effects.push(effect); return null; }, deps); } };
});
vi.mock('@/components/levytate-mvp/useRetainedWorkspaceRequest', () => ({ useRetainedWorkspaceRequest: () => harness.request }));
vi.mock('@/components/levytate-mvp/MvpWorkspaceStore', () => ({ useMvpWorkspace: () => ({ meta: { storageMode: 'supabase', userEmail: 'lead@fictional.invalid', organisationId: 'tenant-a', userRole: 'Apprenticeship Lead' }, data: { learnerRecords: [], employees: [] } }) }));
vi.mock('@/lib/levytate/client-session', () => ({ authenticatedClientFetch: harness.write }));
import { OperationalActionDetail } from '@/components/levytate-mvp/OperationalActionDetail';
type Element = { type: unknown; props: Record<string, unknown> };
function descendants(tree: unknown): Element[] { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(descendants); const element = tree as Element; return [element, ...descendants(element.props?.children)]; }
function text(tree: unknown): string { if (typeof tree === 'string') return tree; if (Array.isArray(tree)) return tree.map(text).join(''); return tree && typeof tree === 'object' ? text((tree as Element).props?.children) : ''; }
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
beforeEach(() => { harness.cells = []; harness.cursor = 0; harness.effects = []; harness.request.mockReset(); harness.write.mockReset(); harness.request.mockImplementation(async (_path, init) => Response.json(init?.method ? {} : { ok: true, ...operationalDetail() })); harness.write.mockResolvedValue(Response.json({})); });
it('does not confirm malformed HTTP 200, freezes the form and retains its exact original PATCH for retry', async () => {
  const changed = vi.fn(); const props = { actionId: 'action-a', onBack: vi.fn(), onOpenAction: vi.fn(), onOpenLearner: vi.fn(), onChanged: changed };
  function render() { harness.cursor = 0; return OperationalActionDetail(props); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  let tree = render(); const button = descendants(tree).find(item => item.type === 'button' && text(item.props.children) === 'Acknowledge');
  expect(button).toBeDefined(); await (button!.props.onClick as () => Promise<void>)(); await flush(); tree = render();
  expect(changed).not.toHaveBeenCalled();
  expect(descendants(tree).some(item => item.type === 'fieldset' && item.props.disabled === true)).toBe(true);
  const recovery = descendants(tree).find(item => item.props?.mutation && (item.props.mutation as { pending: boolean }).pending);
  expect(recovery).toBeDefined();
  const action = { ...operationalDetail().action, version: 3, status: 'acknowledged', acknowledgedAt: '2026-11-10T12:00:00Z', acknowledgedBy: 'lead-a' };
  harness.write.mockResolvedValueOnce(Response.json({ ok: true, action }));
  (recovery!.props.mutation as { retry: () => void }).retry(); await flush();
  expect(harness.write).toHaveBeenCalledTimes(2);
  expect(harness.write.mock.calls[0]?.[1].body).toBe(harness.write.mock.calls[1]?.[1].body);
  expect(JSON.parse(harness.write.mock.calls[0]?.[1].body)).toEqual({ command: 'acknowledge', expectedVersion: 2 });
  expect(changed).toHaveBeenCalledOnce();
});

it('keeps recovery modal ownership while the first request is still in flight', async () => {
  const props = { actionId: 'action-a', onBack: vi.fn(), onOpenAction: vi.fn(), onOpenLearner: vi.fn(), onChanged: vi.fn() };
  function render() { harness.cursor = 0; return OperationalActionDetail(props); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  const button = descendants(render()).find(item => item.type === 'button' && text(item.props.children) === 'Acknowledge');
  let resolve!: (value: Response) => void;
  harness.write.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  const request = (button!.props.onClick as () => Promise<void>)(); await flush();
  const recovery = descendants(render()).find(item => item.props?.mutation && (item.props.mutation as { pending: boolean }).pending);
  expect(recovery).toBeDefined(); expect((recovery!.props.mutation as { working: boolean }).working).toBe(true);
  resolve(Response.json({})); await request;
  expect((descendants(render()).find(item => item.props?.mutation)!.props.mutation as { pending: boolean; working: boolean })).toMatchObject({ pending: true, working: false });
});

import { AutopilotOperationsPanel } from '@/components/levytate-mvp/AutopilotOperationsPanel';
import { ProgressReviewIntelligencePanel } from '@/components/levytate-mvp/ProgressReviewIntelligencePanel';
it('rejects malformed successful Autopilot reads before rendering incomplete lanes', async () => {
  const response = async () => Response.json({ ok: true, workspace: { brief: {}, lanes: {} } }); harness.request.mockImplementation(response); vi.stubGlobal('fetch', response);
  function render() { harness.cursor = 0; return AutopilotOperationsPanel({ onOpenAction: vi.fn() }); }
  try { render(); harness.effects.splice(0).forEach(effect => effect()); await flush(); expect(() => render()).not.toThrow(); expect(text(render())).not.toContain('Nothing needs attention right now'); }
  finally { vi.unstubAllGlobals(); }
});
it('does not report zero Intelligence findings after a malformed successful analysis', async () => {
  harness.request.mockImplementation(async () => Response.json({}));
  function render() { harness.cursor = 0; return ProgressReviewIntelligencePanel({ enabled: true }); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  const output = text(render()); expect(output).not.toContain('found 0'); expect(output).not.toContain('No signals need human review yet');
});

import { fictionalAutopilot, fictionalIntelligence, intelligenceScope } from './helpers/intelligence-client-fixture';
it('retains the actual Autopilot refresh handler request across a lost response and confirms its same key', async () => {
  harness.request.mockImplementation(async () => Response.json({ ok: true, workspace: fictionalAutopilot() }));
  function render() { harness.cursor = 0; return AutopilotOperationsPanel({ onOpenAction: vi.fn() }); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  const button = descendants(render()).find(item => item.type === 'button' && text(item.props.children).includes('Refresh intelligence')); expect(button).toBeDefined();
  harness.write.mockRejectedValueOnce(new Error('Lost response'));
  await (button!.props.onClick as () => Promise<void>)(); await flush();
  const recovery = descendants(render()).find(item => item.props?.mutation && (item.props.mutation as { pending: boolean }).pending); expect(recovery).toBeDefined();
  const original = JSON.parse(harness.write.mock.calls[0]?.[1].body);
  expect(original.action).toBe('refresh'); expect(original.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  harness.write.mockResolvedValueOnce(Response.json({ ok: true, workspace: { ...fictionalAutopilot(), confirmation: { ...intelligenceScope, ...original, signalId: null, revision: 1 } } }));
  (recovery!.props.mutation as { retry: () => void }).retry(); await flush();
  expect(harness.write.mock.calls[1]?.[1].body).toBe(harness.write.mock.calls[0]?.[1].body);
  expect((descendants(render()).find(item => item.props?.mutation)!.props.mutation as { pending: boolean }).pending).toBe(false);
});
it('keeps the actual Intelligence accept review until exact target/key/revision and linked action are confirmed', async () => {
  const read = fictionalIntelligence(); const onSignalContext = vi.fn();
  harness.request.mockImplementation(async () => Response.json(read));
  function render() { harness.cursor = 0; return ProgressReviewIntelligencePanel({ enabled: true, onSignalContext }); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  const open = descendants(render()).find(item => item.type === 'button' && text(item.props.children).startsWith('Review evidence')); expect(open).toBeDefined(); (open!.props.onClick as () => void)();
  const accept = descendants(render()).find(item => item.type === 'button' && text(item.props.children) === 'Accept action'); expect(accept).toBeDefined();
  harness.write.mockResolvedValueOnce(Response.json({ ok: true, signal: {} })); (accept!.props.onClick as () => void)(); await flush();
  expect(onSignalContext).not.toHaveBeenCalled();
  const recovery = descendants(render()).find(item => item.props?.mutation && (item.props.mutation as { pending: boolean }).pending); expect(recovery).toBeDefined();
  const original = JSON.parse(harness.write.mock.calls[0]?.[1].body); const selected = read.signals.find(signal => signal.id === original.signalId)!;
  expect(original.expectedRevision).toBe(1); expect(original.action).toBe('accept');
  harness.write.mockResolvedValueOnce(Response.json({ ok: true, signal: { ...selected, revision: 2, status: 'accepted', linkedOperationalActionId: 'action-a' }, confirmation: { ...intelligenceScope, idempotencyKey: original.idempotencyKey, action: original.action, signalId: original.signalId, revision: 2 } }));
  (recovery!.props.mutation as { retry: () => void }).retry(); await flush();
  expect(harness.write.mock.calls[1]?.[1].body).toBe(harness.write.mock.calls[0]?.[1].body); expect(onSignalContext).toHaveBeenCalledOnce();
  expect((descendants(render()).find(item => item.props?.mutation)!.props.mutation as { pending: boolean }).pending).toBe(false);
});

import { analyseOperationsAutopilot, autopilotLanes, buildOperationsBrief } from '@/lib/levytate/autopilot/operations-autopilot';
function applicationWorkflowWorkspace(owner: 'Apprenticeship Lead' | 'Provider Partner', linked = false) {
  const signals = analyseOperationsAutopilot({ organisationId: intelligenceScope.organisationId, now: '2026-11-10T12:00:00Z', learners: [], actions: [], applications: [{ id: 'application-workflow', employeeId: 'person-workflow', employeeName: 'Fictional Workflow Applicant', status: owner === 'Apprenticeship Lead' ? 'Awaiting Final Approval' : 'Approved for Enrolment', currentOwner: owner, updatedAt: '2026-10-01T12:00:00Z' }] }).map(signal => ({ ...signal, revision: 1, status: 'new' as const, ...(linked ? { linkedOperationalActionId: 'old-generic-action' } : {}) }));
  return { ...fictionalAutopilot(), brief: buildOperationsBrief(signals), lanes: Object.fromEntries(autopilotLanes.map(lane => [lane, signals.filter(signal => signal.lane === lane)])) };
}
function renderIsolatedChild(item: Element) {
  const cells = harness.cells, cursor = harness.cursor; harness.cells = []; harness.cursor = 0;
  try { return (item.type as (props: Record<string, unknown>) => unknown)(item.props); }
  finally { harness.cells = cells; harness.cursor = cursor; }
}
function actualSignalRows(tree: unknown) {
  return descendants(tree).filter(item => typeof item.type === 'function' && item.type.name === 'AutopilotLaneSection')
    .flatMap(section => descendants(renderIsolatedChild(section)).filter(item => typeof item.type === 'function' && item.type.name === 'SignalRow').map(renderIsolatedChild));
}
it.each([
  { owner: 'Apprenticeship Lead' as const, label: 'Review application', linked: false },
  { owner: 'Provider Partner' as const, label: 'Open enrolment handoff', linked: false },
  { owner: 'Apprenticeship Lead' as const, label: 'Review application', linked: true },
])('takes $owner suggestions to the exact canonical workflow, including stale linked tasks: $linked', async ({ owner, label, linked }) => {
  const open = vi.fn(); harness.request.mockImplementation(async () => Response.json({ ok: true, workspace: applicationWorkflowWorkspace(owner, linked) }));
  function render() { harness.cursor = 0; return AutopilotOperationsPanel({ onOpenAction: open }); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  const row = actualSignalRows(render()).find(row => text(row).includes('Fictional Workflow Applicant')); expect(row).toBeDefined();
  const destination = descendants(row).find(item => item.type === 'a' && text(item.props.children).includes(label));
  expect(destination).toBeDefined(); expect(destination!.props.href).toBe('/levytate/app?module=Applications&application=application-workflow');
  expect(descendants(row).some(item => item.type === 'button' && text(item.props.children).includes('Open action'))).toBe(false);
  expect(harness.write).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  const review = descendants(row).find(item => item.type === 'button' && text(item.props.children).includes('Review options')); expect(review).toBeDefined();
  (review!.props.onClick as () => void)();
  const drawer = descendants(render()).find(item => typeof item.type === 'function' && item.type.name === 'ActionReviewDrawer'); expect(drawer).toBeDefined();
  const drawerTree = renderIsolatedChild(drawer!);
  expect(text(drawerTree)).toContain(label); expect(text(drawerTree)).toContain('Dismiss'); expect(text(drawerTree)).not.toContain('Create action');
  expect(text(drawerTree)).not.toContain('Action title'); expect(text(drawerTree)).not.toContain('Communication draft');
});
it('removes canonical navigation targets while a real signal command is in flight or uncertain', async () => {
  harness.request.mockImplementation(async () => Response.json({ ok: true, workspace: applicationWorkflowWorkspace('Apprenticeship Lead') }));
  function render() { harness.cursor = 0; return AutopilotOperationsPanel({ onOpenAction: vi.fn() }); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  const row = actualSignalRows(render()).find(row => text(row).includes('Fictional Workflow Applicant'));
  const review = descendants(row).find(item => item.type === 'button' && text(item.props.children).includes('Review options'));
  (review!.props.onClick as () => void)();
  const drawer = descendants(render()).find(item => typeof item.type === 'function' && item.type.name === 'ActionReviewDrawer');
  let resolve!: (response: Response) => void; harness.write.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  const pending = (drawer!.props.onSubmit as (action: string, fields: Record<string, unknown>) => Promise<void>)('dismiss', { reason: 'Fictional reviewed evidence' }); await flush();
  function expectNoNavigation() {
    const tree = render(), target = '/levytate/app?module=Applications&application=application-workflow';
    const currentDrawer = descendants(tree).find(item => typeof item.type === 'function' && item.type.name === 'ActionReviewDrawer')!;
    expect(currentDrawer.props.saving).toBe(true);
    const components = [...actualSignalRows(tree), renderIsolatedChild(currentDrawer)];
    for (const rendered of components) {
      expect(descendants(rendered).some(item => item.type === 'a' && item.props.href === target && text(item.props.children).includes('Review application'))).toBe(false);
      expect(descendants(rendered).some(item => item.props['aria-disabled'] === true && text(item.props.children).includes('Review application'))).toBe(true);
    }
    expect(descendants(tree).some(item => item.props?.mutation && (item.props.mutation as { pending: boolean }).pending)).toBe(true);
  }
  expectNoNavigation(); resolve(Response.json({})); await pending; await flush(); expectNoNavigation();
});
