"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, Plus, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  LearningTimeActivityInput,
  LearningTimeActivityView,
  LearningTimeAssistantResponse,
  LearningTimeLearnerView,
  LearningTimeWorkspace,
} from "@/lib/levytate/off-the-job/api";
import { activityCategoryLabel, eligibleActivityCategories, excludedActivityCategories, type OtjActivityCategory } from "@/lib/levytate/off-the-job/domain";

type JsonRecord = Record<string, unknown>;
type AssistantMode = LearningTimeAssistantResponse["mode"];

const assistantModeChoices: ReadonlyArray<{
  mode: AssistantMode;
  title: string;
  copy: string;
  placeholder: string;
}> = [
  {
    mode: "eligibility_check",
    title: "Does this count?",
    copy: "Describe something you've done and LevyTate will help you work out whether it may count as off-the-job learning.",
    placeholder: "e.g. I spent three hours shadowing the data team and built my first Power BI report.",
  },
  {
    mode: "planning",
    title: "Plan my learning time",
    copy: "Tell LevyTate how much protected learning time you have and get ideas grounded in your programme and current learning priorities.",
    placeholder: "e.g. I have three hours of protected learning time on Thursday.",
  },
  {
    mode: "capture_support",
    title: "Help me write it up",
    copy: "Turn your rough notes into a clearer learning record. LevyTate will not invent activities, hours or evidence.",
    placeholder: "e.g. Today I learned how to clean a data set and remove duplicate values.",
  },
];

export function LearningTimeModule() {
  const [workspace, setWorkspace] = useState<LearningTimeWorkspace | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/levytate-learning-time", { cache: "no-store" });
      const payload = await response.json() as LearningTimeWorkspace & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Learning Time is unavailable.");
      setWorkspace(payload);
      const requested = new URLSearchParams(window.location.search).get("learner") ?? "";
      setSelectedLearnerId((current) => current || (payload.learners.some((entry) => entry.learnerRecordId === requested) ? requested : payload.learners[0]?.learnerRecordId || ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Learning Time is unavailable.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selectedLearner = useMemo(() => workspace?.learners.find((entry) => entry.learnerRecordId === selectedLearnerId) ?? workspace?.learners[0] ?? null, [selectedLearnerId, workspace]);

  const act = useCallback(async (body: JsonRecord, success: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/levytate-learning-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "The Learning Time action could not be completed.");
      setNotice(success); await load(); return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The Learning Time action could not be completed.");
      return false;
    } finally { setBusy(false); }
  }, [load]);

  if (loading) return <LoadState />;
  if (error && !workspace) return <MessageState title="Learning Time is unavailable" copy={error} tone="error" onRetry={() => void load()} />;
  if (!workspace) return null;

  return <div className="grid gap-5">
    <section className="rounded-[1.75rem] border border-[#102c3d]/[0.08] bg-[linear-gradient(135deg,#102c3d,#17475a)] p-6 text-white shadow-[0_18px_44px_rgba(16,44,61,0.12)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86d8ce]">Off-the-job training</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Learning Time</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Plan, prepare and review attributable learning evidence without confusing candidate records with provider-confirmed time.</p></div>
        <span className="rounded-full bg-white/[0.09] px-3 py-2 text-xs font-semibold text-white/80">{workspace.role}</span>
      </div>
      <div className="mt-7 grid gap-px overflow-hidden rounded-2xl bg-white/[0.10] sm:grid-cols-2 lg:grid-cols-4">
        <HeroMetric label="Published plans" value={workspace.portfolio.activeLearnerPlans.toLocaleString()} />
        <HeroMetric label="Provider confirmed" value={formatMinutes(workspace.portfolio.providerConfirmedMinutes)} />
        <HeroMetric label="Awaiting employer check" value={formatMinutes(workspace.portfolio.candidateMinutesAwaitingCheck)} />
        <HeroMetric label="Needs attention" value={workspace.portfolio.operationalAttention.toLocaleString()} />
      </div>
    </section>

    {error ? <MessageState title="Action not completed" copy={error} tone="error" /> : null}
    {notice ? <MessageState title="Learning Time updated" copy={notice} tone="success" /> : null}
    {!workspace.learners.length ? <EmptyState role={workspace.role} /> : <>
      {workspace.learners.length > 1 ? <label htmlFor="learning-time-learner" className="grid max-w-xl gap-2 text-xs font-semibold text-[#102c3d]/65">Learner
        <select id="learning-time-learner" value={selectedLearner?.learnerRecordId ?? ""} onChange={(event) => setSelectedLearnerId(event.target.value)} className={inputClass}><option value="">Choose learner</option>{workspace.learners.map((learner) => <option key={learner.learnerRecordId} value={learner.learnerRecordId}>{learner.learnerName} · {learner.programmeName}</option>)}</select>
      </label> : null}
      {selectedLearner ? <LearnerSummary learner={selectedLearner} /> : null}
      {selectedLearner && workspace.canCreateActivities ? <EmployeeLearningTime learner={selectedLearner} busy={busy} act={act} /> : null}
      {selectedLearner && workspace.canManagePlans ? <EmployerLearningTime learner={selectedLearner} busy={busy} act={act} /> : null}
      {selectedLearner && !workspace.canCreateActivities && !workspace.canManagePlans ? <ManagerLearningTime learner={selectedLearner} /> : null}
    </>}
    <p className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f6f9f7] px-4 py-3 text-xs leading-5 text-[#102c3d]/55">{workspace.regulatoryNotice}</p>
  </div>;
}

