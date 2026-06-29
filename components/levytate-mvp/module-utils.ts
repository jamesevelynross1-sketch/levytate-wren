import type { MvpEmployee } from "@/lib/levytate/mvp/workspace";

export function includesSearch(values: Array<string | undefined>, search: string) {
  const query = search.trim().toLowerCase();
  return !query || values.join(" ").toLowerCase().includes(query);
}

export function displayEmployee(employee: MvpEmployee | undefined) {
  return employee?.name ?? "Unknown employee";
}

export function statusTone(status: string): "neutral" | "green" | "yellow" | "red" | "blue" {
  if (/approved|active|live|completed|shortlist ready/i.test(status)) return "green";
  if (/declined|cancelled|archived|withdrawn/i.test(status)) return "red";
  if (/awaiting|submitted|progress|review|draft/i.test(status)) return "yellow";
  return "neutral";
}