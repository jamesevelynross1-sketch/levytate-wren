import fs from "node:fs/promises";

const source = await fs.readFile("components/levytate-mvp/LevyTateLoginClient.tsx", "utf8");

assert("successful login uses one full-document navigation", source.includes("window.location.assign(getSafeLevyTateReturnTo())"));
assert("login does not use client-side router navigation", !source.includes("router.push(") && !source.includes("router.replace("));
assert("login has no automatic reload loop", !source.includes("window.location.reload(") && occurrences(source, "window.location.assign(") === 1);
assert("safe return-to validation remains in place", source.includes("isSameOrigin") && source.includes("isLevyTatePath") && source.includes("isLoginPath"));

console.log(JSON.stringify({ ok: true, checks: 4 }, null, 2));

function occurrences(value, term) {
  return value.split(term).length - 1;
}

function assert(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
}
