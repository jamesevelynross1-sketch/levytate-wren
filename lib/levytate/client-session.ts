export type ClientIdentity = { email: string; organisationId: string };
type Transport = (input: string, init?: RequestInit) => Promise<Response>;

/** Retry only an explicit unauthorised response: never replay an uncertain write. */
export function createAuthenticatedClientFetch(transport: Transport) {
  let refreshing: Promise<Response> | null = null;
  return async function authenticatedFetch(path: string, init: RequestInit = {}, expected?: ClientIdentity): Promise<Response> {
    const origin = "https://levytate-client.invalid";
    if (!path.startsWith("/") || new URL(path, origin).origin !== origin) throw new Error("Authenticated requests must use this application origin.");
    const headers = new Headers(init.headers);
    if (expected) {
      headers.set("X-LevyTate-Account", expected.email);
      headers.set("X-LevyTate-Organisation", expected.organisationId);
    }
    const options: RequestInit = { ...init, headers, credentials: "same-origin", cache: "no-store" };
    const response = await transport(path, options);
    if (response.status !== 401 || path === "/api/levytate-auth/session") return response;
    refreshing ??= transport("/api/levytate-auth/session", { method: "POST", credentials: "same-origin", cache: "no-store" }).finally(() => { refreshing = null; });
    const refresh = (await refreshing).clone();
    if (!refresh.ok) return refresh;
    if (expected) {
      const payload = await refresh.json() as { identity?: ClientIdentity };
      if (payload.identity?.email !== expected.email || payload.identity?.organisationId !== expected.organisationId) {
        return Response.json({ code: "account_changed", message: "A different account is signed in. Reload the page to switch accounts; this form has not been submitted." }, { status: 409 });
      }
    }
    return transport(path, options);
  };
}

export const authenticatedClientFetch = createAuthenticatedClientFetch((path, init) => fetch(path, init));
