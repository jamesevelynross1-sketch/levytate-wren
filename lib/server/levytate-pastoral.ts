import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  isPastoralTopicCategory,
  pastoralRecipientIsSafeForConcern,
  pastoralPolicyVersion,
  pastoralSharedFieldNames,
  type PastoralAssistantResponse,
  type PastoralConversationMessage,
  type PastoralConversationSummary,
  type PastoralLearnerContext,
  type PastoralSharedRequestPayload,
  type PastoralSupportActionView,
  type PastoralSupportMutation,
  type PastoralSupportRecipient,
  type PastoralSupportRequestView,
  type PastoralWorkspace,
} from "@/lib/levytate/pastoral/domain";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getPastoralNavigationAccess } from "@/lib/server/levytate-pastoral-capability";
import {
  decryptPastoralJson,
  digestPastoralPayload,
  authenticatePastoralHistoryCommand,
  encryptPastoralJson,
} from "@/lib/server/levytate-pastoral-crypto";
import {
  getLevyTateSupabaseConfig,
  supabaseFetchJson,
  supabaseSelect,
} from "@/lib/server/levytate-supabase";

const privacyNotice = "Private conversations are available only to you through My Support. They are not visible in normal manager, Apprenticeship Lead, employer, Platform Admin, Copilot, assessment or reporting views. A support request shares only the fields you review and send.";
const emergencyNotice = "My Support is an AI assistant, not a monitored emergency service. If someone is in immediate danger in the UK, call 999 or 112 or go to A&E.";

type PastoralServerContext = Awaited<ReturnType<typeof getLearnerLifecycleServerContext>> & {
  role: ReturnType<typeof normaliseMvpUserRole>;
  employee: EmployeeRow | null;
  recipientRows: RecipientRow[];
  accessMode: "employee" | "support_recipient";
};

type EmployeeRow = { id: string; name: string; email: string; status: string };
type PreferenceRow = { id: string; save_history: boolean; history_retention_days: number; lock_version: number };
type RecipientRow = {
  id: string;
  recipient_kind: PastoralSupportRecipient["kind"];
  employer_user_id: string | null;
  provider_membership_id: string | null;
  display_label: string;
  contact_method: PastoralSupportRecipient["contactMethod"];
  active: boolean;
};
type ConversationRow = {
  id: string;
  employee_id: string;
  owner_user_id: string;
  status: "active" | "closed";
  retention_expires_at: string;
  created_at: string;
  updated_at: string;
  last_sequence_number: number;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  employee_id: string;
  owner_user_id: string;
  sequence_number: number;
  author_type: PastoralConversationMessage["author"];
  ciphertext: string;
  nonce: string;
  authentication_tag: string;
  encryption_key_version: string;
  client_message_id: string;
  created_at: string;
};
type SupportRequestRow = {
  id: string;
  employee_id: string;
  owner_user_id: string;
  recipient_id: string;
  assigned_recipient_id: string;
  topic_category: PastoralSupportRequestView["topicCategory"];
  preferred_contact_method: string;
  urgency_route: PastoralSupportRequestView["urgencyRoute"];
  payload_ciphertext: string;
  payload_nonce: string;
  payload_authentication_tag: string;
  encryption_key_version: string;
  idempotency_key: string;
  status: PastoralSupportRequestView["status"];
  lock_version: number;
  submitted_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  agreed_follow_up_at: string | null;
  administratively_closed_at: string | null;
  employee_resolution_status: PastoralSupportRequestView["employeeResolutionStatus"];
  employee_responded_at: string | null;
  employee_confirmed_resolved_at: string | null;
};
type SupportEventRow = {
  id: string;
  support_request_id: string;
  event_type: PastoralSupportRequestView["events"][number]["eventType"];
  previous_state: string | null;
  new_state: string;
  note_ciphertext: string | null;
  note_nonce: string | null;
  note_authentication_tag: string | null;
  encryption_key_version: string | null;
  idempotency_key: string;
  created_at: string;
};
type SupportActionRow = {
  id: string;
  support_request_id: string;
  responsible_recipient_id: string;
  status: PastoralSupportActionView["status"];
  due_at: string | null;
  payload_ciphertext: string;
  payload_nonce: string;
  payload_authentication_tag: string;
  encryption_key_version: string;
  idempotency_key: string;
  lock_version: number;
  completed_at: string | null;
  created_at: string;
};
type SupportActionEventRow = {
  id: string;
  support_request_id: string;
  support_action_id: string;
  event_type: PastoralSupportActionView["events"][number]["eventType"];
  previous_state: string | null;
  new_state: string;
  note_ciphertext: string | null;
  note_nonce: string | null;
  note_authentication_tag: string | null;
  encryption_key_version: string | null;
  idempotency_key: string;
  created_at: string;
};
type LearnerRow = { id: string; programme_id: string; provider_id: string; lifecycle_status: string; expected_start_date: string | null; actual_start_date: string | null; expected_end_date: string | null };
type ProgrammeRow = { id: string; programme_name: string };
type ProviderRow = { provider_id: string; provider_name: string };
type PlanRow = { id: string; current_published_version_id: string | null };
type PriorityRow = { label: string; target_date: string | null; status: string };

export class LevyTatePastoralError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "LevyTatePastoralError";
  }
}

export async function getPastoralWorkspaceForSession(session: LevyTateBetaSession): Promise<PastoralWorkspace> {
  const context = await authorisedPastoralContext(session);
  if (context.accessMode === "employee") return employeeWorkspace(context);
  return supportRecipientWorkspace(context);
}

export async function applyPastoralMutationForSession(session: LevyTateBetaSession, input: unknown) {
  const mutation = parseMutation(input);
  const context = await authorisedPastoralContext(session);
  if (mutation.action === "set_history_preference") await updateHistoryPreference(context, mutation.saveHistory, mutation.retentionDays, mutation.expectedVersion);
  else if (mutation.action === "delete_conversation") await deleteConversation(context, mutation.conversationId);
  else if (mutation.action === "submit_support_request") await submitSupportRequest(context, mutation);
  else if (mutation.action === "transition_support_request") await transitionSupportRequest(context, mutation);
  else if (mutation.action === "record_follow_up") await recordFollowUp(context, mutation);
  else if (mutation.action === "create_support_action") await createSupportAction(context, mutation);
  else if (mutation.action === "transition_support_action") await transitionSupportAction(context, mutation);
  else await recordEmployeeOutcome(context, mutation);
  return getPastoralWorkspaceForSession(session);
}

