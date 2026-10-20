import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  isPastoralTopicCategory,
  pastoralPolicyVersion,
  pastoralSharedFieldNames,
  type PastoralConversationMessage,
  type PastoralConversationSummary,
  type PastoralLearnerContext,
  type PastoralSharedRequestPayload,
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
  encryptPastoralJson,
  type PastoralCiphertext,
} from "@/lib/server/levytate-pastoral-crypto";
import {
  getLevyTateSupabaseConfig,
  supabaseDelete,
  supabaseFetchJson,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
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
type PreferenceRow = { id: string; save_history: boolean; history_retention_days: number };
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
  if (mutation.action === "set_history_preference") await updateHistoryPreference(context, mutation.saveHistory, mutation.retentionDays);
  else if (mutation.action === "delete_conversation") await deleteConversation(context, mutation.conversationId);
  else if (mutation.action === "submit_support_request") await submitSupportRequest(context, mutation);
  else await transitionSupportRequest(context, mutation);
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
  conversationId: string,
  clientMessageId: string,
) {
  const conversation = await getOwnedConversation(context, conversationId);
  const rows = await supabaseSelect<MessageRow>(requireConfig(), "levytate_pastoral_messages", new URLSearchParams({
    select: messageSelect,
    organisation_id: `eq.${context.organisation.id}`,
    conversation_id: `eq.${conversation.id}`,
    client_message_id: `eq.${clientMessageId}:assistant`,
    limit: "1",
  }));
  const row = rows[0];
  return row ? decryptMessage(context, row) : null;
}

export async function persistPastoralExchange(input: {
  context: PastoralServerContext;
  preference: PreferenceRow | null;
  conversation: ConversationRow | null;
  clientMessageId: string;
  employeeMessage: string;
  assistantMessage: string;
}) {
  if (!input.preference?.save_history || !input.context.employee) return null;
  const config = requireConfig();
  const conversation = input.conversation ?? await createConversation(input.context, input.preference.history_retention_days);
  const existing = await supabaseSelect<MessageRow>(config, "levytate_pastoral_messages", new URLSearchParams({
    select: messageSelect,
    organisation_id: `eq.${input.context.organisation.id}`,
    conversation_id: `eq.${conversation.id}`,
    client_message_id: `eq.${input.clientMessageId}`,
    limit: "1",
  }));
  if (existing.length) return conversation.id;
  const sequenceRows = await supabaseSelect<Pick<MessageRow, "sequence_number">>(config, "levytate_pastoral_messages", new URLSearchParams({
    select: "sequence_number",
    organisation_id: `eq.${input.context.organisation.id}`,
    conversation_id: `eq.${conversation.id}`,
    order: "sequence_number.desc",
    limit: "1",
  }));
  const sequence = (sequenceRows[0]?.sequence_number ?? 0) + 1;
  const employeeCipher = encryptPastoralJson(
    { content: input.employeeMessage },
    messageAssociatedData(input.context.organisation.id, input.context.employee.id, conversation.id, sequence, input.clientMessageId),
  );
  const assistantClientId = `${input.clientMessageId}:assistant`;
  const assistantCipher = encryptPastoralJson(
    { content: input.assistantMessage },
    messageAssociatedData(input.context.organisation.id, input.context.employee.id, conversation.id, sequence + 1, assistantClientId),
  );
  await supabaseInsert(config, "levytate_pastoral_messages", [
    messageInsert(input.context, conversation.id, sequence, "employee", input.clientMessageId, employeeCipher),
    messageInsert(input.context, conversation.id, sequence + 1, "assistant", assistantClientId, assistantCipher),
  ]);
  await supabaseUpdate(config, "levytate_pastoral_conversations", new URLSearchParams({
    organisation_id: `eq.${input.context.organisation.id}`,
    id: `eq.${conversation.id}`,
    owner_user_id: `eq.${input.context.user.id}`,
  }).toString(), { last_message_at: new Date().toISOString() });
  return conversation.id;
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
    recipients: context.recipientRows.map(recipientView),
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
    select: "id,save_history,history_retention_days",
    organisation_id: `eq.${context.organisation.id}`,
    employee_id: `eq.${context.employee.id}`,
    owner_user_id: `eq.${context.user.id}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function updateHistoryPreference(context: PastoralServerContext, saveHistory: boolean, retentionDays = 30) {
  assertEmployeeContext(context);
  const safeRetention = Math.max(1, Math.min(90, Math.round(Number(retentionDays) || 30)));
  const existing = await getPreference(context);
  const row = { save_history: saveHistory, history_retention_days: safeRetention };
  let preferenceId = existing?.id;
  if (existing) {
    await supabaseUpdate(requireConfig(), "levytate_pastoral_preferences", new URLSearchParams({
      organisation_id: `eq.${context.organisation.id}`,
      id: `eq.${existing.id}`,
      owner_user_id: `eq.${context.user.id}`,
    }).toString(), row);
  } else {
    preferenceId = randomUUID();
    await supabaseInsert(requireConfig(), "levytate_pastoral_preferences", [{
      id: preferenceId,
      organisation_id: context.organisation.id,
      employee_id: context.employee.id,
      owner_user_id: context.user.id,
      ...row,
    }]);
  }
  await audit(context, "preference", preferenceId!, saveHistory ? "history_saving.enabled" : "history_saving.disabled", "completed");
}

async function createConversation(context: PastoralServerContext, retentionDays: number) {
  assertEmployeeContext(context);
  const id = randomUUID();
  const retentionExpiresAt = new Date(Date.now() + Math.max(1, Math.min(90, retentionDays)) * 86_400_000).toISOString();
  const [row] = await supabaseInsert<ConversationRow>(requireConfig(), "levytate_pastoral_conversations", [{
    id,
    organisation_id: context.organisation.id,
    employee_id: context.employee.id,
    owner_user_id: context.user.id,
    policy_version: pastoralPolicyVersion,
    history_saving_enabled: true,
    status: "active",
    retention_expires_at: retentionExpiresAt,
  }]);
  await audit(context, "conversation", id, "conversation.created", "completed");
  return row;
}

async function listOwnedConversations(context: PastoralServerContext) {
  assertEmployeeContext(context);
  const rows = await supabaseSelect<ConversationRow>(requireConfig(), "levytate_pastoral_conversations", new URLSearchParams({
    select: conversationSelect,
    organisation_id: `eq.${context.organisation.id}`,
    employee_id: `eq.${context.employee.id}`,
    owner_user_id: `eq.${context.user.id}`,
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

async function getOwnedConversation(context: PastoralServerContext, conversationId: string) {
  assertEmployeeContext(context);
  const rows = await supabaseSelect<ConversationRow>(requireConfig(), "levytate_pastoral_conversations", new URLSearchParams({
    select: conversationSelect,
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${boundedId(conversationId)}`,
    employee_id: `eq.${context.employee.id}`,
    owner_user_id: `eq.${context.user.id}`,
    limit: "1",
  }));
  if (!rows[0]) throw new LevyTatePastoralError("That saved conversation is unavailable.", 404);
  return rows[0];
}

