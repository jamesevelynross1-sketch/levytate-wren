import { z } from "zod";
import type { LevyFinanceState } from "@/lib/levytate/finance/types";
import type { EmployerRequestsWorkspaceBootstrap } from "@/lib/levytate/requests/api";
import { providerDeclineReasonCategories, serviceRequestClarificationVisibilities, serviceRequestDecisionStates, serviceRequestInvitationStatuses, serviceRequestModes, serviceRequestReadinessValues, serviceRequestStatuses } from "@/lib/levytate/requests/domain";

const text = z.string(), id = text.min(1), texts = z.array(text);
const count = z.number().int().safe().nonnegative(), money = z.number().int().safe();
const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const date = z.iso.date(), timestamp = z.iso.datetime({ offset: true });
const optionalText = text.optional(), optionalTime = timestamp.optional();
const volume = z.discriminatedUnion("kind", [object({ kind: z.literal("exact"), count }), object({ kind: z.literal("approximate"), count }), object({ kind: z.literal("range"), minimum: count, maximum: count }), object({ kind: z.literal("not_confirmed") })]);
const location = z.discriminatedUnion("kind", [object({ kind: z.literal("sites"), siteIds: texts, labels: texts }), object({ kind: z.literal("remote_or_distributed"), label: optionalText }), object({ kind: z.literal("not_confirmed") })]);
const start = z.discriminatedUnion("kind", [object({ kind: z.literal("month"), value: text }), object({ kind: z.literal("quarter"), value: text }), object({ kind: z.literal("flexible") }), object({ kind: z.literal("not_confirmed") })]);
const optionalInformation = { departments: texts.optional(), targetRoles: texts.optional(), workforceMix: z.enum(["existing_employees", "new_recruits", "mixed", "unknown"]).optional(), businessOutcome: optionalText, workplaceProjectRequirements: optionalText, accessibilityConsiderations: optionalText, procurementRequirements: optionalText, additionalNotes: optionalText };
const commonContent = { title: text, requestMode: z.enum(serviceRequestModes), requirement: text, readiness: z.enum(serviceRequestReadinessValues), learnerVolume: volume, workplaceLocation: location, deliveryPreferences: texts, preferredStart: start, responseDeadline: text };
const content = object({ ...commonContent, ...optionalInformation, programmeId: optionalText, apprenticeshipStandardId: optionalText, programmeTitle: optionalText, providerContextId: optionalText });
const published = object({ ...commonContent, employerOrganisationName: text, programme: object({ id, title: optionalText, apprenticeshipStandardId: optionalText }).optional(), optionalInformation: object(optionalInformation), providersShouldAddress: texts });
const delivery = object({ models: texts, notes: optionalText });
const responseContent = object({ proposedProgramme: z.discriminatedUnion("kind", [object({ kind: z.literal("canonical_programme"), programmeId: id, programmeTitle: optionalText }), object({ kind: z.literal("alternative_to_discuss"), description: text })]), whyThisFits: text, earliestAvailableStart: text, deliveryApproach: delivery, cohortCapacity: object({ kind: z.enum(["can_accommodate", "minimum_required", "maximum_places", "requires_discussion"]), value: count.optional(), notes: optionalText }), workplaceRequirements: text, learningCommitment: optionalText, employerReportingSupport: text, proposedTrainingAssessmentPricePence: count.optional(), priceBasisAndAssumptions: optionalText, additionalCommercialCosts: optionalText, relevantEvidence: optionalText, exceptionsOrClarifications: optionalText });
const scope = { requestId: id, organisationId: id };
const invitation = object({ ...scope, id, providerId: id, providerName: text, requestVersion: count, status: z.enum(serviceRequestInvitationStatuses), notificationStatus: z.enum(["pending", "accepted", "failed"]), notificationAttemptCount: count, sentAt: optionalTime, viewedAt: optionalTime, deadline: text, declinedAt: optionalTime, declineReasonCategory: z.enum(providerDeclineReasonCategories).optional(), createdAt: timestamp, updatedAt: timestamp });
const response = object({ ...scope, id, invitationId: id, providerId: id, providerName: text, requestVersion: count, currentVersion: count, submittedAt: timestamp, submittedContent: responseContent });
const version = object({ ...scope, version: count, publishedSnapshot: published, publishedAt: timestamp, publishedBy: id, changeSummary: text });
const responseVersion = object({ ...scope, responseId: id, providerId: id, requestVersion: count, version: count, submittedContent: responseContent, submittedAt: timestamp, submittedByProviderMembershipId: id });
const clarification = object({ ...scope, id, invitationId: id, providerId: id, providerName: text, requestVersion: count, askedByType: z.enum(["provider_member", "employer_user"]), question: text, visibility: z.enum(serviceRequestClarificationVisibilities), askedAt: timestamp, answer: optionalText, answeredAt: optionalTime });
const decision = object({ ...scope, id, invitationId: id, responseId: id, providerId: id, providerName: text, state: z.enum(serviceRequestDecisionStates), privateDecisionNote: optionalText, updatedAt: timestamp });
const agreement = object({ ...scope, id, providerId: id, invitationId: id, responseId: id, responseVersion: count, proposedProgrammeId: optionalText, proposedStart: text, deliveryApproach: delivery, workplaceRequirements: text, learningCommitment: optionalText, employerReportingSupport: text, proposedTrainingAssessmentPricePence: count.optional(), priceBasisAndAssumptions: optionalText, additionalCommercialCosts: optionalText, exceptionsOrClarifications: optionalText, label: z.literal("Request agreement snapshot"), confirmedAt: timestamp, confirmedBy: id });
const handover = object({ ...scope, id, agreementSnapshotId: id, providerId: id, programmeId: optionalText, addProvider: z.boolean(), addProgramme: z.boolean(), providerAdded: z.boolean(), programmeAdded: z.boolean(), completedBy: id, completedAt: timestamp, idempotencyKey: id });
const comparison = object({ requestId: id, requestVersion: count, pointsToResolve: texts, columns: z.array(object({ providerId: id, responseId: id, programme: text, startAvailability: text, delivery: text, cohortCapacity: text, workplaceRequirements: text, learningCommitment: text, supportAndReporting: text, proposedPrice: text, evidence: text, exceptions: text })) });
const request = object({ id, organisationId: id, content, privateContext: object({ privateNotes: optionalText, employeeIds: texts.optional(), learnerIds: texts.optional(), applicationIds: texts.optional(), financeReference: optionalText, intelligenceSignalIds: texts.optional(), privateProviderConcern: optionalText }), status: z.enum(serviceRequestStatuses), currentVersion: count, createdBy: id, createdAt: timestamp, updatedAt: timestamp, publishedAt: optionalTime, closedAt: optionalTime, cancellationReason: optionalText, versions: z.array(version), invitations: z.array(invitation), responses: z.array(response), responseVersions: z.array(responseVersion), clarifications: z.array(clarification), decisions: z.array(decision), agreementSnapshots: z.array(agreement), handovers: z.array(handover), comparison });
const requests = object({ requestsEnabled: z.literal(true), organisation: object({ id, name: text }), metrics: object({ openRequests: count, responsesReceived: count, requestsInDecision: count, progressedToAgreement: count }), requests: z.array(request), providerOptions: z.array(object({ providerId: id, providerName: text, deliveryModels: texts, regions: texts, programmeIds: texts, relationshipStatus: z.enum(["existing", "marketplace"]), providerAccessReady: z.boolean() })), programmeOptions: z.array(object({ programmeId: id, providerId: id, programmeName: text, apprenticeshipStandardId: optionalText, level: count.optional(), fundingBandMaximumPence: count.optional() })) });

