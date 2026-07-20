import { inspectLineManagerSmokeFixture, prepareLineManagerSmokeFixture } from "./prepare-line-manager-smoke-fixture.mjs";

const before = await inspectLineManagerSmokeFixture();
const first = await prepareLineManagerSmokeFixture();
const afterFirst = await inspectLineManagerSmokeFixture();
const second = await prepareLineManagerSmokeFixture();
const afterSecond = await inspectLineManagerSmokeFixture();

assert("fixture has one active application", afterFirst.activeApplicationCount === 1);
assert("fixture has one known reviewable application", JSON.stringify(afterFirst.reviewableApplicationIds) === JSON.stringify(["gc-rbac-app-erin"]));
assert("fixture application is not duplicated", afterFirst.fixtureApplicationCount === 1);
assert("fixture employee remains an active direct report", afterFirst.directReportActive);
assert("second preparation makes no changes", second.changes.length === 0);
assert("second preparation preserves identical state", JSON.stringify(afterSecond) === JSON.stringify(afterFirst));
assert("smoke history is idempotent", afterSecond.smokeHistoryCount <= 1);

console.log(JSON.stringify({
  ok: true,
  before,
  firstChanges: first.changes,
  secondChanges: second.changes,
  finalState: afterSecond,
  checks: 7,
}, null, 2));

function assert(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
}
