"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import type { ProviderDeliverySubmission, ProviderDeliveryWorkspace as Workspace } from "@/lib/levytate/provider-delivery";

export function ProviderDeliveryWorkspace({initialWorkspace,opportunitiesAvailable}:{
  initialWorkspace:Workspace;opportunitiesAvailable:boolean;
}){
  const [workspace,setWorkspace]=useState(initialWorkspace);
  const [employerId,setEmployerId]=useState(initialWorkspace.employers[0]?.id??"");
  const [kind,setKind]=useState<"learner_progress"|"programme_note">("learner_progress");
  const [targetId,setTargetId]=useState("");
  const [reportDate,setReportDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [percentage,setPercentage]=useState("0");
  const [summary,setSummary]=useState("");
  const [nextReviewDate,setNextReviewDate]=useState("");
  const [capacityStatus,setCapacityStatus]=useState<"available"|"limited"|"unavailable"|"unknown">("unknown");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [retained,setRetained]=useState<ProviderDeliverySubmission|null>(null);
  const employer=workspace.employers.find(item=>item.id===employerId);
  const options=useMemo(()=>kind==="learner_progress"
    ? (employer?.learners??[]).map(item=>({id:item.id,label:`${item.name} · ${item.programmeName}`}))
    : (employer?.programmes??[]).map(item=>({id:item.id,label:item.name})),[employer,kind]);
  const recent=employer?.updates??[];

  async function refresh(){
    const response=await fetch("/api/levytate-provider/delivery",{cache:"no-store"});
    if(!response.ok)throw Error("Workspace unavailable");
    const body=await response.json() as {workspace:Workspace};
    setWorkspace(body.workspace);
    return body.workspace;
  }
  async function submit(update:ProviderDeliverySubmission){
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/levytate-provider/delivery",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(update),
      });
      const body=await response.json() as {message?:string};
      if(!response.ok)throw Error(body.message||"Your update could not be confirmed.");
      setRetained(null);setTargetId("");setSummary("");setNextReviewDate("");setPercentage("0");
      setMessage("Update submitted for employer review. It has not changed the learner or programme record.");
      try { await refresh(); } catch { setError("Submission saved, but the list could not refresh. Reload to see the latest status."); }
    }catch(ex){
      setError(ex instanceof Error ? ex.message : "Could not confirm this update.");
    }finally{setBusy(false);}
  }
  function handleSubmit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!employer||!targetId||!summary.trim()||busy)return;
    const base={organisationId:employer.id,targetId,idempotencyKey:crypto.randomUUID()};
    const update:ProviderDeliverySubmission=kind==="learner_progress"
      ? {...base,kind,payload:{reportDate,actualProgressPercentage:Number(percentage),summary:summary.trim(),
        ...(nextReviewDate?{nextReviewDate}:{})}}
      : {...base,kind,payload:{reportDate,deliveryNote:summary.trim(),capacityStatus}};
    setRetained(update);
    void submit(update);
  }
  function resetDraft(){
    setRetained(null);setMessage("");setError("");
    setTargetId("");setSummary("");setNextReviewDate("");setPercentage("0");
  }
  return <main className="lt-design min-h-screen bg-lt-canvas text-lt-ink">
    <header className="lt-topbar">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <LevyTateLogo className="[--levytate-logo-size:2.3rem]" />
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          {opportunitiesAvailable?<Link href="/levytate/provider" className="flex min-h-11 items-center gap-2 text-lt-accent"><ArrowLeft size={15}/> Opportunities</Link>:null}
          <span className="rounded-full bg-[#eaf5f1] px-3 py-2 text-lt-accent">Delivery updates</span>
          <form action="/api/levytate-provider/logout" method="post"><button type="submit" className="min-h-11 rounded-full border border-[#102c3d]/15 px-3 text-lt-secondary">Sign out</button></form>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-8">
      <header><p className="text-xs font-bold uppercase tracking-[0.14em] text-lt-accent">Provider workspace · {workspace.provider.name}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Programme & learner updates</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-lt-muted">Share delivery evidence with employers who have granted access. Every update is attributed, time-stamped and reviewed by the employer. No compliance record changes automatically.</p>
      </header>
      <label className="block max-w-lg text-sm font-semibold" htmlFor="delivery-employer">Employer
        <select id="delivery-employer" value={employerId} disabled={busy||Boolean(retained)}
          onChange={event=>{setEmployerId(event.target.value);resetDraft()}}
          className="mt-2 block min-h-12 w-full rounded-xl border border-[#102c3d]/15 bg-white px-3 text-sm">
          {workspace.employers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {employer?<div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#102c3d]/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2"><ClipboardList className="text-lt-accent" size={20}/><h2 className="text-xl font-semibold">Submit an update</h2></div>
          <p className="mt-2 text-sm leading-6 text-lt-muted">Choose the employer-approved record and supply a concise, factual update.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <fieldset disabled={busy||Boolean(retained)} className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold">Update type</legend>
              {([["learner_progress","Learner progress"],["programme_note","Programme delivery"]] as const).map(([value,label])=>
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#102c3d]/10 px-3 text-sm">
                  <input type="radio" name="kind" checked={kind===value} onChange={()=>{setKind(value);setTargetId("");setError("")}}/>{label}
                </label>)}
            </fieldset>
            <label htmlFor="delivery-target" className="block text-sm font-semibold">Record
              <select id="delivery-target" value={targetId} disabled={busy||Boolean(retained)} required
                onChange={event=>setTargetId(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-[#102c3d]/15 px-3 text-sm">
                <option value="">Choose {kind==="learner_progress"?"an assigned learner":"a selected programme"}</option>
                {options.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {!options.length?<p className="text-xs text-[#ac4a4a]">No active {kind==="learner_progress"?"assigned learners":"selected programmes"} have been shared for this employer.</p>:null}
            <label htmlFor="delivery-date" className="block text-sm font-semibold">Date of evidence
              <input id="delivery-date" type="date" value={reportDate} required disabled={busy||Boolean(retained)}
                onChange={event=>setReportDate(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-[#102c3d]/15 px-3 text-sm"/>
            </label>
            {kind==="learner_progress"?<div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor="delivery-progress" className="block text-sm font-semibold">Actual progress (%)
                <input id="delivery-progress" type="number" min="0" max="100" step="1" value={percentage} required disabled={busy||Boolean(retained)}
                  onChange={event=>setPercentage(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-[#102c3d]/15 px-3 text-sm"/>
              </label>
              <label htmlFor="delivery-next-review" className="block text-sm font-semibold">Next review (optional)
                <input id="delivery-next-review" type="date" min={reportDate} value={nextReviewDate} disabled={busy||Boolean(retained)}
                  onChange={event=>setNextReviewDate(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-[#102c3d]/15 px-3 text-sm"/>
              </label>
            </div>:<label htmlFor="delivery-capacity" className="block text-sm font-semibold">Capacity outlook
              <select id="delivery-capacity" value={capacityStatus} disabled={busy||Boolean(retained)}
                onChange={event=>setCapacityStatus(event.target.value as typeof capacityStatus)} className="mt-2 block min-h-12 w-full rounded-xl border border-[#102c3d]/15 px-3 text-sm">
                <option value="unknown">To confirm</option><option value="available">Available</option>
                <option value="limited">Limited</option><option value="unavailable">Not currently available</option>
              </select>
            </label>}
            <label htmlFor="delivery-summary" className="block text-sm font-semibold">{kind==="learner_progress"?"Progress evidence":"Programme delivery note"}
              <textarea id="delivery-summary" value={summary} required maxLength={1200} rows={4} disabled={busy||Boolean(retained)}
                onChange={event=>setSummary(event.target.value)} placeholder="What has changed, and what should the employer know?"
                className="mt-2 block w-full rounded-xl border border-[#102c3d]/15 p-3 text-sm"/>
            </label>
            {message?<p role="status" className="flex gap-2 text-sm font-semibold text-lt-accent"><CheckCircle2 size={18}/>{message}</p>:null}
            {error?<p role="alert" className="text-sm font-semibold text-[#a63348]">{error}</p>:null}
            {retained?<div className="rounded-xl bg-[#fff6e8] p-4 text-sm">
              <p>Submission status is uncertain. The original update has been retained unchanged to prevent duplicates.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={()=>void submit(retained)} className="min-h-11 rounded-full bg-[#102c3d] px-4 font-semibold text-white">Retry original update</button>
                <button type="button" disabled={busy} onClick={()=>{void refresh().then(updated=>{
                  const found=updated.employers.flatMap(item=>item.updates).some(item=>item.requestKey===retained.idempotencyKey);
                  if(found){setRetained(null);setMessage("Original update found in the employer review queue.");}
                  else setError("No matching receipt yet. Retry the original update; do not create a duplicate.");
                }).catch(()=>setError("Unable to reconcile status; try again."))}} className="min-h-11 rounded-full border px-4">Check current status</button>
              </div>
            </div>:<button type="submit" disabled={busy||!targetId||!summary.trim()} className="min-h-12 rounded-full bg-[#102c3d] px-6 text-sm font-semibold text-white disabled:opacity-40">{busy?"Submitting…":"Submit for employer review"}</button>}
          </form>
        </section>
        <section className="rounded-2xl border border-[#102c3d]/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Submission history</h2>
            <button type="button" aria-label="Refresh submissions" onClick={()=>void refresh().catch(()=>setError("Could not refresh updates."))}
              className="grid h-11 w-11 place-items-center rounded-xl border border-[#102c3d]/10"><RefreshCw size={17}/></button></div>
          <p className="mt-2 text-sm text-lt-muted">Source: {employer.name}. Employer-approved learner progress reports become official learner progress entries; programme notes remain separate evidence.</p>
          <div className="mt-5 space-y-3">{recent.length?recent.slice(0,30).map(item=><article key={item.id} className="rounded-xl border border-[#102c3d]/10 p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-lt-muted">{item.kind==="learner_progress"?"Learner progress":"Programme delivery"} · {item.reportDate}</span>
              <span className="rounded-full bg-[#f2f5f3] px-2 py-1 text-xs font-semibold capitalize">{item.status}</span></div>
            <p className="mt-2 text-sm leading-6">{item.kind==="learner_progress"?"summary" in item.payload?item.payload.summary:"":"deliveryNote" in item.payload?item.payload.deliveryNote:""}</p>
            <p className="mt-2 text-xs text-lt-muted">{item.promotedProgressId?"Included in official learner progress":item.status==="pending"?"Awaiting employer review":`Employer ${item.status}`}</p>
          </article>):<p className="rounded-xl border border-dashed border-[#102c3d]/15 p-5 text-sm text-lt-muted">No delivery updates submitted yet.</p>}</div>
        </section>
      </div>:<p role="alert">No authorised employer is currently available.</p>}
    </div>
  </main>;
}