function EmployeeLearningTime({ learner, busy, act }: { learner: LearningTimeLearnerView; busy: boolean; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LearningTimeActivityView | null>(null);
  if (!learner.plan) return <MessageState title="Your learning-time plan is being prepared" copy="You can use the Off-the-Job Assistant for guidance once your agreed plan has been published. No historic learning time has been inferred." tone="neutral" />;
  const edit = (activity: LearningTimeActivityView) => { setEditing(activity); setShowForm(true); };
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
    <div className="order-2 grid content-start gap-5 lg:order-1">
      <Section title="My learning activity" action={<button type="button" onClick={() => { setEditing(null); setShowForm((value) => !value); }} className={primaryButton}><Plus size={15}/>{showForm ? "Close form" : "Add learning activity"}</button>}>
        {showForm ? <ActivityForm learner={learner} existing={editing} busy={busy} onSaved={() => { setEditing(null); setShowForm(false); }} act={act} /> : null}
        <ActivityList learner={learner} canEdit canReview={false} busy={busy} onEdit={edit} act={act} />
      </Section>
    </div>
    <div className="order-1 grid min-w-0 content-start gap-5 lg:order-2"><Priorities learner={learner}/><OffTheJobAssistant learner={learner}/></div>
  </div>;
}

function EmployerLearningTime({ learner, busy, act }: { learner: LearningTimeLearnerView; busy: boolean; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
    <Section title="Candidate activity review"><ActivityList learner={learner} canEdit={false} canReview busy={busy} act={act} /></Section>
    <div className="grid content-start gap-5"><PlanPanel learner={learner} busy={busy} act={act}/><Priorities learner={learner}/><OffTheJobAssistant learner={learner}/></div>
  </div>;
}

function ManagerLearningTime({ learner }: { learner: LearningTimeLearnerView }) {
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.55fr)]"><Section title="Direct-report learning summary"><ActivityList learner={learner} canEdit={false} canReview={false} busy={false} act={async () => false}/></Section><Priorities learner={learner}/></div>;
}

