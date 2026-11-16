import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyMvpWorkspace } from '@/lib/levytate/mvp/workspace';

// Execute the real shell and its effects, without a browser, Auth or API mock.
// Child modules stay React elements; this tests the actual navigation contract,
// not the separately verified server's authorisation or persistence.
const hooks = vi.hoisted(() => ({ cells: [] as unknown[], effects: new Map<number, { deps: unknown[] | undefined; cleanup?: () => void }>(), pending: [] as (() => void)[], cursor: 0, changed: false, store: {} as Record<string, unknown> }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const index = hooks.cursor++;
      if (!(index in hooks.cells)) hooks.cells[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
      return [hooks.cells[index], (next: T | ((prior: T) => T)) => {
        const value = typeof next === 'function' ? (next as (prior: T) => T)(hooks.cells[index] as T) : next;
        if (!Object.is(value, hooks.cells[index])) { hooks.cells[index] = value; hooks.changed = true; }
      }];
    },
    useRef: <T,>(initial: T) => { const index = hooks.cursor++; if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }; return hooks.cells[index]; },
    useMemo: <T,>(factory: () => T) => factory(),
    useCallback: <T,>(callback: T) => callback,
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
      const index = hooks.cursor++, prior = hooks.effects.get(index);
      if (prior && deps && prior.deps && deps.length === prior.deps.length && deps.every((value, at) => Object.is(value, prior.deps![at]))) return;
      hooks.pending.push(() => { prior?.cleanup?.(); const cleanup = effect(); hooks.effects.set(index, { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined }); });
    },
  };
});
vi.mock('@/components/levytate-mvp/MvpWorkspaceStore', () => ({ useMvpWorkspace: () => hooks.store, MvpWorkspaceProvider: () => null, WorkspaceSessionRecovery: () => null }));
vi.mock('@/components/levytate-mvp/DemoPerspectiveSwitcher', () => ({ useDemoPerspectiveSwitcher: () => ({ state: null }), DemoModeIndicator: () => null, DemoPerspectiveMenu: () => null }));
import { LevyTateMvpApp } from '@/components/levytate-mvp/LevyTateMvpApp';
import { LearnersModule } from '@/components/levytate-mvp/LearnersModule';
import { OperationsCentreModule } from '@/components/levytate-mvp/OperationsCentreModule';

type Element = { type: unknown; props: Record<string, unknown> };
function descendants(tree: unknown): Element[] { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(descendants); const item = tree as Element; return [item, ...descendants(item.props?.children)]; }
const listeners = new Map<string, Set<() => void>>();
let location: URL;
const learnerId = 'learner-149592ee-0000-4000-8000-000000000001';
function navigate(query: string) {
  location = new URL(`/levytate/app${query}`, 'https://fictional.invalid');
  for (const callback of listeners.get('popstate') ?? []) callback();
}
function render() {
  let tree: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    hooks.changed = false; hooks.cursor = 0;
    const wrapper = LevyTateMvpApp({}) as unknown as Element;
    const shell = ((wrapper.props.children as Element).props.children as Element);
    tree = (shell.type as (props: Record<string, unknown>) => unknown)(shell.props);
    const pending = hooks.pending.splice(0); pending.forEach(effect => effect());
    if (!hooks.changed) return tree;
  }
  throw new Error('Shell did not settle');
}
function learner(tree = render()) { return descendants(tree).find(item => item.type === LearnersModule); }
beforeEach(() => {
  hooks.cells = []; hooks.effects.clear(); hooks.pending = []; hooks.cursor = 0; hooks.changed = false; listeners.clear();
  hooks.store = { data: createEmptyMvpWorkspace(), meta: { storageMode: 'supabase', userRole: 'Apprenticeship Lead', userEmail: 'lead@fictional.invalid' }, hydrated: true };
  location = new URL(`https://fictional.invalid/levytate/app?module=Learners&learner=${learnerId}`);
  vi.stubGlobal('window', {
    get location() { return location; },
    history: { replaceState: (_state: unknown, _unused: string, url: string) => { location = new URL(url, location); }, pushState: (_state: unknown, _unused: string, url: string) => { location = new URL(url, location); } },
    addEventListener: (type: string, callback: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(callback); },
    removeEventListener: (type: string, callback: () => void) => { listeners.get(type)?.delete(callback); },
  });
});
afterEach(() => { for (const effect of hooks.effects.values()) effect.cleanup?.(); vi.unstubAllGlobals(); });

