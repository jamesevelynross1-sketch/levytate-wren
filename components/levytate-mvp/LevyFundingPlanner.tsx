"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { decodePlannerFile } from "@/lib/levytate/finance/levy-planner-file";
import { CalendarDays, ChevronDown, Download, Plus, Trash2, SlidersHorizontal, Upload, Pencil, X, Check } from "lucide-react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { useLevyTateStandards } from "@/components/levytate-mvp/LevyTateStandardsProvider";
import { formatGbp, monthLabel } from "@/lib/levytate/finance/calculations";
import type { LevyFinanceSummary } from "@/lib/levytate/finance/types";
import { addMonths, cohortEligibility, expiryMonth, forecastLevy, fundingRuleVersion, fundingSources, validatePlanner, type PlannedCohort, type PlannerInputs } from "@/lib/levytate/finance/levy-planner";
import { initialPlanFromEvidence, reconcileImportedEvidence, applyLatestDasEvidence } from "@/lib/levytate/finance/levy-planner-evidence";

const fieldClass="lt-control h-11 w-full min-w-0 px-3 text-sm focus:outline-none";
const panelClass="lt-panel p-4 sm:p-5";
const buttonClass="lt-button lt-primary";
const subtleClass="lt-button lt-secondary";
const gbp=(p:number)=>Number.isFinite(p)?formatGbp(p):"—";
const todayMonth=()=>new Date().toISOString().slice(0,7);
const scrollBehaviour=():ScrollBehavior=>window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth";

function Field({label,children}:{label:string;children:ReactNode}){return <label className="lt-label grid min-w-0 gap-1.5">{label}{children}</label>;}
function MoneyField({label,value,onChange}:{label:string;value:number;onChange:(p:number)=>void}) {return <Field label={label}><input className={fieldClass} type="number" min="0" max="1000000000" step="0.01" value={Number.isFinite(value)?value/100:""} onChange={e=>onChange(e.target.value===""?NaN:Math.round(Number(e.target.value)*100))}/></Field>;}
function NumberField({label,value,onChange,min,max}:{label:string;value:number;onChange:(n:number)=>void;min:number;max:number}) {return <Field label={label}><input className={fieldClass} type="number" min={min} max={max} step="1" value={Number.isFinite(value)?value:""} onChange={e=>onChange(e.target.value===""?NaN:Number(e.target.value))}/></Field>;}
function MonthField({label,value,onChange}:{label:string;value:string;onChange:(s:string)=>void}){return <Field label={label}><input className={fieldClass} type="month" value={value} onChange={e=>onChange(e.target.value)}/></Field>;}
function Metric({label,value,copy,tone=false}:{label:string;value:string;copy:string;tone?:boolean}){return <div className="min-w-0 border-b border-lt-border px-2 py-3 sm:px-3"><p className="text-xs font-semibold text-lt-muted">{label}</p><p className={`lt-finance-number mt-1 font-semibold tabular-nums ${tone?"text-lt-risk":"text-lt-ink"}`}>{value}</p><p className="mt-2 text-xs leading-5 text-lt-muted">{copy}</p></div>;}
function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
type SavedScenario={id:string;name:string;input:PlannerInputs};

