"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedClientFetch } from "@/lib/levytate/client-session";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import { availablePersonalProgrammes, ownDevelopmentPerson, personalProgrammeChoices, type PersonalProgrammeChoices } from "@/lib/levytate/mvp/programme-discovery";
import { createMvpId, nowIso, type MvpApplication } from "@/lib/levytate/mvp/workspace";
import { employeeCurrentApplication } from "@/lib/levytate/mvp/workspace-insights";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { MvpModal, MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { EmployeeEligibilityPanel } from "@/components/levytate-mvp/EmployeeEligibilityPanel";

const endpoint = "/api/levytate-programme-discovery";
const button = "min-h-11 rounded-xl border border-[#102c3d]/20 px-4 py-2 text-sm font-semibold disabled:opacity-50";
type ChoiceCommand = { action: "save" | "unsave" | "compare" | "uncompare"; programmeId: string; requestId: string; expectedRevision: number };

export function PersonalProgrammeDiscovery({ onNavigate }: { onNavigate: (target: "My Application" | "Copilot") => void }) {
  const { data, meta, saveApplication } = useMvpWorkspace();
  const identity = useRef(meta?.userEmail ? { email: meta.userEmail, organisationId: meta.organisationId } : undefined);
  const person = ownDevelopmentPerson(data, identity.current?.email ?? "");
  const active = person ? employeeCurrentApplication(data, person.id) : null;
  const learnerRecords = data.learnerRecords.filter((record) => record.employeeId === person?.id);
  const applicationHistory = data.applications.filter((application) => application.employeeId === person?.id && application.id !== active?.id && !learnerRecords.some((record) => record.applicationId === application.id));
  const [choices, setChoices] = useState<PersonalProgrammeChoices | null>(null);
  const programmes = availablePersonalProgrammes(data, identity.current?.email ?? "", choices?.availableProgrammeIds ?? []);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [savedOnly, setSavedOnly] = useState(false), [detail, setDetail] = useState<string | null>(null);
  const pending = useRef<ChoiceCommand | null>(null), pendingApplication = useRef<MvpApplication | null>(null), working = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const request = useCallback((init?: RequestInit) => {
    if (!identity.current) throw new Error("Reload to verify your individual account.");
    return authenticatedClientFetch(endpoint, init, identity.current);
  }, []);
  const readChoices = useCallback(async () => {
    const response = await request(); const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Saved programme choices are unavailable.");
    return personalProgrammeChoices.parse(body.choices);
  }, [request]);
  useEffect(() => { let cancelled = false;
    void readChoices().then((value) => { if (!cancelled) setChoices(value); }).catch(() => { if (!cancelled) setError("Your saved choices could not be loaded. Reconnect before saving or comparing."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [readChoices]);

  async function saveChoice(command?: ChoiceCommand) {
    if (working.current || pendingApplication.current || (!pending.current && !command)) return;
    pending.current ??= command!; working.current = true; setBusy(true); setError("");
    try {
      const response = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.current) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || "The change was not confirmed.");
      const next = personalProgrammeChoices.parse(body.choices);
      if (next.employeeId !== person?.id) throw new Error("Account changed. Reload before continuing.");
      setChoices(next); pending.current = null; setUncertain(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The change was not confirmed. Retry the original request."); setUncertain(true); }
    finally { working.current = false; setBusy(false); }
  }
  async function startApplication(standardId?: string) {
    if (working.current || pending.current || !person || (!pendingApplication.current && (!standardId || active))) return;
    const now = nowIso();
    pendingApplication.current ??= { id: createMvpId("application"), employeeId: person.id, apprenticeshipStandardId: standardId!, status: "Draft", currentOwner: "Employee", reason: "", careerGoal: "", supportRequired: "", managerNote: "", submittedAt: now, updatedAt: now, history: [], revision: 0 };
    working.current = true; setBusy(true); setError("");
    try {
      const result = await saveApplication(pendingApplication.current);
      if (!result.ok) throw new Error(result.message);
      pendingApplication.current = null; setUncertain(false); setDetail(null); onNavigate("My Application");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your draft was not confirmed. Retry the original request."); setUncertain(true); setDetail(null); }
    finally { working.current = false; setBusy(false); }
  }
  async function inspectChoices() {
    if (working.current) return;
    if (pendingApplication.current) { window.location.reload(); return; }
    setLoading(true); setError("");
    try { const next = await readChoices(); if (next.employeeId !== person?.id) throw new Error(); setChoices(next); pending.current = null; setUncertain(false); }
    catch { setError("Saved choices could not be confirmed. Keep the original request and retry when service returns."); }
    finally { setLoading(false); }
  }
  const locked = busy || uncertain || loading || !choices || choices.employeeId !== person?.id;
  const compare = programmes.filter((item) => choices?.comparedProgrammeIds.includes(item.programme.id));
  const visible = programmes.filter(({ programme, provider }) => (!savedOnly || choices?.savedProgrammeIds.includes(programme.id)) && `${programme.programmeName} ${provider.providerName} ${programme.linkedStandardName}`.toLowerCase().includes(query.toLowerCase().trim()));
  const selected = programmes.find((item) => item.programme.id === detail);
  const change = (action: ChoiceCommand["action"], programmeId: string) => { if (!locked && choices) void saveChoice({ action, programmeId, requestId: crypto.randomUUID(), expectedRevision: choices.revision }); };
  const unavailableSaved = choices?.savedProgrammeIds.filter((id) => !programmes.some((item) => item.programme.id === id)) ?? [];
  const unavailableCompared = choices?.comparedProgrammeIds.filter((id) => !programmes.some((item) => item.programme.id === id)) ?? [];

  if (!person) return <MvpPanel title="Your development" eyebrow="Individual account"><p>Your account needs exactly one active People record. Ask your Apprenticeship Lead to check the linkage.</p></MvpPanel>;
  return <div className="grid min-w-0 gap-5">
    {learnerRecords.filter((record) => record.recordStatus === "Active" && record.lifecycleStatus === "pre_enrolment").map((record) => <EmployeeEligibilityPanel key={record.id} learnerId={record.id} />)}
    {learnerRecords.length || applicationHistory.length ? <MvpPanel title="Your recorded journey" eyebrow="Current and previous development"><p className="mb-3 text-sm leading-6">Your existing records remain here when your employer changes its published programme choices.</p><div className="grid gap-3">{learnerRecords.map((record) => {
      const programme = data.providerProgrammes.find((item) => item.id === record.programmeId && item.providerId === record.providerId);
      const provider = data.providers.find((item) => item.providerId === record.providerId);
      const application = data.applications.find((item) => item.id === record.applicationId && item.employeeId === person.id);
      const archived = record.recordStatus === "Archived";
      const previous = ["withdrawn", "achieved", "completed_without_achievement"].includes(record.lifecycleStatus);
      return <article key={record.id} className="rounded-xl border border-[#102c3d]/15 p-4"><p className="mb-1 text-xs font-semibold text-[#102c3d]/60">{archived ? "Archived programme record" : previous ? "Previous programme record" : "Current programme record"}</p><h3 className="font-semibold">{programme?.programmeName || (application ? getApprenticeshipStandard(application.apprenticeshipStandardId)?.title : null) || "Recorded apprenticeship"}</h3><dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">{archived ? "Last recorded status" : "Programme status"}</dt><dd>{record.lifecycleStatus.replaceAll("_", " ")}</dd></div><div><dt className="font-semibold">Provider</dt><dd>{provider?.providerName || (record.providerId ? "Provider no longer in the current catalogue" : "Not yet confirmed")}</dd></div><div><dt className="font-semibold">Start date</dt><dd>{record.actualStartDate || record.expectedStartDate || "Not recorded"}</dd></div><div><dt className="font-semibold">End date</dt><dd>{record.actualEndDate || record.expectedEndDate || "Not recorded"}</dd></div></dl></article>;
    })}{applicationHistory.map((application) => <article key={application.id} className="rounded-xl border border-[#102c3d]/15 p-4"><h3 className="font-semibold">{getApprenticeshipStandard(application.apprenticeshipStandardId)?.title || "Previous apprenticeship application"}</h3><p className="mt-1 text-sm">{application.status}</p><p className="mt-1 text-sm">{application.history.at(-1)?.note || "No decision note recorded."}</p></article>)}</div></MvpPanel> : null}
    <MvpPanel title="Explore your programmes" eyebrow={meta?.userRole === "Line Manager" ? "Your own development · separate from your team" : "Your own development"}>
      <p className="text-sm leading-6 text-[#102c3d]/70">Browse programmes published by your employer, save options and compare their recorded details. A role mapping confirms which pathways you may apply for; your manager reviews fit before enrolment.</p>
      {active ? <div className="mt-4 rounded-xl bg-[#eef8f4] p-4 text-sm"><p>You already have an active application. You can keep exploring, saving and comparing.</p><button className={`${button} mt-2`} onClick={() => onNavigate("My Application")}>Open my application</button></div> : null}
      <div className="mt-4 flex flex-wrap items-end gap-3"><label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">Search programmes<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 rounded-xl border border-[#102c3d]/20 px-3" /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} />Saved only</label><button className={button} disabled={busy || loading} onClick={() => void inspectChoices()}>Refresh saved choices</button></div>
      {loading ? <p role="status" className="mt-3 text-sm">Loading your saved choices…</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}
      {uncertain ? <div role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><p>The original change is retained. Inspect saved state before editing or retry it unchanged.</p><div className="mt-2 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void (pendingApplication.current ? startApplication() : saveChoice())}>Retry original change</button><button className={button} disabled={busy || loading} onClick={() => void inspectChoices()}>Inspect saved state</button></div></div> : null}
    </MvpPanel>
    {choices && visible.length ? <div className="grid min-w-0 gap-4 lg:grid-cols-2">{visible.map(({ programme, provider, mapping }) => <article key={programme.id} className="min-w-0 rounded-2xl border border-[#102c3d]/10 bg-white p-5">
      <div className="flex flex-wrap gap-2"><StatusBadge tone={mapping ? "green" : "blue"}>{mapping ? "Mapped to your role" : "Discuss role fit"}</StatusBadge><StatusBadge tone="blue">{programme.level ? `Level ${programme.level}` : "Level not recorded"}</StatusBadge></div>
      <h3 className="mt-3 text-lg font-semibold">{programme.programmeName}</h3><p className="mt-1 text-sm">{provider.providerName}</p><p className="mt-3 text-sm leading-6 text-[#102c3d]/70">{programme.shortDescription || "Open the published programme details to review delivery and requirements."}</p>
      <p className="mt-2 text-sm text-[#102c3d]/70">{programme.deliveryModels.join(", ") || "Delivery not recorded"} · {programme.duration || "Duration not recorded"}</p>
      <div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={() => setDetail(programme.id)}>View {programme.programmeName}</button><button className={button} disabled={locked} aria-pressed={choices?.savedProgrammeIds.includes(programme.id) ?? false} onClick={() => change(choices?.savedProgrammeIds.includes(programme.id) ? "unsave" : "save", programme.id)}>{choices?.savedProgrammeIds.includes(programme.id) ? "Remove saved programme" : "Save programme"}</button><button className={button} disabled={locked || (!choices?.comparedProgrammeIds.includes(programme.id) && (choices?.comparedProgrammeIds.length ?? 0) >= 3)} aria-pressed={choices?.comparedProgrammeIds.includes(programme.id) ?? false} onClick={() => change(choices?.comparedProgrammeIds.includes(programme.id) ? "uncompare" : "compare", programme.id)}>{choices?.comparedProgrammeIds.includes(programme.id) ? "Remove comparison" : "Compare programme"}</button></div>
    </article>)}</div> : choices ? <MvpPanel title={programmes.length ? "No matching programmes" : "No programmes published"}><p className="text-sm">{programmes.length ? "Change your search or saved-only filter." : "Your Apprenticeship Lead needs to publish a verified provider and programme before you can apply."}</p></MvpPanel> : null}
    {compare.length ? <MvpPanel title="Your programme comparison" eyebrow="Published facts · up to three options"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left text-sm text-[#102c3d]/70">Missing details are shown explicitly. Funding and eligibility require confirmation.</caption><thead><tr><th scope="col" className="p-3">Detail</th>{compare.map(({ programme }) => <th key={programme.id} scope="col" className="p-3">{programme.programmeName}</th>)}</tr></thead><tbody>{["Provider", "Level", "Delivery", "Duration", "Funding route", "Role fit"].map((label, index) => <tr key={label} className="border-t border-[#102c3d]/10"><th scope="row" className="p-3">{label}</th>{compare.map(({ programme, provider, mapping }) => <td key={programme.id} className="p-3 align-top">{[provider.providerName, programme.level ? `Level ${programme.level}` : "Not recorded", programme.deliveryModels.join(", ") || "Not recorded", programme.duration || "Not recorded", programme.fundingRoute || "Confirm with your Lead", mapping ? "Mapped to your role" : "Discuss with your Lead"][index]}</td>)}</tr>)}</tbody></table></div></MvpPanel> : null}
    {unavailableSaved.length || unavailableCompared.length ? <MvpPanel title="Unavailable saved options"><p className="text-sm">Your employer has withdrawn or changed these options. They cannot be used to start an application.</p><div className="mt-3 grid gap-2">{[...new Set([...unavailableSaved, ...unavailableCompared])].map((id, index) => <div key={id} className="flex flex-wrap items-center gap-2"><span className="text-sm">Unavailable option {index + 1}</span>{unavailableSaved.includes(id) ? <button className={button} disabled={locked} onClick={() => change("unsave", id)}>Remove saved option</button> : null}{unavailableCompared.includes(id) ? <button className={button} disabled={locked} onClick={() => change("uncompare", id)}>Remove unavailable comparison</button> : null}</div>)}</div></MvpPanel> : null}
    {selected ? <MvpModal title={selected.programme.programmeName} eyebrow={selected.provider.providerName} onClose={() => { if (!busy) setDetail(null); }}><div className="grid gap-4 text-sm leading-6"><p>{selected.programme.fullDescription || selected.programme.shortDescription || "No detailed description has been published."}</p><p><strong>Skills:</strong> {selected.programme.skillsDeveloped.join(", ") || "Not recorded"}</p><p><strong>Expected outcomes:</strong> {selected.programme.expectedOutcomes.join(", ") || "Not recorded"}</p><p><strong>Role fit:</strong> {selected.mapping?.businessRationale || (selected.mapping ? "This pathway is mapped to your assigned role." : "Ask your Apprenticeship Lead to review role fit before applying.")}</p><p>Applications follow the apprenticeship pathway. The exact provider and programme are confirmed in pre-enrolment after approval.</p><div className="flex flex-wrap gap-2"><button className={`${button} bg-[#102c3d] text-white`} disabled={locked || Boolean(active) || !selected.mapping} onClick={() => void startApplication(selected.mapping?.apprenticeshipStandardId)}>{active ? "One application is already active" : "Start pathway application"}</button><button className={button} onClick={() => onNavigate("Copilot")}>Ask LevyTate Copilot</button></div></div></MvpModal> : null}
  </div>;
}