describe('actual shell learner deep-link effects', () => {
  it('passes the exact permitted learner from the canonical Application link into the real module', () => {
    expect(learner()?.props).toMatchObject({ initialLearnerRecordId: learnerId, initialAction: 'open_learner' });
  });
  it('resolves Back/Forward to another learner and clears the target on a list URL', () => {
    render(); navigate('?module=Learners&learner=learner-second');
    expect(learner()?.props.initialLearnerRecordId).toBe('learner-second');
    navigate('?module=Learners'); expect(learner()?.props.initialLearnerRecordId).toBeUndefined();
  });
  it('does not let an unrelated module carry a target into a later Learners list', () => {
    render(); navigate(`?module=Applications&learner=${learnerId}`); expect(learner()).toBeUndefined();
    navigate('?module=Learners'); expect(learner()?.props.initialLearnerRecordId).toBeUndefined();
  });
  it('clears the target and query for an explicit Back to learners action, including reload', () => {
    (learner()!.props.onBackToList as () => void)();
    expect(learner()?.props.initialLearnerRecordId).toBeUndefined();
    expect(location.searchParams.get('learner')).toBeNull();
    navigate(location.search); expect(learner()?.props.initialLearnerRecordId).toBeUndefined();
  });
  it.each(['', '../other', 'learner/other', 'learner?tenant=other', 'learner\nother', 'x'.repeat(201)])('ignores a malformed learner identifier %j', value => {
    location = new URL(`https://fictional.invalid/levytate/app?module=Learners&learner=${encodeURIComponent(value)}`);
    expect(learner()?.props.initialLearnerRecordId).toBeUndefined();
  });
  it.each(['Employee', 'Line Manager', 'Platform Admin'])('does not activate organisation learner details for %s', role => {
    hooks.store.meta = { storageMode: 'supabase', userRole: role, userEmail: 'person@fictional.invalid' };
    expect(learner()).toBeUndefined();
  });
  it('cannot replace the mounted tenant/account using extra query fields', () => {
    const meta = hooks.store.meta;
    location = new URL(`https://fictional.invalid/levytate/app?module=Learners&learner=${learnerId}&organisationId=foreign&userEmail=foreign`);
    expect(learner()?.props.initialLearnerRecordId).toBe(learnerId); expect(hooks.store.meta).toBe(meta);
  });
  it('preserves the existing Operations in-memory learner action', () => {
    location = new URL('https://fictional.invalid/levytate/app?module=Operations');
    const operations = descendants(render()).find(item => item.type === OperationsCentreModule);
    expect(operations).toBeDefined();
    (operations!.props.onOpenLearner as (target: unknown) => void)({ learnerRecordId: learnerId, actionType: 'record_review' });
    expect(learner()?.props).toMatchObject({ initialLearnerRecordId: learnerId, initialAction: 'record_review' });
    expect(location.searchParams.get('learner')).toBe(learnerId);
    (learner()!.props.onDeepLinkConsumed as () => void)();
    expect(learner()?.props).toMatchObject({ initialLearnerRecordId: learnerId, initialAction: 'open_learner' });
    for (const effect of hooks.effects.values()) effect.cleanup?.();
    hooks.cells = []; hooks.effects.clear(); hooks.pending = []; listeners.clear();
    expect(learner()?.props).toMatchObject({ initialLearnerRecordId: learnerId, initialAction: 'open_learner' });
  });
  it('the actual Learners component clears changed detail selection and calls Back without a mutation', () => {
    hooks.store.can = () => true;
    const back = vi.fn();
    const invokeLearners = (id: string) => { hooks.cursor = 0; hooks.pending = []; return LearnersModule({ initialLearnerRecordId: id, onBackToList: back }); };
    const view = descendants(invokeLearners(learnerId)).find(item => typeof item.type === 'function' && item.type.name === 'LearnerRecordView');
    expect(view).toBeDefined();
    (view!.props.onBack as () => void)(); expect(back).toHaveBeenCalledOnce();
    // Execute the first real effect only (incoming selection); do not run API
    // effects in this component contract test or claim server acceptance.
    invokeLearners(learnerId); hooks.pending[0]?.();
    invokeLearners(''); hooks.pending[0]?.();
    expect(descendants(invokeLearners('')).some(item => typeof item.type === 'function' && item.type.name === 'LearnerRecordView')).toBe(false);
  });
});
