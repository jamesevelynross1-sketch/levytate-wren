import { describe, expect, it } from 'vitest';
// Tests validate only the helper's actor contract; these objects are not Auth evidence.
// @ts-expect-error Executable helper intentionally has no declaration file.
import { operationsAcceptanceActors } from '../scripts/release-operations-intelligence-browser.mjs';
const learnerId = 'learner-10000000-0000-4000-8000-000000000001';
function fixture() {
  const tenant = { key: 'a', id: '10000000-0000-4000-8000-000000000001', users: [
    { key: 'lead', role: 'Apprenticeship Lead', email: 'lead@example.invalid', membershipId: 'member-a', personId: null },
    { key: 'employee', role: 'Employee', email: 'employee@example.invalid', membershipId: 'employee-a', personId: 'person-employee-a' },
    { key: 'manager', role: 'Line Manager', email: 'manager@example.invalid', membershipId: 'manager-a', personId: 'person-manager-a' },
  ] };
  const manifest = { tenants: [tenant, { key: 'b', id: '20000000-0000-4000-8000-000000000001', users: [] }] };
  const lead = { context: { request: {} }, page: {}, user: tenant.users[0], tenant };
  return { manifest, lead, contexts: new Map([['a:lead', lead]]) };
}
describe('explicit Lead-only continuation never manufactures role contexts', () => {
  it('retains the original Lead and declared People identities while returning no absent role actors', () => {
    const { manifest, lead, contexts } = fixture(); const result = operationsAcceptanceActors(manifest, contexts, learnerId, true);
    expect(result.lead).toBe(lead); expect(result.roleActors).toEqual([]); expect(result.manager).toBeUndefined(); expect(result.employee).toBeUndefined(); expect(result.other).toBeUndefined();
    expect(result.personIds).toEqual(['person-employee-a', 'person-manager-a']); expect(result.otherTenant).toBe(manifest.tenants[1]);
  });
  it('is not enabled implicitly when the ordinary run is missing actors', () => {
    const { manifest, contexts } = fixture(); expect(operationsAcceptanceActors(manifest, contexts, learnerId).roleActors).toEqual([undefined, undefined, undefined]);
  });
  it.each(['extra context', 'foreign lead', 'changed email', 'changed membership', 'duplicate People', 'missing learner'])('refuses %s before any browser action', kind => {
    const { manifest, lead, contexts } = fixture(); let id = learnerId;
    if (kind === 'extra context') contexts.set('a:manager', lead);
    if (kind === 'foreign lead') lead.tenant = manifest.tenants[1];
    if (kind === 'changed email') lead.user = { ...lead.user, email: 'different@example.invalid' };
    if (kind === 'changed membership') lead.user = { ...lead.user, membershipId: 'different' };
    if (kind === 'duplicate People') manifest.tenants[0].users[2].personId = manifest.tenants[0].users[1].personId;
    if (kind === 'missing learner') id = '';
    expect(() => operationsAcceptanceActors(manifest, contexts, id, true)).toThrow('Lead-only');
  });
});
