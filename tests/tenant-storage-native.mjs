// Explicitly invoked LOCAL native runtime drill. Never accepts remote endpoints.
// Creates two unique fictional tenants and reports only synthetic IDs/counts.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { request } from "node:http";
import { join } from "node:path";
const statePath = process.argv[2];
if (!statePath?.startsWith("/private/tmp/levytate-release-runtime.")) throw Error("Explicit local fixture runtime required");
const runtime = statePath.slice(0, statePath.lastIndexOf("/"));
const env = JSON.parse(readFileSync(statePath, "utf8")).env;
const api = new URL(env.API_URL), db = new URL(env.DB_URL);
if (api.hostname !== "127.0.0.1" || db.hostname !== "127.0.0.1") throw Error("Loopback endpoints required");
const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` };
const tenantA = randomUUID(), tenantB = randomUUID(), prefix = `release-offboard-resume-${randomUUID()}`;
const bucket = "levytate-uploads", nameA = `${tenantA}/${prefix}/original.txt`, nameB = `${tenantB}/${prefix}/unaffected.txt`;
const manifestPath = `${runtime}/offboard-storage-native-${tenantA}.json`;
const manifest = { tenantA, tenantB, prefix, checks: [], cleanup: "pending" };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
function sql(statement) {
  const r = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-h", db.hostname, "-p", db.port, "-U", db.username, "-d", db.pathname.slice(1), "-X", "-At", "-v", "ON_ERROR_STOP=1"], { input: statement, env: { ...process.env, PGPASSWORD: db.password }, encoding: "utf8" });
  if (r.status !== 0) throw Error("Local fixture SQL failed; inspect restricted runtime evidence");
  return r.stdout.trim();
}
function check(condition, label, extra = {}) { manifest.checks.push({ label, passed: condition, ...extra }); console.log(`${condition ? "PASS" : "FAIL"}: ${label}`); if (!condition) throw Error(label); }
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const upload = (name, bytes, upsert = false) => fetch(`${api.origin}/storage/v1/object/${bucket}/${name}`, { method: "POST", headers: { ...headers, "Content-Type": "text/plain", "x-upsert": String(upsert) }, body: bytes });
const get = (name) => fetch(`${api.origin}/storage/v1/object/authenticated/${bucket}/${name}`, { headers });
function physicalFiles() {
  const stacks = `${runtime}/home/stacks`, matches = [];
  for (const stack of readdirSync(stacks, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const native = JSON.parse(readFileSync(join(stacks, stack.name, "state.json"), "utf8"));
    const storage = native.instances.find((item) => item.creation.service === "storage");
    const data = storage?.creation.config.filePath;
    if (!data?.startsWith(`${stacks}/${stack.name}/`)) throw Error("Native file backend path must remain inside the local fixture runtime");
    for (const relative of readdirSync(data, { recursive: true })) {
      if (relative.includes(prefix) && statSync(join(data, relative)).isFile()) matches.push(join(data, relative));
    }
  }
  return matches;
}
async function removeExact(name) {
  const versions = sql(`select version from storage.objects where bucket_id='${bucket}' and name='${name}';`).split("\n").filter(Boolean);
  for (const versionId of versions) {
    if (!/^[a-f0-9-]{36}$/.test(versionId)) throw Error("Immutable version required");
    const response = await fetch(`${api.origin}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [{ path: name, versionId }] }) });
    check(response.ok, "exact-version API removal succeeds");
  }
}
try {
  sql(`insert into public.levytate_organisations(id,name,slug,workspace_template,status) values
   ('${tenantA}','Synthetic Storage lifecycle A','storage-${tenantA}','levytate-client-v1','Active'),
   ('${tenantB}','Synthetic Storage lifecycle B','storage-${tenantB}','levytate-client-v1','Active');`);
  check((await upload(nameA, "fictional approved original")).ok, "active first tenant upload succeeds");
  check((await upload(nameB, "fictional unaffected original")).ok, "second tenant upload succeeds");
  const lateName = `${tenantA}/${prefix}/in-flight.txt`;
  let stream;
  const pending = new Promise((resolve, reject) => {
    stream = request(`${api.origin}/storage/v1/object/${bucket}/${lateName}`, { method: "POST", headers: { ...headers, "Content-Type": "text/plain", "Content-Length": "131072", "x-upsert": "false" } }, (response) => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    stream.on("error", reject); stream.write(Buffer.alloc(65536, 65));
  });
  // Observe the native file backend receiving this request before suspension.
  let observed = false;
  for (let n = 0; n < 40; n++) { if (physicalFiles().some((file) => file.includes("in-flight.txt"))) { observed = true; break; } await pause(50); }
  check(observed, "in-flight upload has reached native object bytes before suspension");
  sql(`update public.levytate_organisations set status='Suspended',updated_at=clock_timestamp() where id='${tenantA}';`);
  stream.end(Buffer.alloc(65536, 66));
  const lateStatus = await pending;
  check(lateStatus >= 400, "upload already in flight is refused after suspension", { status: lateStatus });
  check(!(await upload(`${tenantA}/${prefix}/new-after-suspension.txt`, "fictional late new")).ok, "suspended tenant new upload denied");
  check(!(await upload(nameA, "fictional replacement", true)).ok, "suspended tenant replacement denied");
  check(await (await get(nameA)).text() === "fictional approved original", "denied replacement preserves original bytes");
  check((await upload(nameB, "fictional second tenant new", true)).ok, "other tenant remains writable while first is suspended");
  for (let n = 0; n < 60 && physicalFiles().some((file) => file.includes("in-flight.txt")); n++) await pause(100);
  check(!physicalFiles().some((file) => file.includes("in-flight.txt")), "provider error cleanup removes rejected native in-flight bytes");
  check(sql(`select count(*) from storage.objects where name='${lateName}';`) === "0", "rejected in-flight upload has no metadata");
  await removeExact(nameA);
  sql(`delete from public.levytate_organisations where id='${tenantA}';`);
  check(!(await upload(`${tenantA}/${prefix}/after-deletion.txt`, "fictional deleted tenant")).ok, "deleted tenant late upload denied");
  check(await (await get(nameB)).text() === "fictional second tenant new", "second tenant bytes survive first tenant removal");
  await removeExact(nameB);
  sql(`delete from public.levytate_organisations where id='${tenantB}';`);
  for (let n = 0; n < 60 && physicalFiles().length; n++) await pause(100);
  check(physicalFiles().length === 0, "exclusive native fixture object bytes cleaned via provider API");
  manifest.cleanup = "complete";
} finally { writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 }); console.log(`Restricted fictional drill evidence: ${manifestPath}`); }
