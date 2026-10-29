import { describe, expect, it, vi } from "vitest";
import { normaliseMvpUserRole, parseMvpUserRole, permissionsForMvpRole } from "../lib/levytate/mvp/rbac";
import { findAuthIdentityByEmail } from "../lib/server/levytate-auth-directory";
import { resolveIdentityPerson } from "../lib/server/levytate-identity-policy";

describe("authenticated role boundary", () => {
  it.each(["Department Head", "employee", "Super Admin", "", null, undefined])("denies unsupported role %s", (role) => {
    expect(parseMvpUserRole(role)).toBeNull();
    expect(permissionsForMvpRole(role)).toEqual([]);
    expect(() => normaliseMvpUserRole(role)).toThrow("Unsupported LevyTate role.");
  });
  it.each(["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin", "Platform Admin"])("keeps supported role %s", (role) => {
    expect(parseMvpUserRole(role)).toBe(role);
  });
});

describe("deterministic People identity", () => {
  const membership = { id: "member", organisation_id: "tenant-a", email: "PERSON@example.test", role: "Employee", active: true };
  const person = { id: "person", organisation_id: "tenant-a", email: "person@example.test", platform_role: "Employee", status: "Active" };
  it("matches one active same-tenant normalized email", () => expect(resolveIdentityPerson(membership, [person])).toEqual({ allowed: true, employeeId: "person" }));
  it.each([
    [], [person, { ...person, id: "duplicate" }], [{ ...person, organisation_id: "tenant-b" }],
    [{ ...person, status: "Archived" }], [{ ...person, platform_role: "Line Manager" }], [{ ...person, email: "other@example.test" }],
  ])("denies absent, ambiguous or invalid People pairing", (...rows) => {
    expect(resolveIdentityPerson(membership, rows)).toEqual({ allowed: false, employeeId: null });
  });
  it("requires a manager's own matching People record", () => {
    expect(resolveIdentityPerson({ ...membership, role: "Line Manager" }, [person]).allowed).toBe(false);
    expect(resolveIdentityPerson({ ...membership, role: "Line Manager" }, [{ ...person, platform_role: "Line Manager" }]).allowed).toBe(true);
  });
  it.each(["Apprenticeship Lead", "Employer Admin"])("allows initial %s without fabricated employee", (role) => {
    expect(resolveIdentityPerson({ ...membership, role }, [])).toEqual({ allowed: true, employeeId: null });
  });
  it("denies revoked and unknown memberships", () => {
    expect(resolveIdentityPerson({ ...membership, active: false }, [person]).allowed).toBe(false);
    expect(resolveIdentityPerson({ ...membership, role: "Department Head" }, [person]).allowed).toBe(false);
  });
});

describe("Auth directory pagination", () => {
  it("finds an existing identity beyond 1000 without creating a duplicate", async () => {
    const request = vi.fn(async (path: string) => new Response(JSON.stringify({ users: path.includes("page=1&")
      ? Array.from({ length: 1000 }, (_, index) => ({ id: `other-${index}`, email: `other-${index}@example.test` }))
      : [{ id: "existing", email: "Person@Example.test" }] })));
    expect(await findAuthIdentityByEmail("person@example.test", request)).toEqual({ id: "existing", email: "Person@Example.test" });
    expect(request.mock.calls.map(([path]) => path)).toEqual(["admin/users?page=1&per_page=1000", "admin/users?page=2&per_page=1000"]);
  });
  it("follows server capped pages using Link headers", async () => {
    const request = vi.fn(async (path: string) => path.includes("page=1&")
      ? new Response(JSON.stringify({ users: [{ id: "first", email: "other@example.test" }] }), { headers: { Link: '<https://example.test/admin/users?page=2>; rel="next"' } })
      : new Response(JSON.stringify({ users: [{ id: "found", email: "person@example.test" }] })));
    expect((await findAuthIdentityByEmail("person@example.test", request))?.id).toBe("found");
  });
  it("reports absence only after an exhausted directory", async () => {
    expect(await findAuthIdentityByEmail("person@example.test", async () => new Response(JSON.stringify({ users: [] })))).toBeNull();
  });
  it("fails closed on directory failures and malformed pages", async () => {
    await expect(findAuthIdentityByEmail("person@example.test", async () => new Response("{}", { status: 503 }))).rejects.toThrow();
    await expect(findAuthIdentityByEmail("person@example.test", async () => new Response("{}"))).rejects.toThrow();
  });
  it("detects repeated pages instead of a false absence", async () => {
    await expect(findAuthIdentityByEmail("person@example.test", async () => new Response(JSON.stringify({ users: [{ id: "same", email: "other@example.test" }], next_page: 4 })))).rejects.toThrow("did not advance safely");
  });
});
