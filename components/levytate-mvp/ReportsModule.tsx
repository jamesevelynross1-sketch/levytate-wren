"use client";

import { MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { departmentCapabilityRows, providerCoverageSummary, reportingInsights } from "@/lib/levytate/mvp/workspace-insights";

export function ReportsModule() {
  const { data } = useMvpWorkspace();
  const insights = reportingInsights(data);
  const departmentRows = departmentCapabilityRows(data);
  const providerCoverage = providerCoverageSummary(data);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {insights.map((insight) => (
          <div key={insight.title} className="rounded-xl border border-[#102c3d]/[0.07] bg-white px-4 py-4 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">{insight.title}</p>
            <p className="mt-3 text-2xl font-semibold text-[#102c3d]">{insight.value}</p>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{insight.copy}</p>
          </div>
        ))}
      </section>

      <MvpPanel title="Operational insights" eyebrow="Board-ready reporting">
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
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
                        <div className="h-2 rounded-full bg-[#e8f0ed]">
                          <div className="h-2 rounded-full bg-[#159b8f]" style={{ width: `${Math.max(8, row.aiCapability)}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-[#102c3d]/48">{row.aiCapability}% readiness signal</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{row.activeApplications}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-8 text-sm text-[#102c3d]/52" colSpan={5}>Add employees, roles and discovery data to unlock department reporting.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </MvpPanel>

        <MvpPanel title="Provider coverage" eyebrow="Partner continuity">
          <div className="space-y-4">
            <div className="rounded-xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#102c3d]">Coverage score</p>
                <StatusBadge tone={providerCoverage.missing.length ? "yellow" : "green"}>{providerCoverage.covered}/{providerCoverage.total}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">Preferred partner relationships are tracked by category so provider continuity is preserved as demand grows.</p>
            </div>
            <div className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Missing categories</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {providerCoverage.missing.length ? providerCoverage.missing.map((category) => (
                  <span key={category} className="rounded-full bg-[#fff7cf] px-3 py-1.5 text-xs font-semibold text-[#756000]">{category}</span>
                )) : <span className="rounded-full bg-[#edf7f3] px-3 py-1.5 text-xs font-semibold text-[#0b6f63]">All categories covered</span>}
              </div>
            </div>
          </div>
        </MvpPanel>
      </div>
    </div>
  );
}