"use client";

import {
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import type {
  PastoralAssistantResponse,
  PastoralContactMethod,
  PastoralConversationMessage,
  PastoralSupportRequestView,
  PastoralTopicCategory,
  PastoralUrgencyRoute,
  PastoralWorkspace,
} from "@/lib/levytate/pastoral/domain";
import { MvpLoadingState, MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";

type EmployeeView = "conversation" | "requests" | "privacy";

const starters = [
  "I'm struggling to keep up.",
  "I'm not getting enough learning time.",
  "I'm finding part of my programme difficult.",
  "I'm having problems with someone at work.",
  "I'm not sure what's wrong — I'd just like to talk.",
] as const;

const topicOptions: Array<{ value: PastoralTopicCategory; label: string }> = [
  { value: "apprenticeship_support", label: "Apprenticeship support" },
  { value: "workload_pressure", label: "Workload or keeping up" },
  { value: "workplace_relationships", label: "A workplace relationship" },
  { value: "bullying_harassment_discrimination", label: "Bullying, harassment or discrimination" },
  { value: "wellbeing", label: "Wellbeing" },
  { value: "personal_circumstances", label: "Personal circumstances" },
  { value: "accessibility_adjustments", label: "Accessibility or adjustments" },
  { value: "provider_support", label: "Training-provider support" },
  { value: "other", label: "Something else" },
];

const emptyDraft = () => ({
  topicCategory: "apprenticeship_support" as PastoralTopicCategory,
  topic: "",
  whatIWantYouToUnderstand: "",
  howItIsAffectingMe: "",
  supportIWant: "",
  preferredContactMethod: "in_platform" as PastoralContactMethod,
  sharingRestrictions: "",
  recipientId: "",
  urgencyRoute: "standard" as PastoralUrgencyRoute,
  idempotencyKey: crypto.randomUUID(),
});

export function PastoralSupportModule() {
  const [workspace, setWorkspace] = useState<PastoralWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/levytate-pastoral", { cache: "no-store" });
    const body = await safeJson(response);
    setLoading(false);
    if (!response.ok || !body?.workspace) {
      setError(body?.message || "My Support is temporarily unavailable.");
      return;
    }
    setWorkspace(body.workspace as PastoralWorkspace);
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <MvpLoadingState label="Opening My Support…" />;
  if (error || !workspace) return <UnavailableState message={error || "My Support is unavailable."} onRetry={load} />;
  return workspace.accessMode === "employee"
    ? <EmployeePastoralWorkspace workspace={workspace} onWorkspace={setWorkspace} />
    : <SupportInbox workspace={workspace} onWorkspace={setWorkspace} />;
}

function EmployeePastoralWorkspace({ workspace, onWorkspace }: { workspace: PastoralWorkspace; onWorkspace: (workspace: PastoralWorkspace) => void }) {
  const [view, setView] = useState<EmployeeView>("conversation");
  const [messages, setMessages] = useState<PastoralConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [suggestedTopic, setSuggestedTopic] = useState<PastoralTopicCategory>("apprenticeship_support");
  const [suggestedUrgency, setSuggestedUrgency] = useState<PastoralUrgencyRoute>("standard");

  function openRequest(topic = suggestedTopic, urgency = suggestedUrgency) {
    setSuggestedTopic(topic);
    setSuggestedUrgency(urgency);
    setDraftOpen(true);
    setView("requests");
  }

  function resumeConversation(id: string) {
    const conversation = workspace.conversations.find((entry) => entry.id === id);
    if (!conversation) return;
    setConversationId(id);
    setMessages(conversation.messages);
    setView("conversation");
  }

  const tabs: Array<{ id: EmployeeView; label: string; icon: typeof MessageCircle }> = [
    { id: "conversation", label: "Talk it through", icon: MessageCircle },
    { id: "requests", label: "My support requests", icon: UserRoundCheck },
    { id: "privacy", label: "My privacy", icon: LockKeyhole },
  ];

  return <div className="grid gap-5">
    <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.07] bg-white shadow-[0_16px_42px_rgba(16,44,61,0.05)]">
      <div className="bg-[linear-gradient(130deg,#102c3d_0%,#174b56_62%,#167e74_100%)] px-5 py-6 text-white sm:px-7">
        <div className="max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9de5d8]">Private apprenticeship support</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">What would help today?</h2><p className="mt-2 text-sm leading-6 text-white/72">Whether you&apos;re finding your workload difficult, struggling with your programme or unsure how to ask for help, you can talk it through here.</p></div>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/12 bg-white/[0.08] p-4 text-xs leading-5 text-white/72"><ShieldCheck className="mt-0.5 shrink-0 text-[#9de5d8]" size={17} aria-hidden="true" /><p>This is an AI assistant, not a human pastoral officer, and chats are not monitored live. Private chat is not shared with your employer. You decide whether to send a separate support request.</p></div>
      </div>
      <div role="tablist" aria-label="My Support sections" className="grid border-t border-[#102c3d]/[0.06] sm:grid-cols-3">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`flex min-h-12 items-center justify-center gap-2 border-b border-[#102c3d]/[0.06] px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 sm:border-b-0 sm:border-r ${view === id ? "bg-[#edf7f3] text-[#087c73]" : "text-[#102c3d]/58 hover:bg-[#f7faf8] hover:text-[#102c3d]"}`}><Icon size={15} aria-hidden="true" />{label}</button>)}</div>
    </section>

    {view === "conversation" ? <ConversationPanel workspace={workspace} messages={messages} conversationId={conversationId} onMessages={setMessages} onConversationId={setConversationId} onRequestSupport={openRequest} /> : null}
    {view === "requests" ? <EmployeeRequests workspace={workspace} draftOpen={draftOpen} initialTopic={suggestedTopic} initialUrgency={suggestedUrgency} onDraftOpen={setDraftOpen} onWorkspace={onWorkspace} /> : null}
    {view === "privacy" ? <PrivacyPanel workspace={workspace} onWorkspace={onWorkspace} onResume={resumeConversation} /> : null}
  </div>;
}