async function loadConversationMessages(context: PastoralServerContext, conversation: ConversationRow) {
  const rows = await supabaseSelect<MessageRow>(requireConfig(), "levytate_pastoral_messages", new URLSearchParams({
    select: messageSelect,
    organisation_id: `eq.${context.organisation.id}`,
    conversation_id: `eq.${conversation.id}`,
    owner_user_id: `eq.${context.user.id}`,
    order: "sequence_number.asc",
    limit: "100",
  }));
  return rows.map((row) => decryptMessage(context, row));
}

function decryptMessage(context: PastoralServerContext, row: MessageRow): PastoralConversationMessage {
  const value = decryptPastoralJson<{ content: string }>({
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    authenticationTag: row.authentication_tag,
    keyVersion: row.encryption_key_version,
  }, messageAssociatedData(context.organisation.id, row.employee_id, row.conversation_id, row.sequence_number, row.client_message_id));
  return { id: row.id, author: row.author_type, content: bounded(value.content, 3000), createdAt: row.created_at };
}

async function deleteConversation(context: PastoralServerContext, conversationId: string) {
  const conversation = await getOwnedConversation(context, conversationId);
  await supabaseDelete(requireConfig(), "levytate_pastoral_conversations", new URLSearchParams({
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${conversation.id}`,
    owner_user_id: `eq.${context.user.id}`,
  }).toString());
  await audit(context, "conversation", conversation.id, "conversation.deleted", "completed");
}

async function listRecipients(organisationId: string, employerUserId?: string) {
  const query = new URLSearchParams({
    select: "id,recipient_kind,employer_user_id,provider_membership_id,display_label,contact_method,active",
    organisation_id: `eq.${organisationId}`,
    active: "eq.true",
    order: "display_label.asc",
    limit: "100",
  });
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
  const recipients = await listRecipients(context.organisation.id);
  const recipientById = new Map(recipients.map((entry) => [entry.id, entry]));
  const employeeIds = [...new Set(rows.map((row) => row.employee_id))];
  const employees = await supabaseSelect<EmployeeRow>(requireConfig(), "levytate_employees", new URLSearchParams({
    select: "id,name,email,status",
    organisation_id: `eq.${context.organisation.id}`,
    id: `in.(${employeeIds.join(",")})`,
    limit: "100",
  }));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const events = await supabaseSelect<SupportEventRow>(requireConfig(), "levytate_pastoral_support_request_events", new URLSearchParams({
    select: eventSelect,
    organisation_id: `eq.${context.organisation.id}`,
    support_request_id: `in.(${rows.map((row) => row.id).join(",")})`,
    order: "created_at.asc",
    limit: "1000",
  }));
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
      payload,
      events: events.filter((event) => event.support_request_id === row.id).map((event) => ({
        id: event.id,
        eventType: event.event_type,
        previousState: event.previous_state,
        newState: event.new_state,
        note: decryptEventNote(context.organisation.id, row.id, event),
        createdAt: event.created_at,
      })),
    };
  });
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
  if (mutation.action === "set_history_preference") return { action: mutation.action, saveHistory: mutation.saveHistory === true, retentionDays: numberOrUndefined(mutation.retentionDays) };
  if (mutation.action === "delete_conversation") return { action: mutation.action, conversationId: String(mutation.conversationId ?? "") };
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
  throw new LevyTatePastoralError("That My Support action is not recognised.");
}

async function audit(context: PastoralServerContext, entityType: string, entityId: string, action: string, outcome: string) {
  await supabaseInsert(requireConfig(), "levytate_pastoral_audit_events", [{
    id: randomUUID(),
    organisation_id: context.organisation.id,
    employee_id: context.employee?.id ?? null,
    actor_user_id: context.user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    outcome,
    correlation_id: randomUUID(),
  }], { prefer: "return=minimal" });
}

function messageInsert(context: PastoralServerContext, conversationId: string, sequence: number, author: PastoralConversationMessage["author"], clientMessageId: string, encrypted: PastoralCiphertext) {
  assertEmployeeContext(context);
  return {
    id: randomUUID(), organisation_id: context.organisation.id, conversation_id: conversationId,
    employee_id: context.employee.id, owner_user_id: context.user.id, sequence_number: sequence,
    author_type: author, ciphertext: encrypted.ciphertext, nonce: encrypted.nonce,
    authentication_tag: encrypted.authenticationTag, encryption_key_version: encrypted.keyVersion,
    policy_version: pastoralPolicyVersion, client_message_id: clientMessageId,
  };
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
function bounded(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }
function boundedRequired(value: unknown, max: number, label: string) { const clean = bounded(value, max); if (!clean) throw new LevyTatePastoralError(`${label} is required.`); return clean; }
function boundedId(value: string) { const clean = String(value ?? "").trim(); if (!/^[0-9a-f-]{36}$/i.test(clean)) throw new LevyTatePastoralError("A valid record identifier is required."); return clean; }
function validIdempotencyKey(value: string) { const clean = String(value ?? "").trim(); if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(clean)) throw new LevyTatePastoralError("A valid idempotency key is required."); return clean; }
function numberOrUndefined(value: unknown) { return value === undefined ? undefined : Number(value); }
function contactMethod(value: unknown): PastoralSharedRequestPayload["preferredContactMethod"] { if (!["in_platform", "email", "phone", "meeting", "provider_route"].includes(String(value))) throw new LevyTatePastoralError("Choose a valid preferred contact method."); return value as PastoralSharedRequestPayload["preferredContactMethod"]; }
function recipientIsSafeForPayload(recipient: RecipientRow, payload: PastoralSharedRequestPayload) {
  const combined = `${payload.topic} ${payload.whatIWantYouToUnderstand} ${payload.howItIsAffectingMe} ${payload.supportIWant} ${payload.sharingRestrictions}`;
  if (recipient.recipient_kind === "line_manager" && /\b(?:my\s+)?(?:line\s+)?manager\b/i.test(combined)) return false;
  if (recipient.recipient_kind === "apprenticeship_lead" && /\bapprenticeship\s+lead\b/i.test(combined)) return false;
  return true;
}

const conversationSelect = "id,employee_id,owner_user_id,status,retention_expires_at,created_at,updated_at";
const messageSelect = "id,conversation_id,employee_id,owner_user_id,sequence_number,author_type,ciphertext,nonce,authentication_tag,encryption_key_version,client_message_id,created_at";
const supportRequestSelect = "id,employee_id,owner_user_id,recipient_id,assigned_recipient_id,topic_category,preferred_contact_method,urgency_route,payload_ciphertext,payload_nonce,payload_authentication_tag,encryption_key_version,idempotency_key,status,lock_version,submitted_at,acknowledged_at,resolved_at";
const eventSelect = "id,support_request_id,event_type,previous_state,new_state,note_ciphertext,note_nonce,note_authentication_tag,encryption_key_version,idempotency_key,created_at";
