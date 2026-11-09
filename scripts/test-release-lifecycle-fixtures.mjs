import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assertLifecycleManifest, lifecycleRecipients, planLifecycleFixtures, prepareLifecycleFixtures } from "./release-lifecycle-fixtures.mjs";
const base = () => ({ synthetic: true, environment: "local", run: randomUUID(), tenants: [{ id: randomUUID() }, { id: randomUUID() }] });
test("plan creates exactly three fictional identities without preparing provider/database state", () => {
  const parent = base(), plan = planLifecycleFixtures(parent);
  assert.equal(plan.stage, "planned"); assert.equal(plan.databasePrepared, false); assert.equal(plan.storagePrepared, false);
  assert.deepEqual(plan.users.map((user) => user.role), ["Platform Admin", "Platform Admin", "Apprenticeship Lead"]);
  assert.ok(plan.users.every((user) => user.authSubject === null && !Object.hasOwn(user, "password")));
  assert.equal(lifecycleRecipients(plan, parent.run).length, 3);
  assert.ok(plan.users.every((user) => user.email === `lg.${plan.run}.${user.key}@example.test`));
});
for (const [label, mutate] of [
  ["nonlocal environment", (plan) => { plan.environment = "preview"; }],
  ["another parent run", (plan) => { plan.parentRun = randomUUID(); }],
  ["real recipient", (plan) => { plan.users[0].email = "real@example.com"; }],
  ["extra recipient", (plan) => { plan.users.push({ ...plan.users[0], membershipId: randomUUID() }); }],
  ["different role", (plan) => { plan.users[0].role = "Employee"; }],
  ["duplicate membership", (plan) => { plan.users[1].membershipId = plan.users[0].membershipId; }],
  ["duplicate Auth subject", (plan) => { plan.users[0].authSubject = plan.users[1].authSubject = randomUUID(); }],
  ["operator as target", (plan) => { plan.target.id = plan.operator.id; }],
  ["unowned Storage prefix", (plan) => { plan.storage.path = `${randomUUID()}/evidence.txt`; }],
  ["another bucket", (plan) => { plan.storage.bucket = "private-customer-files"; }],
  ["different bytes", (plan) => { plan.storage.sha256 = "a".repeat(64); }],
  ["changed operator slug", (plan) => { plan.operator.slug = "levytate-internal"; }],
]) test(`manifest rejects ${label}`, () => { const parent = base(), plan = planLifecycleFixtures(parent); mutate(plan); assert.throws(() => assertLifecycleManifest(plan, parent.run)); });
test("browser requires completed fixture state and three real provider identifiers", () => {
  const parent = base(), plan = planLifecycleFixtures(parent);
  assert.throws(() => assertLifecycleManifest(plan, parent.run, true));
  plan.stage = "prepared"; plan.databasePrepared = plan.storagePrepared = true;
  assert.throws(() => assertLifecycleManifest(plan, parent.run, true));
  plan.users.forEach((user) => { user.authSubject = randomUUID(); });
  assert.equal(assertLifecycleManifest(plan, parent.run, true), plan);
});
test("preparation rejects missing reviewed hash before accessing local files", async () => {
  await assert.rejects(() => prepareLifecycleFixtures({ runtime: "/private/tmp/levytate-release-runtime.synthetic" }), /Reviewed local plan hash/);
  await assert.rejects(() => prepareLifecycleFixtures({ runtime: "https://production.invalid", approvedSha256: "a".repeat(64) }), /Reviewed local plan hash/);
});
test("planning rejects missing or nonlocal base without mutating it", () => {
  const parent = base(), before = JSON.stringify(parent); planLifecycleFixtures(parent); assert.equal(JSON.stringify(parent), before);
  assert.throws(() => planLifecycleFixtures({ ...parent, synthetic: false }));
  assert.throws(() => planLifecycleFixtures({ ...parent, tenants: [] }));
});
