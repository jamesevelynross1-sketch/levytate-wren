"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import type { EmployerDeliveryWorkspace, ProviderDeliveryUpdateView } from "@/lib/levytate/provider-delivery";

export function EmployerProviderUpdatesPanel() {
  const [data,setData]=useState<EmployerDeliveryWorkspace|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function refresh() {
    const result=await fetch("/api/levytate-employer/provider-delivery",{cache:"no-store"});
    if(result.status===404){setData(null);return;}
    if(!result.ok)throw Error("Provider delivery updates are temporarily unavailable.");
    const body=await result.json() as {workspace:EmployerDeliveryWorkspace};
    setData(body.workspace);
  }
  useEffect(()=>{
    let active=true;
    void fetch("/api/levytate-employer/provider-delivery",{cache:"no-store"}).then(async result=>{
      if(result.status===404 || result.status===403 || result.status===401)return;
      if(!result.ok)throw Error("Provider delivery updates are temporarily unavailable.");
      const body=await result.json() as {workspace:EmployerDeliveryWorkspace};
      if(active)setData(body.workspace);
    }).catch(()=>{if(active)setError("Provider delivery updates are temporarily unavailable.");});
    return()=>{active=false;};
  },[]);

  async function action(value:Record<string,unknown>) {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/levytate-employer/provider-delivery",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value),
      });
      const body=await response.json() as {message?:string;workspace?:EmployerDeliveryWorkspace};
      if(!response.ok||!body.workspace)throw Error(body.message??"The update could not be confirmed.");
      setData(body.workspace);
    }catch(ex){setError(ex instanceof Error?ex.message:"The update could not be confirmed.");}
    finally{setBusy(false);}
  }
  if(!data&&!error)return null;
  const pending=data?.updates.filter(item=>item.status==="pending")??[];
  const accepted=data?.updates.filter(item=>item.status==="accepted")??[];
  return <section data-testid="employer-provider-delivery" className="mb-6 rounded-2xl border border-[#102c3d]/10 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0b776e]"><ShieldCheck size={16}/> Core provider collaboration</p>
        <h2 className="mt-2 text-xl font-semibold">Provider delivery updates</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#102c3d]/60">Grant access to selected providers. Reports appear here for your review, with sources and dates. They never automatically overwrite learner or programme records.</p></div>
      <button type="button" disabled={busy} onClick={()=>void refresh().catch(()=>setError("Could not refresh provider reports."))}
        aria-label="Refresh provider reports" className="grid h-11 w-11 place-items-center rounded-xl border border-[#102c3d]/10"><RefreshCw size={17}/></button>
    </div>
    {error?<p role="alert" className="mt-4 text-sm font-semibold text-[#af3452]">{error}</p>:null}
    {data?<div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.grants.map(grant=><div key={grant.providerId} className="rounded-xl border border-[#102c3d]/10 bg-[#fafcfb] p-4">
        <p className="font-semibold">{grant.providerName}</p>
        <p className="mt-1 text-xs text-[#102c3d]/55">{grant.enabled?"Provider can view assigned active learners and programmes":"No learner information shared"}</p>
        <button type="button" disabled={busy}
          onClick={()=>{if(window.confirm(grant.enabled?"Revoke this provider's access immediately? Historical reports remain.":"Share assigned active learner identities and programme data with this provider for progress reporting?"))void action({action:"grant",providerId:grant.providerId,enabled:!grant.enabled})}}
          className={`mt-3 min-h-11 rounded-full px-4 text-xs font-semibold ${grant.enabled?"border border-[#a73b52]/30 text-[#a73b52]":"bg-[#102c3d] text-white"}`}>
          {grant.enabled?"Revoke access":"Grant delivery access"}
        </button>
      </div>)}</div>
      <div><h3 className="text-base font-semibold">Awaiting your review ({pending.length})</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">{pending.length?pending.slice(0,40).map(update=><ReportCard key={update.id} update={update} providerName={data.grants.find(g=>g.providerId===update.providerId)?.providerName??"Provider"}>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={()=>void action({action:"review",updateId:update.id,decision:"accepted"})} className="min-h-11 rounded-full bg-[#eaf5f1] px-4 text-xs font-semibold text-[#087c73]">Accept report</button>
            <button type="button" disabled={busy} onClick={()=>void action({action:"review",updateId:update.id,decision:"rejected"})} className="min-h-11 rounded-full border border-[#ad344e]/20 px-4 text-xs font-semibold text-[#ad344e]">Reject report</button>
          </div>
        </ReportCard>):<p className="text-sm text-[#102c3d]/55">No submissions need review.</p>}</div>
      </div>
      {accepted.length?<div><h3 className="flex items-center gap-2 text-base font-semibold"><CheckCircle2 size={18} className="text-[#0b776e]"/> Recent accepted provider evidence</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">{accepted.slice(0,12).map(update=><ReportCard key={update.id} update={update} providerName={data.grants.find(g=>g.providerId===update.providerId)?.providerName??"Provider"}/>)}</div>
      </div>:null}
    </div>:null}
  </section>;
}
function ReportCard({update,providerName,children}:{update:ProviderDeliveryUpdateView;providerName:string;children?:React.ReactNode}) {
  const text=update.kind==="learner_progress"
    ? "summary" in update.payload?update.payload.summary:""
    : "deliveryNote" in update.payload?update.payload.deliveryNote:"";
  return <article className="rounded-xl border border-[#102c3d]/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold text-[#102c3d]/55">{providerName} · {update.kind==="learner_progress"?"Learner":"Programme"} report</p>
      <span className="rounded-full bg-[#f2f5f3] px-2 py-1 text-xs capitalize">{update.status}</span>
    </div>
    <p className="mt-2 text-sm font-semibold">Source date: {update.reportDate}</p>
    <p className="mt-2 text-sm leading-6 text-[#102c3d]/75">{text}</p>
    {update.kind==="learner_progress"&&"actualProgressPercentage" in update.payload
      ? <p className="mt-2 text-xs text-[#102c3d]/60">Provider-reported actual progress: {update.payload.actualProgressPercentage}% · not an official progression decision</p>:null}
    <p className="mt-2 text-[11px] text-[#102c3d]/45">Received {new Date(update.submittedAt).toLocaleDateString("en-GB")}</p>
    {children}
  </article>;
}
