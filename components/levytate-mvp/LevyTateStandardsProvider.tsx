"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getApprenticeshipStandardsImport,
  getLiveApprenticeshipStandards,
  getSelectableApprenticeshipStandards,
  hydrateApprenticeshipStandards,
  searchApprenticeshipStandards,
} from "@/lib/levytate/domain";
import type { ApprenticeshipStandard } from "@/lib/levytate/domain";

type LevyTateStandardsPayload = {
  source: "supabase" | "fallback";
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
  source: "supabase" | "fallback";
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

export function LevyTateStandardsProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<LevyTateStandardsPayload>({
    source: "fallback",
    counts: fallbackCounts,
    standards: fallbackStandards,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrateApprenticeshipStandards(payload.standards);
  }, [payload.standards]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/levytate-standards", { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as LevyTateStandardsPayload;
        if (!cancelled && Array.isArray(next.standards) && next.standards.length) {
          setPayload(next);
        }
      } catch {
        // Fallback stays in place when live standards are unavailable.
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
  }, []);

  const value = useMemo<LevyTateStandardsContextValue>(() => ({
    standards: payload.standards,
    liveStandards: getLiveApprenticeshipStandards(),
    selectableStandards: getSelectableApprenticeshipStandards(),
    loading,
    source: payload.source,
    counts: payload.counts,
    search: searchApprenticeshipStandards,
  }), [loading, payload]);

  return <LevyTateStandardsContext.Provider value={value}>{children}</LevyTateStandardsContext.Provider>;
}

export function useLevyTateStandards() {
  const context = useContext(LevyTateStandardsContext);
  if (!context) {
    throw new Error("useLevyTateStandards must be used inside LevyTateStandardsProvider");
  }
  return context;
}

