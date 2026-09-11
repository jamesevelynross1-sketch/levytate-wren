import type {
  EmployerRequestAction,
  ProviderRequestAction,
} from "@/lib/levytate/requests/api";
import type {
  ProviderResponseContent,
  ServiceRequestContent,
  ServiceRequestPrivateContext,
} from "@/lib/levytate/requests/domain";

// Keep the wire-level allow-lists local to the validator so it has no runtime
// dependency on application modules and can be exercised by the Node harness.
const allowedRequestModes = ["programme_led", "need_led"] as const;
const allowedRequestReadiness = ["exploring", "planning", "approved_to_proceed"] as const;
const allowedProviderDeclineReasons = [
  "not_a_programme_we_deliver",
  "no_capacity_in_required_timeframe",
  "location_or_delivery_requirements",
  "cohort_size",
  "commercial_fit",
  "other",
] as const;

const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MAX_RECORD_ID_LENGTH = 36;
const MAX_CATALOGUE_ID_LENGTH = 160;
const MAX_TITLE_LENGTH = 160;
const MAX_SHORT_TEXT_LENGTH = 500;
const MAX_MEDIUM_TEXT_LENGTH = 2_000;
const MAX_LONG_TEXT_LENGTH = 5_000;
const MAX_LIST_ITEMS = 20;
const MAX_PRIVATE_RECORDS = 100;
const MAX_DELIVERY_MODELS = 8;
const MAX_LEARNER_VOLUME = 1_000_000;
const MAX_PRICE_PENCE = 1_000_000_000_000;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const catalogueIdPattern = /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/i;
const idempotencyKeyPattern = /^[a-z0-9](?:[a-z0-9._:/-]{0,198}[a-z0-9])?$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const unsafeControlCharacterPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

type UnknownRecord = Record<string, unknown>;

/** A deliberately non-reflective error suitable for returning from a 400 API response. */
export class LevyTateRequestPayloadValidationError extends Error {
  readonly code = "invalid_request_payload";

  constructor(message = "Request payload is invalid.") {
    super(message);
    this.name = "LevyTateRequestPayloadValidationError";
  }
}

function invalid(message = "Request payload is invalid."): never {
  throw new LevyTateRequestPayloadValidationError(message);
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function record(value: unknown): UnknownRecord {
  if (!isPlainRecord(value)) invalid();
  return value;
}

function hasOwn(value: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function exactKeys(value: UnknownRecord, required: readonly string[], optional: readonly string[] = []) {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key))) invalid();
  if (required.some((key) => !hasOwn(value, key))) invalid();
}

function assertPayloadSize(value: unknown) {
  let serialised: string;
  try {
    serialised = JSON.stringify(value);
  } catch {
    invalid();
  }
  if (!serialised || new TextEncoder().encode(serialised).byteLength > MAX_PAYLOAD_BYTES) invalid();
}

function stringValue(
  value: unknown,
  maximumLength: number,
  options: { required?: boolean } = {},
) {
  if (typeof value !== "string" || value.length > maximumLength || unsafeControlCharacterPattern.test(value)) {
    invalid();
  }
  if (options.required && !value.trim()) invalid();
  return value;
}

function optionalString(value: UnknownRecord, key: string, maximumLength: number) {
  if (hasOwn(value, key) && value[key] !== undefined) stringValue(value[key], maximumLength);
}

function requiredString(value: UnknownRecord, key: string, maximumLength: number) {
  return stringValue(value[key], maximumLength, { required: true });
}

function exactBoolean(value: UnknownRecord, key: string) {
  if (typeof value[key] !== "boolean") invalid();
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) invalid();
  return value as T[number];
}

function assertIsoDate(value: unknown) {
  const candidate = stringValue(value, 10, { required: true });
  if (!isoDatePattern.test(candidate)) invalid();
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) invalid();
}

function assertRecordId(value: unknown) {
  const candidate = stringValue(value, MAX_RECORD_ID_LENGTH, { required: true });
  if (!uuidPattern.test(candidate)) invalid();
}

function assertCatalogueId(value: unknown) {
  const candidate = stringValue(value, MAX_CATALOGUE_ID_LENGTH, { required: true });
  if (!catalogueIdPattern.test(candidate)) invalid();
}

function assertIdempotencyKey(value: unknown) {
  const candidate = stringValue(value, MAX_IDEMPOTENCY_KEY_LENGTH, { required: true });
  if (!idempotencyKeyPattern.test(candidate)) invalid();
}

