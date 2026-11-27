"use client";

import { useMemo, useState } from "react";
import { compareForecastScenarios, type ForecastChartView, type ForecastScenario } from "@/lib/levytate/finance/forecast-comparison";
import { formatGbp, monthLabel } from "@/lib/levytate/finance/calculations";

type Props={
  baseline:ForecastScenario;
  planned:ForecastScenario;
  horizon:12|24|36|48;
  unknownOpeningPence:number;
  excludedCohorts?:number;
};
const gbp=(p:number)=>formatGbp(p);

export function FinanceForecastComparison({baseline,planned,horizon,unknownOpeningPence,excludedCohorts=0}:Props){
  const comparison=useMemo(()=>compareForecastScenarios(baseline,planned),[baseline,planned]);
  const [selectedView,setSelectedView]=useState<"auto"|ForecastChartView>("auto");
  const [selectedMonth,setSelectedMonth]=useState<string|null>(null);
  const activeView:ForecastChartView=selectedView==="auto"?comparison.preferredView:selectedView;
  const month=comparison.rows.find(row=>row.month===selectedMonth)??comparison.rows.at(-1);
  const unaged=unknownOpeningPence>0;
  const difference=comparison.extraCashPence;

  return <div data-testid="finance-scenario-comparison" className="mt-4 border-t border-lt-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-lt-ink">Compare the financial impact</p>
        <p className="mt-1 text-xs leading-5 text-lt-muted">Compare the same months either as levy balances or cumulative employer cash. These are separate financial measures.</p>
      </div>
      <div role="group" aria-label="Forecast chart view" className="inline-flex rounded-xl bg-[#f4f7f5] p-1">
        {([["levy","Levy balance"],["cash","Employer cash"]] as const).map(([view,label])=>
          <button type="button" key={view} aria-pressed={activeView===view} onClick={()=>setSelectedView(view)}
            className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lt-accent ${activeView===view?"bg-[#102c3d] text-white":"text-lt-muted hover:bg-white"}`}>{label}</button>
        )}
      </div>
    </div>

    {excludedCohorts>0 ? <p data-testid="finance-excluded-cohorts" role="status" className="mt-3 rounded-xl border border-[#e6b74a]/30 bg-[#fffaf0] p-3 text-xs leading-5 text-lt-secondary">
      {excludedCohorts} planned {excludedCohorts===1?"cohort is":"cohorts are"} awaiting valid apprenticeship funding evidence and are excluded from both charts. A missing funding band or test-only standard cannot be treated as privately funded spending.
    </p> : null}
    {comparison.levyLinesMatch && !comparison.cashLinesMatch ?
      <p role="status" data-testid="matched-levy-explanation" className="mt-3 rounded-xl bg-[#f4f8f6] px-4 py-3 text-xs leading-5 text-lt-secondary">
        Both levy-balance curves match because the proposed starts do not reduce DAS funding within this horizon. The estimated additional employer contribution of <strong className="text-lt-ink">{gbp(difference)}</strong> over {horizon} months is from co-investment when levy funds run short, or agreed costs above the funding band.
        {activeView==="cash"?" The graph below shows that contribution.":" Select Employer cash to see it."}
      </p> : null}
    {activeView==="levy" && unaged ?
      <p className="mt-3 text-xs leading-5 text-lt-muted">This balance projection is indicative: {gbp(unknownOpeningPence)} of opening levy funds have no known expiry age.</p> : null}

    <ComparisonGraph
      baseline={activeView==="cash"?comparison.cashBaseline:comparison.levyBaseline}
      planned={activeView==="cash"?comparison.cashPlanned:comparison.levyPlanned}
      months={comparison.rows.map(row=>row.month)}
      selectedMonth={month?.month}
      onSelectMonth={setSelectedMonth}
      view={activeView}
    />

    {month?<div className="mb-3 rounded-lg bg-[#f4f8f6] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">Explore a month · {activeView==="cash"?"cumulative employer cash":"remaining levy balance"}</p>
        <select aria-label="Explore forecast month" className="rounded-lg border border-[#102c3d]/10 bg-white px-2 py-1.5 text-xs" value={month.month} onChange={event=>setSelectedMonth(event.target.value)}>
          {comparison.rows.map(row=><option key={row.month} value={row.month}>{monthLabel(row.month)}</option>)}
        </select>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 break-words text-xs">
        <div><p className="text-lt-muted">{activeView==="cash"?"Existing cash":"Levy · existing"}</p><strong className="mt-1 block tabular-nums">{gbp(activeView==="cash"?month.cashBaselinePence:month.levyBaselinePence)}</strong></div>
        <div><p className="text-lt-muted">{activeView==="cash"?"With planned starts":"Levy · planned"}</p><strong className="mt-1 block tabular-nums">{gbp(activeView==="cash"?month.cashPlannedPence:month.levyPlannedPence)}</strong></div>
        <div><p className="text-lt-muted">{activeView==="cash"?"Extra employer cash":"Levy reduction"}</p><strong className="mt-1 block tabular-nums">{gbp(activeView==="cash"?month.cashDifferencePence:month.levyDifferencePence)}</strong></div>
      </div>
    </div>:null}

    <div aria-label="Forecast chart legend" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-lt-muted">
      <span><span className="mr-1 inline-block w-5 align-middle border-t-2 border-dashed border-lt-ink"/> Existing commitments only</span>
      <span><span className="mr-1 inline-block w-5 align-middle border-t-2 border-lt-accent"/> With proposed starts</span>
      <span className="font-medium">{activeView==="cash"?"Cumulative employer cash, £":"Levy balance, £"}</span>
    </div>

    <div className="mt-4 grid gap-2 border-t border-lt-border pt-3 text-xs sm:grid-cols-2">
      <span>Modelled expiry avoided <strong className="ml-1 tabular-nums">{unaged?"Unknown":gbp(baseline.expiry-planned.expiry)}</strong></span>
      <span>Next 3 months expiry <strong className="ml-1 tabular-nums">{unaged?"Unknown":gbp(planned.rows.slice(0,3).reduce((sum,row)=>sum+row.expired,0))}</strong></span>
      {planned.unfundedTransfers>0?<span className="font-semibold text-lt-risk">Unfunded transfers: {gbp(planned.unfundedTransfers)}</span>:null}
      {planned.futureProposedDue>0?<span>Programme payments beyond the selected horizon: <strong>{gbp(planned.futureProposedDue)}</strong></span>:null}
    </div>
  </div>;
}

function ComparisonGraph({baseline,planned,months,selectedMonth,onSelectMonth,view}:{baseline:number[];planned:number[];months:string[];selectedMonth?:string;onSelectMonth:(month:string)=>void;view:ForecastChartView}){
  const max=Math.max(1,...baseline,...planned),width=640,left=72,right=22,height=220,plot=175;
  const formatAxis=(pence:number)=>pence>=10_000_000?new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",notation:"compact",maximumFractionDigits:1}).format(pence/100):gbp(Math.round(pence));
  const activeIndex=months.indexOf(selectedMonth??"");
  const x=(i:number)=>left+i*(width-left-right)/Math.max(1,months.length-1);
  const y=(pence:number)=>height-30-pence/max*plot;
  const points=(values:number[])=>values.map((value,index)=>`${x(index)},${y(value)}`).join(" ");
  const tickIndices=new Set([0,Math.round((months.length-1)/4),Math.round((months.length-1)/2),Math.round((months.length-1)*3/4),months.length-1]);
  return <div className="my-4 min-w-0">
    <div data-testid="chart-mobile-scale" className="flex items-center justify-between text-xs font-medium tabular-nums text-lt-muted sm:hidden"><span>£0</span><span>Chart scale: {formatAxis(max)}</span></div>
    <svg data-testid={"finance-forecast-chart-"+view} viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
    aria-label={view==="cash"?"Cumulative employer cash for existing commitments compared with proposed starts":"Levy balance for existing commitments compared with proposed starts"}>
    {[0,.25,.5,.75,1].map(fraction=><g key={fraction}>
      <line x1={left} x2={width-right} y1={y(max*fraction)} y2={y(max*fraction)} stroke="#102c3d" opacity=".1"/>
      <text className="hidden sm:block" x={left-8} y={y(max*fraction)+4} textAnchor="end" fontSize="11" fill="#526575">{formatAxis(max*fraction)}</text>
    </g>)}
    <path d={`M${x(0)},${height-30} L${planned.map((value,index)=>`${x(index)},${y(value)}`).join(" L")} L${x(months.length-1)},${height-30} Z`} fill="#08766d" opacity=".065"/>
    <polyline data-testid="forecast-planned-line" points={points(planned)} fill="none" stroke="#08766d" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline data-testid="forecast-baseline-line" points={points(baseline)} fill="none" stroke="#102c3d" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round"/>
    {activeIndex>=0?<g><line x1={x(activeIndex)} x2={x(activeIndex)} y1={14} y2={height-30} stroke="#159b8f" strokeDasharray="3 3" opacity=".65"/><circle cx={x(activeIndex)} cy={y(planned[activeIndex])} r="4.5" fill="#159b8f" stroke="white" strokeWidth="2"/></g>:null}
    {months.map((month,index)=>{const half=(width-left-right)/Math.max(1,months.length-1)/2;return <rect key={month} x={Math.max(left-half,x(index)-half)} y="12" width={half*2} height={height-42} fill="transparent" className="cursor-crosshair" onPointerEnter={()=>onSelectMonth(month)} onClick={()=>onSelectMonth(month)}/>;})}
    {months.map((month,index)=>tickIndices.has(index)?
      <text className="hidden sm:block" key={month} x={x(index)} y={height-6} textAnchor={index===0?"start":index===months.length-1?"end":"middle"} fontSize="11" fill="#526575">{monthLabel(month)}</text>:null)}
    </svg>
    <div data-testid="chart-mobile-months" className="flex items-center justify-between gap-2 text-xs text-lt-muted sm:hidden">
      <span>{monthLabel(months[0])}</span><span>{monthLabel(months[Math.floor((months.length-1)/2)])}</span><span>{monthLabel(months[months.length-1])}</span>
    </div>
  </div>;
}
