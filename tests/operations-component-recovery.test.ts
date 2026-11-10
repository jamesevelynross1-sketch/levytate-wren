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
vi.mock('@/components/levytate-mvp/MvpWorkspaceStore', () => ({ useMvpWorkspace: () => ({ meta: { storageMode: 'supabase', userEmail: 'lead@fictional.invalid', organisationId: 'tenant-a', role: 'Apprenticeship Lead' } }) }));
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