function assertBoundedInteger(value: unknown, minimum: number, maximum: number) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) invalid();
}

function assertUniqueStringArray(
  value: unknown,
  options: {
    maximumItems: number;
    maximumItemLength: number;
    minimumItems?: number;
    catalogueIds?: boolean;
    recordIds?: boolean;
  },
) {
  if (!Array.isArray(value)) invalid();
  const minimumItems = options.minimumItems ?? 0;
  if (value.length < minimumItems || value.length > options.maximumItems) invalid();
  const seen = new Set<string>();
  for (const item of value) {
    if (options.catalogueIds) assertCatalogueId(item);
    else if (options.recordIds) assertRecordId(item);
    else stringValue(item, options.maximumItemLength, { required: true });
    const uniquenessKey = (item as string).trim().toLocaleLowerCase("en-GB");
    if (seen.has(uniquenessKey)) invalid();
    seen.add(uniquenessKey);
  }
}

function assertLearnerVolume(value: unknown) {
  const volume = record(value);
  const kind = enumValue(volume.kind, ["exact", "approximate", "range", "not_confirmed"] as const);
  if (kind === "exact" || kind === "approximate") {
    exactKeys(volume, ["kind", "count"]);
    assertBoundedInteger(volume.count, 1, MAX_LEARNER_VOLUME);
    return;
  }
  if (kind === "range") {
    exactKeys(volume, ["kind", "minimum", "maximum"]);
    assertBoundedInteger(volume.minimum, 1, MAX_LEARNER_VOLUME);
    assertBoundedInteger(volume.maximum, 1, MAX_LEARNER_VOLUME);
    if ((volume.maximum as number) < (volume.minimum as number)) invalid();
    return;
  }
  exactKeys(volume, ["kind"]);
}

function assertWorkplaceLocation(value: unknown) {
  const location = record(value);
  const kind = enumValue(location.kind, ["sites", "remote_or_distributed", "not_confirmed"] as const);
  if (kind === "sites") {
    exactKeys(location, ["kind", "siteIds", "labels"]);
    assertUniqueStringArray(location.siteIds, {
      maximumItems: MAX_LIST_ITEMS,
      maximumItemLength: MAX_CATALOGUE_ID_LENGTH,
      catalogueIds: true,
    });
    assertUniqueStringArray(location.labels, {
      maximumItems: MAX_LIST_ITEMS,
      maximumItemLength: MAX_SHORT_TEXT_LENGTH,
    });
    if ((location.siteIds as unknown[]).length === 0 && (location.labels as unknown[]).length === 0) invalid();
    return;
  }
  if (kind === "remote_or_distributed") {
    exactKeys(location, ["kind"], ["label"]);
    optionalString(location, "label", MAX_SHORT_TEXT_LENGTH);
    return;
  }
  exactKeys(location, ["kind"]);
}

function assertPreferredStart(value: unknown) {
  const start = record(value);
  const kind = enumValue(start.kind, ["month", "quarter", "flexible", "not_confirmed"] as const);
  if (kind === "month" || kind === "quarter") {
    exactKeys(start, ["kind", "value"]);
    requiredString(start, "value", MAX_SHORT_TEXT_LENGTH);
    return;
  }
  exactKeys(start, ["kind"]);
}

