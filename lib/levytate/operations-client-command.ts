import { authenticatedClientFetch, type ClientIdentity } from '@/lib/levytate/client-session';
import { createPinnedClientMutation } from '@/lib/levytate/client-mutation-retry';

/** A mounted Operations surface owns one exact request, including its path and decoder. */
export function createOperationsClientCommand(identity: ClientIdentity | null, fetcher = authenticatedClientFetch) {
  const expected = identity ? { ...identity } : null;
  let current: ReturnType<typeof createPinnedClientMutation<unknown>> | null = null;
  return {
    get pending() { return current?.pending ?? false; },
    get busy() { return current?.busy ?? false; },
    async execute<T>(path: string, body: unknown, decode: (value: unknown) => T, confirmed: (value: T) => void, method: 'POST' | 'PATCH' = 'POST'): Promise<void> {
      if (current?.pending || current?.busy) throw new Error('Confirm the original update or reload saved state before making another change.');
      current = createPinnedClientMutation<unknown>(expected, path, decode, fetcher, undefined, method);
      await current.execute(body, value => confirmed(value as T));
    },
    async retry(): Promise<void> {
      if (!current) throw new Error('There is no pending update to retry.');
      await current.retry();
    },
  };
}
