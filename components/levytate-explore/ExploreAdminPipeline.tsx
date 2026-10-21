"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, ExternalLink,
  Inbox, RefreshCw, Save, ShieldCheck,
} from "lucide-react";
import {
  EXPLORE_ENQUIRY_STATUSES, EXPLORE_REVENUE_ROUTES,
  EXPLORE_ROUTE_LABELS, EXPLORE_STATUS_LABELS,
  type ExploreEnquiryStatus, type ExploreRevenueRoute,
} from "@/lib/levytate/explore/policy";
import type { ExploreEnquiryRow } from "@/lib/server/levytate-explore";

type Result = { enquiries?: ExploreEnquiryRow[]; message?: string };
type Editable = { status: ExploreEnquiryStatus; commercialRoute: ExploreRevenueRoute; notes: string };

function shortDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function currentForm(item: ExploreEnquiryRow): Editable {
  return { status: item.status, commercialRoute: item.commercial_route, notes: item.internal_notes };
}

export function ExploreAdminPipeline() {
  const [enquiries, setEnquiries] = useState<ExploreEnquiryRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<Editable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/levytate-explore/admin/enquiries", { cache: "no-store" });
      const data = (await response.json()) as Result;
      if (!response.ok || !data.enquiries) throw new Error(data.message || "The pipeline could not be loaded.");
      setEnquiries(data.enquiries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The pipeline is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = enquiries.find(item => item.id === selectedId) || null;
  const visible = useMemo(
    () => enquiries.filter(item => filter === "all" || item.status === filter),
    [enquiries, filter],
  );
  const newCount = enquiries.filter(item => item.status === "new").length;
  const managerCount = enquiries.filter(item => item.status === "manager_conversation").length;
  const providerCount = enquiries.filter(item => item.commercial_route === "provider_referral" || item.commercial_route === "both").length;
  const licenceCount = enquiries.filter(item => item.commercial_route === "levytate_licence" || item.commercial_route === "both").length;

  function open(item: ExploreEnquiryRow) {
    setSelectedId(item.id);
    setDraft(currentForm(item));
    setNotice("");
    setError("");
  }

  async function save() {
    if (!selected || !draft || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/levytate-explore/admin/enquiries/" + selected.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: selected.updated_at,
          status: draft.status,
          commercialRoute: draft.commercialRoute,
          internalNotes: draft.notes,
        }),
      });
      const payload = (await response.json()) as { enquiry?: ExploreEnquiryRow; message?: string };
      if (!response.ok || !payload.enquiry) throw new Error(payload.message || "Unable to save the change.");
      setEnquiries(current => current.map(item => item.id === payload.enquiry?.id ? payload.enquiry : item));
      setDraft(currentForm(payload.enquiry));
      setNotice("Saved. The pipeline has been updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f2] px-5 py-7 text-[#102c3d] sm:px-9 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a className="inline-flex items-center gap-2 text-xs font-semibold text-[#102c3d]/60 hover:text-[#102c3d]" href="/levytate/app">
            <ArrowLeft size={15} /> Employer workspace
          </a>
          <a className="inline-flex items-center gap-2 text-xs font-semibold text-[#117f70] hover:underline" href="/explore" target="_blank" rel="noopener noreferrer">
            Open public Explore <ExternalLink size={14} />
          </a>
        </div>

        <div className="mt-9 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#117f70]">LEVYTATE / EXPLORE / INTERNAL</p>
            <h1 className="mt-3 text-[clamp(2.1rem,4vw,3.7rem)] font-semibold tracking-[-.06em]">Development pipeline</h1>
            <p className="mt-3 max-w-[730px] text-sm leading-7 text-[#102c3d]/65">
              Employee-initiated enquiries across employers that do not necessarily use LevyTate.
              The employee has requested MPR guidance, not authorised unsolicited manager or employer contact.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#102c3d]/15 bg-white px-5 text-xs font-semibold disabled:opacity-50">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [newCount, "New enquiries"],
            [managerCount, "Manager conversations"],
            [providerCount, "Provider referral routes"],
            [licenceCount, "LevyTate licence routes"],
          ].map(([value, label]) => (
            <div key={String(label)} className="rounded-[18px] border border-[#102c3d]/10 bg-white p-5">
              <div className="text-3xl font-semibold tabular-nums tracking-[-.04em]">{value}</div>
              <div className="mt-2 text-xs font-medium text-[#102c3d]/60">{label}</div>
            </div>
          ))}
        </div>

        {error ? <p role="alert" className="mt-5 rounded-xl border border-[#c75e64]/20 bg-[#fff0eb] p-4 text-sm text-[#923e42]">{error}</p> : null}
        {notice ? <p role="status" className="mt-5 flex items-center gap-2 rounded-xl bg-[#e5f3e9] p-4 text-sm text-[#126f60]"><CheckCircle2 size={17} /> {notice}</p> : null}

        <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(345px,420px)]">
          <section className="overflow-hidden rounded-[22px] border border-[#102c3d]/10 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#102c3d]/10 p-5">
              <h2 className="text-lg font-semibold">Enquiries <span className="text-[#102c3d]/40">({visible.length})</span></h2>
              <label className="text-xs text-[#102c3d]/60">
                <span className="sr-only">Filter enquiries by status</span>
                <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-[#102c3d]/15 bg-[#f5f6f2] px-3 py-2.5 font-semibold text-[#102c3d]">
                  <option value="all">All statuses</option>
                  {EXPLORE_ENQUIRY_STATUSES.map(value => <option key={value} value={value}>{EXPLORE_STATUS_LABELS[value]}</option>)}
                </select>
              </label>
            </div>
            {loading && !enquiries.length ? (
              <div className="p-9 text-sm text-[#102c3d]/55">Loading the private pipeline...</div>
            ) : visible.length ? (
              <div className="divide-y divide-[#102c3d]/10">
                {visible.map(item => (
                  <button key={item.id} type="button" onClick={() => open(item)}
                    className={"flex w-full items-start justify-between gap-3 px-5 py-5 text-left transition hover:bg-[#f1f5f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#159b8f] " + (selectedId === item.id ? "bg-[#e7f2ea]" : "")}>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold">{item.full_name}</span>
                      <span className="mt-1 block text-sm text-[#102c3d]/65">{item.organisation} · {item.standard_title}</span>
                      <span className="mt-2 block text-xs text-[#102c3d]/45">{shortDate(item.created_at)} · {EXPLORE_ROUTE_LABELS[item.commercial_route]}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="hidden rounded-full bg-[#e2f0e8] px-3 py-1.5 text-[10px] font-bold text-[#14766b] sm:inline">{EXPLORE_STATUS_LABELS[item.status]}</span>
                      <ArrowUpRight size={17} className="text-[#102c3d]/40" aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-[#102c3d]/55">
                <Inbox className="mx-auto mb-4 text-[#117f70]" size={28} aria-hidden="true" />
                No enquiries match this view.
              </div>
            )}
          </section>

          <section aria-label="Selected enquiry" className="lg:sticky lg:top-6">
            {selected && draft ? (
              <div className="overflow-hidden rounded-[22px] border border-[#102c3d]/10 bg-white">
                <div className="bg-[#102c3d] px-6 py-6 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#c6ebdd]">Private employee enquiry</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{selected.full_name}</h2>
                  <p className="mt-2 text-xs text-white/65">{selected.organisation} · {shortDate(selected.created_at)}</p>
                </div>
                <div className="space-y-5 p-6">
                  <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-4 text-sm">
                    <dt className="text-[#102c3d]/50">Email</dt><dd className="break-all"><a className="font-medium text-[#117f70] underline" href={"mailto:" + selected.email}>{selected.email}</a></dd>
                    <dt className="text-[#102c3d]/50">Role</dt><dd>{selected.job_title || "Not stated"}</dd>
                    <dt className="text-[#102c3d]/50">Apprenticeship</dt><dd><a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-[#117f70] underline">{selected.standard_title} <ExternalLink size={13} className="inline"/></a></dd>
                    <dt className="text-[#102c3d]/50">Interest</dt><dd className="whitespace-pre-wrap">{selected.employee_note || "General guidance"}</dd>
                    <dt className="text-[#102c3d]/50">Consent</dt><dd>{shortDate(selected.consent_given_at)} · {selected.consent_version}</dd>
                  </dl>
                  <div className="flex items-start gap-3 rounded-xl bg-[#fff3e9] p-4 text-xs leading-6 text-[#825c30]">
                    <ShieldCheck size={19} className="mt-0.5 shrink-0" />
                    Contact permission is for employee guidance only. Employer and manager outreach have not been authorised.
                  </div>
                  <label className="block text-xs font-semibold text-[#102c3d]/75" htmlFor="explore-stage">Pipeline stage
                    <select id="explore-stage" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as ExploreEnquiryStatus })} className="mt-2 block min-h-11 w-full rounded-xl border border-[#102c3d]/15 bg-[#f5f6f2] px-3 text-sm font-semibold">
                      {EXPLORE_ENQUIRY_STATUSES.map(value => <option key={value} value={value}>{EXPLORE_STATUS_LABELS[value]}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#102c3d]/75" htmlFor="explore-revenue">Potential revenue route
                    <select id="explore-revenue" value={draft.commercialRoute} onChange={e => setDraft({ ...draft, commercialRoute: e.target.value as ExploreRevenueRoute })} className="mt-2 block min-h-11 w-full rounded-xl border border-[#102c3d]/15 bg-[#f5f6f2] px-3 text-sm font-semibold">
                      {EXPLORE_REVENUE_ROUTES.map(value => <option key={value} value={value}>{EXPLORE_ROUTE_LABELS[value]}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#102c3d]/75" htmlFor="explore-notes">Internal MPR notes
                    <textarea id="explore-notes" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value.slice(0, 2000) })} rows={5} maxLength={2000} className="mt-2 block w-full resize-y rounded-xl border border-[#102c3d]/15 bg-[#f5f6f2] px-3 py-3 text-sm font-normal leading-6"/>
                  </label>
                  <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-[49px] w-full items-center justify-center gap-2 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:bg-[#20485a] disabled:opacity-55">
                    <Save size={16} /> {saving ? "Saving..." : "Save enquiry changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-[#102c3d]/10 bg-white p-8 text-center">
                <Inbox className="mx-auto mb-4 text-[#117f70]" size={29} />
                <h2 className="text-lg font-semibold">Choose an enquiry</h2>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/55">Review the employee's interest and qualify the provider referral or LevyTate licence opportunity.</p>
              </div>
            )}
          </section>
        </div>
        <p className="mt-7 text-xs leading-6 text-[#102c3d]/50">
          These are independently consented public enquiries. No record is added automatically to an employer tenant or shared with a line manager.
        </p>
      </div>
    </main>
  );
}
