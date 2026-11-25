"use client";

import { useEffect, useState } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { authenticatedClientFetch } from "@/lib/levytate/client-session";
import { decodeFinanceReadResponse } from "@/lib/levytate/client-employer-module-reads";
import { buildEmployerSetupSteps, employerSetupComplete, financeSetupStatus, isEmployerSetupRole, type EmployerSetupStep, type SetupFinanceStatus } from "@/lib/levytate/mvp/employer-setup";

export type EmployerSetupProgress = {
  steps: EmployerSetupStep[];
  complete: boolean;
  financeStatus: SetupFinanceStatus;
  refreshFinance: () => void;
};

export function useEmployerSetupProgress(onHome: boolean): EmployerSetupProgress | null {
  const { data, meta, hydrated, can } = useMvpWorkspace();
  const email = meta?.userEmail;
  const organisationId = meta?.organisationId;
  const enabled = hydrated && meta?.storageMode === "supabase" && isEmployerSetupRole(meta.userRole) && can("finance:read");
  const key = enabled && email && organisationId ? JSON.stringify([organisationId, email]) : null;
  const [finance, setFinance] = useState<{ key: string; status: SetupFinanceStatus } | null>(null);
  const [reload, setReload] = useState(0);

  // Re-check the server after returning from Finance (and on a new session).
  // Pin the read to the employer/account and discard late responses.
  useEffect(() => {
    if (!key || !email || !organisationId || !onHome) return;
    let cancelled = false;
    setFinance({ key, status: "checking" });
    void authenticatedClientFetch("/api/levytate-finance", {}, { email, organisationId })
      .then(async (response) => {
        if (!response.ok) throw new Error("Finance unavailable");
        const state = decodeFinanceReadResponse(await response.json());
        if (!cancelled) setFinance({ key, status: financeSetupStatus(state) });
      })
      .catch(() => { if (!cancelled) setFinance({ key, status: "unavailable" }); });
    return () => { cancelled = true; };
  }, [key, email, organisationId, onHome, reload]);

  if (!key) return null;
  const financeStatus = finance?.key === key ? finance.status : "checking";
  const steps = buildEmployerSetupSteps(data, financeStatus);
  return { steps, complete: employerSetupComplete(steps), financeStatus, refreshFinance: () => setReload((value) => value + 1) };
}
