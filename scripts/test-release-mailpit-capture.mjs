import { test } from "node:test";
import assert from "node:assert/strict";
import { readLocalMailpitCapture } from "./release-mailpit-capture.mjs";
const origin = "http://127.0.0.1:54324";
const messages = (count) => Array.from({ length: count }, (_, n) => ({ ID: `synthetic-${n}`, To: [{ Address: `recipient${n}@example.test` }], Snippet: "Must not be retained", Subject: "Fictional" }));
const page = (all, start = 0) => ({ total: all.length, start, messages: all.slice(start, start + 50) });
test("reads every page twice and only retains message IDs and recipient addresses", async () => {
  const all = messages(123), calls = [];
  const result = await readLocalMailpitCapture(origin, async (url, options) => {
    const parsed = new URL(url); calls.push(Number(parsed.searchParams.get("start")));
    assert.equal(parsed.origin, origin); assert.equal(parsed.pathname, "/api/v1/messages"); assert.equal(parsed.searchParams.get("limit"), "50"); assert.equal(options.method, "GET"); assert.equal(options.redirect, "error");
    return Response.json(page(all, calls.at(-1)));
  });
  assert.deepEqual(calls, [0, 50, 100, 0, 50, 100]); assert.equal(result.messages.length, 123);
  assert.deepEqual(result.messages.at(-1), { ID: "synthetic-122", To: [{ Address: "recipient122@example.test" }] });
  assert.equal(JSON.stringify(result).includes("Must not be retained"), false);
});
test("complete empty capture remains valid", async () => { assert.deepEqual(await readLocalMailpitCapture(origin, async () => Response.json(page([]))), { total: 0, messages: [] }); });
test("cannot silently miss a recipient beyond the first50", async () => {
  const all = messages(51); all[50].To = [{ Address: "pending-lead@example.test" }];
  const result = await readLocalMailpitCapture(origin, async url => Response.json(page(all, Number(new URL(url).searchParams.get("start")))));
  assert.equal(result.messages.some(message => message.To.some(to => to.Address === "pending-lead@example.test")), true);
});
test("rejects missing pages", async () => { let calls = 0; await assert.rejects(readLocalMailpitCapture(origin, async () => Response.json(++calls === 1 ? page(messages(51)) : { total: 51, start: 50, messages: [] })), /completely enumerated/); });
test("rejects duplicate messages and wrong pagination offsets", async () => {
  for (const invalid of [{ ...page(messages(2)), messages: [messages(1)[0], messages(1)[0]] }, { ...page(messages(1)), start: 50 }]) await assert.rejects(readLocalMailpitCapture(origin, async () => Response.json(invalid)), /completely enumerated/);
});
test("rejects changed totals and same-count replacement between scans", async () => {
  for (const replacement of [messages(2), [{ ID: "changed", To: [] }]]) {
    let calls = 0; await assert.rejects(readLocalMailpitCapture(origin, async () => Response.json(page(++calls === 1 ? messages(1) : replacement))), /completely enumerated/);
  }
});
test("rejects oversized or malformed captures without disclosing raw diagnostics", async () => {
  for (const invalid of [{ total: 2001, messages: [] }, { total: 1, messages: [{ ID: "missing-recipient-data" }] }, { total: "1", messages: [] }]) await assert.rejects(readLocalMailpitCapture(origin, async () => Response.json(invalid)), /completely enumerated/);
  await assert.rejects(readLocalMailpitCapture(origin, async () => { throw new Error("private diagnostic"); }), error => !error.message.includes("private diagnostic"));
});
test("forbids non-loopback, embedded credentials and non-HTTP origins before transport", async () => {
  for (const url of ["https://capture.example.test", "http://secret@localhost:54324", "ftp://localhost:54324"]) await assert.rejects(readLocalMailpitCapture(url, async () => { assert.fail("No network request permitted"); }));
});