function LearnerSummary({ learner }: { learner: LearningTimeLearnerView }) {
  return <section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_12px_30px_rgba(16,44,61,0.04)] sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b8075]">{learner.department || "Learner"}</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{learner.learnerName}</h3><p className="mt-1 text-sm text-[#102c3d]/55">{learner.programmeName} · {learner.providerName}</p></div><StatusPill value={learner.lifecycleStatus.replaceAll("_", " ")} /></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Learner recorded" value={formatMinutes(learner.totals.learnerRecordedMinutes)}/><Metric label="Employer checked" value={formatMinutes(learner.totals.employerCheckedMinutes)}/><Metric label="Provider confirmed" value={formatMinutes(learner.totals.providerConfirmedMinutes)}/><Metric label="Remaining to individual minimum" value={learner.plan ? formatMinutes(learner.totals.remainingMinutes) : "Plan required"}/></div>
    {learner.attention.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{learner.attention.map((item) => <div key={item.type} className="rounded-xl bg-[#fff8e8] p-3"><p className="flex items-center gap-2 text-xs font-semibold text-[#795515]"><AlertCircle size={14}/>{item.label}</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/55">{item.detail}</p></div>)}</div> : null}
  </section>;
}

function ActivityForm({ learner, existing, busy, onSaved, act }: { learner: LearningTimeLearnerView; existing: LearningTimeActivityView | null; busy: boolean; onSaved: () => void; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<LearningTimeActivityInput>(() => ({ learnerRecordId: learner.learnerRecordId, activityId: existing?.id, activityDate: existing?.activityDate ?? today, startedAt: existing?.startedAt ?? "09:00", endedAt: existing?.endedAt ?? "10:00", breakMinutes: existing?.breakMinutes ?? 0, category: existing?.category ?? "provider_workshop", title: existing?.title ?? "", description: existing?.description ?? "", whatWasNew: existing?.whatWasNew ?? "", standardRelevance: existing?.standardRelevance ?? "", reflection: existing?.reflection ?? "", workingHoursBasis: existing?.workingHoursBasis ?? "not_confirmed", compensationNote: existing?.compensationNote ?? "", separateFromProductiveWork: existing?.separateFromProductiveWork ?? null, ksbReferences: existing?.ksbReferences ?? [], evidenceReference: existing?.evidenceReference ?? "" }));
  const update = <K extends keyof LearningTimeActivityInput>(key: K, value: LearningTimeActivityInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); if (await act({ action: "save_activity", activity: form }, existing ? "Draft updated." : "Private draft saved.")) onSaved(); };
  return <form onSubmit={submit} className="mb-5 grid gap-4 rounded-2xl border border-[#0b8075]/15 bg-[#f2f8f6] p-4 sm:grid-cols-2">
    <Field label="Activity date"><input required type="date" value={form.activityDate} onChange={(event) => update("activityDate", event.target.value)} className={inputClass}/></Field>
    <Field label="Activity type"><select value={form.category} onChange={(event) => update("category", event.target.value as OtjActivityCategory)} className={inputClass}>{eligibleActivityCategories.map((value) => <option key={value} value={value}>{activityCategoryLabel(value)}</option>)}<optgroup label="Usually not countable">{excludedActivityCategories.map((value) => <option key={value} value={value}>{activityCategoryLabel(value)}</option>)}</optgroup></select></Field>
    <Field label="Start"><input required type="time" value={form.startedAt} onChange={(event) => update("startedAt", event.target.value)} className={inputClass}/></Field>
    <Field label="End"><input required type="time" value={form.endedAt} onChange={(event) => update("endedAt", event.target.value)} className={inputClass}/></Field>
    <Field label="Break minutes"><input required min={0} max={600} type="number" value={form.breakMinutes} onChange={(event) => update("breakMinutes", Number(event.target.value))} className={inputClass}/></Field>
    <Field label="Working-hours basis"><select value={form.workingHoursBasis} onChange={(event) => update("workingHoursBasis", event.target.value as LearningTimeActivityInput["workingHoursBasis"])} className={inputClass}><option value="not_confirmed">Not confirmed</option><option value="within_normal_working_hours">Normal paid hours</option><option value="paid_exception">Paid exception</option><option value="time_off_in_lieu_exception">Time off in lieu</option><option value="outside_working_hours_uncompensated">Outside hours, uncompensated</option></select></Field>
    <Field label="Title" wide><input required maxLength={180} value={form.title} onChange={(event) => update("title", event.target.value)} className={inputClass}/></Field>
    <Field label="What did you do?" wide><textarea required rows={3} maxLength={4000} value={form.description} onChange={(event) => update("description", event.target.value)} className={inputClass}/></Field>
    <Field label="What was genuinely new?" wide><textarea required rows={2} maxLength={3000} value={form.whatWasNew} onChange={(event) => update("whatWasNew", event.target.value)} className={inputClass}/></Field>
    <Field label="How did this relate to your standard or agreed priority?" wide><textarea required rows={2} maxLength={3000} value={form.standardRelevance} onChange={(event) => update("standardRelevance", event.target.value)} className={inputClass}/></Field>
    <Field label="Reflection" wide><textarea rows={2} maxLength={3000} value={form.reflection} onChange={(event) => update("reflection", event.target.value)} className={inputClass}/></Field>
    <Field label="Evidence reference (no sensitive content)" wide><input maxLength={1000} value={form.evidenceReference} onChange={(event) => update("evidenceReference", event.target.value)} placeholder="e.g. provider LMS activity reference" className={inputClass}/></Field>
    <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" checked={form.separateFromProductiveWork === true} onChange={(event) => update("separateFromProductiveWork", event.target.checked ? true : null)} className="h-4 w-4 accent-[#0b8075]"/>This was separate from routine productive work.</label>
    <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" checked={form.saveAsNonCounted === true} onChange={(event) => update("saveAsNonCounted", event.target.checked)} className="h-4 w-4 accent-[#0b8075]"/>If the deterministic rules find this ineligible, retain it explicitly as a non-counted learning note.</label>
    <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy} className={primaryButton}>{busy ? <LoaderCircle size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>}Save {form.saveAsNonCounted ? "learning note" : "private draft"}</button></div>
  </form>;
}

function ActivityList({ learner, canEdit, canReview, busy, onEdit, act }: { learner: LearningTimeLearnerView; canEdit: boolean; canReview: boolean; busy: boolean; onEdit?: (activity: LearningTimeActivityView) => void; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  if (!learner.activities.length) return <p className="rounded-xl bg-[#f6f9f7] p-4 text-sm text-[#102c3d]/55">No learning activity is recorded. LevyTate does not infer historic time.</p>;
  return <div className="grid gap-3">{learner.activities.map((activity) => <article key={activity.id} className="rounded-2xl border border-[#102c3d]/[0.08] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#0b8075]">{activityCategoryLabel(activity.category)}</p><h4 className="mt-1 font-semibold">{activity.title}</h4><p className="mt-1 text-xs text-[#102c3d]/50">{formatDate(activity.activityDate)} · {formatMinutes(activity.durationMinutes)}</p></div><StatusPill value={activity.status.replaceAll("_", " ")}/></div>
    <p className="mt-3 text-sm leading-6 text-[#102c3d]/65">{activity.description}</p>
    <div className="mt-3 rounded-xl bg-[#f6f9f7] p-3 text-xs leading-5 text-[#102c3d]/60"><span className="font-semibold">Deterministic pre-check:</span> {activity.deterministicReasons.join(" ")}</div>
    {activity.confirmation ? <p className="mt-3 text-xs font-semibold text-[#0b6f63]">Provider record: {activity.confirmation.outcome.replaceAll("_", " ")} · {formatMinutes(activity.confirmation.confirmedMinutes)} · {activity.confirmation.sourceReference}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      {canEdit && (activity.status === "draft" || activity.status === "needs_information") ? <button type="button" onClick={() => onEdit?.(activity)} className={secondaryButton}>Edit</button> : null}
      {canEdit && (activity.status === "draft" || activity.status === "needs_information") ? <button type="button" disabled={busy} onClick={() => void act({ action: "submit_activity", activityId: activity.id, lockVersion: activity.lockVersion, idempotencyKey: clientKey("submit") }, "Activity submitted for employer review.")} className={primaryButton}><Send size={14}/>Submit</button> : null}
      {canReview && activity.status === "submitted" ? <><button type="button" disabled={busy} onClick={() => void act({ action: "transition_activity", activityId: activity.id, transitionAction: "employer_check", lockVersion: activity.lockVersion, note: "Employer eligibility check completed; provider confirmation remains required.", idempotencyKey: clientKey("check") }, "Candidate evidence marked as employer checked.")} className={primaryButton}>Employer check</button><button type="button" disabled={busy} onClick={() => void act({ action: "transition_activity", activityId: activity.id, transitionAction: "request_information", lockVersion: activity.lockVersion, note: "Please clarify the learning, standard relevance or working-hours basis.", idempotencyKey: clientKey("clarify") }, "Clarification requested.")} className={secondaryButton}>Request information</button></> : null}
      {canReview && activity.status === "employer_checked" && !activity.confirmation ? <ConfirmationButton learner={learner} activity={activity} busy={busy} act={act}/> : null}
    </div>
  </article>)}</div>;
}

function ConfirmationButton({ learner, activity, busy, act }: { learner: LearningTimeLearnerView; activity: LearningTimeActivityView; busy: boolean; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  const confirm = () => {
    const reference = window.prompt("Enter the attributable provider source reference (for example, LMS record or provider confirmation ID).");
    if (!reference) return;
    void act({ action: "record_confirmation", activityId: activity.id, outcome: "confirmed", confirmedMinutes: activity.durationMinutes, sourceType: "provider_report", providerId: learner.providerId, sourceReference: reference, sourceDate: new Date().toISOString().slice(0, 10), note: "Provider-confirmed record captured by an authorised employer user.", idempotencyKey: clientKey("confirm") }, "Attributable provider confirmation recorded.");
  };
  return <button type="button" disabled={busy} onClick={confirm} className={primaryButton}>Record provider confirmation</button>;
}

function PlanPanel({ learner, busy, act }: { learner: LearningTimeLearnerView; busy: boolean; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  if (learner.plan) return <Section title={learner.plan.status === "draft" ? "Draft learning-time plan" : "Published learning-time plan"}><dl className="grid gap-3 text-xs"><DataRow label="Policy regime" value={learner.plan.policyRegime === "standard_minimum" ? "Standard-specific minimum" : "Legacy 20% basis"}/><DataRow label="Practical period" value={`${formatDate(learner.plan.practicalPeriodStartDate)} – ${formatDate(learner.plan.practicalPeriodEndDate)}`}/><DataRow label="Standard" value={`${learner.plan.standardId} · ${learner.plan.standardVersion}`}/><DataRow label="Individual minimum" value={formatMinutes(learner.plan.individualMinimumMinutes)}/><DataRow label="Planned delivery" value={formatMinutes(learner.plan.plannedDeliveryMinutes)}/><DataRow label="Training-plan reference" value={learner.plan.trainingPlanReference}/></dl>{learner.plan.status === "draft" ? <button type="button" disabled={busy} onClick={() => void act({ action: "publish_plan", versionId: learner.plan?.versionId }, "Learning-time plan published.")} className={`${primaryButton} mt-4`}>Publish checked plan</button> : <PriorityForm learner={learner} busy={busy} act={act}/>}</Section>;
  return <Section title="Set up learning-time plan"><PlanForm learner={learner} busy={busy} act={act}/></Section>;
}

function PriorityForm({ learner, busy, act }: { learner: LearningTimeLearnerView; busy: boolean; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false); const [label, setLabel] = useState(""); const [description, setDescription] = useState(""); const [sourceReference, setSourceReference] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); if (await act({ action: "add_priority", learnerRecordId: learner.learnerRecordId, planVersionId: learner.plan?.versionId, label, description, sourceType: "provider_training_plan", sourceReference }, "Learning priority added.")) { setOpen(false); setLabel(""); setDescription(""); setSourceReference(""); } };
  return <div className="mt-4 border-t border-[#102c3d]/[0.07] pt-4">{open ? <form onSubmit={submit} className="grid gap-3"><Field label="Priority"><input required maxLength={180} value={label} onChange={(event) => setLabel(event.target.value)} className={inputClass}/></Field><Field label="Description"><textarea rows={2} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass}/></Field><Field label="Agreed source reference"><input required maxLength={500} value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} className={inputClass}/></Field><div className="flex gap-2"><button disabled={busy} className={primaryButton}>Add priority</button><button type="button" onClick={() => setOpen(false)} className={secondaryButton}>Cancel</button></div></form> : <button type="button" onClick={() => setOpen(true)} className={secondaryButton}><Plus size={14}/>Add agreed learning priority</button>}</div>;
}

function PlanForm({ learner, busy, act }: { learner: LearningTimeLearnerView; busy: boolean; act: (body: JsonRecord, success: string) => Promise<boolean> }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ originalStartDate: today, practicalStartDate: today, practicalEndDate: "", standardId: learner.standardId, standardVersion: "", individualHours: "187", plannedHours: "200", priorLearningHours: "0", legacyHours: "", trainingPlanReference: "", sourceDate: today });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); void act({ action: "create_plan_draft", learnerRecordId: learner.learnerRecordId, originalStartDate: form.originalStartDate, practicalStartDate: form.practicalStartDate, practicalEndDate: form.practicalEndDate, standardId: form.standardId, standardVersion: form.standardVersion, priorLearningReductionMinutes: Math.round(Number(form.priorLearningHours) * 60), individualMinimumMinutes: Math.round(Number(form.individualHours) * 60), plannedDeliveryMinutes: Math.round(Number(form.plannedHours) * 60), legacyIndicativeMinimumMinutes: form.legacyHours ? Math.round(Number(form.legacyHours) * 60) : null, providerId: learner.providerId, trainingPlanReference: form.trainingPlanReference, sourceType: "provider_training_plan", sourceDate: form.sourceDate }, "Draft plan created. Publish it only after checking the official requirement and agreed training plan."); };
  return <form onSubmit={submit} className="grid gap-3"><Field label="Original apprenticeship start"><input required type="date" value={form.originalStartDate} onChange={(event) => update("originalStartDate", event.target.value)} className={inputClass}/></Field><Field label="Practical period"><div className="grid grid-cols-2 gap-2"><input aria-label="Practical period start" required type="date" value={form.practicalStartDate} onChange={(event) => update("practicalStartDate", event.target.value)} className={inputClass}/><input aria-label="Practical period end" required type="date" value={form.practicalEndDate} onChange={(event) => update("practicalEndDate", event.target.value)} className={inputClass}/></div></Field><Field label="Standard and version"><div className="grid grid-cols-2 gap-2"><input required value={form.standardId} onChange={(event) => update("standardId", event.target.value)} placeholder="ST1512" className={inputClass}/><input required value={form.standardVersion} onChange={(event) => update("standardVersion", event.target.value)} placeholder="2.1" className={inputClass}/></div></Field><Field label="Individual minimum hours"><input required min={0} step="0.5" type="number" value={form.individualHours} onChange={(event) => update("individualHours", event.target.value)} className={inputClass}/></Field><Field label="Planned delivery hours"><input required min={0} step="0.5" type="number" value={form.plannedHours} onChange={(event) => update("plannedHours", event.target.value)} className={inputClass}/></Field><Field label="Prior-learning reduction hours"><input required min={0} step="0.5" type="number" value={form.priorLearningHours} onChange={(event) => update("priorLearningHours", event.target.value)} className={inputClass}/></Field><Field label="Legacy indicative minimum hours (required only for starts before 1 August 2025)"><input min={0} step="0.5" type="number" value={form.legacyHours} onChange={(event) => update("legacyHours", event.target.value)} className={inputClass}/></Field><Field label="Training-plan reference"><input required value={form.trainingPlanReference} onChange={(event) => update("trainingPlanReference", event.target.value)} className={inputClass}/></Field><Field label="Source date"><input required type="date" value={form.sourceDate} onChange={(event) => update("sourceDate", event.target.value)} className={inputClass}/></Field><button disabled={busy} className={primaryButton}>Create versioned draft</button><p className="text-[11px] leading-5 text-[#102c3d]/50">Publishing is a separate governed action. A future version never silently rewrites an earlier plan.</p></form>;
}

