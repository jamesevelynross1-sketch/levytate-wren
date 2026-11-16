import { analyseOperationsAutopilot, autopilotLanes, buildOperationsBrief } from '@/lib/levytate/autopilot/operations-autopilot';
import { analyseProgressReviewIntelligence } from '@/lib/levytate/intelligence/progress-review';
import { progressReviewDemoScenarios } from '@/lib/levytate/intelligence/demo-progress-review';
export const intelligenceScope = { organisationId: 'tenant-a', userEmail: 'lead@fictional.invalid', role: 'Apprenticeship Lead' };
const now = '2026-11-10T12:00:00Z';
export function fictionalIntelligence() {
  const signals = analyseProgressReviewIntelligence({ ...progressReviewDemoScenarios[0], organisationId: intelligenceScope.organisationId, now }).signals.map(signal => ({ ...signal, revision: 1 }));
  return { ok: true, scope: intelligenceScope, organisationId: intelligenceScope.organisationId, signals, revision: 1, lastAnalysedAt: now, checked: true };
}
export function fictionalAutopilot() {
  const signals = analyseOperationsAutopilot({ organisationId: intelligenceScope.organisationId, now, learners: [], actions: [], applications: [{ id: 'application-a', employeeId: 'person-a', employeeName: 'Fictional Employee', status: 'Awaiting Manager Review', currentOwner: 'Line Manager', updatedAt: '2026-10-01T12:00:00Z' }] }).map(signal => ({ ...signal, revision: 1, status: 'new' as const }));
  return { scope: intelligenceScope, organisationId: intelligenceScope.organisationId, revision: 1, generatedAt: now, checked: true, analyserVersion: 'operations-autopilot-v1', brief: buildOperationsBrief(signals), lanes: Object.fromEntries(autopilotLanes.map(lane => [lane, signals.filter(signal => signal.lane === lane)])) };
}
