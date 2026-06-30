"use client";

import { Building2, Mail, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MvpPanel } from "@/components/levytate-mvp/MvpUi";
import {
  earlyAccessStatuses,
  earlyAccessStorageKey,
  type EarlyAccessRequest,
  type EarlyAccessStatus,
} from "@/lib/levytate/early-access/domain";

export function EarlyAccessModule() {
  const [leads, setLeads] = useState<EarlyAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | EarlyAccessStatus>("All");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/levytate-early-access", { cache: "no-store" });
        const payload = (await response.json()) as {
          leads?: EarlyAccessRequest[];
          message?: string;
        };

        const serverLeads = response.ok && Array.isArray(payload.leads) ? payload.leads : [];
        const localLeads = readLocalLeads();
        const merged = mergeLeads(serverLeads, localLeads);

        if (!cancelled) {
          setLeads(merged);
          setError(response.ok ? "" : payload.message || "Early access leads could not be loaded.");
        }
      } catch {
        if (!cancelled) {
          setLeads(readLocalLeads());
          setError("Live lead storage is unavailable, showing locally captured requests only.");
        }
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

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "All" || lead.status === statusFilter;
      const matchesSearch = !query || [
        lead.organisation,
        lead.contactName,
        lead.email,
        lead.employeeCount,
        lead.currentProvider,
      ].some((value) => value.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [leads, search, statusFilter]);

  const counts = useMemo(() => ({
    total: leads.length,
    new: leads.filter((lead) => lead.status === "New").length,
    contacted: leads.filter((lead) => lead.status === "Contacted").length,
    approved: leads.filter((lead) => lead.status === "Approved" || lead.status === "Onboarded").length,
  }), [leads]);

  async function handleStatusChange(id: string, status: EarlyAccessStatus) {
    setUpdatingId(id);
    setError("");

    try {
      const response = await fetch(`/api/levytate-early-access/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as {
        lead?: EarlyAccessRequest;
        message?: string;
      };

      if (!response.ok || !payload.lead) {
        throw new Error(payload.message || "Lead status could not be updated.");
      }

      const next = leads.map((lead) => lead.id === id ? payload.lead! : lead);
      setLeads(next);
      persistLocalLeads(next);
    } catch (updateError) {
      const next = leads.map((lead) => lead.id === id ? { ...lead, status } : lead);
      setLeads(next);
      persistLocalLeads(next);
      setError(updateError instanceof Error ? `${updateError.message} Showing the updated status from local beta storage.` : "Lead status could not be updated in live storage. Showing the updated status from local beta storage.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 lg:grid-cols-4">
        <SummaryCard label="Requests captured" value={counts.total} copy="Early Access opportunities currently held inside the workspace." />
        <SummaryCard label="New for review" value={counts.new} copy="Fresh employer requests that need a first commercial response." />
        <SummaryCard label="Contacted" value={counts.contacted} copy="Organisations that have had an initial LevyTate follow-up." />
        <SummaryCard label="Approved / onboarded" value={counts.approved} copy="Requests moving into beta access or active onboarding." />
      </section>

      <MvpPanel
        eyebrow="Lead management"
        title="Early Access pipeline"
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#102c3d]/38" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search organisation or contact"
                className="h-10 w-[250px] rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] pl-9 pr-4 text-sm text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "All" | EarlyAccessStatus)}
              className="h-10 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
            >
              <option value="All">All statuses</option>
              {earlyAccessStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        )}
      >
        {error ? (
          <div className="mb-4 rounded-2xl border border-[#c95568]/15 bg-[#fff4f5] px-4 py-3 text-sm text-[#a93d52]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-[#102c3d]/[0.12] bg-[#f8fbfa] px-5 py-12 text-center text-sm text-[#102c3d]/52">
            Loading early access requests...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#102c3d]/[0.12] bg-[#f8fbfa] px-5 py-12 text-center text-sm text-[#102c3d]/52">
            No early access requests have been captured yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.06]">
            <div className="hidden grid-cols-[1.25fr_1fr_0.7fr_0.9fr_0.8fr] gap-4 bg-[#f8fbfa] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42 lg:grid">
              <span>Organisation</span>
              <span>Contact</span>
              <span>Employees</span>
              <span>Submitted</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-[#102c3d]/[0.06]">
              {filteredLeads.map((lead) => (
                <article key={lead.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.25fr_1fr_0.7fr_0.9fr_0.8fr] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-[#0b8e82]" />
                      <p className="text-sm font-semibold">{lead.organisation}</p>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#102c3d]/58">
                      {lead.biggestChallenge || "No challenge note supplied yet."}
                    </p>
                    {lead.currentProvider ? (
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#0b6f63]">
                        Provider: {lead.currentProvider}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <UserRound size={16} className="text-[#102c3d]/46" />
                      <p className="text-sm font-semibold">{lead.contactName}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[#102c3d]/58">
                      <Mail size={14} />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">{lead.employeeCount}</p>
                    <p className="mt-1 text-xs text-[#102c3d]/52">employee band</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">{formatSubmittedDate(lead.submittedAt)}</p>
                    <p className="mt-1 text-xs text-[#102c3d]/52">captured in beta CRM</p>
                  </div>

                  <div className="flex items-center gap-2 lg:justify-end">
                    <StatusPill status={lead.status} />
                    <select
                      value={lead.status}
                      disabled={updatingId === lead.id}
                      onChange={(event) => void handleStatusChange(lead.id, event.target.value as EarlyAccessStatus)}
                      className="h-9 rounded-full border border-[#102c3d]/[0.08] bg-white px-3 text-xs font-semibold text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
                    >
                      {earlyAccessStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </MvpPanel>
    </div>
  );
}

function SummaryCard({ label, value, copy }: { label: string; value: number; copy: string }) {
  return (
    <article className="rounded-xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_36px_rgba(16,44,61,0.045)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{copy}</p>
    </article>
  );
}

function StatusPill({ status }: { status: EarlyAccessStatus }) {
  const tone = {
    New: "bg-[#fff4f5] text-[#a93d52]",
    Contacted: "bg-[#eef8f4] text-[#0b6f63]",
    Approved: "bg-[#e8f4fb] text-[#20597c]",
    Declined: "bg-[#f5f6f7] text-[#56656e]",
    Onboarded: "bg-[#102c3d] text-white",
  } satisfies Record<EarlyAccessStatus, string>;

  return (
    <span className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ${tone[status]}`}>
      {status}
    </span>
  );
}

function formatSubmittedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function mergeLeads(serverLeads: EarlyAccessRequest[], localLeads: EarlyAccessRequest[]) {
  const seen = new Map<string, EarlyAccessRequest>();

  [...serverLeads, ...localLeads].forEach((lead) => {
    if (!seen.has(lead.id)) {
      seen.set(lead.id, lead);
    }
  });

  return Array.from(seen.values()).sort((left, right) =>
    right.submittedAt.localeCompare(left.submittedAt),
  );
}

function readLocalLeads() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(earlyAccessStorageKey) ?? "[]") as EarlyAccessRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLocalLeads(leads: EarlyAccessRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(earlyAccessStorageKey, JSON.stringify(leads));
}