export async function getEmployeePastoralAssistantContext(session: LevyTateBetaSession, conversationId?: string | null) {
  const context = await authorisedPastoralContext(session);
  if (context.accessMode !== "employee" || !context.employee) throw new LevyTatePastoralError("Only an eligible employee may use My Support.", 403);
  const [preference, recipients, learnerContext] = await Promise.all([
    getPreference(context),
    listRecipients(context.organisation.id),
    getLearnerContext(context.organisation.id, context.employee.id),
  ]);
  let conversation: ConversationRow | null = null;
  let messages: PastoralConversationMessage[] = [];
  if (conversationId) {
    conversation = await getOwnedConversation(context, conversationId);
    messages = await loadConversationMessages(context, conversation);
  }
  return { context, preference, recipients, learnerContext, conversation, messages };
}

export async function findPersistedAssistantReply(
  context: PastoralServerContext,
  conversationId: string | null | undefined,
  clientMessageId: string,
  employeeMessage: string,
  requestDetails?: unknown,
) {
  assertEmployeeContext(context);
  const result = await historyCommand(context, {
    action: "probe_exchange", client_message_id: validExchangeId(clientMessageId), conversation_id: conversationId ?? null,
    request_hmac: exchangeHmac(context, conversationId, clientMessageId, employeeMessage, requestDetails),
  });
  return result ? savedExchange(context, result) : null;
}

export async function persistPastoralExchange(input: {
  context: PastoralServerContext;
  preference: PreferenceRow | null;
  conversation: ConversationRow | null;
  clientMessageId: string;
  employeeMessage: string;
  requestDetails?: unknown;
  assistantMessage: string;
  assistantResponse?: Omit<PastoralAssistantResponse, "conversationId">;
}) {
  if (!input.preference?.save_history || !input.context.employee) return null;
  const conversationId = input.conversation?.id ?? randomUUID();
  const expectedSequence = input.conversation?.last_sequence_number ?? 0;
  if (!Number.isSafeInteger(expectedSequence) || expectedSequence < 0) throw new LevyTatePastoralError("Reload the saved conversation before continuing.", 409);
  const sequence = expectedSequence + 1;
  const clientMessageId = validExchangeId(input.clientMessageId);
  const employeeCipher = encryptPastoralJson(
    { content: input.employeeMessage },
    messageAssociatedData(input.context.organisation.id, input.context.employee.id, conversationId, sequence, clientMessageId),
  );
  const assistantClientId = `${clientMessageId}:assistant`;
  const assistantCipher = encryptPastoralJson(
    { content: input.assistantMessage, assistantResponse: input.assistantResponse },
    messageAssociatedData(input.context.organisation.id, input.context.employee.id, conversationId, sequence + 1, assistantClientId),
  );
  const result = await historyCommand(input.context, {
    action: "exchange", client_message_id: clientMessageId, conversation_id: input.conversation?.id ?? null,
    new_conversation_id: input.conversation ? null : conversationId, expected_sequence: expectedSequence,
    expected_preference_version: input.preference.lock_version,
    policy_version: pastoralPolicyVersion, messages: [employeeCipher, assistantCipher],
    request_hmac: exchangeHmac(input.context, input.conversation?.id, clientMessageId, input.employeeMessage, input.requestDetails),
  });
  return savedExchange(input.context, result);
}