export function LevyFundingPlanner({summary,actuals,importPanel,onChooseFile,uploadDisabled=false,dataMessage,refreshing=false}:{summary:LevyFinanceSummary;actuals?:ReactNode;importPanel?:ReactNode;onChooseFile?:(file?:File)=>void;uploadDisabled?:boolean;dataMessage?:string;refreshing?:boolean}) {
  const {data}=useMvpWorkspace();
  const {selectableStandards:standards,loading:standardsLoading}=useLevyTateStandards();
  const [plan,setPlan]=useState<PlannerInputs>(()=>initialPlanFromEvidence(summary,todayMonth()));
  const planWasEdited=useRef(false);
  const [editor,setEditor]=useState<PlannedCohort|null>(null);
  const [search,setSearch]=useState("");
  const [scenarioName,setScenarioName]=useState("Investment plan");
  const [saved,setSaved]=useState<SavedScenario[]>([]);
  const [message,setMessage]=useState("");
  const [confirmedOpening,setConfirmedOpening]=useState(false);
  const [showMonths,setShowMonths]=useState(false);
  const [selectedMonth,setSelectedMonth]=useState<string|null>(null);
  const [confirmedCommitments,setConfirmedCommitments]=useState(false);
  const [assumptionsOpen,setAssumptionsOpen]=useState(false);
  const editorRef=useRef<HTMLDivElement>(null);
  const assumptionRef=useRef<HTMLDivElement>(null);
  const programmeSearchRef=useRef<HTMLInputElement>(null);
  const scenarioRef=useRef<HTMLDetailsElement>(null);
  const historyRef=useRef<HTMLDetailsElement>(null);
  const evidenceKey=JSON.stringify([summary.currentBalance,summary.latestMonth,summary.monthly.length,summary.latest?.levyReceivedPence,summary.latest?.apprenticeshipSpendPence]);
  const [reviewedEvidence,setReviewedEvidence]=useState(evidenceKey);
  const previouslyLoadedEvidence=useRef(evidenceKey);
  const evidenceChanged=reviewedEvidence!==evidenceKey;
  // The Finance view may mount before its async DAS read or while an import is
  // previewed. On new evidence, repair only an untouched default plan.
  // Once anyone edits a plan, preserve all their assumptions until an explicit
  // "Apply latest DAS evidence" action, which itself retains their cohorts.
  useEffect(()=>{
    if(previouslyLoadedEvidence.current===evidenceKey)return;
    previouslyLoadedEvidence.current=evidenceKey;
    setConfirmedOpening(false);
    setConfirmedCommitments(false);
    const hasEdits=planWasEdited.current;
    if(!hasEdits){
      setPlan(previous=>reconcileImportedEvidence(previous,summary,todayMonth(),false).plan);
      setReviewedEvidence(evidenceKey);
      setMessage("Imported DAS figures are now the forecast starting point. Review the historic balance, future receipts and commitments before relying on the outlook.");
    }else{
      setMessage("New DAS evidence has arrived. Your custom forecast has been preserved until you choose to update its opening balance.");
    }
  },[evidenceKey,summary]);
  const liveLearners=data?.learnerRecords?.filter(r=>r.recordStatus==="Active" && !["withdrawn","achieved","completed_without_achievement","pre_enrolment"].includes(r.lifecycleStatus)).length??null;
  const approvedApplications=data?.applications?.filter(a=>a.status==="Approved for Enrolment").length??null;
  const patch=(change:Partial<PlannerInputs>)=>{
    planWasEdited.current=true;
    setPlan(p=>({...p,...change}));
  };
  function useLatestDasEvidence(){
    if(editor){
      setMessage("Finish or cancel the unsaved cohort edit before updating forecast evidence.");
      return;
    }
    if(plan.openingFunds.length&&!window.confirm("Replace the opening balance and clear the existing fund-age entries? Existing cohorts and commitments will be kept."))return;
    planWasEdited.current=true;
    setPlan(previous=>applyLatestDasEvidence(previous,summary,todayMonth()));
    setConfirmedOpening(false);
    setConfirmedCommitments(false);
    setReviewedEvidence(evidenceKey);
    setMessage("Latest recorded DAS balance applied. Please review future receipts and existing commitments. No cohort or transfer plan was removed.");
  }
  const draftPlan=useMemo(()=>editor?{...plan,cohorts:plan.cohorts.some(c=>c.id===editor.id)?plan.cohorts.map(c=>c.id===editor.id?editor:c):[...plan.cohorts,editor]}:plan,[plan,editor]);
  const draftErrors=useMemo(()=>editor?validatePlanner(draftPlan):[],[draftPlan,editor]);
  const canPreview=Boolean(editor&&editor.standardId&&!draftErrors.length);
  const displayedPlan=canPreview?draftPlan:plan;
  const errors=useMemo(()=>validatePlanner(plan),[plan]);
  const result=useMemo(()=>errors.length&&!canPreview?null:forecastLevy(displayedPlan),[displayedPlan,errors,canPreview]);
  const baseline=useMemo(()=>errors.length?null:forecastLevy(plan,false),[plan,errors]);
  const committed=useMemo(()=>errors.length?null:forecastLevy(plan),[plan,errors]);
  function updateCohort(id:string,change:Partial<PlannedCohort>){setEditor(c=>c?.id===id?{...c,...change}:c);}
  function newCohort(){
    if(plan.cohorts.length>=50||editor)return;
    const first=/^20\d\d-(0[1-9]|1[0-2])$/.test(plan.openingMonth)?addMonths(plan.openingMonth,1):todayMonth();
    const start=first>todayMonth()?first:todayMonth();
    setSearch("");
    setEditor({id:crypto.randomUUID(),name:`Cohort ${plan.cohorts.length+1}`,standardId:"",standardTitle:"",level:4,startMonth:start,learners:1,pricePence:0,bandPence:0,durationMonths:12,assessmentMonths:3,ageAtStart:25,exception:"none",route:"levy",fundingChecked:false,department:""});
    requestAnimationFrame(()=>{programmeSearchRef.current?.focus({preventScroll:true});programmeSearchRef.current?.scrollIntoView({block:"nearest",behavior:scrollBehaviour()});});
  }
  function openAssumptions(){
    setAssumptionsOpen(true);
    requestAnimationFrame(()=>assumptionRef.current?.scrollIntoView({block:"start",behavior:scrollBehaviour()}));
  }
  function openDisclosure(target:HTMLDetailsElement|null){if(!target)return;target.open=true;requestAnimationFrame(()=>target.scrollIntoView({block:"start",behavior:scrollBehaviour()}));}
  function acceptCohort(){
    if(!editor||!canPreview)return;
    const existing=plan.cohorts.some(c=>c.id===editor.id);
    patch({cohorts:existing?plan.cohorts.map(c=>c.id===editor.id?editor:c):[...plan.cohorts,editor]});
    setEditor(null);setSearch("");
  }
  function selectStandard(c:PlannedCohort,id:string){
    const s=standards.find(item=>item.id===id);
    if(!s){updateCohort(c.id,{standardId:"",standardTitle:"",fundingChecked:false});return;}
    const duration=String(s.typicalDuration??"").match(/(\d+(?:\.\d+)?)\s*(month|year)/i);
    const months=duration?Math.round(Number(duration[1])*(duration[2].toLowerCase()==="year"?12:1)):12;
    updateCohort(c.id,{standardId:s.referenceCode||s.id,standardTitle:s.title,level:s.level,bandPence:(s.fundingBand??0)*100,pricePence:(s.fundingBand??0)*100,durationMonths:Math.min(72,Math.max(8,months)),fundingChecked:false});
  }
  function saveScenario(){if(editor||errors.length||!scenarioName.trim()||saved.length>=20)return;planWasEdited.current=true;setSaved(s=>[...s,{id:crypto.randomUUID(),name:scenarioName.trim(),input:structuredClone(plan)}]);setMessage("Scenario saved for this Finance session. Export a copy to retain it after leaving Finance.");}
  async function importPlan(file?: File) {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size>512*1024) throw new Error("Choose a LevyTate plan JSON file under 512 KB.");
      const next=decodePlannerFile(JSON.parse(await file.text()));
      if(editor&&!window.confirm("Discard the unsaved cohort edit?"))return;planWasEdited.current=true;setPlan(next.plan);setScenarioName(next.scenarioName);setConfirmedOpening(false);setConfirmedCommitments(false);setReviewedEvidence(evidenceKey);setEditor(null);setMessage("Plan loaded. Reconfirm the opening balance, funding evidence and commitments before using it.");
    } catch(error){setMessage(error instanceof Error?error.message:"The plan could not be read.");}
  }
  function exportForecast(){if(editor||!result||!baseline)return;const header="Month,Opening balance GBP,Levy receipts GBP,Existing due GBP,Transfers due GBP,Unfunded transfers GBP,Proposed due GBP,Levy used GBP,Modelled expiry GBP,Existing employer cash GBP,Proposed employer cash GBP,Closing balance GBP,Baseline closing GBP,Unknown age GBP";const lines=result.rows.map((r,i)=>[r.month,...[r.opening,r.receipts,r.existingDue,r.transfersDue,r.transfersUnfunded,r.proposedDue,r.levyUsed,r.expired,r.existingCash,r.proposedCash,r.closing,baseline.rows[i].closing,r.unaged].map(v=>(v/100).toFixed(2))].join(","));download("levytate-forecast.csv",[header,...lines].join("\n"),"text/csv;charset=utf-8");}

  const c=editor;
  const selected=c?standards.find(s=>(s.referenceCode||s.id)===c.standardId):undefined;
  const filteredStandards=standards.filter(s=>s.id===selected?.id||`${s.title} ${s.referenceCode} Level ${s.level}`.toLowerCase().includes(search.trim().toLowerCase()));
  const providers=selected?(data?.providerProgrammes??[]).filter(p=>p.status==="Active"&&p.recordStatus==="Active"&&p.linkedStandardIds.includes(selected.id)).flatMap(p=>(data?.providers??[]).filter(v=>v.providerId===p.providerId&&v.status==="Active"&&v.verificationStatus==="verified").map(v=>v.providerName)):[];
  const eligibility=c?cohortEligibility(c):null;
  const stale=summary.currentBalance.asOf&&summary.currentBalance.asOf.slice(0,7)<addMonths(todayMonth(),-1);
  const outsideRules=(result?.rows.at(-1)?.month??"")>"2027-07"||displayedPlan.cohorts.some(c=>cohortEligibility(c).provisional);
  const unresolved=displayedPlan.cohorts.filter(c=>c.route==="levy"&&!cohortEligibility(c).eligible).length;
  const totalStarts=displayedPlan.cohorts.reduce((n,c)=>n+c.learners,0);
  const contractValue=displayedPlan.cohorts.reduce((n,c)=>n+c.pricePence*c.learners,0);
  const actualBalance=summary.currentBalance.amountPence;
  const selectedForecastMonth=result?.rows.find(r=>r.month===selectedMonth)??result?.rows.at(-1);
  const asOf=summary.currentBalance.asOf;
  const unaged=plan.openingPence-plan.openingFunds.reduce((n,f)=>n+f.amountPence,0);
  return <div className="lt-finance-frame grid min-w-0 gap-4" data-testid="levy-funding-planner">
    <section className="lt-hero px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8fe0d2]">Levy position · Funding and investment</p><h2 className="mt-1 text-2xl font-semibold">Plan your next investment</h2><p className="mt-1 text-sm text-white/65">See your funding, plan new starts and understand the impact in one place.</p></div>
        <div className="flex flex-wrap gap-2">{actuals?<button type="button" className="inline-flex min-h-10 items-center rounded-lg border border-white/20 px-3 text-xs font-semibold text-white" onClick={()=>openDisclosure(historyRef.current)}>DAS history</button>:null}<button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-semibold text-white" onClick={openAssumptions}><SlidersHorizontal size={15}/> Assumptions</button>{onChooseFile?<label className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-semibold ${uploadDisabled?"opacity-50":"cursor-pointer"}`}><Upload size={15}/> Update DAS<input aria-label="Update DAS CSV" type="file" accept=".csv,text/csv" className="sr-only" disabled={uploadDisabled} onChange={e=>{const file=e.target.files?.[0];e.target.value="";onChooseFile(file);}}/></label>:null}<button type="button" onClick={newCohort} disabled={Boolean(editor)||plan.cohorts.length>=50} className="lt-button lt-hero-action disabled:opacity-60"><Plus size={16}/> Plan a cohort</button></div>
      </div>
      <div className="mt-4 grid gap-3 border-t border-white/15 pt-4 sm:grid-cols-3">
        <div><p className="text-xs text-white/65">Latest evidenced DAS balance</p><p className="mt-1 text-3xl font-semibold tabular-nums">{actualBalance===undefined?"Not available":gbp(actualBalance)}</p><p className="mt-1 text-xs text-white/65">{asOf?`Evidence: ${asOf}`:"Import DAS data to begin"}{stale?" · historical":""}</p></div>
        <div><p className="text-xs text-white/65">Last reported monthly receipts</p><p className="mt-1 text-xl font-semibold tabular-nums">{summary.latest?gbp(summary.latest.levyReceivedPence):"—"}</p><p className="mt-1 text-xs text-white/65">{summary.latestMonth?monthLabel(summary.latestMonth):"No data imported"}</p></div>
        <div><p className="text-xs text-white/65">Last reported monthly spend</p><p className="mt-1 text-xl font-semibold tabular-nums">{summary.latest?gbp(summary.latest.apprenticeshipSpendPence):"—"}</p><p className="mt-1 text-xs text-white/65">Actual DAS transactions</p></div>
      </div>
    </section>
    {refreshing?<p role="status" className="text-xs text-lt-muted">Refreshing DAS evidence. Showing the last loaded values.</p>:null}
    {dataMessage&&!importPanel?<p role="alert" className="rounded-lg border border-[#ad344e]/20 bg-[#fff2f4] p-3 text-xs text-lt-risk">{dataMessage}</p>:null}
    {importPanel?<section aria-label="DAS import preview" className="min-w-0">{importPanel}</section>:null}
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e6b74a]/30 bg-[#fffaf0] px-4 py-3 text-xs leading-5">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Planning estimates · {evidenceChanged?"New DAS evidence needs review":!confirmedOpening||!confirmedCommitments?"Review assumptions":unaged>0?"Fund ages incomplete":"Review before committing"}</p>
        <p className="mt-0.5 text-lt-muted">
          {evidenceChanged?"New DAS evidence is available; your custom plan still uses its previous assumptions. ":stale?"The imported DAS balance is historical, not a live balance. ":""}
          {asOf?`Forecast starts from ${gbp(plan.openingPence)} in ${monthLabel(plan.openingMonth)}; latest source balance recorded ${asOf}. `:"No recorded DAS opening balance is available. "}
          {unaged>0?`${gbp(unaged)} of opening funds have no confirmed age; future expiry cannot be reliably calculated. `:""}
          {outsideRules?"Rules after July 2027 are provisional.":""}
        </p>
        {message?<p role="status" className="mt-1 text-lt-secondary">{message}</p>:null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {evidenceChanged&&actualBalance!==undefined?<button type="button" onClick={useLatestDasEvidence} disabled={Boolean(editor)} className="min-h-10 rounded-lg bg-[#102c3d] px-3 text-xs font-semibold text-white disabled:opacity-40">Apply latest DAS evidence</button>:null}
        <button type="button" onClick={openAssumptions} className="min-h-10 shrink-0 font-semibold text-lt-accent underline">Review inputs</button>
      </div>
    </div>
    {errors.length?<section role="alert" className="rounded-xl border border-[#ad344e]/20 bg-[#fff2f4] p-3 text-xs text-lt-risk"><p className="font-semibold">Complete the forecast assumptions</p>{errors.map(e=><p key={e} className="mt-1">{e}</p>)}</section>:null}
    <div className="lt-finance-grid grid min-w-0 items-start gap-4" data-testid="funding-decision-workspace">
      <div className="lt-finance-outlook grid min-w-0 gap-3">
        <section className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Funding outlook</h3><p className="mt-1 text-xs text-lt-muted">{editor?(canPreview?"Live preview of unsaved cohort":"Current plan · complete the cohort to preview it"):"Existing commitments vs planned investment"}</p></div><div className="flex gap-1" aria-label="Forecast horizon">{([12,24,36,48] as const).map(n=><button key={n} type="button" aria-pressed={plan.horizon===n} onClick={()=>patch({horizon:n})} className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold ${plan.horizon===n?"bg-[#102c3d] text-white":"bg-[#f4f7f5] text-lt-muted"}`}>{n}m</button>)}</div></div>
          <div className="mt-3 grid grid-cols-2 gap-x-2" aria-live="polite">
            <Metric label="Projected balance" value={result?gbp(result.closing):"—"} copy={baseline?`Without new starts: ${gbp(baseline.closing)}`:"Check assumptions"}/>
            <Metric label="Modelled future expiry" value={unaged>0?"Unknown":result?gbp(result.expiry):"—"} copy={unaged>0?"Remaining fund ages are missing; £0 would be misleading.":baseline?`Without new starts: ${gbp(baseline.expiry)}`:"Check fund ages"} tone={Boolean(result?.expiry)&&unaged<=0}/>
            <Metric label="Employer cash needed" value={result?gbp(result.cash):"—"} copy={result?`New starts: ${gbp(result.proposedCash)}`:"Check assumptions"} tone={Boolean(result?.cash)}/>
            <Metric label="Planned investment" value={gbp(contractValue)} copy={`${totalStarts} proposed starts · full contract value`}/>
          </div>
          {result&&baseline?<><ForecastChart baseline={baseline.rows.map(r=>r.closing)} planned={result.rows.map(r=>r.closing)} months={result.rows.map(r=>r.month)} selectedMonth={selectedForecastMonth?.month} onSelectMonth={setSelectedMonth}/>{selectedForecastMonth?<div className="mb-3 rounded-lg bg-[#f4f8f6] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">Explore a month</p><select aria-label="Explore forecast month" className="rounded-md border border-[#102c3d]/10 bg-white px-2 py-1.5 text-xs" value={selectedForecastMonth.month} onChange={e=>setSelectedMonth(e.target.value)}>{result.rows.map(r=><option key={r.month} value={r.month}>{monthLabel(r.month)}</option>)}</select></div><div className="mt-2 grid grid-cols-3 gap-2 break-words text-xs"><div><p className="text-lt-muted">Balance</p><strong>{gbp(selectedForecastMonth.closing)}</strong></div><div><p className="text-lt-muted">Expiry</p><strong>{gbp(selectedForecastMonth.expired)}</strong></div><div><p className="text-lt-muted">Employer cash</p><strong>{gbp(selectedForecastMonth.existingCash+selectedForecastMonth.proposedCash)}</strong></div></div></div>:null}<div className="flex flex-wrap gap-3 text-xs text-lt-muted"><span><span className="mr-1 inline-block w-5 align-middle border-t-2 border-dashed border-lt-ink"/> Existing commitments only</span><span><span className="mr-1 inline-block w-5 align-middle border-t-2 border-lt-accent"/> With proposed starts</span></div><div className="mt-4 grid gap-2 border-t border-[#102c3d]/[0.07] pt-3 text-xs sm:grid-cols-2"><span>Modelled expiry avoided <strong className="ml-1 tabular-nums">{gbp(baseline.expiry-result.expiry)}</strong></span><span>Next 3 months expiry <strong className="ml-1 tabular-nums">{gbp(result.rows.slice(0,3).reduce((n,r)=>n+r.expired,0))}</strong></span>{result.unfundedTransfers>0?<span className="font-semibold text-lt-risk">Unfunded transfers: {gbp(result.unfundedTransfers)}</span>:null}{result.futureProposedDue>0?<span>Cost beyond horizon: <strong>{gbp(result.futureProposedDue)}</strong></span>:null}</div></>:<div className="my-4 rounded-lg bg-[#f8fbfa] p-4 text-sm text-lt-muted">Enter valid forecast assumptions to see your outlook.</div>}
        </section>
        {result&&baseline?<section className={panelClass}><button type="button" onClick={()=>setShowMonths(x=>!x)} className="flex w-full items-center justify-between text-left text-sm font-semibold" aria-expanded={showMonths}>Monthly breakdown <ChevronDown size={17}/></button>{showMonths?<><div className="mt-3 flex justify-end"><button type="button" className={subtleClass} disabled={Boolean(editor)} onClick={exportForecast}><Download size={14}/> Export CSV</button></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-xs"><thead><tr className="border-b text-left text-lt-muted">{["Month","Receipts","Existing due","Transfers","New starts","Levy used","Expiry","Cash","Closing"].map(t=><th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{result.rows.map(r=><tr key={r.month} className="border-b border-[#102c3d]/5">{[monthLabel(r.month),gbp(r.receipts),gbp(r.existingDue),gbp(r.transfersDue),gbp(r.proposedDue),gbp(r.levyUsed),gbp(r.expired),gbp(r.existingCash+r.proposedCash),gbp(r.closing)].map((value,i)=><td className="whitespace-nowrap p-2 tabular-nums" key={i}>{value}</td>)}</tr>)}</tbody></table></div></>:null}</section>:null}
      </div>
      <div ref={editorRef} className="grid min-w-0 scroll-mt-24 gap-3">
        <section className={panelClass}><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-semibold">Planned enrolments</h3><p className="mt-1 text-xs text-lt-muted">{plan.cohorts.length? `${plan.cohorts.length} cohorts · ${plan.cohorts.reduce((n,item)=>n+item.learners,0)} starts`:"Build your investment plan"}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={subtleClass} onClick={()=>openDisclosure(scenarioRef.current)}>Saved plans</button>{plan.cohorts.length>0?<button type="button" className={buttonClass} onClick={newCohort} disabled={Boolean(editor)||plan.cohorts.length>=50}><Plus size={15}/> Add cohort</button>:null}</div></div>
          {plan.cohorts.length?<div className="mt-3 grid gap-2">{plan.cohorts.map(item=><article key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{item.standardTitle||item.name}</p><p className="mt-1 text-xs text-lt-muted">{item.learners} starts · {monthLabel(item.startMonth)} · {gbp(item.pricePence*item.learners)}</p><p className="mt-1 text-xs font-medium text-lt-muted">{cohortEligibility(item).eligible?"Modelled eligible":"Private / unconfirmed funding"}</p></div><div className="flex shrink-0 gap-1"><button type="button" aria-label={`Edit ${item.name}`} title="Edit cohort" className="rounded-lg p-2 text-lt-accent hover:bg-white disabled:opacity-40" disabled={Boolean(editor)} onClick={()=>{setSearch("");setEditor({...item});requestAnimationFrame(()=>{programmeSearchRef.current?.focus({preventScroll:true});programmeSearchRef.current?.scrollIntoView({block:"nearest",behavior:scrollBehaviour()});});}}><Pencil size={15}/></button><button type="button" aria-label={`Remove ${item.name}`} title="Remove cohort" className="rounded-lg p-2 text-lt-risk hover:bg-white disabled:opacity-40" disabled={Boolean(editor)} onClick={()=>patch({cohorts:plan.cohorts.filter(x=>x.id!==item.id)})}><Trash2 size={15}/></button></div></article>)}</div>:!c?<div className="mt-4 rounded-xl border border-dashed border-[#102c3d]/15 bg-[#f8fbfa] p-4 text-center"><p className="text-sm font-semibold">What would you like to invest in?</p><p className="mt-1 text-xs leading-5 text-lt-muted">Choose an apprenticeship, number of learners and start date. See the effect on your levy forecast instantly.</p><button type="button" className={buttonClass+" mt-3"} onClick={newCohort}><Plus size={15}/> Plan your first cohort</button></div>:null}
        </section>
        {c?<section className={panelClass} data-testid="cohort-editor"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">{plan.cohorts.some(x=>x.id===c.id)?"Edit cohort":"New cohort"}</h4><button type="button" aria-label="Cancel cohort edit" onClick={()=>{setEditor(null);setSearch("");}} className="rounded-lg p-2 hover:bg-[#f4f7f5]"><X size={18}/></button></div>
          <div className="mt-3 grid gap-3"><Field label="Find an apprenticeship"><input ref={programmeSearchRef} className={fieldClass} placeholder="Search title, level or reference" value={search} onChange={e=>setSearch(e.target.value)}/></Field><Field label="Apprenticeship programme"><select aria-label="Apprenticeship programme" className={fieldClass} value={selected?.id??""} onChange={e=>selectStandard(c,e.target.value)}><option value="">{standardsLoading?"Loading standards…":"Select programme"}</option>{filteredStandards.map(s=><option key={s.id} value={s.id}>Level {s.level} · {s.title}</option>)}</select></Field>{search&&filteredStandards.length===0?<p className="text-xs text-lt-muted">No matching standards. Try a different search.</p>:null}
          <div className="grid grid-cols-2 gap-3"><NumberField label="Learners" value={c.learners} onChange={v=>updateCohort(c.id,{learners:v})} min={1} max={10000}/><MonthField label="Start month" value={c.startMonth} onChange={v=>updateCohort(c.id,{startMonth:v,fundingChecked:false})}/><MoneyField label="Price per learner (£)" value={c.pricePence} onChange={v=>updateCohort(c.id,{pricePence:v})}/><NumberField label="Age at start" value={c.ageAtStart} onChange={v=>updateCohort(c.id,{ageAtStart:v,fundingChecked:false})} min={16} max={100}/></div>
          <p className="text-xs leading-5 text-lt-muted">{providers.length?`Available catalogue providers: ${[...new Set(providers)].join(", ")}`:"Confirm provider delivery before committing."} Use separate cohorts for different ages or funding routes.</p>
          <details className="rounded-lg border border-[#102c3d]/[0.08] p-3"><summary className="lt-disclosure cursor-pointer text-xs font-semibold">Programme details &amp; eligibility</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Cohort name"><input className={fieldClass} value={c.name} maxLength={100} onChange={e=>updateCohort(c.id,{name:e.target.value})}/></Field><Field label="Department"><input className={fieldClass} value={c.department} maxLength={100} onChange={e=>updateCohort(c.id,{department:e.target.value})}/></Field>
            <MoneyField label="Funding band (£)" value={c.bandPence} onChange={v=>updateCohort(c.id,{bandPence:v,fundingChecked:false})}/><NumberField label="Training months" value={c.durationMonths} onChange={v=>updateCohort(c.id,{durationMonths:v})} min={8} max={72}/><NumberField label="Assessment months" value={c.assessmentMonths} onChange={v=>updateCohort(c.id,{assessmentMonths:v})} min={0} max={12}/>
            <Field label="Funding route"><select className={fieldClass} value={c.route} onChange={e=>updateCohort(c.id,{route:e.target.value as PlannedCohort["route"],fundingChecked:false})}><option value="levy">Levy / co-investment</option><option value="private">Private budget</option></select></Field>
            <Field label="Verified age exception"><select className={fieldClass} value={c.exception} onChange={e=>updateCohort(c.id,{exception:e.target.value as PlannedCohort["exception"],fundingChecked:false})}><option value="none">None</option><option value="care-ehcp">Care leaver / EHC plan</option><option value="foundation-other">Other foundation exception</option></select></Field>
          </div><p className="mt-2 text-xs text-lt-muted">Price and duration default to the catalogue estimate when available; confirm with the provider.</p></details>
          {c.route==="levy"?<label className="flex items-start gap-2 text-xs leading-5 text-lt-secondary"><input type="checkbox" checked={c.fundingChecked} onChange={e=>updateCohort(c.id,{fundingChecked:e.target.checked})}/> I have checked the funding rules, programme version, provider and learner eligibility for this start.</label>:null}
          <div className="rounded-xl bg-[#f1f7f4] p-3"><p className="text-xs font-semibold text-lt-muted">Proposed contract value</p><p className="mt-1 text-xl font-semibold tabular-nums">{gbp(c.pricePence*c.learners)}</p><p className="mt-2 text-xs leading-5 text-lt-secondary">{eligibility?.reason}. {eligibility?.eligible?`${eligibility.shortfallRate}% employer share of eligible levy shortfall.`:"Cost modelled as private cash until eligibility is confirmed."}</p>{canPreview&&result&&committed?<p className="mt-2 text-xs font-semibold">Change vs saved plan: {gbp(result.cash-committed.cash)} employer cash · {gbp(committed.expiry-result.expiry)} modelled expiry avoided.</p>:null}</div>
          {!canPreview?<div className="text-xs leading-5 text-lt-muted" role="status"><p>Select a programme and enter valid dates, prices, age and duration to preview the change.</p>{c.standardId?draftErrors.map(error=><p key={error} className="mt-1 text-lt-risk">{error}</p>):null}</div>:null}
          <div className="flex gap-2"><button type="button" className={buttonClass+" flex-1"} disabled={!canPreview} onClick={acceptCohort}><Check size={15}/> {plan.cohorts.some(x=>x.id===c.id)?"Update cohort":"Add to plan"}</button><button type="button" className={subtleClass} onClick={()=>{setEditor(null);setSearch("");}}>Cancel</button></div>
        </div></section>:null}
        {unresolved?<p className="rounded-lg bg-[#fffaf0] p-3 text-xs font-medium text-lt-secondary">{unresolved} planned {unresolved===1?"cohort has":"cohorts have"} unconfirmed or restricted levy funding. The model includes the cost as private cash.</p>:null}
        <section className={panelClass}><h4 className="text-sm font-semibold">Forecast inputs</h4><div className="mt-3 grid grid-cols-2 gap-3"><MoneyField label="Monthly levy receipts (£)" value={plan.monthlyReceiptsPence} onChange={v=>patch({monthlyReceiptsPence:v})}/><MoneyField label="Existing monthly payments (£)" value={plan.monthlyExistingPence} onChange={v=>{patch({monthlyExistingPence:v});setConfirmedCommitments(false);}}/></div><button type="button" onClick={openAssumptions} className="mt-3 text-xs font-semibold text-lt-accent underline">Edit opening balance, fund ages &amp; commitments</button></section>
      </div>
    </div>
    <section ref={assumptionRef} className={panelClass+" scroll-mt-24"}><button type="button" aria-expanded={assumptionsOpen} onClick={()=>setAssumptionsOpen(v=>!v)} className="flex w-full items-center justify-between gap-3 text-left"><span><strong className="text-sm">Assumptions &amp; funding evidence</strong><span className="mt-1 block text-xs text-lt-muted">Opening balance, fund ages, existing commitments and transfers</span></span><ChevronDown className={assumptionsOpen?"rotate-180":""} size={18}/></button>{assumptionsOpen?<div className="mt-4">
      <section className="border-t border-[#102c3d]/[0.07] py-4"><h3 className="text-lg font-semibold">Opening balance and future receipts</h3><p className="mt-1 text-xs leading-5 text-lt-muted">Use a confirmed month-end balance. Historical imports are only a starting estimate. Receipt estimates use up to three post-reform complete months; no 10% top-up is added.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><MonthField label="Closing balance month" value={plan.openingMonth} onChange={v=>{patch({openingMonth:v});setConfirmedOpening(false);}}/><MoneyField label="Opening levy balance (£)" value={plan.openingPence} onChange={v=>{patch({openingPence:v});setConfirmedOpening(false);}}/><MoneyField label="Future monthly receipts (£)" value={plan.monthlyReceiptsPence} onChange={v=>patch({monthlyReceiptsPence:v})}/></div><label className="mt-4 flex gap-2 text-xs font-semibold"><input type="checkbox" checked={confirmedOpening&&!evidenceChanged} onChange={e=>{setConfirmedOpening(e.target.checked);if(e.target.checked)setReviewedEvidence(evidenceKey);}}/> I have checked the opening balance against the latest DAS evidence.</label><button type="button" className={subtleClass+" mt-4"} onClick={useLatestDasEvidence} disabled={Boolean(editor)||actualBalance===undefined}>Apply latest DAS evidence</button></section>
      <section className="border-t border-[#102c3d]/[0.07] py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Remaining funds by receipt month</h3><p className="text-xs leading-5 text-lt-muted">Enter actual unspent monthly funding amounts from your account. Older funds retain 24 months; funds from August 2026 have 12 months.</p></div><button type="button" className={subtleClass} disabled={plan.openingFunds.length>=48} onClick={()=>patch({openingFunds:[...plan.openingFunds,{receiptMonth:plan.openingMonth,amountPence:0}]})}><Plus size={15}/> Add fund month</button></div>
        {plan.openingFunds.map((f,i)=><div key={i} className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><MonthField label="Receipt month" value={f.receiptMonth} onChange={v=>patch({openingFunds:plan.openingFunds.map((row,j)=>j===i?{...row,receiptMonth:v}:row)})}/><MoneyField label="Remaining amount (£)" value={f.amountPence} onChange={v=>patch({openingFunds:plan.openingFunds.map((row,j)=>j===i?{...row,amountPence:v}:row)})}/><div className="pb-3 text-xs">Expiry: {/^20\d\d-(0[1-9]|1[0-2])$/.test(f.receiptMonth)?monthLabel(expiryMonth(f.receiptMonth)):"—"}</div><button type="button" aria-label="Remove fund month" className={subtleClass} onClick={()=>patch({openingFunds:plan.openingFunds.filter((_,j)=>j!==i)})}><Trash2 size={15}/></button></div>)}
        <p className="mt-4 text-sm font-semibold">Unallocated opening balance: {gbp(plan.openingPence-plan.openingFunds.reduce((n,f)=>n+f.amountPence,0))}</p></section>
      <section className="border-t border-[#102c3d]/[0.07] py-4"><h3 className="text-lg font-semibold">Existing commitments and transfers</h3><p className="mt-1 text-xs leading-5 text-lt-muted">{liveLearners===null?"Workspace learner counts unavailable.":`Workspace contains ${liveLearners} active learner records and ${approvedApplications} approved applications.`} The initial commitment assumption is recent imported apprenticeship spend, not a sum of outstanding provider invoices. Confirm or replace it; do not include proposed cohorts twice.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><MoneyField label="Existing monthly eligible payments (£)" value={plan.monthlyExistingPence} onChange={v=>{patch({monthlyExistingPence:v});setConfirmedCommitments(false);}}/><NumberField label="Months existing payments continue" value={plan.existingMonths} min={0} max={48} onChange={v=>{patch({existingMonths:v});setConfirmedCommitments(false);}}/><Field label="Existing shortfall cash rate assumption"><select className={fieldClass} value={plan.existingShortfallRate} onChange={e=>{patch({existingShortfallRate:Number(e.target.value) as PlannerInputs["existingShortfallRate"]});setConfirmedCommitments(false);}}><option value={0}>0% — eligible waiver</option><option value={5}>5% — legacy starts estimate</option><option value={25}>25% — new adult starts estimate</option></select></Field><MoneyField label="Outgoing monthly transfer commitments (£)" value={plan.monthlyTransferPence} onChange={v=>{patch({monthlyTransferPence:v});setConfirmedCommitments(false);}}/><NumberField label="Months transfers continue" value={plan.transferMonths} min={0} max={48} onChange={v=>{patch({transferMonths:v});setConfirmedCommitments(false);}}/></div><p className="mt-3 text-xs leading-5 text-lt-muted">Transfers are paid before own apprenticeships. Annual transfer allowance, receiving-employer liability and mixed legacy co-investment rates require separate reconciliation. No incoming transfers are assumed.</p><label className="mt-4 flex gap-2 text-xs font-semibold"><input type="checkbox" checked={confirmedCommitments&&!evidenceChanged} onChange={e=>setConfirmedCommitments(e.target.checked)}/> I have reviewed existing payment and transfer assumptions.</label></section>

    </div>:null}</section>
    <details ref={scenarioRef} className={panelClass+" scroll-mt-24"}><summary className="lt-disclosure cursor-pointer text-sm font-semibold">Saved scenarios &amp; exports {saved.length?`(${saved.length})`:""}</summary><div className="mt-3"><p className="mt-1 text-xs leading-5 text-lt-muted">Save alternatives for this Finance session. Download and reload a plan file for later work; plans are not yet saved to the organisation database.</p><div className="mt-3 flex flex-wrap items-end gap-2"><Field label="Scenario name"><input className={fieldClass} value={scenarioName} maxLength={100} onChange={e=>setScenarioName(e.target.value)}/></Field><button type="button" className={buttonClass} disabled={!!editor||!!errors.length||!scenarioName.trim()||saved.length>=20} onClick={saveScenario}>Save session scenario</button><button type="button" className={subtleClass} disabled={!!editor||!!errors.length} onClick={()=>download("levytate-plan.json",JSON.stringify({ruleVersion:fundingRuleVersion,scenarioName,plan},null,2),"application/json")}><Download size={14}/> Export plan</button><label className={subtleClass+" cursor-pointer"}>Load plan file<input type="file" accept=".json,application/json" className="sr-only" onChange={e=>{const file=e.target.files?.[0];e.target.value="";void importPlan(file);}}/></label></div>{message?<p role="status" className="mt-2 text-xs text-lt-accent">{message}</p>:null}<div className="mt-4 grid gap-2">{saved.map(s=>{const f=forecastLevy(s.input);return <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f8fbfa] p-3 text-xs"><div><p className="font-semibold">{s.name}</p><p className="mt-1">Closing {gbp(f.closing)} · Modelled expiry {gbp(f.expiry)} · Cash {gbp(f.cash)}</p></div><div className="flex gap-2"><button type="button" className={subtleClass} onClick={()=>{if(editor&&!window.confirm("Discard the unsaved cohort edit?"))return;planWasEdited.current=true;setPlan(structuredClone(s.input));setScenarioName(s.name);setConfirmedOpening(false);setConfirmedCommitments(false);setReviewedEvidence(evidenceKey);setEditor(null);}}>Load</button><button type="button" aria-label="Remove scenario" className={subtleClass} onClick={()=>setSaved(a=>a.filter(x=>x.id!==s.id))}><Trash2 size={14}/></button></div></div>;})}</div></div></details>

    {actuals?<details ref={historyRef} className={panelClass+" scroll-mt-24"} data-testid="historical-das-evidence"><summary className="lt-disclosure cursor-pointer text-sm font-semibold">DAS reporting &amp; transaction history <span className="ml-2 text-xs font-normal text-lt-muted">{summary.latestMonth?monthLabel(summary.latestMonth):"No import yet"}</span></summary><div className="mt-4">{actuals}</div></details>:null}
    <details className={panelClass}><summary className="lt-disclosure cursor-pointer text-sm font-semibold">Funding rules and calculation method</summary><div className="mt-3 grid gap-2 text-xs leading-5 text-lt-muted"><p><CalendarDays size={14} className="mr-1 inline"/> England levy payer model · {fundingRuleVersion}.</p><p>Monthly payment model: 80% of eligible price over training, 20% at completion, one-month payment lag assumption, FIFO use before expiry in each month. Above-band or private payments spread over practical training for planning. No VAT, payroll costs, incentives, units or individual ILR adjustments included.</p><p>Use separate cohorts for different ages, start dates, negotiated prices and funding routes. Verify all eligibility with providers and the applicable rules; 16 standards withdrawn from September 2026 are treated as private-only. Future starts after July 2027 are provisional.</p>{Object.entries(fundingSources).map(([key,url])=><a key={key} href={url} target="_blank" rel="noreferrer" className="font-semibold text-lt-accent underline">{key==="policy"?"Apprenticeship funding policy":key==="technical"?"Technical funding guide":key==="reforms"?"Growth and Skills Levy reforms":"2026/27 funding rules"}</a>)}</div></details>

  </div>;
}
function ForecastChart({baseline,planned,months,selectedMonth,onSelectMonth}:{baseline:number[];planned:number[];months:string[];selectedMonth?:string;onSelectMonth:(month:string)=>void}) {
  const max=Math.max(1,...baseline,...planned), width=640, left=72, right=22, height=220, plot=175;
  const axisMoney=(p:number)=>p>=10000000?new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",notation:"compact",maximumFractionDigits:1}).format(p/100):gbp(Math.round(p));
  const activeIndex=months.indexOf(selectedMonth??"");
  const x=(i:number)=>left+i*(width-left-right)/Math.max(1,months.length-1);
  const y=(v:number)=>height-30-v/max*plot;
  const points=(values:number[])=>values.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="my-4 w-full" role="img" aria-label="Existing commitments and proposed starts monthly balance forecast">
    {[0,.25,.5,.75,1].map(f=><g key={f}><line x1={left} x2={width-right} y1={y(max*f)} y2={y(max*f)} stroke="#102c3d" opacity=".1"/><text x={left-8} y={y(max*f)+4} textAnchor="end" fontSize="11" fill="#526575">{axisMoney(max*f)}</text></g>)}
    <path d={`M${x(0)},${height-30} L${planned.map((v,i)=>`${x(i)},${y(v)}`).join(" L")} L${x(months.length-1)},${height-30} Z`} fill="#08766d" opacity=".065"/><polyline points={points(baseline)} fill="none" stroke="#102c3d" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round"/><polyline points={points(planned)} fill="none" stroke="#08766d" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    {activeIndex>=0?<g><line x1={x(activeIndex)} x2={x(activeIndex)} y1={14} y2={height-30} stroke="#159b8f" strokeDasharray="3 3" opacity=".65"/><circle cx={x(activeIndex)} cy={y(planned[activeIndex])} r="4.5" fill="#159b8f" stroke="white" strokeWidth="2"/></g>:null}
    {months.map((m,i)=>{const half=(width-left-right)/Math.max(1,months.length-1)/2;return <rect key={m} x={Math.max(left-half,x(i)-half)} y="12" width={half*2} height={height-42} fill="transparent" className="cursor-crosshair" onPointerEnter={()=>onSelectMonth(m)} onClick={()=>onSelectMonth(m)}/>;})}
    {months.map((m,i)=>i===0||i===months.length-1||i%Math.max(3,Math.ceil(months.length/5))===0?<text key={m} x={x(i)} y={height-6} textAnchor={i===0?"start":i===months.length-1?"end":"middle"} fontSize="11" fill="#526575">{monthLabel(m)}</text>:null)}
  </svg>;
}
