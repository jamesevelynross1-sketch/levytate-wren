"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StockSignal } from "@/lib/stocks/types";
import { ProviderStatusBadge } from "./ProviderStatusBadge";
import { SignalBadge } from "./SignalBadge";

type SortKey =
  | "ticker"
  | "currentPrice"
  | "dailyChangePct"
  | "fiveDayChangePct"
  | "twentyDayChangePct"
  | "volumeVsAverage"
  | "volatilityScore"
  | "trendScore"
  | "sentimentScore"
  | "newsCatalystScore"
  | "opportunityScore";

const columns: Array<[SortKey, string]> = [
  ["ticker", "Ticker"],
  ["currentPrice", "Price"],
  ["dailyChangePct", "1D %"],
  ["fiveDayChangePct", "5D %"],
  ["twentyDayChangePct", "20D %"],
  ["volumeVsAverage", "Vol/Avg"],
  ["volatilityScore", "Volatility"],
  ["trendScore", "Trend"],
  ["sentimentScore", "Sentiment"],
  ["newsCatalystScore", "Catalyst"],
  ["opportunityScore", "Score"],
];

export function SignalTable({ signals }: { signals: StockSignal[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("opportunityScore");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...signals].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      const result = typeof left === "string" ? left.localeCompare(String(right)) : Number(left) - Number(right);
      return direction === "asc" ? result : -result;
    });
  }, [direction, signals, sortKey]);

  function updateSort(key: SortKey) {
    if (key === sortKey) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setDirection(key === "ticker" ? "asc" : "desc");
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
      <div className="grid gap-3 p-3 md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Sort
            <select
              className="mt-2 w-full rounded-md border border-white/10 bg-[#07101f] px-3 py-2 text-sm normal-case tracking-normal text-slate-100"
              value={sortKey}
              onChange={(event) => updateSort(event.target.value as SortKey)}
            >
              {columns.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100"
            onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
          >
            {direction === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        {sorted.map((stock) => (
          <article key={stock.ticker} className="rounded-lg border border-white/10 bg-black/15 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/stocks/${stock.ticker}`} className="text-lg font-semibold text-white">
                  {stock.ticker}
                </Link>
                <p className="mt-1 text-xs text-slate-500">{stock.name}</p>
              </div>
              <SignalBadge signal={stock.signal} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MobileMetric label="Price" value={`$${stock.currentPrice.toFixed(2)}`} />
              <MobileMetric label="Score" value={String(stock.opportunityScore)} strong />
              <MobileMetric label="1D" value={`${stock.dailyChangePct.toFixed(2)}%`} tone={stock.dailyChangePct} />
              <MobileMetric label="5D" value={formatPercent(stock.fiveDayChangePct)} tone={stock.fiveDayChangePct} />
              <MobileMetric label="20D" value={formatPercent(stock.twentyDayChangePct)} tone={stock.twentyDayChangePct} />
              <MobileMetric label="Vol/Avg" value={formatVolumeRatio(stock.volumeVsAverage)} />
              <MobileMetric label="Trend" value={String(stock.trendScore)} />
              <MobileMetric label="Sentiment" value={String(stock.sentimentScore)} />
            </div>
            <div className="mt-4">
              <ProviderStatusBadge signal={stock} />
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              {stock.riskControls.doNotBuyWarning ?? `${stock.riskControls.suggestedPositionSizePct}% size / stop $${stock.riskControls.stopLoss}`}
            </p>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {columns.map(([key, label]) => (
                <th key={key} className="px-4 py-3">
                  <button className="text-left transition hover:text-slate-200" onClick={() => updateSort(key)}>
                    {label}
                    {sortKey === key ? (direction === "asc" ? " ASC" : " DESC") : ""}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sorted.map((stock) => (
              <tr key={stock.ticker} className="transition hover:bg-white/[0.04]">
                <td className="px-4 py-4">
                  <Link href={`/stocks/${stock.ticker}`} className="font-semibold text-white hover:text-emerald-200">
                    {stock.ticker}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{stock.name}</p>
                </td>
                <td className="px-4 py-4">${stock.currentPrice.toFixed(2)}</td>
                <ChangeCell value={stock.dailyChangePct} />
                <ChangeCell value={stock.fiveDayChangePct} />
                <ChangeCell value={stock.twentyDayChangePct} />
                <td className="px-4 py-4">{formatVolumeRatio(stock.volumeVsAverage)}</td>
                <td className="px-4 py-4">{stock.volatilityScore}</td>
                <td className="px-4 py-4">{stock.trendScore}</td>
                <td className="px-4 py-4">{stock.sentimentScore}</td>
                <td className="px-4 py-4">{stock.newsCatalystScore}</td>
                <td className="px-4 py-4 text-lg font-semibold text-white">{stock.opportunityScore}</td>
                <td className="px-4 py-4">
                  <SignalBadge signal={stock.signal} />
                </td>
                <td className="px-4 py-4">
                  <ProviderStatusBadge signal={stock} />
                </td>
                <td className="px-4 py-4 text-xs text-slate-400">
                  {stock.riskControls.doNotBuyWarning ?? `${stock.riskControls.suggestedPositionSizePct}% size / stop $${stock.riskControls.stopLoss}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChangeCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-4 py-4 font-medium text-slate-500">N/A</td>;
  }

  const color = value > 0 ? "text-emerald-300" : value < 0 ? "text-red-300" : "text-slate-300";
  return <td className={`px-4 py-4 font-medium ${color}`}>{formatPercent(value)}</td>;
}

function MobileMetric({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone?: number | null;
  strong?: boolean;
}) {
  const color = typeof tone === "number" ? (tone > 0 ? "text-emerald-300" : tone < 0 ? "text-red-300" : "text-slate-200") : "text-slate-200";

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 ${strong ? "text-lg font-semibold text-white" : color}`}>{value}</p>
    </div>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function formatVolumeRatio(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)}x`;
}
