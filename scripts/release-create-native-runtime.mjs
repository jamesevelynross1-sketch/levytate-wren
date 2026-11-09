/** Reproducible LOCAL-only recovery from Git. No prior runtime, ledger or data is copied. */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReleaseSources } from "./build-release-supabase-worktree.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = process.env.RELEASE_LOCAL_RUNTIME;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(runtime ?? "")) throw new Error("Dedicated temporary local runtime required");
if (existsSync(`${runtime}/project`) || existsSync(`${runtime}/home`) || existsSync(`${runtime}/private-stack-state.json`)) throw new Error("Existing runtime is preserved; choose a fresh empty runtime");
if (!existsSync(`${runtime}/supabase`)) throw new Error("Install a published-checksum-verified native-capable CLI inside this runtime first");
const verified = await verifyReleaseSources(repository);
mkdirSync(`${runtime}/home`, { mode: 0o700 });
const env = { PATH: process.env.PATH, HOME: process.env.HOME, SUPABASE_HOME: `${runtime}/home`, SUPABASE_EXPERIMENTAL_STACK: "1" };
const version = execFileSync(`${runtime}/supabase`, ["--version"], { env, encoding: "utf8" }).trim();
if (version !== "2.122.1") throw new Error("This local harness requires reviewed Supabase CLI 2.122.1");
execFileSync(process.execPath, [resolve(repository, "scripts/build-fresh-supabase-bootstrap.mjs"), "--output", `${runtime}/project`], { encoding: "utf8" });
for (const migration of verified.manifest.migrations) {
  const bytes = readFileSync(resolve(repository, migration.path));
  if (createHash("sha256").update(bytes).digest("hex") !== migration.sha256) throw new Error("Release migration changed after verification");
  copyFileSync(resolve(repository, migration.path), `${runtime}/project/supabase/migrations/${basename(migration.path)}`);
}
// Minimal local config: no remote, no open registration, no external sender,
// no inherited service credentials, no auto-seed and no optional live modules.
const config = `project_id = "levytate-release-${randomBytes(6).toString("hex")}"
[experimental]
stack = true
[api]
enabled = true
schemas = ["public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
major_version = 17
health_timeout = "2m"
[db.migrations]
enabled = true
[db.seed]
enabled = false
sql_paths = []
[auth]
enabled = true
site_url = "http://localhost:3107"
additional_redirect_urls = ["http://localhost:3107/levytate/auth/callback", "http://localhost:3107/levytate/provider/auth/callback"]
enable_signup = false
enable_anonymous_sign_ins = false
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
[auth.email]
enable_signup = false
enable_confirmations = true
double_confirm_changes = true
max_frequency = "1s"
otp_expiry = 3600
[auth.hook.send_email]
enabled = true
uri = "http://127.0.0.1:3117/email"
secrets = "env(RELEASE_EMAIL_HOOK_SECRET)"
[local_smtp]
enabled = true
[storage]
enabled = true
file_size_limit = "50MiB"
[realtime]
enabled = false
[studio]
enabled = false
[edge_runtime]
enabled = false
[analytics]
enabled = false
`;
writeFileSync(`${runtime}/project/supabase/config.toml`, config, { mode: 0o600 });
writeFileSync(`${runtime}/private-app-secrets.json`, JSON.stringify({ hookSecret: randomBytes(32).toString("base64"), sessionSecret: randomBytes(48).toString("base64url") }), { flag: "wx", mode: 0o600 });
writeFileSync(`${runtime}/runtime-source-evidence.json`, `${JSON.stringify({ version, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(), bootstrapConvergence: verified.bootstrap.convergence.sha256, candidateManifest: verified.manifestSha256, migrationCount: verified.manifest.migrations.length + 2, excludes038: true, hostedExecutionAuthorised: false }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ prepared: runtime, cli: version, migrations: verified.manifest.migrations.length + 2, databaseCopied: false, hostedConnection: false }));
