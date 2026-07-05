"use client";

import {  Building2, ChartColumn, ShieldCheck, Users } from "lucide-react";
import { MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { departmentCapabilityRows, providerCoverageSummary, reportingInsights } from "@/lib/levytate/mvp/workspace-insights";
import { commercialProfileCompletion, programmeProfileCompletion } from "@/lib/levytate/domain";

export function ReportsModule() {
  const { data } = useMvpWorkspace();
  const insights = reportingInsights(data);
  const departmentRows = departmentCapabilityRows(data);
  const providerCoverage = providerCoverageSummary(data);
  const activeProviders = data.providers.filter((provider) => provider.status === "Active");
  const activeProgrammes = data.providerProgrammes.filter((programme) => programme.recordStatus === "Active");
  const providerCompletion = average(activeProviders.map((provider) => commercialProfileCompletion(provider.commercialProfile)));
  const programmeCompletion = average(activeProgrammes.map((programme) => programmeProfileCompletion(programme.commercialProfile)));
  const deliveryMix = buildMix(activeProgrammes.flatMap((programme) => programme.deliveryModels));
  const industryDemand = buildMix(data.matchingRequests.flatMap((request) => request.industries));

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {insights.map((insight) => (
          <article key={insight.title} className="rounded-xl border border-[#102c3d]/[0.07] bg-white px-4 py-4 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">{insight.title}</p>
            <p className="mt-3 text-2xl font-semibold text-[#102c3d]">{insight.value}</p>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{insight.copy}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <MvpPanel title="Executive reporting" eyebrow="Board-ready operating view">
          <div className="grid gap-4 lg:grid-cols-2">
            {insights.map((insight) => (
              <div key={insight.title} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#102c3d]">{insight.title}</p>
                  <StatusBadge tone="blue">Live data</StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">{insight.detail}</p>
              </div>
            ))}
          </div>
        </MvpPanel>

        <MvpPanel title="Provider intelligence" eyebrow="Commercial readiness">
          <div className="grid gap-4">
            <MetricTile icon={Building2} label="Provider profile completion" value={`${providerCompletion}%`} copy="Average buyer-facing profile quality across active provider partners." />
            <MetricTile icon={ChartColumn} label="Programme readiness" value={`${programmeCompletion}%`} copy="How well programme landing pages explain outcomes, audience and delivery fit." />
            <MetricTile icon={ShieldCheck} label="Coverage score" value={`${providerCoverage.covered}/${providerCoverage.total}`} copy={providerCoverage.missing.length ? `Gaps remain in ${providerCoverage.missing.slice(0, 2).join(" and ")}.` : "Preferred partner coverage is in place across all major categories."} />
          </div>
        </MvpPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <MvpPanel title="Department capability" eyebrow="Workforce readiness">
          <div className="overflow-x-auto rounded-xl border border-[#102c3d]/[0.07]">
            <table className="min-w-[760px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
                <tr>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Employees</th>
                  <th className="px-4 py-3">Ready records</th>
                  <th className="px-4 py-3">AI capability</th>
                  <th className="px-4 py-3">Active applications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#102c3d]/[0.055] bg-white">
                {departmentRows.length ? departmentRows.map((row) => (
                  <tr key={row.department}>
                    <td className="px-4 py-3 font-semibold">{row.department}</td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{row.employees}</td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{row.recommendationCount}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-[150px]">
                        <div className="h-2 rounded-full bg-[#e8f0ed]"><div className="h-2 rounded-full bg-[#159b8f]" style={{ width: `${Math.max(8, row.aiCapability)}%` }} /></div>
                        <p className="mt-1 text-xs text-[#102c3d]/48">{row.aiCapability}% readiness signal</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{row.activeApplications}</td>
                  </tr>
                )) : <tr><td className="px-4 py-8 text-sm text-[#102c3d]/52" colSpan={5}>Add employees, roles and discovery data to unlock department reporting.</td></tr>}
              </tbody>
            </table>
          </div>
        </MvpPanel>

        <div className="grid gap-5">
          <MvpPanel title="Delivery mix" eyebrow="Operational signals">
            <MixList items={deliveryMix} fallback="Add programme delivery models to unlock this view." />
          </MvpPanel>
          <MvpPanel title="Demand by industry" eyebrow="Matching pipeline">
            <MixList items={industryDemand} fallback="Raise provider matching requests with industry tags to unlock demand reporting." />
          </MvpPanel>
        </div>
      </div>
    </div>
  );
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildMix(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
}

function MetricTile({ icon: Icon, label, value, copy }: { icon: typeof Users; label: string; value: string; copy: string }) {
  return <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4"><div className="flex items-center gap-2 text-[#0b6f63]"><Icon size={15} /><p className="text-xs font-semibold uppercase tracking-[0.12em]">{label}</p></div><p className="mt-3 text-2xl font-semibold text-[#102c3d]">{value}</p><p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{copy}</p></div>;
}

function MixList({ items, fallback }: { items: Array<{ label: string; value: number }>; fallback: string }) {
  if (!items.length) return <p className="text-sm text-[#102c3d]/52">{fallback}</p>;
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="grid gap-3">{items.map((item) => <div key={item.label} className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#102c3d]">{item.label}</p><span className="text-xs font-semibold text-[#102c3d]/48">{item.value}</span></div><div className="mt-3 h-2 rounded-full bg-[#eef3f1]"><div className="h-2 rounded-full bg-[#159b8f]" style={{ width: `${Math.max(12, Math.round((item.value / max) * 100))}%` }} /></div></div>)}</div>;
}