function assertServiceRequestContent(value: unknown): asserts value is ServiceRequestContent {
  const content = record(value);
  exactKeys(
    content,
    [
      "title",
      "requestMode",
      "requirement",
      "readiness",
      "learnerVolume",
      "workplaceLocation",
      "deliveryPreferences",
      "preferredStart",
      "responseDeadline",
    ],
    [
      "programmeId",
      "apprenticeshipStandardId",
      "programmeTitle",
      "providerContextId",
      "departments",
      "targetRoles",
      "workforceMix",
      "businessOutcome",
      "workplaceProjectRequirements",
      "accessibilityConsiderations",
      "procurementRequirements",
      "additionalNotes",
    ],
  );
  requiredString(content, "title", MAX_TITLE_LENGTH);
  const requestMode = enumValue(content.requestMode, allowedRequestModes);
  requiredString(content, "requirement", MAX_LONG_TEXT_LENGTH);
  enumValue(content.readiness, allowedRequestReadiness);
  assertLearnerVolume(content.learnerVolume);
  assertWorkplaceLocation(content.workplaceLocation);
  assertUniqueStringArray(content.deliveryPreferences, {
    maximumItems: MAX_DELIVERY_MODELS,
    maximumItemLength: MAX_SHORT_TEXT_LENGTH,
  });
  assertPreferredStart(content.preferredStart);
  assertIsoDate(content.responseDeadline);

  for (const key of ["programmeId", "apprenticeshipStandardId", "providerContextId"] as const) {
    if (hasOwn(content, key) && content[key] !== undefined) assertCatalogueId(content[key]);
  }
  optionalString(content, "programmeTitle", MAX_SHORT_TEXT_LENGTH);
  if (requestMode === "programme_led" && !content.programmeId) invalid();

  for (const key of ["departments", "targetRoles"] as const) {
    if (hasOwn(content, key) && content[key] !== undefined) {
      assertUniqueStringArray(content[key], {
        maximumItems: MAX_LIST_ITEMS,
        maximumItemLength: MAX_SHORT_TEXT_LENGTH,
      });
    }
  }
  if (hasOwn(content, "workforceMix") && content.workforceMix !== undefined) {
    enumValue(content.workforceMix, ["existing_employees", "new_recruits", "mixed", "unknown"] as const);
  }
  for (const key of [
    "businessOutcome",
    "workplaceProjectRequirements",
    "accessibilityConsiderations",
    "procurementRequirements",
    "additionalNotes",
  ] as const) {
    optionalString(content, key, MAX_LONG_TEXT_LENGTH);
  }
}

function assertPrivateContext(value: unknown): asserts value is ServiceRequestPrivateContext {
  const context = record(value);
  exactKeys(
    context,
    [],
    [
      "privateNotes",
      "employeeIds",
      "learnerIds",
      "applicationIds",
      "financeReference",
      "intelligenceSignalIds",
      "privateProviderConcern",
    ],
  );
  optionalString(context, "privateNotes", MAX_LONG_TEXT_LENGTH);
  optionalString(context, "financeReference", MAX_SHORT_TEXT_LENGTH);
  optionalString(context, "privateProviderConcern", MAX_LONG_TEXT_LENGTH);
  for (const key of ["employeeIds", "learnerIds", "applicationIds", "intelligenceSignalIds"] as const) {
    if (hasOwn(context, key) && context[key] !== undefined) {
      assertUniqueStringArray(context[key], {
        maximumItems: MAX_PRIVATE_RECORDS,
        maximumItemLength: MAX_CATALOGUE_ID_LENGTH,
        catalogueIds: true,
      });
    }
  }
}

function assertProviderIds(value: unknown) {
  assertUniqueStringArray(value, {
    minimumItems: 1,
    maximumItems: 5,
    maximumItemLength: MAX_CATALOGUE_ID_LENGTH,
    catalogueIds: true,
  });
}

function assertProposedProgramme(value: unknown, requireComplete: boolean) {
  const programme = record(value);
  const kind = enumValue(programme.kind, ["canonical_programme", "alternative_to_discuss"] as const);
  if (kind === "canonical_programme") {
    exactKeys(programme, ["kind", "programmeId"], ["programmeTitle"]);
    if (requireComplete) assertCatalogueId(programme.programmeId);
    else {
      const id = stringValue(programme.programmeId, MAX_CATALOGUE_ID_LENGTH);
      if (id && !catalogueIdPattern.test(id)) invalid();
    }
    optionalString(programme, "programmeTitle", MAX_SHORT_TEXT_LENGTH);
    return;
  }
  exactKeys(programme, ["kind", "description"]);
  stringValue(programme.description, MAX_MEDIUM_TEXT_LENGTH, { required: requireComplete });
}

function assertDeliveryApproach(value: unknown, requireComplete: boolean) {
  const approach = record(value);
  exactKeys(approach, ["models"], ["notes"]);
  assertUniqueStringArray(approach.models, {
    minimumItems: requireComplete ? 1 : 0,
    maximumItems: MAX_DELIVERY_MODELS,
    maximumItemLength: MAX_SHORT_TEXT_LENGTH,
  });
  optionalString(approach, "notes", MAX_MEDIUM_TEXT_LENGTH);
}

