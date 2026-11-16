import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Independent offline artifact/control-flow verification. The test CLI below
// never starts PostgreSQL/Auth/Storage, connects to a database or executes SQL.
const repository = process.env.RELEASE_STARTUP_REVIEW_SOURCE ?? fileURLToPath(new URL('../', import.meta.url));
const artifacts: string[] = [];
afterEach(() => { for (const path of artifacts.splice(0)) rmSync(path, { recursive: true, force: true }); });
function offlineRuntime() {
  const root = mkdtempSync('/private/tmp/levytate-release-runtime.'); artifacts.push(root);
  const code = `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
if(process.argv[2]==='--version'){console.log('2.122.1');process.exit(0);}
if(process.argv[2]!=='stack'||process.argv[3]!=='start')process.exit(79);
const project=process.argv[process.argv.indexOf('--workdir')+1],entries=[];
function walk(folder){for(const name of fs.readdirSync(folder)){const value=path.join(folder,name),stat=fs.lstatSync(value);if(stat.isSymbolicLink())entries.push({path:path.relative(project,value),kind:'symlink'});else if(stat.isDirectory())walk(value);else if(/\\.sql$/i.test(name))entries.push({path:path.relative(project,value),kind:'sql'});}}
walk(project);fs.writeFileSync(path.join(path.dirname(project),'offline-first-cli-start.json'),JSON.stringify({offlineStub:true,entries}));
console.log(JSON.stringify({runtime:'native',id:'offline-test-only',env:{},endpoints:{}}));
`;
  writeFileSync(`${root}/supabase`, code, { mode: 0o700 });
  return root;
}
function script(name: string, root: string) {
  // No inherited Supabase token, database URL, service credential or hook key.
  return spawnSync(process.execPath, [resolve(repository, `scripts/${name}`)], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, RELEASE_LOCAL_RUNTIME: root }, encoding: 'utf8', timeout: 30000,
  });
}
describe('independent first native start ordering (offline fake CLI, no DB evidence)', () => {
  it('the actual creator and start wrapper expose no SQL or symlink to the first CLI start', () => {
    const root = offlineRuntime();
    const created = script('release-create-native-runtime.mjs', root);
    expect(created.status, 'creator exit code; raw diagnostics intentionally withheld').toBe(0);
    const started = script('release-start-local-stack.mjs', root);
    expect(started.status, 'start-wrapper exit code; raw diagnostics intentionally withheld').toBe(0);
    const observation = JSON.parse(readFileSync(`${root}/offline-first-cli-start.json`, 'utf8'));
    expect(observation.offlineStub).toBe(true);
    expect(observation.entries).toEqual([]);
  });
});
