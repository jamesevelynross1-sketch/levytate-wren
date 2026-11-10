/** Start an already prepared LOCAL generated worktree without printing keys. */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const root = process.env.RELEASE_LOCAL_RUNTIME;
if (!root?.startsWith("/private/tmp/levytate-release-runtime.")) {
  console.error("BLOCKED: dedicated temporary runtime required"); process.exit(2);
}
const secrets = JSON.parse(readFileSync(`${root}/private-app-secrets.json`, "utf8"));
// Do not inherit hosted project/auth/database overrides into a new local stack.
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "USER", "LOGNAME", "LANG", "LC_ALL", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS"].filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
Object.assign(env, { SUPABASE_HOME: `${root}/home`, SUPABASE_EXPERIMENTAL_STACK: "1", RELEASE_EMAIL_HOOK_SECRET: `v1,whsec_${secrets.hookSecret}` });
const child = spawn(`${root}/supabase`, ["stack", "start", "--runtime", "native", "--preparation", "on-demand", "--output-format", "json", "--workdir", `${root}/project`], {
  env, stdio: ["ignore", "pipe", "pipe"],
});
let stdout = "", stderr = "";
child.stdout.on("data", (data) => { stdout += data; });
child.stderr.on("data", (data) => { stderr += data; });
child.on("close", (code) => {
  if (code) {
    let diagnostic = "Native stack start failed";
    for (const text of ["Operation not permitted", "permission denied", "checksum", "unsupported", "Download", "connection refused", "not found", "timeout", "Failed to download"]) {
      if (`${stdout}\n${stderr}`.toLowerCase().includes(text.toLowerCase())) diagnostic += `; ${text}`;
    }
    console.error(diagnostic);
    // Emit error type only; never stdout/stderr, URLs with userinfo, or config.
    const tags = [...`${stdout}\n${stderr}`.matchAll(/(?:"_tag"\s*:\s*"|\b)([A-Z][A-Za-z]+Error)\b/g)].map((match) => match[1]);
    console.error(JSON.stringify({ exit: code, errorTypes: [...new Set(tags)] }));
    process.exitCode = 1;
    return;
  }
  try {
    const state = JSON.parse(stdout);
    writeFileSync(`${root}/private-stack-state.json`, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ status: "PASS", runtime: state.runtime, id: state.id, variableNames: Object.keys(state.env ?? {}), endpoints: Object.keys(state.endpoints ?? {}) }));
  } catch {
    console.error("FAIL stack returned an unrecognised status; credentials withheld"); process.exitCode = 1;
  }
});
