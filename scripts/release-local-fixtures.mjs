/** LOCAL ONLY. Creates synthetic acceptance identities, never session cookies. */
import { randomUUID } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function seedSyntheticStandard(standardId) {
  // Official standards are intentionally read-only to the application. Owner
  // fixture setup may insert a clearly synthetic row only in this local stack.
  const root=process.env.RELEASE_LOCAL_RUNTIME;
  if(!root?.startsWith("/private/tmp/levytate-release-runtime.")||standardId!=="ST1490")throw new Error("Local synthetic standard setup only");
  const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")),db=new URL(state.env.DB_URL);
  if(db.hostname!=="127.0.0.1")throw new Error("Local standard database only");
  const result=spawnSync(process.env.RELEASE_PSQL??"/opt/homebrew/opt/postgresql@17/bin/psql",["-XAtq","-v","ON_ERROR_STOP=1"],{env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)},input:"insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values('ST1490','Synthetic acceptance standard record','ST1490','Approved for delivery',4,'Synthetic acceptance only');",encoding:"utf8"});
  if(result.status)throw new Error("Synthetic local standard setup failed; no grants changed");
}

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
    if (!response.ok) {
      const resource=path.split("?")[0].replace(/[^a-zA-Z0-9/_-]/g,"");
      const payload=await response.json().catch(()=>null);
      const code=typeof payload?.code==="string"&&/^[A-Z0-9]{5,12}$/.test(payload.code)?payload.code:"unclassified";
      throw new Error(`Local fixture request failed (${response.status}) at ${resource}; code ${code}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}

export async function createReleaseFixtures() {
  const backend = releaseBackend();
  const run = randomUUID();
  const manifest = { version: 1, run, synthetic: true, environment: "local", tenants: [] };
  const catalogue = await backend("rest/v1/levytate_organisations?slug=eq.levytate-internal&select=id");
  const catalogueId = catalogue[0]?.id ?? randomUUID();
  if (!catalogue.length) await backend("rest/v1/levytate_organisations", "POST", { id: catalogueId, name: "Synthetic catalogue", slug: "levytate-internal", status: "Active" });
  const providerId = `synthetic-${run}`, programmeId = `synthetic-programme-${run}`, standardId = "ST1490";
  const standards=await backend(`rest/v1/levytate_apprenticeship_standards?id=eq.${standardId}&select=id`);
  if(!standards.length)seedSyntheticStandard(standardId);
  await backend("rest/v1/levytate_providers", "POST", { organisation_id: catalogueId, provider_id: providerId, provider_name: "Synthetic acceptance provider", provider_type: "Independent training provider", status: "Active", verification_status: "verified",last_verified:new Date().toISOString().slice(0,10),source_urls:["https://example.test/synthetic-provider-evidence"] });
  await backend("rest/v1/levytate_provider_programmes", "POST", { organisation_id: catalogueId, id: programmeId, provider_id: providerId, programme_name: "Synthetic acceptance programme", apprenticeship_standard_id: standardId, linked_standard_id: standardId,linked_standard_ids:[standardId], status: "Active", record_status: "Active", verification_status: "LevyTate reviewed",source_url:"https://example.test/synthetic-programme-evidence" });
  manifest.catalogue = { providerId, programmeId, standardId };
  for (const tenant of ["a", "b"]) {
    const id = randomUUID();
    await backend("rest/v1/levytate_organisations", "POST", {
      id, name: `Synthetic release ${tenant.toUpperCase()}`, slug: `release-${run}-${tenant}`,
      workspace_name: `Synthetic release ${tenant.toUpperCase()}`, primary_contact: "Synthetic Lead",
      contact_email: `release.${run}.${tenant}.lead@example.test`, workspace_template: "levytate-client-v1", status: "Active",
    });
    await backend("rest/v1/levytate_roles", "POST", { organisation_id: id, id: `${tenant}-role`, title: "Synthetic role", career_level: "Experienced", status: "Active" });
    await backend("rest/v1/levytate_role_pathway_mappings", "POST", { organisation_id: id, id: `${tenant}-mapping`, role_id: `${tenant}-role`, apprenticeship_standard_id: standardId, recommendation_type: "Primary" });
    await backend("rest/v1/levytate_organisation_providers", "POST", { organisation_id: id, provider_id: providerId, status: "Active" });
    await backend("rest/v1/levytate_organisation_programmes", "POST", { organisation_id: id, programme_id: programmeId, provider_id: providerId, status: "Active" });
    const people = [];
    const users = [];
    for (const [key, role] of [["lead", "Apprenticeship Lead"], ["manager", "Line Manager"], ["employee", "Employee"]]) {
      const email = `release.${run}.${tenant}.${key}@example.test`;
      const membershipId = randomUUID();
      const personId = `${tenant}-${key}`;
      const auth = key === "lead" ? await backend("auth/v1/admin/users", "POST", {
        email, email_confirm: true, app_metadata: { release_fixture: run },
      }) : null;
      if (key === "lead" && !auth?.id) throw new Error("Local Auth did not create a synthetic identity");
      // Only the two bootstrap Leads have Auth identities. All other users are
      // invited by their Lead through the actual application endpoint.
      // Auth account creation is fixture setup. Login must still traverse
      // the public request endpoint, SMTP capture, provider verify and callback.
      await backend("rest/v1/levytate_users", "POST", {
        id: membershipId, organisation_id: id, email, role, access_level: "beta_user", display_name: `Synthetic ${key}`,
        active: key === "lead", auth_subject: auth?.id ?? null, auth_binding_status: key === "lead" ? "bound" : "pending",
        ...(key === "lead" ? { auth_bound_at: new Date().toISOString() } : {}),
      });
      users.push({ key, role, email, membershipId, personId: key === "lead" ? null : personId });
      if (key !== "lead") people.push({
        organisation_id: id, id: personId, employee_number: `${tenant}-${key}`, name: `Synthetic ${key}`, email,
        job_title: key, department: "Synthetic", platform_role: role, manager_id: key === "employee" ? `${tenant}-manager` : "",
        role_id: `${tenant}-role`, status: "Active", start_date: "2026-01-01",
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
    console.log("PASS local synthetic fixtures: two tenants, two bootstrap Lead Auth identities, four pending members and People records; no email sent");
  } catch (error) {
    console.error(error.message.startsWith("BLOCKED:")||error.message.startsWith("Local fixture request failed") ? error.message : "FAIL local synthetic fixture preparation; inspect restricted local diagnostics");
    process.exitCode = error.message.startsWith("BLOCKED:") ? 2 : 1;
  }
}