async function employeeWorkspace(context: PastoralServerContext): Promise<PastoralWorkspace> {
  if (!context.employee) throw new LevyTatePastoralError("Your active employee record could not be found.", 403);
  const [preference, recipients, conversations, requests, learnerContext] = await Promise.all([
    getPreference(context),
    listRecipients(context.organisation.id),
    listOwnedConversations(context),
    listSupportRequests(context),
    getLearnerContext(context.organisation.id, context.employee.id),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    role: context.role,
    capabilityEnabled: true,
    accessMode: "employee",
    employee: {
      id: context.employee.id,
      name: context.employee.name,
      historySavingEnabled: preference?.save_history ?? false,
      historyRetentionDays: preference?.history_retention_days ?? 30,
      historyPreferenceVersion: preference?.lock_version ?? 0,
      learnerContext,
    },
    recipients: recipients.map(recipientView),
    conversations,
    requests,
    privacyNotice,
    emergencyNotice,
  };
}

async function supportRecipientWorkspace(context: PastoralServerContext): Promise<PastoralWorkspace> {
  return {
    generatedAt: new Date().toISOString(),
    role: context.role,
    capabilityEnabled: true,
    accessMode: "support_recipient",
    employee: null,
    recipients: (await listRecipients(context.organisation.id)).map(recipientView),
    conversations: [],
    requests: await listSupportRequests(context),
    privacyNotice,
    emergencyNotice,
  };
}

async function authorisedPastoralContext(session: LevyTateBetaSession): Promise<PastoralServerContext> {
  const base = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(base.user.role);
  const access = await getPastoralNavigationAccess({
    organisationId: base.organisation.id,
    userId: base.user.id,
    email: base.user.email,
    role,
  });
  if (!access.organisationEnabled) throw new LevyTatePastoralError("My Support is not enabled for this workspace.", 404);
  if (role === "Platform Admin") throw new LevyTatePastoralError("Platform Admin cannot access pastoral support content.", 403);
  const employee = role === "Employee" ? await getEmployee(base.organisation.id, base.user.email) : null;
  const recipientRows = role === "Employee" ? [] : await listRecipients(base.organisation.id, base.user.id);
  if (role === "Employee" && (!access.employeeAccess || !employee)) throw new LevyTatePastoralError("My Support is not available for this identity.", 403);
  if (role !== "Employee" && (!access.supportInboxAccess || !recipientRows.length)) throw new LevyTatePastoralError("You are not an active approved support recipient.", 403);
  return { ...base, role, employee, recipientRows, accessMode: role === "Employee" ? "employee" : "support_recipient" };
}

async function getEmployee(organisationId: string, email: string) {
  const rows = await supabaseSelect<EmployeeRow>(requireConfig(), "levytate_employees", new URLSearchParams({
    select: "id,name,email,status",
    organisation_id: `eq.${organisationId}`,
    email: `eq.${email.trim().toLowerCase()}`,
    status: "eq.Active",
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function getPreference(context: PastoralServerContext) {
  if (!context.employee) return null;
  const rows = await supabaseSelect<PreferenceRow>(requireConfig(), "levytate_pastoral_preferences", new URLSearchParams({
    select: "id,save_history,history_retention_days,lock_version",
    organisation_id: `eq.${context.organisation.id}`,
    employee_id: `eq.${context.employee.id}`,
    owner_user_id: `eq.${context.user.id}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function updateHistoryPreference(context: PastoralServerContext, saveHistory: boolean, retentionDays = 30, expectedVersion: number) {
  assertEmployeeContext(context);
  const safeRetention = Math.max(1, Math.min(90, Math.round(Number(retentionDays) || 30)));
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new LevyTatePastoralError("Reload your privacy settings before changing them.", 409);
  const command = { action: "preference", expected_version: expectedVersion, save_history: saveHistory, retention_days: safeRetention };
  const result = await historyCommand(context, { ...command, request_hmac: historyHmac(context, command) });
  if (result?.preferenceVersion !== expectedVersion + 1) throw new LevyTatePastoralError("Your privacy change could not be confirmed. Keep this page and retry.", 503);
}

async function listOwnedConversations(context: PastoralServerContext) {
  assertEmployeeContext(context);
  const rows = await supabaseSelect<ConversationRow>(requireConfig(), "levytate_pastoral_conversations", new URLSearchParams({
    select: conversationSelect,
    organisation_id: `eq.${context.organisation.id}`,
    employee_id: `eq.${context.employee.id}`,
    owner_user_id: `eq.${context.user.id}`,
    retention_expires_at: `gt.${new Date().toISOString()}`,
    order: "updated_at.desc",
    limit: "20",
  }));
  return Promise.all(rows.map(async (row): Promise<PastoralConversationSummary> => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retentionExpiresAt: row.retention_expires_at,
    messages: await loadConversationMessages(context, row),
  })));
}

async function getOwnedConversation(context: PastoralServerContext, conversationId: string, allowExpired=false) {
  assertEmployeeContext(context);
  const rows = await supabaseSelect<ConversationRow>(requireConfig(), "levytate_pastoral_conversations", new URLSearchParams({
    select: conversationSelect,
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${boundedId(conversationId)}`,
    employee_id: `eq.${context.employee.id}`,
    owner_user_id: `eq.${context.user.id}`,
    limit: "1",
  }));
  if (!rows[0] || (!allowExpired && (!Number.isFinite(Date.parse(rows[0].retention_expires_at)) || Date.parse(rows[0].retention_expires_at)<=Date.now()))) throw new LevyTatePastoralError("That saved conversation is unavailable.", 404);
  return rows[0];
}

async function loadConversationMessages(context: PastoralServerContext, conversation: ConversationRow) {
  if (!Number.isFinite(Date.parse(conversation.retention_expires_at)) || Date.parse(conversation.retention_expires_at)<=Date.now()) throw new LevyTatePastoralError("That saved conversation is unavailable.",404);
  const rows = await supabaseSelect<MessageRow>(requireConfig(), "levytate_pastoral_messages", new URLSearchParams({
    select: messageSelect,
    organisation_id: `eq.${context.organisation.id}`,
    conversation_id: `eq.${conversation.id}`,
    owner_user_id: `eq.${context.user.id}`,
    order: "sequence_number.desc",
    limit: "100",
  }));
  return rows.reverse().map((row) => decryptMessage(context, row));
}

function decryptMessage(context: PastoralServerContext, row: MessageRow): PastoralConversationMessage {
  const value = decryptMessageEnvelope(context, row);
  return { id: row.id, author: row.author_type, content: bounded(value.content, 3000), createdAt: row.created_at };
}

function decryptMessageEnvelope(context: PastoralServerContext, row: MessageRow) {
  assertEmployeeContext(context);
  if(row.owner_user_id!==context.user.id || row.employee_id!==context.employee.id) throw new LevyTatePastoralError("That saved conversation is unavailable.",404);
  return decryptPastoralJson<{ content: string; assistantResponse?: Omit<PastoralAssistantResponse, "conversationId"> }>({
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    authenticationTag: row.authentication_tag,
    keyVersion: row.encryption_key_version,
  }, messageAssociatedData(context.organisation.id, row.employee_id, row.conversation_id, row.sequence_number, row.client_message_id));
}

async function deleteConversation(context: PastoralServerContext, conversationId: string) {
  const command = { action: "delete", conversation_id: boundedId(conversationId) };
  const result = await historyCommand(context, { ...command, request_hmac: historyHmac(context, command) });
  if (result?.deleted !== true || result.conversationId !== conversationId) throw new LevyTatePastoralError("Deletion could not be confirmed. Keep this page and retry.", 503);
}

async function listRecipients(organisationId: string, employerUserId?: string, activeOnly = true) {
  const query = new URLSearchParams({
    select: "id,recipient_kind,employer_user_id,provider_membership_id,display_label,contact_method,active",
    organisation_id: `eq.${organisationId}`,
    order: "display_label.asc",
    limit: "100",
  });
  if (activeOnly) query.set("active", "eq.true");
  if (employerUserId) query.set("employer_user_id", `eq.${employerUserId}`);
  return supabaseSelect<RecipientRow>(requireConfig(), "levytate_pastoral_support_recipients", query);
}

function recipientView(row: RecipientRow): PastoralSupportRecipient {
  return { id: row.id, kind: row.recipient_kind, label: row.display_label, contactMethod: row.contact_method };
}

async function submitSupportRequest(context: PastoralServerContext, mutation: Extract<PastoralSupportMutation, { action: "submit_support_request" }>) {
  assertEmployeeContext(context);
  const recipients = await listRecipients(context.organisation.id);
  const recipient = recipients.find((entry) => entry.id === boundedId(mutation.recipientId));
  if (!recipient) throw new LevyTatePastoralError("The selected support contact is no longer available.", 409);
  if (!isPastoralTopicCategory(mutation.topicCategory)) throw new LevyTatePastoralError("Choose a valid support topic.");
  if (!["standard", "prompt_human_support", "emergency_guidance"].includes(mutation.urgencyRoute)) throw new LevyTatePastoralError("Choose a valid support route.");
  const payload: PastoralSharedRequestPayload = {
    topic: boundedRequired(mutation.payload.topic, 180, "Topic"),
    whatIWantYouToUnderstand: boundedRequired(mutation.payload.whatIWantYouToUnderstand, 2500, "What you want the support contact to understand"),
    howItIsAffectingMe: bounded(mutation.payload.howItIsAffectingMe, 1800),
    supportIWant: boundedRequired(mutation.payload.supportIWant, 1800, "Support requested"),
    preferredContactMethod: contactMethod(mutation.payload.preferredContactMethod),
    sharingRestrictions: bounded(mutation.payload.sharingRestrictions, 1000),
    recipient: recipient.display_label,
  };
  if (!recipientIsSafeForPayload(recipient, payload)) {
    throw new LevyTatePastoralError("Choose an independent approved support contact for this concern.", 409);
  }
  const idempotencyKey = validIdempotencyKey(mutation.idempotencyKey);
  const encrypted = encryptPastoralJson(payload, supportRequestAssociatedData(context.organisation.id, context.employee.id, idempotencyKey));
  await rpc<SupportRequestRow>("levytate_submit_pastoral_support_request", {
    p_organisation_id: context.organisation.id,
    p_employee_id: context.employee.id,
    p_owner_user_id: context.user.id,
    p_recipient_id: recipient.id,
    p_topic_category: mutation.topicCategory,
    p_preferred_contact_method: payload.preferredContactMethod,
    p_urgency_route: mutation.urgencyRoute,
    p_shared_field_names: pastoralSharedFieldNames,
    p_payload_ciphertext: encrypted.ciphertext,
    p_payload_nonce: encrypted.nonce,
    p_payload_authentication_tag: encrypted.authenticationTag,
    p_encryption_key_version: encrypted.keyVersion,
    p_payload_digest: digestPastoralPayload(payload),
    p_idempotency_key: idempotencyKey,
  });
}

async function transitionSupportRequest(context: PastoralServerContext, mutation: Extract<PastoralSupportMutation, { action: "transition_support_request" }>) {
  const requestId = boundedId(mutation.requestId);
  const action = mutation.transition;
  const allowed = context.accessMode === "employee" ? ["reopen", "dispute"] : ["acknowledge", "start_support", "request_follow_up", "resolve"];
  if (!allowed.includes(action)) throw new LevyTatePastoralError("That support-request action is not available to your role.", 403);
  if (!Number.isInteger(mutation.expectedLockVersion) || mutation.expectedLockVersion < 0) throw new LevyTatePastoralError("Refresh the request before trying again.", 409);

  if (context.accessMode === "employee") {
    const requests = await supabaseSelect<Pick<SupportRequestRow, "id" | "assigned_recipient_id">>(requireConfig(), "levytate_pastoral_support_requests", new URLSearchParams({
      select: "id,assigned_recipient_id",
      organisation_id: `eq.${context.organisation.id}`,
      owner_user_id: `eq.${context.user.id}`,
      id: `eq.${requestId}`,
      limit: "1",
    }));
    const request = requests[0];
    if (!request) throw new LevyTatePastoralError("That support request is unavailable.", 404);
    const activeRecipients = await listRecipients(context.organisation.id);
    if (!activeRecipients.some((recipient) => recipient.id === request.assigned_recipient_id)) {
      throw new LevyTatePastoralError("The assigned support contact is no longer available. Please use a new support request to choose a safe contact.", 409);
    }
  }

  const idempotencyKey = validIdempotencyKey(mutation.idempotencyKey);
  const note = bounded(mutation.note, 2000);
  const encrypted = note ? encryptPastoralJson({ content: note }, supportEventAssociatedData(context.organisation.id, requestId, idempotencyKey)) : null;
  await rpc<SupportRequestRow>("levytate_transition_pastoral_support_request", {
    p_organisation_id: context.organisation.id,
    p_support_request_id: requestId,
    p_actor_user_id: context.user.id,
    p_actor_provider_membership_id: null,
    p_action: action,
    p_expected_lock_version: mutation.expectedLockVersion,
    p_idempotency_key: idempotencyKey,
    p_new_recipient_id: null,
    p_note_ciphertext: encrypted?.ciphertext ?? null,
    p_note_nonce: encrypted?.nonce ?? null,
    p_note_authentication_tag: encrypted?.authenticationTag ?? null,
    p_encryption_key_version: encrypted?.keyVersion ?? null,
  });
}

async function recordFollowUp(context: PastoralServerContext, mutation: Extract<PastoralSupportMutation, { action: "record_follow_up" }>) {
  if (context.accessMode !== "support_recipient") throw new LevyTatePastoralError("Only the assigned support contact may agree follow-up.", 403);
  const requestId = boundedId(mutation.requestId);
  const idempotencyKey = validIdempotencyKey(mutation.idempotencyKey);
  const agreedFollowUpAt = validDate(mutation.agreedFollowUpAt, "Choose an agreed follow-up date.");
  const note = bounded(mutation.note, 2000);
  const encrypted = note ? encryptPastoralJson({ content: note }, supportEventAssociatedData(context.organisation.id, requestId, idempotencyKey)) : null;
  await rpc<SupportRequestRow>("levytate_record_pastoral_follow_up", {
    p_organisation_id: context.organisation.id,
    p_support_request_id: requestId,
    p_actor_user_id: context.user.id,
    p_actor_provider_membership_id: null,
    p_expected_lock_version: mutation.expectedLockVersion,
    p_agreed_follow_up_at: agreedFollowUpAt,
    p_idempotency_key: idempotencyKey,
    p_note_ciphertext: encrypted?.ciphertext ?? null,
    p_note_nonce: encrypted?.nonce ?? null,
    p_note_authentication_tag: encrypted?.authenticationTag ?? null,
    p_encryption_key_version: encrypted?.keyVersion ?? null,
  });
}

async function createSupportAction(context: PastoralServerContext, mutation: Extract<PastoralSupportMutation, { action: "create_support_action" }>) {
  if (context.accessMode !== "support_recipient") throw new LevyTatePastoralError("Only the assigned support contact may agree an action.", 403);
  const requestId = boundedId(mutation.requestId);
  const responsibleRecipientId = boundedId(mutation.responsibleRecipientId);
  const idempotencyKey = validIdempotencyKey(mutation.idempotencyKey);
  const payload = { summary: boundedRequired(mutation.summary, 1800, "Agreed action") };
  const encrypted = encryptPastoralJson(payload, supportActionAssociatedData(context.organisation.id, requestId, idempotencyKey));
  await rpc<SupportActionRow>("levytate_create_pastoral_support_action", {
    p_organisation_id: context.organisation.id,
    p_support_request_id: requestId,
    p_responsible_recipient_id: responsibleRecipientId,
    p_actor_user_id: context.user.id,
    p_actor_provider_membership_id: null,
    p_due_at: mutation.dueAt ? validDate(mutation.dueAt, "Choose a valid action due date.") : null,
    p_payload_ciphertext: encrypted.ciphertext,
    p_payload_nonce: encrypted.nonce,
    p_payload_authentication_tag: encrypted.authenticationTag,
    p_encryption_key_version: encrypted.keyVersion,
    p_payload_digest: digestPastoralPayload(payload),
    p_idempotency_key: idempotencyKey,
  });
}

async function transitionSupportAction(context: PastoralServerContext, mutation: Extract<PastoralSupportMutation, { action: "transition_support_action" }>) {
  if (context.accessMode !== "support_recipient") throw new LevyTatePastoralError("Only an authorised support contact may update an action.", 403);
  const actionId = boundedId(mutation.supportActionId);
  const idempotencyKey = validIdempotencyKey(mutation.idempotencyKey);
  if (!Number.isInteger(mutation.expectedLockVersion) || mutation.expectedLockVersion < 0) throw new LevyTatePastoralError("Refresh the action before trying again.", 409);
  if (!["start", "progress", "complete", "cancel", "reassign"].includes(mutation.transition)) throw new LevyTatePastoralError("That support-action update is not available.");
  const note = bounded(mutation.note, 2000);
  const encrypted = note ? encryptPastoralJson({ content: note }, supportActionEventAssociatedData(context.organisation.id, actionId, idempotencyKey)) : null;
  await rpc<SupportActionRow>("levytate_transition_pastoral_support_action", {
    p_organisation_id: context.organisation.id,
    p_support_action_id: actionId,
    p_actor_user_id: context.user.id,
    p_actor_provider_membership_id: null,
    p_action: mutation.transition,
    p_expected_lock_version: mutation.expectedLockVersion,
    p_idempotency_key: idempotencyKey,
    p_new_responsible_recipient_id: mutation.newResponsibleRecipientId ? boundedId(mutation.newResponsibleRecipientId) : null,
    p_note_ciphertext: encrypted?.ciphertext ?? null,
    p_note_nonce: encrypted?.nonce ?? null,
    p_note_authentication_tag: encrypted?.authenticationTag ?? null,
    p_encryption_key_version: encrypted?.keyVersion ?? null,
  });
}

async function recordEmployeeOutcome(context: PastoralServerContext, mutation: Extract<PastoralSupportMutation, { action: "record_employee_outcome" }>) {
  assertEmployeeContext(context);
  const requestId = boundedId(mutation.requestId);
  const idempotencyKey = validIdempotencyKey(mutation.idempotencyKey);
  if (!["helped", "further_support_requested"].includes(mutation.outcome)) throw new LevyTatePastoralError("Choose whether the support helped or whether you need more support.");
  const note = bounded(mutation.note, 2000);
  const encrypted = note ? encryptPastoralJson({ content: note }, supportEventAssociatedData(context.organisation.id, requestId, idempotencyKey)) : null;
  await rpc<SupportRequestRow>("levytate_record_pastoral_employee_outcome", {
    p_organisation_id: context.organisation.id,
    p_support_request_id: requestId,
    p_owner_user_id: context.user.id,
    p_outcome: mutation.outcome,
    p_expected_lock_version: mutation.expectedLockVersion,
    p_idempotency_key: idempotencyKey,
    p_note_ciphertext: encrypted?.ciphertext ?? null,
    p_note_nonce: encrypted?.nonce ?? null,
    p_note_authentication_tag: encrypted?.authenticationTag ?? null,
    p_encryption_key_version: encrypted?.keyVersion ?? null,
  });
}

async function listSupportRequests(context: PastoralServerContext) {
  const query = new URLSearchParams({
    select: supportRequestSelect,
    organisation_id: `eq.${context.organisation.id}`,
    order: "submitted_at.desc",
    limit: "100",
  });
  if (context.accessMode === "employee") query.set("owner_user_id", `eq.${context.user.id}`);
  else query.set("assigned_recipient_id", `in.(${context.recipientRows.map((row) => row.id).join(",")})`);
  const rows = await supabaseSelect<SupportRequestRow>(requireConfig(), "levytate_pastoral_support_requests", query);
  if (!rows.length) return [];
  const recipients = await listRecipients(context.organisation.id, undefined, false);
  const recipientById = new Map(recipients.map((entry) => [entry.id, entry]));
  const employeeIds = [...new Set(rows.map((row) => row.employee_id))];
  const employees = await supabaseSelect<EmployeeRow>(requireConfig(), "levytate_employees", new URLSearchParams({
    select: "id,name,email,status",
    organisation_id: `eq.${context.organisation.id}`,
    id: `in.(${employeeIds.join(",")})`,
    limit: "100",
  }));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const [events, actions] = await Promise.all([
    supabaseSelect<SupportEventRow>(requireConfig(), "levytate_pastoral_support_request_events", new URLSearchParams({
    select: eventSelect,
    organisation_id: `eq.${context.organisation.id}`,
    support_request_id: `in.(${rows.map((row) => row.id).join(",")})`,
    order: "created_at.asc",
    limit: "1000",
    })),
    supabaseSelect<SupportActionRow>(requireConfig(), "levytate_pastoral_support_actions", new URLSearchParams({
      select: supportActionSelect,
      organisation_id: `eq.${context.organisation.id}`,
      support_request_id: `in.(${rows.map((row) => row.id).join(",")})`,
      order: "created_at.asc",
      limit: "1000",
    })),
  ]);
  const actionEvents = actions.length ? await supabaseSelect<SupportActionEventRow>(requireConfig(), "levytate_pastoral_support_action_events", new URLSearchParams({
    select: supportActionEventSelect,
    organisation_id: `eq.${context.organisation.id}`,
    support_action_id: `in.(${actions.map((action) => action.id).join(",")})`,
    order: "created_at.asc",
    limit: "2000",
  })) : [];
  return rows.map((row): PastoralSupportRequestView => {
    const payload = decryptPastoralJson<PastoralSharedRequestPayload>({
      ciphertext: row.payload_ciphertext,
      nonce: row.payload_nonce,
      authenticationTag: row.payload_authentication_tag,
      keyVersion: row.encryption_key_version,
    }, supportRequestAssociatedData(context.organisation.id, row.employee_id, row.idempotency_key));
    return {
      id: row.id,
      employeeLabel: employeeById.get(row.employee_id)?.name ?? "Employee",
      recipientId: row.assigned_recipient_id,
      recipientLabel: recipientById.get(row.assigned_recipient_id)?.display_label ?? "Approved support contact",
      topicCategory: row.topic_category,
      urgencyRoute: row.urgency_route,
      status: row.status,
      lockVersion: row.lock_version,
      submittedAt: row.submitted_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      agreedFollowUpAt: row.agreed_follow_up_at,
      administrativelyClosedAt: row.administratively_closed_at,
      employeeResolutionStatus: row.employee_resolution_status,
      employeeRespondedAt: row.employee_responded_at,
      employeeConfirmedResolvedAt: row.employee_confirmed_resolved_at,
      payload,
      events: events.filter((event) => event.support_request_id === row.id).map((event) => ({
        id: event.id,
        eventType: event.event_type,
        previousState: event.previous_state,
        newState: event.new_state,
        note: decryptEventNote(context.organisation.id, row.id, event),
        createdAt: event.created_at,
      })),
      actions: actions.filter((action) => action.support_request_id === row.id).map((action) => {
        const payload = decryptPastoralJson<{ summary: string }>({
          ciphertext: action.payload_ciphertext,
          nonce: action.payload_nonce,
          authenticationTag: action.payload_authentication_tag,
          keyVersion: action.encryption_key_version,
        }, supportActionAssociatedData(context.organisation.id, row.id, action.idempotency_key));
        return {
          id: action.id,
          responsibleRecipientId: action.responsible_recipient_id,
          responsibleRecipientLabel: recipientById.get(action.responsible_recipient_id)?.display_label ?? "Inactive support contact",
          status: action.status,
          dueAt: action.due_at,
          summary: bounded(payload.summary, 1800),
          lockVersion: action.lock_version,
          completedAt: action.completed_at,
          events: actionEvents.filter((event) => event.support_action_id === action.id).map((event) => ({
            id: event.id,
            eventType: event.event_type,
            previousState: event.previous_state,
            newState: event.new_state,
            note: decryptActionEventNote(context.organisation.id, action.id, event),
            createdAt: event.created_at,
          })),
        };
      }),
    };
  });
}

function decryptActionEventNote(organisationId: string, actionId: string, row: SupportActionEventRow) {
  if (!row.note_ciphertext || !row.note_nonce || !row.note_authentication_tag || !row.encryption_key_version) return "";
  const value = decryptPastoralJson<{ content: string }>({
    ciphertext: row.note_ciphertext,
    nonce: row.note_nonce,
    authenticationTag: row.note_authentication_tag,
    keyVersion: row.encryption_key_version,
  }, supportActionEventAssociatedData(organisationId, actionId, row.idempotency_key));
  return bounded(value.content, 2000);
}

function decryptEventNote(organisationId: string, requestId: string, row: SupportEventRow) {
  if (!row.note_ciphertext || !row.note_nonce || !row.note_authentication_tag || !row.encryption_key_version) return "";
  const value = decryptPastoralJson<{ content: string }>({
    ciphertext: row.note_ciphertext,
    nonce: row.note_nonce,
    authenticationTag: row.note_authentication_tag,
    keyVersion: row.encryption_key_version,
  }, supportEventAssociatedData(organisationId, requestId, row.idempotency_key));
  return bounded(value.content, 2000);
}

async function getLearnerContext(organisationId: string, employeeId: string): Promise<PastoralLearnerContext | null> {
  const config = requireConfig();
  const learners = await supabaseSelect<LearnerRow>(config, "levytate_learner_records", new URLSearchParams({
    select: "id,programme_id,provider_id,lifecycle_status,expected_start_date,actual_start_date,expected_end_date",
    organisation_id: `eq.${organisationId}`,
    employee_id: `eq.${employeeId}`,
    record_status: "eq.Active",
    order: "updated_at.desc",
    limit: "1",
  }));
  const learner = learners[0];
  if (!learner) return null;
  const [programmes, providers, plans] = await Promise.all([
    learner.programme_id ? supabaseSelect<ProgrammeRow>(config, "levytate_provider_programmes", new URLSearchParams({ select: "id,programme_name", organisation_id: `eq.${organisationId}`, id: `eq.${learner.programme_id}`, limit: "1" })) : [],
    learner.provider_id ? supabaseSelect<ProviderRow>(config, "levytate_providers", new URLSearchParams({ select: "provider_id,provider_name", organisation_id: `eq.${organisationId}`, provider_id: `eq.${learner.provider_id}`, limit: "1" })) : [],
    supabaseSelect<PlanRow>(config, "levytate_otj_plans", new URLSearchParams({ select: "id,current_published_version_id", organisation_id: `eq.${organisationId}`, learner_record_id: `eq.${learner.id}`, status: "eq.published", limit: "1" })),
  ]);
  const planVersionId = plans[0]?.current_published_version_id;
  const priorities = planVersionId ? await supabaseSelect<PriorityRow>(config, "levytate_otj_learning_priorities", new URLSearchParams({
    select: "label,target_date,status",
    organisation_id: `eq.${organisationId}`,
    learner_record_id: `eq.${learner.id}`,
    plan_version_id: `eq.${planVersionId}`,
    status: "eq.active",
    order: "target_date.asc.nullslast",
    limit: "5",
  })) : [];
  return {
    programmeName: programmes[0]?.programme_name ?? "Programme not confirmed",
    lifecycleStage: learner.lifecycle_status,
    providerName: providers[0]?.provider_name ?? "Provider not confirmed",
    importantDates: [
      learner.actual_start_date ? { label: "Started", date: learner.actual_start_date } : learner.expected_start_date ? { label: "Expected start", date: learner.expected_start_date } : null,
      learner.expected_end_date ? { label: "Expected completion", date: learner.expected_end_date } : null,
    ].filter((item): item is { label: string; date: string } => Boolean(item)),
    learningPriorities: priorities.map((priority) => ({ label: priority.label, targetDate: priority.target_date })),
  };
}

function parseMutation(value: unknown): PastoralSupportMutation {
  if (!value || typeof value !== "object") throw new LevyTatePastoralError("A valid My Support action is required.");
  const mutation = value as Record<string, unknown>;
  if (mutation.action === "set_history_preference") {
    if (Object.keys(mutation).some((key) => !["action", "saveHistory", "retentionDays", "expectedVersion"].includes(key)) || typeof mutation.saveHistory !== "boolean" || !Number.isSafeInteger(mutation.expectedVersion) || Number(mutation.expectedVersion) < 0) throw new LevyTatePastoralError("Reload your privacy settings before changing them.", 409);
    if (mutation.retentionDays !== undefined && (typeof mutation.retentionDays !== "number" || !Number.isInteger(mutation.retentionDays) || mutation.retentionDays < 1 || mutation.retentionDays > 90)) throw new LevyTatePastoralError("Choose a retention period between 1 and 90 days.", 422);
    return { action: mutation.action, saveHistory: mutation.saveHistory, retentionDays: numberOrUndefined(mutation.retentionDays), expectedVersion: Number(mutation.expectedVersion) };
  }
  if (mutation.action === "delete_conversation") {
    if (Object.keys(mutation).some((key) => !["action", "conversationId"].includes(key)) || typeof mutation.conversationId !== "string") throw new LevyTatePastoralError("A valid conversation deletion is required.");
    return { action: mutation.action, conversationId: mutation.conversationId };
  }
  if (mutation.action === "submit_support_request") return {
    action: mutation.action,
    recipientId: String(mutation.recipientId ?? ""),
    topicCategory: mutation.topicCategory as never,
    urgencyRoute: mutation.urgencyRoute as never,
    idempotencyKey: String(mutation.idempotencyKey ?? ""),
    payload: (mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {}) as never,
  };
  if (mutation.action === "transition_support_request") return {
    action: mutation.action,
    requestId: String(mutation.requestId ?? ""),
    transition: mutation.transition as never,
    expectedLockVersion: Number(mutation.expectedLockVersion),
    idempotencyKey: String(mutation.idempotencyKey ?? ""),
    note: typeof mutation.note === "string" ? mutation.note : undefined,
  };
  if (mutation.action === "record_follow_up") return {
    action: mutation.action,
    requestId: String(mutation.requestId ?? ""),
    expectedLockVersion: Number(mutation.expectedLockVersion),
    agreedFollowUpAt: String(mutation.agreedFollowUpAt ?? ""),
    idempotencyKey: String(mutation.idempotencyKey ?? ""),
    note: typeof mutation.note === "string" ? mutation.note : undefined,
  };
  if (mutation.action === "create_support_action") return {
    action: mutation.action,
    requestId: String(mutation.requestId ?? ""),
    responsibleRecipientId: String(mutation.responsibleRecipientId ?? ""),
    dueAt: mutation.dueAt == null ? null : String(mutation.dueAt),
    summary: String(mutation.summary ?? ""),
    idempotencyKey: String(mutation.idempotencyKey ?? ""),
  };
  if (mutation.action === "transition_support_action") return {
    action: mutation.action,
    supportActionId: String(mutation.supportActionId ?? ""),
    transition: mutation.transition as never,
    expectedLockVersion: Number(mutation.expectedLockVersion),
    idempotencyKey: String(mutation.idempotencyKey ?? ""),
    newResponsibleRecipientId: typeof mutation.newResponsibleRecipientId === "string" ? mutation.newResponsibleRecipientId : undefined,
    note: typeof mutation.note === "string" ? mutation.note : undefined,
  };
  if (mutation.action === "record_employee_outcome") return {
    action: mutation.action,
    requestId: String(mutation.requestId ?? ""),
    outcome: mutation.outcome as never,
    expectedLockVersion: Number(mutation.expectedLockVersion),
    idempotencyKey: String(mutation.idempotencyKey ?? ""),
    note: typeof mutation.note === "string" ? mutation.note : undefined,
  };
  throw new LevyTatePastoralError("That My Support action is not recognised.");
}

function historyHmac(context: PastoralServerContext, command: unknown) {
  assertEmployeeContext(context);
  return authenticatePastoralHistoryCommand({ organisationId: context.organisation.id, employeeId: context.employee.id, ownerUserId: context.user.id, command });
}

function exchangeHmac(context: PastoralServerContext, conversationId: string | null | undefined, clientMessageId: string, message: string, requestDetails?: unknown) {
  return historyHmac(context, { action: "exchange", conversationId: conversationId ?? null, clientMessageId, message, requestDetails: requestDetails ?? null });
}

type HistoryResult = { conversationId?: string; preferenceVersion?: number; deleted?: boolean; replayed: boolean; message?: MessageRow };
async function historyCommand(context: PastoralServerContext, command: Record<string, unknown>) {
  assertEmployeeContext(context);
  try {
    return await supabaseFetchJson<HistoryResult | null>(requireConfig(), "rpc/levytate_pastoral_history_command", { method: "POST", body: JSON.stringify({
      p_organisation_id: context.organisation.id, p_owner_user_id: context.user.id, p_employee_id: context.employee.id, p_command: command,
    }) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^(PT403|42501)/.test(code)) throw new LevyTatePastoralError("My Support is no longer available for this identity.", 403);
    if (code.startsWith("PT404")) throw new LevyTatePastoralError("That saved conversation is unavailable.", 404);
    if (/^(PT409|23505|40001|40P01)/.test(code)) throw new LevyTatePastoralError("Your private history changed. Keep your message and reload before continuing.", 409);
    if (/^(PT422|23514|23503|22)/.test(code)) throw new LevyTatePastoralError("The private history command could not be validated. No partial exchange was saved.", 422);
    throw new LevyTatePastoralError("The private history save could not be confirmed. Keep your message and retry.", 503);
  }
}

function savedExchange(context: PastoralServerContext, result: HistoryResult | null) {
  if (!result?.message || result.message.conversation_id !== result.conversationId || result.message.author_type !== "assistant") throw new LevyTatePastoralError("The saved reply could not be confirmed. Keep your message and retry.", 503);
  const envelope = decryptMessageEnvelope(context, result.message);
  return { message: decryptMessage(context, result.message), response: envelope.assistantResponse ?? null, conversationId: result.message.conversation_id };
}

function assertEmployeeContext(context: PastoralServerContext): asserts context is PastoralServerContext & { employee: EmployeeRow } {
  if (context.accessMode !== "employee" || !context.employee) throw new LevyTatePastoralError("Only an eligible employee may perform this action.", 403);
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTatePastoralError("My Support storage is unavailable.", 503);
  return config;
}

async function rpc<T>(name: string, body: Record<string, unknown>) {
  const rows = await supabaseFetchJson<T[]>(requireConfig(), `rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  return rows[0] ?? null;
}

function messageAssociatedData(organisationId: string, employeeId: string, conversationId: string, sequence: number, clientMessageId: string) { return `${organisationId}:${employeeId}:message:${conversationId}:${sequence}:${clientMessageId}`; }
function supportRequestAssociatedData(organisationId: string, employeeId: string, idempotencyKey: string) { return `${organisationId}:${employeeId}:support-request:${idempotencyKey}`; }
function supportEventAssociatedData(organisationId: string, requestId: string, idempotencyKey: string) { return `${organisationId}:${requestId}:event:${idempotencyKey}`; }
function supportActionAssociatedData(organisationId: string, requestId: string, idempotencyKey: string) { return `${organisationId}:${requestId}:support-action:${idempotencyKey}`; }
function supportActionEventAssociatedData(organisationId: string, actionId: string, idempotencyKey: string) { return `${organisationId}:${actionId}:action-event:${idempotencyKey}`; }
function bounded(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }
function boundedRequired(value: unknown, max: number, label: string) { const clean = bounded(value, max); if (!clean) throw new LevyTatePastoralError(`${label} is required.`); return clean; }
function boundedId(value: string) { const clean = String(value ?? "").trim(); if (!/^[0-9a-f-]{36}$/i.test(clean)) throw new LevyTatePastoralError("A valid record identifier is required."); return clean; }
function validIdempotencyKey(value: string) { const clean = String(value ?? "").trim(); if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(clean)) throw new LevyTatePastoralError("A valid idempotency key is required."); return clean; }
function validExchangeId(value: string) { const clean = String(value ?? "").trim(); if (!/^[a-zA-Z0-9:_-]{8,118}$/.test(clean)) throw new LevyTatePastoralError("A valid exchange identifier is required."); return clean; }
function numberOrUndefined(value: unknown) { return value === undefined ? undefined : Number(value); }
function contactMethod(value: unknown): PastoralSharedRequestPayload["preferredContactMethod"] { if (!["in_platform", "email", "phone", "meeting", "provider_route"].includes(String(value))) throw new LevyTatePastoralError("Choose a valid preferred contact method."); return value as PastoralSharedRequestPayload["preferredContactMethod"]; }
function validDate(value: unknown, message: string) { const date = new Date(String(value ?? "")); if (Number.isNaN(date.getTime())) throw new LevyTatePastoralError(message); return date.toISOString(); }
function recipientIsSafeForPayload(recipient: RecipientRow, payload: PastoralSharedRequestPayload) {
  const combined = `${payload.topic} ${payload.whatIWantYouToUnderstand} ${payload.howItIsAffectingMe} ${payload.supportIWant} ${payload.sharingRestrictions}`;
  return pastoralRecipientIsSafeForConcern(recipientView(recipient), combined);
}

const conversationSelect = "id,employee_id,owner_user_id,status,retention_expires_at,created_at,updated_at,last_sequence_number";
const messageSelect = "id,conversation_id,employee_id,owner_user_id,sequence_number,author_type,ciphertext,nonce,authentication_tag,encryption_key_version,client_message_id,created_at";
const supportRequestSelect = "id,employee_id,owner_user_id,recipient_id,assigned_recipient_id,topic_category,preferred_contact_method,urgency_route,payload_ciphertext,payload_nonce,payload_authentication_tag,encryption_key_version,idempotency_key,status,lock_version,submitted_at,acknowledged_at,resolved_at,agreed_follow_up_at,administratively_closed_at,employee_resolution_status,employee_responded_at,employee_confirmed_resolved_at";
const eventSelect = "id,support_request_id,event_type,previous_state,new_state,note_ciphertext,note_nonce,note_authentication_tag,encryption_key_version,idempotency_key,created_at";
const supportActionSelect = "id,support_request_id,responsible_recipient_id,status,due_at,payload_ciphertext,payload_nonce,payload_authentication_tag,encryption_key_version,idempotency_key,lock_version,completed_at,created_at";
const supportActionEventSelect = "id,support_request_id,support_action_id,event_type,previous_state,new_state,note_ciphertext,note_nonce,note_authentication_tag,encryption_key_version,idempotency_key,created_at";
