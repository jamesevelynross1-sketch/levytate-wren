import { authenticatedClientFetch, type ClientIdentity } from "@/lib/levytate/client-session";

type Fetcher = typeof authenticatedClientFetch;

/** One retained command per mounted form owner. Memory only; never browser storage. */
export function createPinnedClientMutation<T>(identity: ClientIdentity | null, path: string,
  decode: (value: unknown) => T, fetcher: Fetcher = authenticatedClientFetch,
  readResponse: (response: Response) => Promise<unknown> = (response) => response.json()) {
  const expected = identity ? { ...identity } : null;
  let pending: { body: string; confirmed?: (value: T) => void } | null = null;
  let busy = false;

  async function send(): Promise<T> {
    if (busy) throw new Error("An update is already in progress.");
    if (!pending) throw new Error("There is no pending update to retry.");
    if (!expected?.email || !expected.organisationId) throw new Error("Reload to confirm the signed-in account before submitting.");
    const attempt = pending;
    busy = true;
    let value: T;
    try {
      const response = await fetcher(path, {
        method: "POST", headers: { "Content-Type": "application/json", "X-LevyTate-Account": expected.email },
        body: attempt.body, signal: AbortSignal.timeout(30_000),
      }, expected);
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const message = result && typeof result === "object" && "message" in result && typeof result.message === "string" ? result.message : null;
        throw new Error(response.status === 401 ? "Your session has ended. Sign in again before retrying." : message || "The update could not be confirmed.");
      }
      value = decode(await readResponse(response));
    } finally { busy = false; }
    // Only a valid success clears the original body/key. A callback failure must
    // not turn a confirmed durable command back into an uncertain mutation.
    pending = null;
    attempt.confirmed?.(value);
    return value;
  }

  return {
    get pending() { return pending !== null; },
    get busy() { return busy; },
    execute(command: unknown, confirmed?: (value: T) => void): Promise<T> {
      if (pending || busy) return Promise.reject(new Error("Confirm the original update or reload saved state before making another change."));
      pending = { body: JSON.stringify(command), confirmed };
      return send();
    },
    retry: send,
  };
}
