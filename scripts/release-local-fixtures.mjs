/** LOCAL ONLY. Creates synthetic acceptance identities, never session cookies. */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

export function localUrl(value, label) {
  if (!value) throw new Error(`BLOCKED: ${label} is missing`);
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password) {
    throw new Error(`BLOCKED: ${label} must be a credential-free loopback URL`);
  }
  return url.origin;
}

export function releaseBackend() {
  const origin = localUrl(process.env.RELEASE_SUPABASE_URL, "RELEASE_SUPABASE_URL");
  const key = process.env.RELEASE_SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("BLOCKED: local service credential unavailable");
  return async (path, method = "GET", body) => {
    const response = await fetch(`${origin}/${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Local fixture request failed (${response.status})`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}

export async function createReleaseFixtures() {
  const backend = releaseBackend();
  const run = randomUUID();
  const manifest = { version: 1, run, synthetic: true, environment: "local", tenants: [] };
  for (const tenant of ["a", "b"]) {
    const id = randomUUID();
    await backend("rest/v1/levytate_organisations", "POST", {
      id, name: `Synthetic release ${tenant.toUpperCase()}`, slug: `release-${run}-${tenant}`,
      workspace_name: `Synthetic release ${tenant.toUpperCase()}`, primary_contact: "Synthetic Lead",
      contact_email: `release.${run}.${tenant}.lead@example.test`, workspace_template: "levytate-client-v1", status: "Active",
    });
    const people = [];
    const users = [];
    for (const [key, role] of [["lead", "Apprenticeship Lead"], ["manager", "Line Manager"], ["employee", "Employee"]]) {
      const email = `release.${run}.${tenant}.${key}@example.test`;
      const membershipId = randomUUID();
      const personId = `${tenant}-${key}`;
      const auth = await backend("auth/v1/admin/users", "POST", {
        email, email_confirm: true, app_metadata: { release_fixture: run },
      });
      if (!auth.id) throw new Error("Local Auth did not create a synthetic identity");
      // Auth account creation is fixture setup. Login below must still traverse
      // the public request endpoint, SMTP capture, provider verify and callback.
      await backend("rest/v1/levytate_users", "POST", {
        id: membershipId, organisation_id: id, email, role, access_level: "beta_user", display_name: `Synthetic ${key}`,
        active: true, auth_subject: null, auth_binding_status: "pending",
      });
      users.push({ key, role, email, membershipId, authId: auth.id, personId: key === "lead" ? null : personId });
      if (key !== "lead") people.push({
        organisation_id: id, id: personId, employee_number: `${tenant}-${key}`, name: `Synthetic ${key}`, email,
        job_title: key, platform_role: role, manager_id: key === "employee" ? `${tenant}-manager` : "",
        status: "Active", start_date: "2026-01-01",
      });
    }
    await backend("rest/v1/levytate_employees", "POST", people);
    manifest.tenants.push({ key: tenant, id, users });
  }
  return manifest;
}

if (process.argv[1]?.endsWith("release-local-fixtures.mjs")) {
  try {
    if (!process.env.RELEASE_FIXTURE_MANIFEST?.startsWith("/private/tmp/")) throw new Error("BLOCKED: manifest must be a restricted temporary path");
    const manifest = await createReleaseFixtures();
    writeFileSync(process.env.RELEASE_FIXTURE_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    console.log("PASS local synthetic fixtures: two tenants, six distinct Auth identities, four People records; no email sent");
  } catch (error) {
    console.error(error.message.startsWith("BLOCKED:") ? error.message : "FAIL local synthetic fixture preparation; inspect restricted local diagnostics");
    process.exitCode = error.message.startsWith("BLOCKED:") ? 2 : 1;
  }
}