function assertCohortCapacity(value: unknown, requireComplete: boolean) {
  const capacity = record(value);
  exactKeys(capacity, ["kind"], ["value", "notes"]);
  const kind = enumValue(
    capacity.kind,
    ["can_accommodate", "minimum_required", "maximum_places", "requires_discussion"] as const,
  );
  if (hasOwn(capacity, "value") && capacity.value !== undefined) {
    assertBoundedInteger(capacity.value, 1, MAX_LEARNER_VOLUME);
  }
  if (requireComplete && (kind === "minimum_required" || kind === "maximum_places") && capacity.value === undefined) {
    invalid();
  }
  optionalString(capacity, "notes", MAX_MEDIUM_TEXT_LENGTH);
}

function assertProviderResponseContent(
  value: unknown,
  options: { requireComplete: boolean },
): asserts value is ProviderResponseContent {
  const content = record(value);
  exactKeys(
    content,
    [
      "proposedProgramme",
      "whyThisFits",
      "earliestAvailableStart",
      "deliveryApproach",
      "cohortCapacity",
      "workplaceRequirements",
      "employerReportingSupport",
    ],
    [
      "learningCommitment",
      "proposedTrainingAssessmentPricePence",
      "priceBasisAndAssumptions",
      "additionalCommercialCosts",
      "relevantEvidence",
      "exceptionsOrClarifications",
    ],
  );
  assertProposedProgramme(content.proposedProgramme, options.requireComplete);
  stringValue(content.whyThisFits, MAX_LONG_TEXT_LENGTH, { required: options.requireComplete });
  stringValue(content.earliestAvailableStart, MAX_SHORT_TEXT_LENGTH, { required: options.requireComplete });
  assertDeliveryApproach(content.deliveryApproach, options.requireComplete);
  assertCohortCapacity(content.cohortCapacity, options.requireComplete);
  stringValue(content.workplaceRequirements, MAX_LONG_TEXT_LENGTH, { required: options.requireComplete });
  stringValue(content.employerReportingSupport, MAX_LONG_TEXT_LENGTH, { required: options.requireComplete });
  optionalString(content, "learningCommitment", MAX_LONG_TEXT_LENGTH);
  if (
    hasOwn(content, "proposedTrainingAssessmentPricePence") &&
    content.proposedTrainingAssessmentPricePence !== undefined
  ) {
    assertBoundedInteger(content.proposedTrainingAssessmentPricePence, 0, MAX_PRICE_PENCE);
  }
  for (const key of [
    "priceBasisAndAssumptions",
    "additionalCommercialCosts",
    "relevantEvidence",
    "exceptionsOrClarifications",
  ] as const) {
    optionalString(content, key, MAX_LONG_TEXT_LENGTH);
  }
}

function assertBaseAction(action: UnknownRecord) {
  assertIdempotencyKey(action.idempotencyKey);
}

function assertRequestAndResponseIds(action: UnknownRecord) {
  assertRecordId(action.requestId);
  assertRecordId(action.responseId);
}

function assertDecisionAction(action: UnknownRecord, actionName: string) {
  exactKeys(action, ["action", "idempotencyKey", "requestId", "responseId"], ["privateDecisionNote"]);
  assertRequestAndResponseIds(action);
  optionalString(action, "privateDecisionNote", MAX_LONG_TEXT_LENGTH);
  if (action.action !== actionName) invalid();
}

