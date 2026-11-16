"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getApprenticeshipStandardsImport,
  hydrateApprenticeshipStandards,
  searchApprenticeshipStandards,
  searchApprenticeshipStandardsList,
} from "@/lib/levytate/domain";
import type { ApprenticeshipStandard } from "@/lib/levytate/domain";

type LevyTateStandardsPayload = {
  source: "supabase" | "demo" | "unavailable";
  counts: {
    totalRecords: number;
    apprenticeshipStandards: number;
    approvedForDelivery: number;
  };
  standards: ApprenticeshipStandard[];
};

type LevyTateStandardsContextValue = {
  standards: ApprenticeshipStandard[];
  liveStandards: ApprenticeshipStandard[];
  selectableStandards: ApprenticeshipStandard[];
  loading: boolean;
  source: LevyTateStandardsPayload["source"];
  counts: LevyTateStandardsPayload["counts"];
  search: typeof searchApprenticeshipStandards;
};

const fallbackImport = getApprenticeshipStandardsImport();
const fallbackStandards = fallbackImport.standards;

const fallbackCounts = {
  totalRecords: fallbackImport.source.totalRecords ?? fallbackStandards.length,
  apprenticeshipStandards: fallbackImport.source.totalStandards ?? fallbackStandards.filter((standard) => standard.programmeType === "Apprenticeship standard").length,
  approvedForDelivery: fallbackImport.source.approvedForDelivery ?? fallbackImport.source.activeStandards ?? fallbackStandards.filter((standard) => standard.programmeType === "Apprenticeship standard" && (standard.sourceStatus === "Approved for delivery" || standard.status === "Live")).length,
};

const LevyTateStandardsContext = createContext<LevyTateStandardsContextValue | null>(null);

const unavailablePayload: LevyTateStandardsPayload = { source: "unavailable", counts: { totalRecords: 0, apprenticeshipStandards: 0, approvedForDelivery: 0 }, standards: [] };

export function LevyTateStandardsProvider({ children, demoMode = false }: { children: ReactNode; demoMode?: boolean }) {
  const [payload, setPayload] = useState<LevyTateStandardsPayload>(() => demoMode ? { source: "demo", counts: fallbackCounts, standards: fallbackStandards } : unavailablePayload);
  const [loading, setLoading] = useState(!demoMode);

  useEffect(() => {
    hydrateApprenticeshipStandards(payload.standards);
  }, [payload.standards]);

  useEffect(() => {
    let cancelled = false;
    if (demoMode) return;

    async function load() {
      try {
        const response = await fetch("/api/levytate-standards", { cache: "no-store" });
        if (!response.ok) throw new Error("Standards unavailable");
        const next = await response.json() as LevyTateStandardsPayload;
        if (!cancelled && next.source === "supabase" && Array.isArray(next.standards)) {
          hydrateApprenticeshipStandards(next.standards);
          setPayload(next);
        } else if (!cancelled) throw new Error("Unconfirmed standards source");
      } catch {
        if (!cancelled) { hydrateApprenticeshipStandards([]); setPayload(unavailablePayload); }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const value = useMemo<LevyTateStandardsContextValue>(() => ({
    standards: payload.standards,
    liveStandards: payload.standards.filter((item) => item.programmeType === "Apprenticeship standard" && item.sourceStatus === "Approved for delivery"),
    selectableStandards: payload.standards.filter((item) => item.programmeType === "Apprenticeship standard" && item.sourceStatus === "Approved for delivery"),
    loading,
    source: payload.source,
    counts: payload.counts,
    search: (query, filters) => searchApprenticeshipStandardsList(payload.standards, query, filters),
  }), [loading, payload]);

  return <LevyTateStandardsContext.Provider value={value}>{loading ? <p role="status" className="p-6 text-sm">Loading workspace reference data…</p> : <>{payload.source === "unavailable" ? <p role="status" className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">The official standards catalogue is unavailable. Programme choices and recommendations may be incomplete; no substitute records are being shown.</p> : null}{children}</>}</LevyTateStandardsContext.Provider>;
}

export function useLevyTateStandards() {
  const context = useContext(LevyTateStandardsContext);
  if (!context) {
    throw new Error("useLevyTateStandards must be used inside LevyTateStandardsProvider");
  }
  return context;
}

