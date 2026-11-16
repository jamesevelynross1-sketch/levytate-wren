import { z } from 'zod';
import { operationalActionEventTypes, operationalActionSourceTypes, operationalActionStatuses, persistentOperationalActionTypes } from '@/lib/levytate/mvp/operational-actions';
import type { PersistentOperationalAction } from '@/lib/levytate/mvp/operational-actions';
import type { OperationalActionManagementDetail } from '@/lib/server/levytate-operational-actions';

export const operationalText = z.string();
export const operationalId = z.string().min(1);
export const operationalCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const operationalTimestamp = z.string().min(1).refine(value => Number.isFinite(Date.parse(value)));
export const operationalDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)]);
const timeOrEmpty = z.union([z.literal(''), operationalTimestamp]);
export const operationalOwner = z.enum(['Employee', 'Line Manager', 'Apprenticeship Lead', 'HR', 'Provider', 'Shared']);
export const operationalPriority = z.enum(['Critical', 'High', 'Medium', 'Low', 'Informational']);
export const operationalWorkflow = z.enum(['open_learner', 'complete_pre_enrolment', 'complete_enrolment', 'record_review', 'add_progress', 'manage_break', 'return_learner', 'manage_assessment']);
export const operationalPath = z.string().refine(value => value.startsWith('/levytate/app') && !value.includes('\\') && !/[\r\n]/.test(value));
const metadata = z.object({ sourceCondition: operationalText.optional(), priorActionId: operationalText.optional(), conditionClearedAt: timeOrEmpty.optional(), dismissalSuppressesUntilConditionClears: z.boolean().optional(), dueDateOverride: z.object({ date: operationalDate, reason: operationalText, sourceDate: operationalDate, setAt: operationalTimestamp, setBy: operationalText }).optional(), ownershipOverride: z.object({ ownerType: operationalOwner, ownerUserId: operationalText, ownerDisplayName: operationalText, assignedAt: operationalTimestamp, assignedBy: operationalText }).optional(), cancellation: z.object({ category: operationalText, reason: operationalText, cancelledAt: operationalTimestamp, cancelledBy: operationalText }).optional() }).catchall(z.unknown());
export const persistentActionSchema = z.object({ organisationId: operationalId, id: operationalId, learnerRecordId: operationalText, applicationId: operationalText, employeeId: operationalText, sourceType: z.enum(operationalActionSourceTypes), sourceKey: operationalId, actionType: z.enum(persistentOperationalActionTypes), title: operationalText, description: operationalText, priority: operationalPriority, priorityRank: operationalCount, status: z.enum(operationalActionStatuses), ownerType: operationalOwner, ownerUserId: operationalText, ownerDisplayName: operationalText, dueDate: operationalDate, detectedAt: operationalTimestamp, acknowledgedAt: timeOrEmpty, acknowledgedBy: operationalText, startedAt: timeOrEmpty, startedBy: operationalText, completedAt: timeOrEmpty, completedBy: operationalText, completionMethod: z.enum(['', 'source_condition_resolved', 'user_completed', 'dismissed', 'system_cancelled']), completionNote: operationalText, dismissedAt: timeOrEmpty, dismissedBy: operationalText, dismissalReason: operationalText, sourceUrl: operationalPath, metadata, version: operationalCount, createdAt: operationalTimestamp, updatedAt: operationalTimestamp });
export const operationalEventSchema = z.object({ organisationId: operationalId, id: operationalId, operationalActionId: operationalId, eventType: z.enum(operationalActionEventTypes), previousStatus: z.union([z.literal(''), z.enum(operationalActionStatuses)]), newStatus: z.union([z.literal(''), z.enum(operationalActionStatuses)]), actorUserId: operationalText, actorName: operationalText, eventDate: operationalTimestamp, summary: operationalText, metadata: z.record(z.string(), z.unknown()), createdAt: operationalTimestamp });
const managementSchema = z.object({ ok: z.literal(true), action: persistentActionSchema, history: z.array(operationalEventSchema), previousOccurrences: z.array(persistentActionSchema), ownerOptions: z.array(z.object({ ownerType: operationalOwner, ownerUserId: operationalText, label: operationalText, accessNote: operationalText })), context: z.object({ learnerName: operationalText, jobTitle: operationalText, department: operationalText, site: operationalText, managerName: operationalText, programmeName: operationalText, providerName: operationalText, sourceReason: operationalText, sourceFacts: z.array(z.object({ label: operationalText, value: operationalText })), workflowLabel: operationalText, workflowActionType: operationalWorkflow, dueDateOrigin: z.enum(['Source workflow', 'Manual override', 'No source date']), terminalProtection: z.boolean() }) });
export function decodeOperationsValue<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('The saved Operations response could not be verified. Retry the original update or reload saved state.');
  return result.data;
}
function requireSameScope(condition: boolean) { if (!condition) throw new Error('The Operations response does not match the original account and update. Reload saved state before continuing.'); }
export function decodeOperationalDetail(value: unknown, expected: { actionId: string; organisationId: string }): OperationalActionManagementDetail {
  const result = decodeOperationsValue(managementSchema, value);
  requireSameScope(result.action.id === expected.actionId && result.action.organisationId === expected.organisationId && result.history.every(event => event.operationalActionId === expected.actionId && event.organisationId === expected.organisationId) && result.previousOccurrences.every(action => action.organisationId === expected.organisationId && action.sourceKey === result.action.sourceKey));
  return result;
}
export function decodeOperationalMutation(value: unknown, expected: { action: PersistentOperationalAction; command: string; payload: Record<string, unknown> }): PersistentOperationalAction {
  const { action } = decodeOperationsValue(z.object({ ok: z.literal(true), action: persistentActionSchema }), value);
  const status = ({ acknowledge: 'acknowledged', start: 'in_progress', complete: 'completed', dismiss: 'dismissed', cancel: 'cancelled' } as Record<string, string>)[expected.command] ?? expected.action.status;
  requireSameScope(action.id === expected.action.id && action.organisationId === expected.action.organisationId && action.version === expected.action.version + 1 && action.status === status && action.sourceKey === expected.action.sourceKey);
  if (expected.command === 'assign') requireSameScope(action.ownerType === expected.payload.ownerType && action.ownerUserId === (expected.payload.ownerUserId ?? ''));
  if (expected.command === 'due_date') requireSameScope(action.dueDate === expected.payload.dueDate);
  return action;
}

