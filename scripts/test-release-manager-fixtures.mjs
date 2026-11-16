import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { planManagerFixtures, assertManagerManifest, managerRecipients, prepareManagerFixtures } from "./release-manager-fixtures.mjs";
function fixture() {
  const run = randomUUID(), tenantId = randomUUID(), membershipId = randomUUID(), email = `release.${run}.a.manager@example.test`, stamp = "2026-11-09T19:00:00+00:00";
  const base = { version: 1, run, synthetic: true, environment: "local", tenants: [{ key: "a", id: tenantId, users: [{ key: "manager", role: "Line Manager", email, membershipId, personId: "a-manager" }] }, { key: "b", id: randomUUID(), users: [] }] };
  const source = { organisation: { id: tenantId, status: "Active", updated_at: stamp }, membership: { id: membershipId, organisation_id: tenantId, email, role: "Line Manager", active: true, auth_subject: randomUUID(), auth_binding_status: "bound", updated_at: stamp }, person: { id: "a-manager", organisation_id: tenantId, email, platform_role: "Line Manager", status: "Active", manager_id: "", role_id: "a-role", updated_at: stamp } };
  return { base, source, plan: planManagerFixtures(base, source) };
}
test("plan preserves reviewed source and contains only one additional fictional identity", () => {
  const { base, source, plan } = fixture();
  assert.deepEqual(plan.source, source); assert.equal(plan.stage, "planned"); assert.equal(plan.users.length, 1); assert.equal(plan.users[0].authSubject, null);
  assert.deepEqual(managerRecipients(plan, base), [`lg.${plan.run}.reviewer@example.test`]);
});
for (const [label, change] of [
  ["other parent", (plan) => { plan.parentRun = randomUUID(); }],
  ["hosted environment", (plan) => { plan.environment = "preview"; }],
  ["real recipient", (plan) => { plan.users[0].email = "person@example.com"; }],
  ["extra recipient", (plan) => { plan.users.push({ ...plan.users[0] }); }],
  ["wrong role", (plan) => { plan.users[0].role = "Apprenticeship Lead"; }],
  ["cross tenant", (plan) => { plan.users[0].organisationId = randomUUID(); }],
  ["reused membership", (plan) => { plan.users[0].membershipId = plan.source.membership.id; }],
  ["reused Auth subject", (plan) => { plan.users[0].authSubject = plan.source.membership.auth_subject; }],
  ["suspended organisation", (plan) => { plan.source.organisation.status = "Suspended"; }],
  ["revoked manager", (plan) => { plan.source.membership.active = false; }],
  ["unbound manager", (plan) => { plan.source.membership.auth_binding_status = "pending"; }],
  ["changed manager email", (plan) => { plan.source.person.email = "changed@example.test"; }],
  ["existing superior", (plan) => { plan.source.person.manager_id = "already-managed"; }],
  ["missing current version", (plan) => { delete plan.source.person.updated_at; }],
]) test(`manifest rejects ${label}`, () => { const { base, plan } = fixture(); change(plan); assert.throws(() => assertManagerManifest(plan, base)); });
test("browser requires confirmed provider and database preparation", () => {
  const { base, plan } = fixture(); assert.throws(() => assertManagerManifest(plan, base, true));
  plan.users[0].authSubject = randomUUID(); plan.stage = "prepared"; plan.databasePrepared = true;
  assert.equal(assertManagerManifest(plan, base, true), plan);
});
test("apply refuses absent review hash before reading runtime or credentials", async () => { await assert.rejects(prepareManagerFixtures({ runtime: "/private/tmp/not-a-runtime" }), /Reviewed local plan hash required/); });