function ConversationPanel({ workspace, messages, conversationId, onMessages, onConversationId, onRequestSupport }: {
  workspace: PastoralWorkspace;
  messages: PastoralConversationMessage[];
  conversationId: string | null;
  onMessages: (messages: PastoralConversationMessage[]) => void;
  onConversationId: (id: string | null) => void;
  onRequestSupport: (topic?: PastoralTopicCategory, urgency?: PastoralUrgencyRoute) => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<PastoralAssistantResponse | null>(null);
  const inputId = useId();

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = message.trim().slice(0, 3000);
    if (!clean || sending) return;
    const clientMessageId = crypto.randomUUID();
    const userMessage: PastoralConversationMessage = { id: clientMessageId, author: "employee", content: clean, createdAt: new Date().toISOString() };
    const prior = messages.slice(-8);
    onMessages([...messages, userMessage]);
    setMessage("");
    setSending(true);
    setError("");
    const response = await fetch("/api/levytate-pastoral/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: clean, conversationId, clientMessageId, recentMessages: prior.map(({ author, content }) => ({ author, content })) }),
    });
    const body = await safeJson(response);
    setSending(false);
    if (!response.ok || !body?.response) {
      setError(body?.message || "The AI conversation is temporarily unavailable. You can still request human support.");
      return;
    }
    const result = body.response as PastoralAssistantResponse;
    setLatest(result);
    onConversationId(result.conversationId);
    onMessages([...messages, userMessage, { id: `${clientMessageId}:assistant`, author: "assistant", content: result.reply, createdAt: new Date().toISOString() }]);
  }

  function startNew() {
    onConversationId(null);
    onMessages([]);
    setLatest(null);
    setError("");
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
    <MvpPanel title="Talk it through" eyebrow="Private AI conversation" actions={messages.length ? <button type="button" onClick={startNew} className="min-h-10 rounded-xl border border-[#102c3d]/10 px-3 text-xs font-semibold text-[#102c3d] hover:bg-[#f4f8f5]">Start a new conversation</button> : undefined}>
      <div className="grid gap-5">
        {!messages.length ? <div><h3 className="text-lg font-semibold text-[#102c3d]">You can start wherever feels easiest.</h3><p className="mt-1 text-sm leading-6 text-[#102c3d]/58">Choose a prompt or write in your own words. You can ask to talk without advice.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{starters.map((starter) => <button key={starter} type="button" onClick={() => setMessage(starter)} className="min-h-12 rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 py-3 text-left text-sm font-semibold leading-5 text-[#102c3d] transition hover:border-[#159b8f]/35 hover:bg-[#eef8f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">{starter}</button>)}</div></div> : <div aria-live="polite" className="grid max-h-[32rem] gap-3 overflow-y-auto pr-1">{messages.map((entry) => <article key={entry.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${entry.author === "employee" ? "ml-auto bg-[#102c3d] text-white" : "bg-[#edf7f3] text-[#102c3d]"}`}><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55">{entry.author === "employee" ? "You" : "My Support · AI"}</p><p className="whitespace-pre-wrap">{entry.content}</p></article>)}{sending ? <div className="max-w-[88%] rounded-2xl bg-[#edf7f3] px-4 py-3 text-sm text-[#102c3d]/60">My Support is preparing a response…</div> : null}</div>}
        {error ? <div role="alert" className="rounded-xl border border-[#c95568]/20 bg-[#fff4f5] p-4 text-sm leading-6 text-[#8f3042]"><p>{error}</p>{workspace.recipients.length ? <button type="button" onClick={() => onRequestSupport()} className="mt-3 min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white">Request human support</button> : null}</div> : null}
        {latest?.supportOffer ? <div className="rounded-xl border border-[#159b8f]/20 bg-[#f0f8f5] p-4"><p className="text-sm font-semibold text-[#102c3d]">Would you like support from a person?</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/58">You can prepare a separate request. Your private conversation will not be attached.</p><button type="button" onClick={() => onRequestSupport(latest.suggestedTopicCategory, latest.urgencyRoute)} className="mt-3 min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white">Prepare a support request</button></div> : null}
        <form onSubmit={send} className="border-t border-[#102c3d]/[0.07] pt-4"><label htmlFor={inputId} className="text-xs font-semibold text-[#102c3d]">What would you like to talk through?</label><textarea id={inputId} value={message} onChange={(event) => setMessage(event.target.value.slice(0, 3000))} rows={4} maxLength={3000} placeholder="Write in your own words…" className="mt-2 w-full resize-y rounded-xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 text-sm leading-6 text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" /><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[#102c3d]/48">{workspace.employee?.historySavingEnabled ? "This conversation will be encrypted and saved so you can return to it." : "History saving is off. Routine chat content is not stored after this active session."}</p><button disabled={sending || !message.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:opacity-45"><Send size={15} aria-hidden="true" />Send</button></div></form>
      </div>
    </MvpPanel>
    <aside className="grid content-start gap-4"><ContextCard workspace={workspace} /><section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_12px_30px_rgba(16,44,61,0.04)]"><HeartHandshake size={20} className="text-[#0b776e]" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold text-[#102c3d]">Talk to a person instead</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/58">You do not need to use the AI conversation first. Send only what you choose to an approved support contact.</p><button type="button" onClick={() => onRequestSupport()} disabled={!workspace.recipients.length} className="mt-4 min-h-11 w-full rounded-xl border border-[#102c3d]/10 px-4 text-xs font-semibold text-[#102c3d] disabled:cursor-not-allowed disabled:opacity-45">{workspace.recipients.length ? "Prepare a support request" : "No approved contact is available"}</button></section><SafetyCard notice={workspace.emergencyNotice} /></aside>
  </div>;
}

function ContextCard({ workspace }: { workspace: PastoralWorkspace }) {
  const context = workspace.employee?.learnerContext;
  if (!context) return <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Your apprenticeship context</p><p className="mt-2 text-sm leading-6 text-[#102c3d]/58">No current learner record is available. My Support will not treat missing data as poor performance.</p></section>;
  return <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Your apprenticeship context</p><h3 className="mt-2 text-sm font-semibold text-[#102c3d]">{context.programmeName}</h3><dl className="mt-3 grid gap-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-[#102c3d]/48">Provider</dt><dd className="text-right font-semibold">{context.providerName}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#102c3d]/48">Stage</dt><dd className="text-right font-semibold">{humanise(context.lifecycleStage)}</dd></div></dl><p className="mt-3 text-[11px] leading-5 text-[#102c3d]/48">Only this minimal, learner-visible context is made available to the assistant.</p></section>;
}

function EmployeeRequests({ workspace, draftOpen, initialTopic, initialUrgency, onDraftOpen, onWorkspace }: {
  workspace: PastoralWorkspace;
  draftOpen: boolean;
  initialTopic: PastoralTopicCategory;
  initialUrgency: PastoralUrgencyRoute;
  onDraftOpen: (open: boolean) => void;
  onWorkspace: (workspace: PastoralWorkspace) => void;
}) {
  const [draft, setDraft] = useState(() => ({ ...emptyDraft(), topicCategory: initialTopic, urgencyRoute: initialUrgency }));
  const [reviewing, setReviewing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { if (draftOpen) setDraft((current) => ({ ...current, topicCategory: initialTopic, urgencyRoute: initialUrgency })); }, [draftOpen, initialTopic, initialUrgency]);

  async function mutate(body: unknown) {
    setWorking(true); setError(""); setSuccess("");
    const response = await fetch("/api/levytate-pastoral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await safeJson(response);
    setWorking(false);
    if (!response.ok || !result?.workspace) { setError(result?.message || "The support request could not be updated."); return false; }
    onWorkspace(result.workspace as PastoralWorkspace);
    return true;
  }

  async function send() {
    const recipient = workspace.recipients.find((entry) => entry.id === draft.recipientId);
    if (!recipient) { setError("Choose an approved support contact."); return; }
    const ok = await mutate({
      action: "submit_support_request",
      recipientId: draft.recipientId,
      topicCategory: draft.topicCategory,
      urgencyRoute: draft.urgencyRoute,
      idempotencyKey: draft.idempotencyKey,
      payload: {
        topic: draft.topic,
        whatIWantYouToUnderstand: draft.whatIWantYouToUnderstand,
        howItIsAffectingMe: draft.howItIsAffectingMe,
        supportIWant: draft.supportIWant,
        preferredContactMethod: draft.preferredContactMethod,
        sharingRestrictions: draft.sharingRestrictions,
      },
    });
    if (!ok) return;
    setSuccess(`Your support request was sent to ${recipient.label}.`);
    setDraft(emptyDraft());
    setReviewing(false);
    onDraftOpen(false);
  }

  async function employeeTransition(request: PastoralSupportRequestView, transition: "reopen" | "dispute") {
    const ok = await mutate({ action: "transition_support_request", requestId: request.id, transition, expectedLockVersion: request.lockVersion, idempotencyKey: crypto.randomUUID(), note: transition === "dispute" ? "I do not agree that this support request is resolved and would like further help." : "I would like further help with this request." });
    if (ok) setSuccess(transition === "reopen" ? "The support request has been reopened." : "Your request for further help has been recorded.");
  }

  return <div className="grid gap-5">
    <MvpPanel title="My support requests" eyebrow="Only what you choose to share" actions={<button type="button" onClick={() => { onDraftOpen(true); setReviewing(false); setError(""); }} disabled={!workspace.recipients.length} className="min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white disabled:opacity-45">New support request</button>}>
      <p className="text-sm leading-6 text-[#102c3d]/58">A support request is separate from your private AI conversation. Your transcript is never attached automatically and later messages are not shared.</p>
      {success ? <p role="status" className="mt-4 rounded-xl bg-[#eaf7f2] p-3 text-sm font-semibold text-[#0b6f63]">{success}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1f3] p-3 text-sm font-semibold text-[#a33a4d]">{error}</p> : null}
      {!workspace.requests.length ? <div className="mt-5 rounded-xl border border-dashed border-[#102c3d]/15 bg-[#f8fbfa] p-6 text-center"><UserRoundCheck className="mx-auto text-[#0b776e]" size={23} aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold text-[#102c3d]">No support requests sent</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/55">You stay in control of whether anything is shared.</p></div> : <div className="mt-5 grid gap-3">{workspace.requests.map((request) => <RequestCard key={request.id} request={request} employeeView onTransition={(transition) => employeeTransition(request, transition)} />)}</div>}
    </MvpPanel>
    {draftOpen ? <SupportRequestDraft workspace={workspace} draft={draft} reviewing={reviewing} working={working} onDraft={setDraft} onReview={() => setReviewing(true)} onBack={() => setReviewing(false)} onCancel={() => { onDraftOpen(false); setReviewing(false); }} onSend={send} /> : null}
  </div>;
}

function SupportRequestDraft({ workspace, draft, reviewing, working, onDraft, onReview, onBack, onCancel, onSend }: {
  workspace: PastoralWorkspace;
  draft: ReturnType<typeof emptyDraft>;
  reviewing: boolean;
  working: boolean;
  onDraft: (draft: ReturnType<typeof emptyDraft>) => void;
  onReview: () => void;
  onBack: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const concernText = `${draft.topic} ${draft.whatIWantYouToUnderstand} ${draft.howItIsAffectingMe} ${draft.supportIWant} ${draft.sharingRestrictions}`;
  const safeRecipients = workspace.recipients.filter((entry) => {
    if (entry.kind === "line_manager" && /\b(?:my\s+)?(?:line\s+)?manager\b/i.test(concernText)) return false;
    if (entry.kind === "apprenticeship_lead" && /\bapprenticeship\s+lead\b/i.test(concernText)) return false;
    return true;
  });
  const recipient = safeRecipients.find((entry) => entry.id === draft.recipientId);
  const canReview = Boolean(recipient && draft.topic.trim() && draft.whatIWantYouToUnderstand.trim() && draft.supportIWant.trim());
  if (reviewing) return <MvpPanel title="Review before sending" eyebrow="Your choice"><div className="grid gap-4"><div className="rounded-xl border border-[#159b8f]/20 bg-[#f1f8f5] p-4"><p className="text-xs font-semibold text-[#0b6f63]">This is exactly what will be shared</p><dl className="mt-3 grid gap-3 text-sm"><ReviewRow label="Recipient" value={recipient?.label || "Not selected"} /><ReviewRow label="Topic" value={draft.topic} /><ReviewRow label="What to understand" value={draft.whatIWantYouToUnderstand} /><ReviewRow label="Effect on apprenticeship" value={draft.howItIsAffectingMe || "Not provided"} /><ReviewRow label="Support requested" value={draft.supportIWant} /><ReviewRow label="Preferred contact" value={humanise(draft.preferredContactMethod)} /><ReviewRow label="Sharing restrictions" value={draft.sharingRestrictions || "None provided"} /></dl></div><div className="flex items-start gap-3 rounded-xl bg-[#fff8df] p-4 text-xs leading-5 text-[#65550b]"><LockKeyhole className="mt-0.5 shrink-0" size={16} aria-hidden="true" />Your private conversation is not included. Sending this request does not authorise sharing later conversations.</div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onBack} disabled={working} className="min-h-11 rounded-xl border border-[#102c3d]/10 px-4 text-xs font-semibold">Edit request</button><button type="button" onClick={onSend} disabled={working} className="min-h-11 rounded-xl bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-50">{working ? "Sending…" : "Send support request"}</button></div></div></MvpPanel>;
  return <MvpPanel title="Prepare a support request" eyebrow="Editable draft"><form onSubmit={(event) => { event.preventDefault(); if (canReview) onReview(); }} className="grid gap-4"><div className="grid gap-4 md:grid-cols-2"><SelectField label="Topic category" value={draft.topicCategory} options={topicOptions} onChange={(value) => onDraft({ ...draft, topicCategory: value as PastoralTopicCategory })} /><SelectField label="Intended recipient" value={recipient ? draft.recipientId : ""} options={[{ value: "", label: safeRecipients.length ? "Choose an approved support contact" : "No independent approved contact is available" }, ...safeRecipients.map((entry) => ({ value: entry.id, label: entry.label }))]} onChange={(value) => onDraft({ ...draft, recipientId: value })} /></div>{safeRecipients.length < workspace.recipients.length ? <p className="rounded-xl bg-[#fff8df] p-3 text-xs leading-5 text-[#65550b]">A contact mentioned in the concern has been removed from the recipient choices. Choose an independent approved support route.</p> : null}<TextField label="Topic" value={draft.topic} maxLength={180} onChange={(value) => onDraft({ ...draft, topic: value })} placeholder="A short description of what you need help with" /><TextArea label="What would you like your support contact to understand?" value={draft.whatIWantYouToUnderstand} maxLength={2500} onChange={(value) => onDraft({ ...draft, whatIWantYouToUnderstand: value })} /><TextArea label="How is this affecting your apprenticeship?" value={draft.howItIsAffectingMe} maxLength={1800} onChange={(value) => onDraft({ ...draft, howItIsAffectingMe: value })} /><TextArea label="What support would you like?" value={draft.supportIWant} maxLength={1800} onChange={(value) => onDraft({ ...draft, supportIWant: value })} /><div className="grid gap-4 md:grid-cols-2"><SelectField label="Preferred contact method" value={draft.preferredContactMethod} options={[{ value: "in_platform", label: "In LevyTate" }, { value: "email", label: "Email" }, { value: "phone", label: "Phone" }, { value: "meeting", label: "Meeting" }, { value: "provider_route", label: "Provider support route" }]} onChange={(value) => onDraft({ ...draft, preferredContactMethod: value as PastoralContactMethod })} /><TextField label="Restrictions on who should be contacted" value={draft.sharingRestrictions} maxLength={1000} onChange={(value) => onDraft({ ...draft, sharingRestrictions: value })} placeholder="Optional" /></div><div className="flex flex-col-reverse gap-2 border-t border-[#102c3d]/[0.07] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-[#102c3d]/10 px-4 text-xs font-semibold">Cancel</button><button disabled={!canReview} className="min-h-11 rounded-xl bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-45">Review support request</button></div></form></MvpPanel>;
}

function PrivacyPanel({ workspace, onWorkspace, onResume }: { workspace: PastoralWorkspace; onWorkspace: (workspace: PastoralWorkspace) => void; onResume: (id: string) => void }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  async function mutate(body: unknown) { setWorking(true); setError(""); const response = await fetch("/api/levytate-pastoral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await safeJson(response); setWorking(false); if (!response.ok || !result?.workspace) { setError(result?.message || "Your privacy setting could not be updated."); return; } onWorkspace(result.workspace as PastoralWorkspace); }
  return <div className="grid gap-5 lg:grid-cols-2"><MvpPanel title="Conversation saving" eyebrow="Your choice"><div className="flex items-start justify-between gap-5 rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] p-4"><div><p className="text-sm font-semibold text-[#102c3d]">Save private conversations</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/58">When on, messages are encrypted before storage and kept for {workspace.employee?.historyRetentionDays ?? 30} days. Turn this off to stop saving future messages.</p></div><button type="button" role="switch" aria-checked={workspace.employee?.historySavingEnabled ?? false} disabled={working} onClick={() => mutate({ action: "set_history_preference", saveHistory: !workspace.employee?.historySavingEnabled, retentionDays: workspace.employee?.historyRetentionDays ?? 30 })} className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${workspace.employee?.historySavingEnabled ? "bg-[#159b8f]" : "bg-[#102c3d]/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${workspace.employee?.historySavingEnabled ? "left-6" : "left-1"}`}><span className="sr-only">{workspace.employee?.historySavingEnabled ? "Saving on" : "Saving off"}</span></span></button></div>{error ? <p role="alert" className="mt-3 text-xs font-semibold text-[#a33a4d]">{error}</p> : null}<div className="mt-5 space-y-3 text-sm leading-6 text-[#102c3d]/60"><p>{workspace.privacyNotice}</p><p>Deleting a saved conversation removes the active database copy and its encrypted messages. It may remain temporarily in restricted backups until those backups expire. A support request you deliberately sent is a separate record and is not deleted with a conversation.</p></div></MvpPanel><MvpPanel title="Saved conversations" eyebrow="Private history">{!workspace.conversations.length ? <p className="text-sm leading-6 text-[#102c3d]/58">You have no saved conversations.</p> : <div className="grid gap-3">{workspace.conversations.map((conversation) => <div key={conversation.id} className="rounded-xl border border-[#102c3d]/[0.08] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#102c3d]">Conversation from {formatDate(conversation.createdAt)}</p><p className="mt-1 text-xs text-[#102c3d]/48">{conversation.messages.length} messages · retained until {formatDate(conversation.retentionExpiresAt)}</p></div><StatusBadge tone="green">Encrypted</StatusBadge></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => onResume(conversation.id)} className="min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white">Resume</button><button type="button" disabled={working} onClick={() => mutate({ action: "delete_conversation", conversationId: conversation.id })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#c95568]/20 px-4 text-xs font-semibold text-[#a33a4d]"><Trash2 size={14} aria-hidden="true" />Delete</button></div></div>)}</div>}</MvpPanel></div>;
}

function SupportInbox({ workspace, onWorkspace }: { workspace: PastoralWorkspace; onWorkspace: (workspace: PastoralWorkspace) => void }) {
  const [selectedId, setSelectedId] = useState(workspace.requests[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const noteId = useId();
  const selected = workspace.requests.find((request) => request.id === selectedId) ?? workspace.requests[0];
  const counts = useMemo(() => ({ open: workspace.requests.filter((request) => request.status !== "resolved").length, followUp: workspace.requests.filter((request) => request.status === "follow_up").length, resolved: workspace.requests.filter((request) => request.status === "resolved").length }), [workspace.requests]);

  async function transition(action: "acknowledge" | "start_support" | "request_follow_up" | "resolve") {
    if (!selected) return;
    setWorking(true); setMessage("");
    const response = await fetch("/api/levytate-pastoral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transition_support_request", requestId: selected.id, transition: action, expectedLockVersion: selected.lockVersion, idempotencyKey: crypto.randomUUID(), note }) });
    const result = await safeJson(response); setWorking(false);
    if (!response.ok || !result?.workspace) { setMessage(result?.message || "The request could not be updated."); return; }
    onWorkspace(result.workspace as PastoralWorkspace); setNote(""); setMessage("Support request updated.");
  }

  return <div className="grid gap-5"><section className="rounded-2xl bg-[#102c3d] p-5 text-white sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9de5d8]">Restricted support inbox</p><h2 className="mt-2 text-2xl font-semibold">Learner Support</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">Only requests addressed or explicitly assigned to your approved support identity appear here. Private employee conversations are never included.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><SummaryMetric label="Open requests" value={counts.open} /><SummaryMetric label="Follow-up" value={counts.followUp} /><SummaryMetric label="Resolved" value={counts.resolved} /></div></section>{!workspace.requests.length ? <MvpPanel title="Support inbox" eyebrow="Restricted"><div className="rounded-xl border border-dashed border-[#102c3d]/15 bg-[#f8fbfa] p-7 text-center"><CheckCircle2 className="mx-auto text-[#0b776e]" size={24} aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold">No requests are assigned to you</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/55">Requests assigned to another support contact remain inaccessible.</p></div></MvpPanel> : <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><MvpPanel title="Assigned requests" eyebrow="Your support queue"><div className="grid gap-2">{workspace.requests.map((request) => <button key={request.id} type="button" onClick={() => setSelectedId(request.id)} aria-current={selected?.id === request.id ? "true" : undefined} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${selected?.id === request.id ? "border-[#159b8f]/35 bg-[#edf7f3]" : "border-[#102c3d]/[0.08] hover:bg-[#f8fbfa]"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-[#102c3d]">{request.payload.topic}</p><StatusBadge tone={statusTone(request.status)}>{humanise(request.status)}</StatusBadge></div><p className="mt-2 text-xs text-[#102c3d]/52">{request.employeeLabel} · {formatDate(request.submittedAt)}</p></button>)}</div></MvpPanel>{selected ? <MvpPanel title={selected.payload.topic} eyebrow="Employee-approved support request"><RequestDetail request={selected} /><div className="mt-5 border-t border-[#102c3d]/[0.07] pt-5"><label htmlFor={noteId} className="text-xs font-semibold text-[#102c3d]">Response or agreed action</label><textarea id={noteId} value={note} onChange={(event) => setNote(event.target.value.slice(0, 2000))} rows={3} maxLength={2000} placeholder="Record only the support response or agreed next action." className="mt-2 w-full rounded-xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 text-sm leading-6 outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" /><div className="mt-3 flex flex-wrap gap-2">{selected.status === "submitted" ? <ActionButton label="Acknowledge receipt" onClick={() => transition("acknowledge")} disabled={working} /> : null}{["acknowledged", "follow_up"].includes(selected.status) ? <ActionButton label="Start support" onClick={() => transition("start_support")} disabled={working} /> : null}{["acknowledged", "support_in_progress"].includes(selected.status) ? <ActionButton label="Set follow-up" onClick={() => transition("request_follow_up")} disabled={working} /> : null}{["support_in_progress", "follow_up"].includes(selected.status) ? <ActionButton label="Mark resolved" onClick={() => transition("resolve")} disabled={working} /> : null}</div>{message ? <p role="status" className="mt-3 text-xs font-semibold text-[#0b6f63]">{message}</p> : null}</div></MvpPanel> : null}</div>}<SafetyCard notice={workspace.emergencyNotice} /></div>;
}

function RequestCard({ request, employeeView, onTransition }: { request: PastoralSupportRequestView; employeeView?: boolean; onTransition?: (action: "reopen" | "dispute") => void }) {
  return <article className="rounded-xl border border-[#102c3d]/[0.08] bg-[#fbfcfb] p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-[#102c3d]">{request.payload.topic}</p><p className="mt-1 text-xs text-[#102c3d]/50">Sent to {request.recipientLabel} · {formatDate(request.submittedAt)}</p></div><StatusBadge tone={statusTone(request.status)}>{humanise(request.status)}</StatusBadge></div><p className="mt-3 text-sm leading-6 text-[#102c3d]/62">{request.payload.supportIWant}</p>{request.events.length ? <div className="mt-4 border-t border-[#102c3d]/[0.06] pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">Latest update</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/58">{humanise(request.events.at(-1)!.eventType)} · {formatDate(request.events.at(-1)!.createdAt)}{request.events.at(-1)!.note ? ` — ${request.events.at(-1)!.note}` : ""}</p></div> : null}{employeeView && request.status === "resolved" && onTransition ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => onTransition("reopen")} className="min-h-10 rounded-xl border border-[#102c3d]/10 px-4 text-xs font-semibold">I need more help</button><button type="button" onClick={() => onTransition("dispute")} className="min-h-10 rounded-xl border border-[#c95568]/20 px-4 text-xs font-semibold text-[#a33a4d]">I don&apos;t agree it&apos;s resolved</button></div> : null}</article>;
}

function RequestDetail({ request }: { request: PastoralSupportRequestView }) { return <div className="grid gap-4"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={statusTone(request.status)}>{humanise(request.status)}</StatusBadge><StatusBadge tone={request.urgencyRoute === "standard" ? "neutral" : "yellow"}>{humanise(request.urgencyRoute)}</StatusBadge></div><dl className="grid gap-4 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4"><ReviewRow label="Employee" value={request.employeeLabel} /><ReviewRow label="What they want you to understand" value={request.payload.whatIWantYouToUnderstand} /><ReviewRow label="Effect on apprenticeship" value={request.payload.howItIsAffectingMe || "Not provided"} /><ReviewRow label="Support requested" value={request.payload.supportIWant} /><ReviewRow label="Preferred contact" value={humanise(request.payload.preferredContactMethod)} /><ReviewRow label="Sharing restrictions" value={request.payload.sharingRestrictions || "None provided"} /></dl>{request.events.length ? <div><p className="text-xs font-semibold text-[#102c3d]">Support history</p><ol className="mt-3 grid gap-3">{request.events.map((event) => <li key={event.id} className="flex gap-3 text-xs leading-5 text-[#102c3d]/58"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#159b8f]" /><span><strong className="text-[#102c3d]">{humanise(event.eventType)}</strong> · {formatDate(event.createdAt)}{event.note ? <span className="block">{event.note}</span> : null}</span></li>)}</ol></div> : null}</div>; }

function SafetyCard({ notice }: { notice: string }) { return <section className="rounded-2xl border border-[#d3a119]/20 bg-[#fff9e8] p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-[#8b6b08]" size={18} aria-hidden="true" /><div><h3 className="text-sm font-semibold text-[#594908]">Immediate safety</h3><p className="mt-1 text-xs leading-5 text-[#594908]/75">{notice}</p></div></div></section>; }
function SummaryMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-white/[0.08] p-4"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/55">{label}</p></div>; }
function ReviewRow({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/42">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#102c3d]">{value}</dd></div>; }
function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white disabled:opacity-45">{label}</button>; }
function TextField({ label, value, maxLength, onChange, placeholder }: { label: string; value: string; maxLength: number; onChange: (value: string) => void; placeholder?: string }) { return <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">{label}<input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-xl border border-[#102c3d]/10 bg-[#f8fbfa] px-3 text-sm text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" /></label>; }
function TextArea({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange: (value: string) => void }) { return <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">{label}<textarea value={value} maxLength={maxLength} rows={4} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-[#102c3d]/10 bg-[#f8fbfa] px-3 py-2.5 text-sm leading-6 text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" /></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) { return <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#102c3d]/10 bg-[#f8fbfa] px-3 text-sm text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function UnavailableState({ message, onRetry }: { message: string; onRetry: () => void }) { return <MvpPanel title="My Support" eyebrow="Private apprenticeship support"><div className="rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] p-6 text-center"><HeartHandshake className="mx-auto text-[#0b776e]" size={25} aria-hidden="true" /><h2 className="mt-3 text-base font-semibold">My Support is unavailable</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#102c3d]/58">{message}</p><button type="button" onClick={onRetry} className="mt-4 min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white">Try again</button></div></MvpPanel>; }
function statusTone(status: string): "neutral" | "green" | "yellow" | "red" | "blue" { if (status === "resolved") return "green"; if (status === "follow_up") return "yellow"; if (status === "support_in_progress") return "blue"; return "neutral"; }
function humanise(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date); }
async function safeJson(response: Response) { try { return await response.json() as { message?: string; workspace?: unknown; response?: unknown }; } catch { return null; } }