/** Validates and returns a closed, bounded employer Request action payload. */
export function assertEmployerRequestActionPayload(value: unknown): EmployerRequestAction {
  assertPayloadSize(value);
  const action = record(value);
  assertBaseAction(action);
  if (typeof action.action !== "string") invalid("Request action is not supported.");

  switch (action.action) {
    case "create_draft":
      exactKeys(action, ["action", "idempotencyKey", "content"], ["privateContext"]);
      assertServiceRequestContent(action.content);
      if (hasOwn(action, "privateContext") && action.privateContext !== undefined) assertPrivateContext(action.privateContext);
      break;
    case "update_draft":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "content"], ["privateContext"]);
      assertRecordId(action.requestId);
      assertServiceRequestContent(action.content);
      if (hasOwn(action, "privateContext") && action.privateContext !== undefined) assertPrivateContext(action.privateContext);
      break;
    case "send_request":
      exactKeys(action, ["action", "idempotencyKey", "content", "providerIds"], ["privateContext"]);
      assertServiceRequestContent(action.content);
      assertProviderIds(action.providerIds);
      if (hasOwn(action, "privateContext") && action.privateContext !== undefined) assertPrivateContext(action.privateContext);
      break;
    case "send_existing_draft":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "content", "providerIds"], ["privateContext"]);
      assertRecordId(action.requestId);
      assertServiceRequestContent(action.content);
      assertProviderIds(action.providerIds);
      if (hasOwn(action, "privateContext") && action.privateContext !== undefined) assertPrivateContext(action.privateContext);
      break;
    case "publish":
      exactKeys(action, ["action", "idempotencyKey", "requestId"]);
      assertRecordId(action.requestId);
      break;
    case "publish_revision":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "content", "changeSummary"]);
      assertRecordId(action.requestId);
      assertServiceRequestContent(action.content);
      requiredString(action, "changeSummary", MAX_MEDIUM_TEXT_LENGTH);
      break;
    case "invite_providers":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "providerIds"]);
      assertRecordId(action.requestId);
      assertProviderIds(action.providerIds);
      break;
    case "retry_invitation":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "invitationId"]);
      assertRecordId(action.requestId);
      assertRecordId(action.invitationId);
      break;
    case "ask_clarification":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "invitationId", "question"]);
      assertRecordId(action.requestId);
      assertRecordId(action.invitationId);
      requiredString(action, "question", MAX_MEDIUM_TEXT_LENGTH);
      break;
    case "answer_clarification":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "clarificationId", "answer", "shareWithAll"]);
      assertRecordId(action.requestId);
      assertRecordId(action.clarificationId);
      requiredString(action, "answer", MAX_LONG_TEXT_LENGTH);
      exactBoolean(action, "shareWithAll");
      break;
    case "shortlist":
    case "decline_provider":
    case "progress_to_agreement":
    case "not_proceeded":
      assertDecisionAction(action, action.action);
      break;
    case "confirm_agreement":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "responseId"]);
      assertRequestAndResponseIds(action);
      break;
    case "confirm_and_handover":
    case "handover":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "responseId", "addProvider", "addProgramme"]);
      assertRequestAndResponseIds(action);
      exactBoolean(action, "addProvider");
      exactBoolean(action, "addProgramme");
      break;
    case "cancel":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "reason"]);
      assertRecordId(action.requestId);
      requiredString(action, "reason", MAX_MEDIUM_TEXT_LENGTH);
      break;
    case "close_request":
      exactKeys(action, ["action", "idempotencyKey", "requestId"]);
      assertRecordId(action.requestId);
      break;
    case "extend_deadline":
      exactKeys(action, ["action", "idempotencyKey", "requestId", "deadline"]);
      assertRecordId(action.requestId);
      assertIsoDate(action.deadline);
      break;
    default:
      invalid("Request action is not supported.");
  }

  return action as EmployerRequestAction;
}

/** Validates and returns a closed, bounded provider Opportunity action payload. */
export function assertProviderRequestActionPayload(value: unknown): ProviderRequestAction {
  assertPayloadSize(value);
  const action = record(value);
  assertBaseAction(action);
  if (typeof action.action !== "string") invalid("Provider action is not supported.");

  switch (action.action) {
    case "mark_viewed":
      exactKeys(action, ["action", "idempotencyKey", "invitationId"]);
      assertRecordId(action.invitationId);
      break;
    case "save_draft":
      exactKeys(action, ["action", "idempotencyKey", "invitationId", "content"]);
      assertRecordId(action.invitationId);
      assertProviderResponseContent(action.content, { requireComplete: false });
      break;
    case "submit_response":
      exactKeys(action, ["action", "idempotencyKey", "invitationId", "content"]);
      assertRecordId(action.invitationId);
      assertProviderResponseContent(action.content, { requireComplete: true });
      break;
    case "decline":
      exactKeys(action, ["action", "idempotencyKey", "invitationId", "reasonCategory"], ["note"]);
      assertRecordId(action.invitationId);
      enumValue(action.reasonCategory, allowedProviderDeclineReasons);
      optionalString(action, "note", MAX_MEDIUM_TEXT_LENGTH);
      break;
    case "ask_clarification":
      exactKeys(action, ["action", "idempotencyKey", "invitationId", "question"]);
      assertRecordId(action.invitationId);
      requiredString(action, "question", MAX_MEDIUM_TEXT_LENGTH);
      break;
    case "answer_clarification":
      exactKeys(action, ["action", "idempotencyKey", "invitationId", "clarificationId", "answer"]);
      assertRecordId(action.invitationId);
      assertRecordId(action.clarificationId);
      requiredString(action, "answer", MAX_LONG_TEXT_LENGTH);
      break;
    default:
      invalid("Provider action is not supported.");
  }

  return action as ProviderRequestAction;
}
