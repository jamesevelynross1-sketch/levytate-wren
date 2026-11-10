'use client';
import { useCallback, useState } from 'react';
import { useMvpWorkspace } from '@/components/levytate-mvp/MvpWorkspaceStore';
import { createOperationsClientCommand } from '@/lib/levytate/operations-client-command';

export function useOperationsClientCommand() {
  const { meta } = useMvpWorkspace();
  const [identity] = useState(() => meta?.storageMode === 'supabase' ? { email: meta.userEmail, organisationId: meta.organisationId } : null);
  const [scope] = useState(() => ({ organisationId: identity?.organisationId ?? "", userEmail: identity?.email ?? "", role: meta?.userRole ?? "" }));
  const [controller] = useState(() => createOperationsClientCommand(identity));
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (send: () => Promise<void>) => {
    if (controller.busy) throw new Error('An update is already in progress.');
    setWorking(true); setPending(true); setError('');
    try { await send(); }
    catch (failure) { setError(failure instanceof Error && failure.name === 'Error' ? failure.message : 'The update could not be confirmed.'); throw failure; }
    finally { setWorking(controller.busy); setPending(controller.pending); }
  }, [controller]);
  function execute<T>(path: string, body: unknown, decode: (value: unknown) => T, confirmed: (value: T) => void, method: 'POST' | 'PATCH' = 'POST') {
    return run(() => controller.execute(path, body, decode, confirmed, method));
  }
  const retry = useCallback(() => { void run(() => controller.retry()).catch(() => undefined); }, [controller, run]);
  return { identity, scope, execute, retry, working, pending, error, locked: working || pending };
}
