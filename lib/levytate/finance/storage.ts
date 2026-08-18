import type { LevyFinanceState } from "./types";

export function financeStorageKey(organisationId: string) { return `levytate-finance-v1:${organisationId.replace(/[^a-zA-Z0-9-]/g, "_")}`; }
export function readFinanceState(organisationId: string, persistence: "local" | "session" = "local") {
  if (typeof window === "undefined") return null;
  try { const value = JSON.parse(window[persistence === "local" ? "localStorage" : "sessionStorage"].getItem(financeStorageKey(organisationId)) ?? "null") as LevyFinanceState | null; return value?.version === 1 ? value : null; } catch { return null; }
}
export function persistFinanceState(organisationId: string, state: LevyFinanceState, persistence: "local" | "session" = "local") {
  if (typeof window !== "undefined") window[persistence === "local" ? "localStorage" : "sessionStorage"].setItem(financeStorageKey(organisationId), JSON.stringify(state));
}