const transaction = object({ transactionId: text, transactionDate: date, description: text, category: z.enum(["levy_in", "apprenticeship_spend", "levy_expiry", "transfer_out", "transfer_in", "refund_or_adjustment", "other"]), amountPence: money, providerName: optionalText, apprenticeName: optionalText, programmeName: optionalText, payeScheme: optionalText, payrollMonth: optionalText, reportedBalancePence: money.optional(), sourceRow: count, fingerprint: id });
const importRecord = object({ id, importedAt: timestamp, fileName: text, sourceRows: count, newTransactions: count, duplicateRows: count, reviewRows: count, dateRange: object({ from: date, to: date }).refine(value => value.from <= value.to).nullable() });
const finance = object({ version: z.literal(1), mode: z.literal("persistent"), transactions: z.array(transaction), imports: z.array(importRecord), manualBalancePence: count.optional(), manualBalanceConfirmedAt: z.union([date, timestamp]).optional() }).refine(value => (value.manualBalancePence === undefined) === (value.manualBalanceConfirmedAt === undefined));

export function decodeRequestsReadResponse(value: unknown, organisationId: string | undefined): EmployerRequestsWorkspaceBootstrap {
  const parsed = object({ ok: z.literal(true), workspace: requests }).safeParse(value);
  if (!parsed.success || !organisationId || parsed.data.workspace.organisation.id !== organisationId) throw new Error("Requests returned an incomplete response for this account. Retry the original update or reload saved state.");
  for (const item of parsed.data.workspace.requests) {
    if (item.organisationId !== organisationId || item.comparison.requestId !== item.id
      || [item.versions, item.invitations, item.responses, item.responseVersions, item.clarifications, item.decisions, item.agreementSnapshots, item.handovers].some(rows => rows.some(row => row.organisationId !== organisationId || row.requestId !== item.id))) {
      throw new Error("Requests returned an inconsistent workspace. Retry the original update or reload saved state.");
    }
  }
  return (value as { workspace: EmployerRequestsWorkspaceBootstrap }).workspace;
}

export function decodeFinanceReadResponse(value: unknown): LevyFinanceState {
  if (!object({ ok: z.literal(true), state: finance }).safeParse(value).success) throw new Error("Finance returned an incomplete response. Retry the original update or reload saved state.");
  return (value as { state: LevyFinanceState }).state;
}
