import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const mode = process.argv[2];
assert.ok(["enabled", "disabled"].includes(mode), "Usage: node scripts/validate-levytate-staging-entry.mjs <enabled|disabled>");

const port = mode === "enabled" ? 3101 : 3102;
const enabled = mode === "enabled";
const server = spawn("node_modules/.bin/next", ["start", "--port", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, LEVYTATE_STAGING_ENTRY_ENABLED: enabled ? "true" : "false" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  await waitForServer(port);
  const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
  if (enabled) {
    assert.ok([307, 308].includes(response.status), `Expected redirect, received ${response.status}`);
    assert.equal(response.headers.get("location"), "/levytate/login");
  } else {
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /MPR Consulting/);
    assert.doesNotMatch(html, /Internal demonstration access/);
  }
  console.log(JSON.stringify({ ok: true, mode, status: response.status }));
} finally {
  server.kill("SIGTERM");
}

async function waitForServer(targetPort) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before validation. ${output.slice(-500)}`);
    try {
      const response = await fetch(`http://127.0.0.1:${targetPort}/levytate/login`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Next.js did not become ready. ${output.slice(-500)}`);
}
