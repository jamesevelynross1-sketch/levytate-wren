import { describe, expect, it, vi } from 'vitest';
// This suite executes the real acceptance transport procedure with a fake
// browser interface. It proves control flow, never authentication or SQL.
// @ts-expect-error The executable .mjs helper has no declaration file.
import { verifyRetainedOperationTransport } from '../scripts/release-operations-intelligence-browser.mjs';

function transport(fault: 'lost' | 'malformed', changedBody = false, rejectReply = false) {
  const app = 'http://127.0.0.1:3000', path = '/api/levytate-autopilot', lead = { user: { email: 'lead@fictional.invalid' }, tenant: { id: 'fictional-tenant' } };
  const input = { action: 'refresh', idempotencyKey: 'original-key' }, body = JSON.stringify(input);
  const headers = { 'x-levytate-account': lead.user.email, 'x-levytate-organisation': lead.tenant.id };
  const request = { method: () => 'POST', postData: () => body, postDataJSON: () => input, headers: () => headers };
  let handler: (route: unknown) => Promise<void> = async () => {}, commits = 0, first: Promise<void> | undefined;
  let reply: (value: unknown) => void = () => {}, reject: (error: Error) => void = () => {};
  const response = { url: () => `${app}${path}`, status: () => 200, request: () => ({ ...request, postData: () => changedBody ? `${body} ` : body }) };
  const route = { request: () => request, continue: vi.fn(), fetch: vi.fn(async () => { commits++; return { status: () => 200, json: async () => ({ ok: true, workspace: { checked: true } }) }; }), abort: vi.fn(), fulfill: vi.fn() };
  const button = { isDisabled: async () => true, waitFor: async () => {}, click: async () => { await first; if (rejectReply) reject(Error('Simulated context closed')); else reply(response); } };
  const recovery = { waitFor: async () => {}, getByRole: () => button };
  const page = { getByRole: () => recovery, route: async (_pattern: string, next: typeof handler) => { handler = next; }, unroute: vi.fn(async () => {}), waitForResponse: (predicate: (value: unknown) => boolean) => { expect(predicate(response)).toBe(true); return new Promise((resolve, rejectPromise) => { reply = resolve; reject = rejectPromise; }); } };
  const checks: Array<{ name: string; ok: boolean }> = [];
  const report = (name: string, ok: boolean) => { checks.push({ name, ok }); if (!ok) throw Error(name); };
  const idle = vi.fn(async () => {}), verifyCommit = vi.fn((before: { commits: number }, durable: { commits: number }) => { expect(before.commits).toBe(0); expect(durable.commits).toBe(1); });
  return { page, route, checks, idle, verifyCommit, run: () => verifyRetainedOperationTransport({ app, page, lead, path, label: 'Transport regression', action: 'refresh', fault, snapshot: async () => ({ commits }), report, idle, verifyCommit,
    trigger: async () => { first = handler(route); }, validate: (value: { workspace: { checked: boolean } }) => value.workspace.checked === true,
    malformed: (value: { workspace: unknown }) => ({ ...value, workspace: null }),
  }) };
}
describe('actual Operations acceptance transport control flow (no Auth or persistence claim)', () => {
  it.each(['lost', 'malformed'] as const)('awaits the exact original retry after a %s response', async fault => {
    const test = transport(fault), result = await test.run();
    expect(result.input).toEqual({ action: 'refresh', idempotencyKey: 'original-key' });
    expect(result.durable).toEqual({ commits: 1 });
    expect(test.route.fetch).toHaveBeenCalledTimes(1); expect(test.verifyCommit).toHaveBeenCalledTimes(1); expect(test.idle).toHaveBeenCalledTimes(1);
    expect(test.checks.some(item => item.name.includes('visible retry preserves exact command') && item.ok)).toBe(true);
    expect(test.checks.some(item => item.name.includes('retry adds no duplicate') && item.ok)).toBe(true);
    expect(test.page.unroute).toHaveBeenCalledTimes(1);
    expect(fault === 'lost' ? test.route.abort : test.route.fulfill).toHaveBeenCalledTimes(1);
  });
  it('fails an altered retry even when the response is 200 and always removes its route handler', async () => {
    const test = transport('lost', true); await expect(test.run()).rejects.toThrow('visible retry preserves exact command');
    expect(test.idle).not.toHaveBeenCalled(); expect(test.page.unroute).toHaveBeenCalledTimes(1);
  });
  it('observes a rejected event promise and cleans up after a simulated browser closes', async () => {
    const test = transport('lost', false, true); await expect(test.run()).rejects.toThrow('Simulated context closed');
    expect(test.idle).not.toHaveBeenCalled(); expect(test.page.unroute).toHaveBeenCalledTimes(1);
  });
});
