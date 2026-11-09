import type { PastoralWorkspace } from "@/lib/levytate/pastoral/domain";
import { authenticatedClientFetch } from "@/lib/levytate/client-session";

type Outcome = { status: "confirmed" | "busy" | "blocked" | "idle" } | { status: "pending"; error: unknown };

export function createAccountPinnedPastoralPost(identity: { email: string; organisationId: string } | null, fetcher = authenticatedClientFetch) {
  const expected = identity ? { ...identity } : null;
  return async (body: string) => {
    if (!expected?.email || !expected.organisationId) throw new Error("Reload My Support to confirm the signed-in account before submitting.");
    return postPastoralMutation(body, (path, init) => {
      const headers = new Headers(init?.headers);
      headers.set("X-LevyTate-Account", expected.email);
      return fetcher(path, { ...init, headers }, expected);
    });
  };
}

export async function postPastoralMutation(body: string, fetcher: (path: string, init?: RequestInit) => Promise<Response> = fetch): Promise<PastoralWorkspace> {
  const response = await fetcher("/api/levytate-pastoral", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(30_000) });
  const result = await response.json().catch(() => null) as { message?: unknown; workspace?: PastoralWorkspace } | null;
  const workspace = result?.workspace;
  if (!response.ok || !workspace || !["employee", "support_recipient"].includes(workspace.accessMode) || !Array.isArray(workspace.requests) || !Array.isArray(workspace.conversations) || !Array.isArray(workspace.recipients) || !Number.isFinite(Date.parse(workspace.generatedAt))) {
    throw new Error(response.status === 401 ? "Your session has ended. Sign in again before retrying." : typeof result?.message === "string" ? result.message : "The update could not be confirmed.");
  }
  return workspace;
}

/** In-memory only: private support text is never copied into browser storage. */
export function createPastoralMutationRetry(send: (body: string) => Promise<void>) {
  let pending: { body: string; confirmed?: () => void } | null = null;
  let busy = false;
  return {
    get pending() { return pending !== null; },
    get busy() { return busy; },
    async run(command?: unknown, confirmed?: () => void): Promise<Outcome> {
      if (busy) return { status: "busy" };
      if (command !== undefined) {
        if (pending) return { status: "blocked" };
        // Freeze the exact command, including revision, payload and retry key.
        pending = { body: JSON.stringify(command), confirmed };
      }
      if (!pending) return { status: "idle" };
      const attempt = pending;
      busy = true;
      try { await send(attempt.body); }
      catch (error) { return { status: "pending", error }; }
      finally { busy = false; }
      pending = null;
      attempt.confirmed?.();
      return { status: "confirmed" };
    },
  };
}
