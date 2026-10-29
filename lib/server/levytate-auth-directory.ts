import { normaliseBetaEmail } from "@/lib/levytate/config/beta-access";

export type DirectoryAuthUser = { id: string; email?: string; email_confirmed_at?: string | null };
type DirectoryPage = { users?: DirectoryAuthUser[]; next_page?: number | null; last_page?: number; total?: number };

/** Never create an identity from a partial directory result. */
export async function findAuthIdentityByEmail(
  emailInput: string,
  request: (path: string, init?: RequestInit) => Promise<Response>,
) {
  const email = normaliseBetaEmail(emailInput);
  const pageSize = 1000;
  const seen = new Set<string>();
  for (let page = 1; page <= 1000; page++) {
    const response = await request(`admin/users?page=${page}&per_page=${pageSize}`);
    if (!response.ok) throw new Error("The authentication directory could not be checked.");
    const payload = await response.json() as DirectoryPage;
    if (!Array.isArray(payload.users)) throw new Error("The authentication directory returned an invalid page.");
    for (const user of payload.users) {
      if (!user || typeof user.id !== "string" || !user.id || seen.has(user.id)) {
        throw new Error("The authentication directory did not advance safely.");
      }
      seen.add(user.id);
    }
    const matches = payload.users.filter((user) => typeof user.email === "string" && normaliseBetaEmail(user.email) === email);
    if (matches.length > 1) throw new Error("The authentication identity is ambiguous.");
    if (matches.length === 1) return matches[0];
    const hasNextLink = (response.headers.get("link") ?? "").split(",")
      .some((link) => /;\s*rel="?next"?/.test(link));
    if (hasNextLink) {
      if (!payload.users.length) throw new Error("The authentication directory did not advance safely.");
      continue;
    }
    // GoTrue may enforce a smaller server page size. Honour its pagination metadata.
    if (typeof payload.next_page === "number" && payload.next_page > page) continue;
    if (typeof payload.last_page === "number" && payload.last_page > page) continue;
    const total = payload.total ?? Number(response.headers.get("x-total-count"));
    if (Number.isFinite(total) && total > seen.size) {
      if (!payload.users.length) throw new Error("The authentication directory did not advance safely.");
      continue;
    }
    if (payload.users.length < pageSize) return null;
  }
  throw new Error("The authentication directory safety limit was reached.");
}