function OffTheJobAssistant({ learner }: { learner: LearningTimeLearnerView }) {
  const [mode, setMode] = useState<AssistantMode>("eligibility_check");
  const [prompt, setPrompt] = useState(""); const [result, setResult] = useState<LearningTimeAssistantResponse | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const selectedChoice = assistantModeChoices.find((choice) => choice.mode === mode) ?? assistantModeChoices[0];
  const chooseMode = (nextMode: AssistantMode) => { setMode(nextMode); setResult(null); setError(""); };
  const ask = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch("/api/levytate-learning-time/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ learnerRecordId: learner.learnerRecordId, mode, prompt }) }); const body = await response.json() as LearningTimeAssistantResponse & { message?: string }; if (!response.ok) throw new Error(body.message || "The assistant is unavailable."); setResult(body); } catch (askError) { setError(askError instanceof Error ? askError.message : "The assistant is unavailable."); } finally { setBusy(false); } };
  return <Section title="Off-the-Job Assistant"><form onSubmit={ask} className="grid gap-4">
    <fieldset className="min-w-0">
      <legend className="text-xs font-semibold text-[#102c3d]/65">How can LevyTate help?</legend>
      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
        {assistantModeChoices.map((choice) => {
          const selected = choice.mode === mode;
          return <button key={choice.mode} type="button" aria-pressed={selected} onClick={() => chooseMode(choice.mode)} className={`min-w-0 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b8075] focus-visible:ring-offset-2 ${selected ? "border-[#0b8075]/45 bg-[#edf8f4] shadow-[0_5px_16px_rgba(11,128,117,0.08)]" : "border-[#102c3d]/[0.09] bg-white hover:border-[#0b8075]/30 hover:bg-[#f7fbf9]"}`}>
            <span className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-[#102c3d]">{choice.title}</span>{selected ? <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0b6f63]"><CheckCircle2 size={13} aria-hidden="true"/>Selected</span> : null}</span>
            <span className="mt-2 block text-xs leading-5 text-[#102c3d]/58">{choice.copy}</span>
          </button>;
        })}
      </div>
    </fieldset>
    <div className="grid gap-2">
      <label htmlFor="otj-assistant-prompt" className="text-xs font-semibold text-[#102c3d]/65">Tell LevyTate about your learning</label>
      <textarea id="otj-assistant-prompt" required rows={4} maxLength={3000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={selectedChoice.placeholder} className={inputClass}/>
    </div>
    <button disabled={busy} className={primaryButton}>{busy ? <LoaderCircle size={15} className="animate-spin"/> : <Sparkles size={15}/>}Prepare guidance</button>
  </form>{error ? <p role="alert" className="mt-3 text-xs text-[#ad344e]">{error}</p> : null}{result ? <div className="mt-4 rounded-xl bg-[#f2f8f6] p-4"><p className="text-sm font-semibold">{result.headline}</p><p className="mt-2 text-xs leading-5 text-[#102c3d]/60">{result.explanation}</p>{result.clarificationQuestions.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[#102c3d]/60">{result.clarificationQuestions.map((question) => <li key={question}>{question}</li>)}</ul> : null}<p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b8075]">{result.source === "openai" ? "AI-assisted draft" : "Deterministic guidance"}</p></div> : null}</Section>;
}

function Priorities({ learner }: { learner: LearningTimeLearnerView }) { return <Section title="Learning priorities">{learner.priorities.length ? <div className="grid gap-2">{learner.priorities.map((priority) => <div key={priority.id} className="rounded-xl bg-[#f6f9f7] p-3"><p className="text-sm font-semibold">{priority.label}</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/55">{priority.description}</p>{priority.ksbReferences.length ? <p className="mt-2 text-[10px] font-semibold text-[#0b8075]">{priority.ksbReferences.join(" · ")}</p> : null}</div>)}</div> : <p className="text-sm text-[#102c3d]/55">No current learning priorities have been recorded.</p>}</Section>; }
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_12px_30px_rgba(16,44,61,0.04)] sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>{action}</div>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid gap-1.5 text-xs font-semibold text-[#102c3d]/65 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>; }
function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="bg-white/[0.055] p-4"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-white/50">{label}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f6f9f7] p-3"><p className="text-base font-semibold">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#102c3d]/40">{label}</p></div>; }
function DataRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 border-b border-[#102c3d]/[0.06] pb-2"><dt className="text-[#102c3d]/45">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>; }
function StatusPill({ value }: { value: string }) { return <span className="rounded-full bg-[#e9f5f1] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0b6f63]">{value}</span>; }
function MessageState({ title, copy, tone, onRetry }: { title: string; copy: string; tone: "error" | "success" | "neutral"; onRetry?: () => void }) { const classes = tone === "error" ? "border-[#ad344e]/15 bg-[#fff2f4] text-[#8c2940]" : tone === "success" ? "border-[#0b8075]/15 bg-[#edf8f4] text-[#0b6f63]" : "border-[#102c3d]/[0.08] bg-[#f6f9f7] text-[#102c3d]"; return <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 ${classes}`}><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 opacity-70">{copy}</p>{onRetry ? <button type="button" onClick={onRetry} className="mt-3 text-xs font-semibold underline">Try again</button> : null}</div>; }
function EmptyState({ role }: { role: string }) { return <MessageState title="No eligible learner records" copy={role === "Employee" ? "No active learner record is linked to this employee identity." : "No learner record is available within this role's organisation scope."} tone="neutral"/>; }
function LoadState() { return <div role="status" className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-[#102c3d]/[0.08] bg-white text-sm text-[#102c3d]/55"><LoaderCircle size={18} className="animate-spin"/>Loading Learning Time…</div>; }
function formatMinutes(value: number) { const hours = Math.floor(value / 60); const minutes = value % 60; return minutes ? `${hours}h ${minutes}m` : `${hours}h`; }
function formatDate(value: string) { if (!value) return "Not set"; return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00Z`)); }
function clientKey(prefix: string) { return `${prefix}:${crypto.randomUUID()}`; }
const inputClass = "min-h-11 w-full rounded-xl border border-[#102c3d]/[0.10] bg-white px-3 py-2 text-sm font-normal text-[#102c3d] outline-none transition focus:border-[#0b8075]/45 focus:ring-2 focus:ring-[#0b8075]/10";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:bg-[#17475a] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#102c3d]/[0.10] bg-white px-4 text-xs font-semibold text-[#102c3d] transition hover:bg-[#f6f9f7] disabled:cursor-not-allowed disabled:opacity-45";
