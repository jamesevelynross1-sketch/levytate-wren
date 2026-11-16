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
it('keeps confirmed controls locked after failed or older readback and retries only the pinned GET', async () => {
  const props = { actionId: 'action-a', onBack: vi.fn(), onOpenAction: vi.fn(), onOpenLearner: vi.fn(), onChanged: vi.fn() };
  function render() { harness.cursor = 0; return OperationalActionDetail(props); }
  render(); harness.effects.splice(0).forEach(effect => effect()); await flush();
  const before = render(); const button = descendants(before).find(item => item.type === 'button' && text(item.props.children) === 'Acknowledge');
  harness.write.mockResolvedValueOnce(Response.json({ ok: true, action: { ...operationalDetail().action, version: 3, status: 'acknowledged' } }));
  harness.request.mockRejectedValueOnce(new Error('Read unavailable'));
  await (button!.props.onClick as () => Promise<void>)(); await flush();
  let tree = render();
  expect(props.onChanged).toHaveBeenCalledOnce(); expect(harness.write).toHaveBeenCalledOnce();
  expect(descendants(tree).some(item => item.type === 'fieldset' && item.props.disabled === true)).toBe(true);
  let recovery = descendants(tree).find(item => item.props?.required === true && typeof item.props.retry === 'function');
  expect(recovery).toBeDefined();
  (recovery!.props.retry as () => void)(); await flush(); tree = render();
  // A complete but stale HTTP200 read must not unlock the original version.
  recovery = descendants(tree).find(item => item.props?.required === true && typeof item.props.retry === 'function'); expect(recovery).toBeDefined();
  harness.request.mockResolvedValueOnce(Response.json({ ok: true, ...operationalDetail(), action: { ...operationalDetail().action, version: 3, status: 'acknowledged' } }));
  (recovery!.props.retry as () => void)(); await flush(); tree = render();
  expect(descendants(tree).some(item => item.props?.required === true)).toBe(false);
  expect(descendants(tree).some(item => item.type === 'fieldset' && item.props.disabled === true)).toBe(false);
  expect(harness.write).toHaveBeenCalledOnce(); expect(harness.request.mock.calls.every(([, init]) => !init.method)).toBe(true);
});