export type OperationsClientScope = { organisationId: string; userEmail: string; role: string };
export const operationsScopeSchema = z.object({ organisationId: operationalId, userEmail: operationalId, role: operationalId });
export function requireOperationsScope(actual: OperationsClientScope, expected: OperationsClientScope) {
  requireSameScope(actual.organisationId === expected.organisationId && actual.userEmail === expected.userEmail && actual.role === expected.role);
}
const managerItemSchema = z.object({ actionId: operationalId, title: operationalText, employeeName: operationalText, programmeName: operationalText, priority: operationalPriority, status: z.enum(operationalActionStatuses), statusLabel: operationalText, dueDate: operationalDate, timingLabel: operationalText, overdue: z.boolean(), reason: operationalText, kind: z.enum(['application_review', 'manager_support']), submittedDate: timeOrEmpty, submittedVersion: operationalCount.nullable(), primaryAction: z.enum(['Acknowledge', 'Start work', 'Open source workflow', 'View history']), sourceUrl: operationalPath, version: operationalCount });
const managerScopeSchema = operationsScopeSchema.extend({ role: z.literal('Line Manager') });
export const managerDetailSchema = managerItemSchema.extend({ scope: managerScopeSchema, employee: z.object({ name: operationalText, jobTitle: operationalText, department: operationalText, site: operationalText }), programme: z.object({ name: operationalText, providerName: operationalText }), ownerLabel: operationalText, detectedAt: operationalTimestamp, nextStep: operationalText, history: z.array(z.object({ eventType: z.enum(operationalActionEventTypes), actorName: operationalText, eventDate: operationalTimestamp, summary: operationalText })) });
export function decodeManagerActions(value: unknown, expected: OperationsClientScope) {
  const result = decodeOperationsValue(z.object({ scope: managerScopeSchema, source: z.literal('supabase'), generatedAt: operationalTimestamp, summary: z.object({ open: operationalCount, acknowledged: operationalCount, inProgress: operationalCount, overdue: operationalCount }), actions: z.array(managerItemSchema) }), value);
  requireOperationsScope(result.scope, expected);
  return result;
}
export function decodeManagerAction(value: unknown, expected: OperationsClientScope, actionId: string) {
  const result = decodeOperationsValue(z.object({ ok: z.literal(true), action: managerDetailSchema }), value);
  requireOperationsScope(result.action.scope, expected); requireSameScope(result.action.actionId === actionId);
  return result.action;
}
const queue = z.enum(['urgent', 'ready_to_enrol', 'reviews', 'progress', 'breaks', 'pre_enrolment', 'assessment']);
const itemSchema = z.object({ id: operationalId, queueType: queue, learnerRecordId: operationalId, learnerName: operationalText, programmeName: operationalText, providerName: operationalText, department: operationalText, site: operationalText, lifecycleStatus: operationalText, priorityLevel: operationalPriority, priorityRank: operationalCount, reason: operationalText, dueDate: operationalDate, dueStatus: z.enum(['Overdue', 'Due today', 'Due soon', 'No due date']), daysOverdue: z.number().int().nullable(), timingLabel: operationalText, ownerType: operationalOwner, actionType: operationalWorkflow, actionLabel: operationalText, actionUrl: operationalPath, secondaryActionUrl: z.union([z.literal(''), operationalPath]), reviewType: operationalText.optional(), latestReviewDate: timeOrEmpty.optional(), targetProgress: z.number().optional(), actualProgress: z.number().optional(), variance: z.number().optional(), supportAction: operationalText.optional(), breakStartDate: operationalDate.optional(), expectedReturnDate: operationalDate.optional(), daysOnBreak: operationalCount.optional(), readinessSummary: operationalText.optional(), sourceType: z.enum(operationalActionSourceTypes), sourceCondition: operationalText, sourceKey: operationalId, persistentActionType: z.enum(persistentOperationalActionTypes), persistentActionId: operationalId.optional(), persistentActionStatus: z.enum(operationalActionStatuses).optional(), persistentDetectedAt: timeOrEmpty.optional(), persistentAcknowledgedAt: timeOrEmpty.optional(), persistentDueDate: operationalDate.optional(), persistentOwnerUserId: operationalText.optional(), persistentOwnerDisplayName: operationalText.optional() });
const operationsSchema = z.object({ ok: z.literal(true), scope: operationsScopeSchema, source: z.literal('supabase'), generatedAt: operationalTimestamp, summary: z.object({ needsAttentionNow: operationalCount, readyToEnrol: operationalCount, reviewsOverdue: operationalCount, behindTarget: operationalCount, activeBreaks: operationalCount, approachingAssessmentCompletion: operationalCount }), queues: z.object({ urgent: z.array(itemSchema), ready_to_enrol: z.array(itemSchema), reviews: z.array(itemSchema), progress: z.array(itemSchema), breaks: z.array(itemSchema), pre_enrolment: z.array(itemSchema), assessment: z.array(itemSchema) }), recentActivity: z.array(z.object({ id: operationalId, learnerRecordId: operationalId, learnerName: operationalText, eventDate: operationalTimestamp, actorName: operationalText, action: operationalText, actionUrl: operationalPath })), filterOptions: z.object({ priorities: z.array(operationalText), queues: z.array(z.object({ value: queue, label: operationalText })), learners: z.array(operationalText), programmes: z.array(operationalText), providers: z.array(operationalText), sites: z.array(operationalText), departments: z.array(operationalText), owners: z.array(operationalText), actionTypes: z.array(operationalText) }), totalAttentionItems: operationalCount });
export function decodeOperationsSummary(value: unknown, expected: OperationsClientScope) {
  const result = decodeOperationsValue(operationsSchema, value); requireOperationsScope(result.scope, expected);
  requireSameScope(Object.entries(result.queues).every(([key, items]) => items.every(item => item.queueType === key)));
  return result;
}
export function decodeManagerMutation(value: unknown, scope: OperationsClientScope, expected: { actionId: string; version: number; command: 'acknowledge' | 'start' }) {
  const result = decodeOperationsValue(z.object({ ok: z.literal(true), action: managerDetailSchema, confirmation: z.object({ actionId: operationalId, version: operationalCount, status: z.enum(operationalActionStatuses) }) }), value);
  requireOperationsScope(result.action.scope, scope);
  requireSameScope(result.action.actionId === expected.actionId && result.confirmation.actionId === expected.actionId && result.confirmation.version === expected.version + 1 && result.confirmation.status === (expected.command === 'acknowledge' ? 'acknowledged' : 'in_progress') && result.action.version >= result.confirmation.version);
  return result.action;
}
