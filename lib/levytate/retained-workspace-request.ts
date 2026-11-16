import { authenticatedClientFetch, type ClientIdentity } from "@/lib/levytate/client-session";

/** Bind every read and write to the account that opened this workspace/form. */
export function createRetainedWorkspaceRequest(identity: ClientIdentity | null, transport = authenticatedClientFetch) {
  const expected = identity ? { ...identity } : null;
  return async (path: string, init?: RequestInit) => {
    if (!expected?.email || !expected.organisationId) throw new Error("Reload this workspace before continuing. Your account could not be verified.");
    return transport(path, init, { ...expected });
  };
}
