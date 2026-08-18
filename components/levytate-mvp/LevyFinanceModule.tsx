"use client";

import { AlertTriangle, FileUp, PoundSterling } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { calculateLevyFinance, formatGbp, monthLabel } from "@/lib/levytate/finance/calculations";
import { financeUploadMaxBytes, mergeFinanceTransactions, parseDasCsv, sanitiseFinanceFileName } from "@/lib/levytate/finance/das-import";
import { createIllustrativeFinanceFixture } from "@/lib/levytate/finance/fixtures";
import { persistFinanceState, readFinanceState } from "@/lib/levytate/finance/storage";
import type { DasColumnKey, DasColumnMapping, DasImportResult, LevyFinanceState } from "@/lib/levytate/finance/types";

const mappingFields: Array<{ key: DasColumnKey; label: string; required?: boolean }> = [
  { key: "date", label: "Date", required: true }, { key: "description", label: "Transaction description/type", required: true },
  { key: "amount", label: "Amount", required: true }, { key: "balance", label: "Optional balance" },
  { key: "provider", label: "Optional provider" }, { key: "learner", label: "Optional learner" }, { key: "programme", label: "Optional programme" },
];

export function LevyFinanceModule({ organisationId, demoMode }: { organisationId: string; demoMode: boolean }) {
  const [state, setState] = useState<LevyFinanceState | null>(null);
  const [range, setRange] = useState<6 | 12 | 24 | "all">(12);
  const [upload, setUpload] = useState<{ fileName: string; csv: string; result: DasImportResult; mapping: DasColumnMapping } | null>(null);
  const [error, setError] = useState("");
  const [balanceInput, setBalanceInput] = useState("");

  useEffect(() => {
    const stored = readFinanceState(organisationId, demoMode ? "local" : "session");
    setState(stored ?? (demoMode ? createIllustrativeFinanceFixture() : null));
  }, [demoMode, organisationId]);

  const summary = useMemo(() => state ? calculateLevyFinance(state) : null, [state]);
  const visibleMonths = summary ? (range === "all" ? summary.monthly : summary.monthly.slice(-range)) : [];

  function save(next: LevyFinanceState) {
    setState(next);
    persistFinanceState(organisationId, next, demoMode ? "local" : "session");
  }

  async function chooseFile(file?: File) {
    setError("");
    if (!file) return;
    if (!/\.csv$/i.test(file.name) || !["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", ""].includes(file.type)) return setError("Choose a valid CSV file.");
    if (file.size > financeUploadMaxBytes) return setError("The CSV must be 5MB or smaller.");
    const csv = await file.text();
    const result = parseDasCsv(csv);
    setUpload({ fileName: sanitiseFinanceFileName(file.name), csv, result, mapping: result.detectedMapping });
  }

  function confirmMapping() {
    if (!upload) return;
    const result = parseDasCsv(upload.csv, upload.mapping);
    setUpload({ ...upload, result });
  }

  function importTransactions() {
    if (!upload || upload.result.needsMapping || !upload.result.transactions.length) return;
    const current = state ?? { version: 1, mode: demoMode ? "local_import" : "session_import", transactions: [], imports: [] };
    const merged = mergeFinanceTransactions(current.transactions, upload.result.transactions);
    const next: LevyFinanceState = {
      ...current, mode: demoMode ? "local_import" : "session_import", transactions: merged.transactions,
      imports: [{ id: `import-${Date.now()}`, importedAt: new Date().toISOString(), fileName: upload.fileName, sourceRows: upload.result.sourceRows, newTransactions: merged.newCount, duplicateRows: merged.duplicateCount, reviewRows: upload.result.transactions.filter((item) => item.category === "other").length, dateRange: upload.result.dateRange }, ...current.imports].slice(0, 12),
    };
    save(next); setUpload(null);
  }

  function confirmBalance() {
    if (!state) return;
    const number = Number(balanceInput.replace(/[£,\s]/g, ""));
    if (!Number.isFinite(number) || number < 0) return setError("Enter the current DAS balance as a positive amount.");
    save({ ...state, manualBalancePence: Math.round(number * 100), manualBalanceConfirmedAt: new Date().toISOString().slice(0, 10) });
    setBalanceInput(""); setError("");
  }

  if (!state && !upload) return <EmptyFinance onFile={chooseFile} error={error} />;
  if (upload) return <ImportWorkspace upload={upload} setUpload={setUpload} onMapping={confirmMapping} onImport={importTransactions} onCancel={() => setUpload(null)} error={error} />;
  if (!state || !summary) return null;

  const latest = summary.latest;
  const lastImport = state.imports[0];
  const providerSpend = breakdown(state, "providerName");
  const programmeSpend = breakdown(state, "programmeName");

  return <div className="grid gap-5" data-testid="levy-finance-module">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><PoundSterling size={18} className="text-[#0b776e]" /><p className="text-sm font-semibold text-[#102c3d]">Levy position</p></div><p className="mt-1 text-xs text-[#102c3d]/48">Download once. Drop once. LevyTate calculates the monthly position.</p></div>
      <div className="text-right"><p className="text-xs font-semibold text-[#0b776e]">{state.mode === "fixture" ? "Illustrative DAS finance data" : "Updated from your latest DAS transaction import"}</p><p className="mt-1 text-xs text-[#102c3d]/44">{lastImport ? `Imported ${displayDate(lastImport.importedAt)}` : "No DAS data imported"}</p></div>
    </div>

    <section className="grid border-y border-[#102c3d]/[0.08] bg-white sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Current levy balance" value={summary.currentBalance.amountPence === undefined ? "Not confirmed" : formatGbp(summary.currentBalance.amountPence)} copy={summary.currentBalance.source === "reported" ? "As reported by DAS" : summary.currentBalance.source === "manual" ? "Balance confirmed from DAS" : "Confirm the current DAS balance"} />
      <Metric label="Levy received this month" value={formatGbp(latest?.levyReceivedPence ?? 0)} copy="Payments into levy account" />
      <Metric label="Levy spend this month" value={formatGbp(latest?.apprenticeshipSpendPence ?? 0)} copy="Apprenticeship payments" />
      <Metric label="Spend vs contributions" value={formatGbp(latest?.spendVsContributionsPence ?? 0)} copy={(latest?.spendVsContributionsPence ?? 0) < 0 ? "Spend exceeded contributions" : "Contributions exceeded spend"} />
      <Metric label="Expired this month" value={formatGbp(latest?.expiredPence ?? 0)} copy="Levy funds expired" tone="coral" />
    </section>

    {summary.currentBalance.source === "unavailable" ? <section className="flex flex-wrap items-end gap-3 border border-[#e6b74a]/25 bg-[#fffaf0] p-4"><div className="min-w-[220px] flex-1"><p className="font-semibold">Confirm current DAS balance</p><p className="mt-1 text-xs text-[#102c3d]/52">Enter the balance currently shown in your Apprenticeship Service account.</p></div><input aria-label="Current DAS balance" value={balanceInput} onChange={(event) => setBalanceInput(event.target.value)} placeholder="£0" className="h-11 w-40 border border-[#102c3d]/10 bg-white px-3 text-sm" /><button onClick={confirmBalance} className="h-11 bg-[#102c3d] px-4 text-sm font-semibold text-white">Confirm balance</button></section> : null}

    <section className="border border-[#102c3d]/[0.07] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Levy in vs apprenticeship spend</h2><p className="mt-1 text-xs text-[#102c3d]/48">Monthly values from the imported DAS transaction history.</p></div><div className="flex gap-1">{([6,12,24,"all"] as const).filter((item) => item === "all" || summary.monthly.length >= item).map((item) => <button key={item} onClick={() => setRange(item)} className={`min-h-9 px-3 text-xs font-semibold ${range === item ? "bg-[#102c3d] text-white" : "bg-[#f4f7f5] text-[#102c3d]/58"}`}>{item === "all" ? "All" : `${item}M`}</button>)}</div></div>
      <FinanceChart months={visibleMonths} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="border border-[#102c3d]/[0.07] bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold">Monthly position</h2><MonthlyTable months={visibleMonths} /></div>
      <div className="grid content-start gap-4">
        <section className="border border-[#102c3d]/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Levy expiry</h2><ExpiryRow label="Expired this month" value={latest?.expiredPence ?? 0} /><ExpiryRow label="Expired this financial year" value={summary.expiredFinancialYearPence} /><ExpiryRow label="Expired over imported period" value={summary.expiredImportedPeriodPence} /><p className="mt-4 border-t border-[#102c3d]/[0.07] pt-3 text-xs leading-5 text-[#102c3d]/48">Forecast expiry will become available once LevyTate can model fund age and future commitments.</p></section>
        <section className="border border-[#102c3d]/[0.07] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">DAS data</h2><label className="cursor-pointer text-xs font-semibold text-[#0b776e]">Upload newer DAS file<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} /></label></div><AuditRows record={lastImport} balanceSource={summary.currentBalance.source} /></section>
      </div>
    </section>

    {(providerSpend.length || programmeSpend.length) ? <section className="grid gap-4 lg:grid-cols-2">{providerSpend.length ? <Breakdown title="Spend by provider" rows={providerSpend} /> : null}{programmeSpend.length ? <Breakdown title="Spend by programme" rows={programmeSpend} /> : null}</section> : null}
    {summary.unknownTransactions.length ? <section className="border border-[#e6b74a]/25 bg-[#fffaf0] p-5"><div className="flex items-center gap-2"><AlertTriangle size={17} className="text-[#9a6a00]" /><h2 className="text-lg font-semibold">Needs review</h2></div><p className="mt-1 text-sm text-[#102c3d]/56">{summary.unknownTransactions.length} imported rows could not be classified and are excluded from category totals.</p><div className="mt-3 grid gap-2">{summary.unknownTransactions.slice(0, 8).map((item) => <div key={item.fingerprint} className="grid gap-1 border-t border-[#102c3d]/[0.07] pt-2 text-xs sm:grid-cols-[100px_1fr_auto]"><span>{item.transactionDate}</span><span>{item.description}</span><span className="font-semibold tabular-nums">{formatGbp(item.amountPence, true)}</span></div>)}</div></section> : null}
    {error ? <p className="text-sm font-semibold text-[#ad344e]">{error}</p> : null}
  </div>;
}

function EmptyFinance({ onFile, error }: { onFile: (file?: File) => void; error: string }) { return <section className="grid min-h-[460px] place-items-center border border-[#102c3d]/[0.07] bg-white p-6 text-center"><div className="max-w-xl"><div className="mx-auto grid h-12 w-12 place-items-center bg-[#eaf5f1] text-[#0b776e]"><FileUp size={22} /></div><h2 className="mt-5 text-2xl font-semibold">Bring your DAS finance data into LevyTate</h2><p className="mt-3 text-sm leading-6 text-[#102c3d]/56">Download your transaction history from the Finance area of the Apprenticeship Service, then upload it here. LevyTate will calculate your monthly levy position automatically.</p><label className="mt-5 inline-flex min-h-11 cursor-pointer items-center bg-[#102c3d] px-5 text-sm font-semibold text-white">Upload DAS transactions<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void onFile(event.target.files?.[0])} /></label><div className="mx-auto mt-6 max-w-sm text-left"><p className="text-sm font-semibold">You&apos;ll get:</p><ul className="mt-2 grid gap-1 text-sm text-[#102c3d]/56"><li>Monthly funding received and apprenticeship spend</li><li>Net movement, levy balance and expired funds</li><li>Monthly history and source information</li></ul></div>{error ? <p className="mt-4 text-sm text-[#ad344e]">{error}</p> : null}</div></section>; }

function ImportWorkspace({ upload, setUpload, onMapping, onImport, onCancel }: { upload: { fileName: string; csv: string; result: DasImportResult; mapping: DasColumnMapping }; setUpload: (value: typeof upload) => void; onMapping: () => void; onImport: () => void; onCancel: () => void; error: string }) {
  const review = upload.result.needsMapping;
  const months = new Set(upload.result.transactions.map((item) => item.transactionDate.slice(0,7))).size;
  const preview = calculateLevyFinance({ version: 1, mode: "session_import", transactions: upload.result.transactions, imports: [] });
  return <section className="border border-[#102c3d]/[0.07] bg-white p-5 sm:p-6"><p className="text-xs font-semibold text-[#0b776e]">{upload.fileName}</p><h2 className="mt-2 text-2xl font-semibold">{review ? "We need to confirm your file" : "Import preview"}</h2>{review ? <><p className="mt-2 text-sm text-[#102c3d]/56">Choose the columns LevyTate should use. Required fields are marked.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{mappingFields.map((field) => <label key={field.key} className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">{field.label}{field.required ? " *" : ""}<select value={upload.mapping[field.key] ?? ""} onChange={(event) => setUpload({ ...upload, mapping: { ...upload.mapping, [field.key]: event.target.value || undefined } })} className="h-11 border border-[#102c3d]/10 bg-[#f8fbfa] px-3 text-sm text-[#102c3d]"><option value="">Not mapped</option>{upload.result.headers.map((header) => <option key={header}>{header}</option>)}</select></label>)}</div><button onClick={onMapping} className="mt-5 min-h-11 bg-[#102c3d] px-5 text-sm font-semibold text-white">Confirm mapping</button></> : <><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><PreviewFact label="Transactions recognised" value={String(upload.result.transactions.length)} /><PreviewFact label="Months covered" value={String(months)} /><PreviewFact label="Levy funding received" value={formatGbp(preview.monthly.reduce((sum,item)=>sum+item.levyReceivedPence,0))} /><PreviewFact label="Apprenticeship spend" value={formatGbp(preview.monthly.reduce((sum,item)=>sum+item.apprenticeshipSpendPence,0))} /><PreviewFact label="Expired" value={formatGbp(preview.expiredImportedPeriodPence)} /><PreviewFact label="Rows need review" value={String(preview.unknownTransactions.length)} /></div>{upload.result.issues.length ? <p className="mt-4 text-sm text-[#ad344e]">{upload.result.issues.length} malformed rows will not be imported.</p> : null}<button onClick={onImport} className="mt-5 min-h-11 bg-[#102c3d] px-5 text-sm font-semibold text-white">Import transactions</button></>}<button onClick={onCancel} className="ml-3 min-h-11 px-3 text-sm font-semibold text-[#102c3d]/48">Cancel</button></section>;
}

function Metric({ label, value, copy, tone }: { label: string; value: string; copy: string; tone?: "coral" }) { return <div className="border-b border-[#102c3d]/[0.07] p-4 last:border-b-0 sm:border-r xl:border-b-0"><p className="text-xs font-semibold text-[#102c3d]/50">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums tracking-[-0.025em] ${tone ? "text-[#b94f64]" : "text-[#102c3d]"}`}>{value}</p><p className="mt-1 text-xs text-[#102c3d]/44">{copy}</p></div>; }
function PreviewFact({ label, value }: { label: string; value: string }) { return <div className="bg-[#f8fbfa] p-4"><p className="text-xs text-[#102c3d]/48">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>; }
function ExpiryRow({ label, value }: { label: string; value: number }) { return <div className="mt-3 flex items-center justify-between border-t border-[#102c3d]/[0.06] pt-3 text-sm"><span className="text-[#102c3d]/56">{label}</span><strong className="tabular-nums text-[#b94f64]">{formatGbp(value)}</strong></div>; }

function FinanceChart({ months }: { months: ReturnType<typeof calculateLevyFinance>["monthly"] }) {
  const max = Math.max(1, ...months.flatMap((month) => [month.levyReceivedPence, month.apprenticeshipSpendPence]));
  return <div className="mt-5"><div className="flex h-52 items-end gap-2 overflow-hidden border-b border-[#102c3d]/10" role="img" aria-label="Monthly levy received compared with apprenticeship spend">{months.map((month) => <div key={month.month} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1" title={`${monthLabel(month.month)}: ${formatGbp(month.levyReceivedPence)} received, ${formatGbp(month.apprenticeshipSpendPence)} spent`}><span className="w-2 max-w-[18px] flex-1 bg-[#159b8f]" style={{height:`${Math.max(3,month.levyReceivedPence/max*100)}%`}} /><span className="w-2 max-w-[18px] flex-1 bg-[#102c3d]" style={{height:`${Math.max(3,month.apprenticeshipSpendPence/max*100)}%`}} /></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-[#102c3d]/42"><span>{months[0] ? monthLabel(months[0].month) : "No data"}</span><span>{months.at(-1) ? monthLabel(months.at(-1)?.month ?? "") : ""}</span></div><div className="mt-3 flex gap-4 text-xs"><span className="flex items-center gap-2"><i className="h-2 w-2 bg-[#159b8f]" />Levy received</span><span className="flex items-center gap-2"><i className="h-2 w-2 bg-[#102c3d]" />Apprenticeship spend</span></div></div>;
}

function MonthlyTable({ months }: { months: ReturnType<typeof calculateLevyFinance>["monthly"] }) { return <div className="mt-4 grid gap-2"><div className="hidden grid-cols-6 gap-3 border-b border-[#102c3d]/[0.08] pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#102c3d]/38 md:grid"><span>Month</span><span className="text-right">Received</span><span className="text-right">Spend</span><span className="text-right">Difference</span><span className="text-right">Expired</span><span className="text-right">Balance</span></div>{[...months].reverse().map((month) => <div key={month.month} className="grid gap-2 border-b border-[#102c3d]/[0.06] py-3 text-sm md:grid-cols-6"><strong>{monthLabel(month.month)}</strong><Cell label="Received" value={formatGbp(month.levyReceivedPence)} /><Cell label="Spend" value={formatGbp(month.apprenticeshipSpendPence)} /><Cell label="Difference" value={formatGbp(month.spendVsContributionsPence)} /><Cell label="Expired" value={formatGbp(month.expiredPence)} /><Cell label="Balance" value={month.closingBalancePence === undefined ? "Not reported" : formatGbp(month.closingBalancePence)} /></div>)}</div>; }
function Cell({ label, value }: { label: string; value: string }) { return <span className="flex justify-between gap-3 tabular-nums md:block md:text-right"><small className="text-[#102c3d]/42 md:hidden">{label}</small>{value}</span>; }
function AuditRows({ record, balanceSource }: { record?: LevyFinanceState["imports"][number]; balanceSource: string }) { if (!record) return <p className="mt-3 text-sm text-[#102c3d]/48">No import recorded.</p>; const rows = [["File",record.fileName],["Rows",String(record.sourceRows)],["New",String(record.newTransactions)],["Duplicates ignored",String(record.duplicateRows)],["Needs review",String(record.reviewRows)],["Balance source",balanceSource]]; return <dl className="mt-3 grid gap-2">{rows.map(([label,value]) => <div key={label} className="flex justify-between gap-3 text-xs"><dt className="text-[#102c3d]/44">{label}</dt><dd className="max-w-[190px] truncate text-right font-semibold">{value}</dd></div>)}</dl>; }
function Breakdown({ title, rows }: { title: string; rows: Array<{ name: string; amount: number; share: number }> }) { return <section className="border border-[#102c3d]/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-3 grid gap-3">{rows.slice(0,6).map((row) => <div key={row.name}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{row.name}</span><strong className="tabular-nums">{formatGbp(row.amount)} · {row.share}%</strong></div><div className="mt-1 h-1.5 bg-[#102c3d]/[0.05]"><div className="h-full bg-[#159b8f]" style={{width:`${row.share}%`}} /></div></div>)}</div></section>; }
function breakdown(state: LevyFinanceState, key: "providerName" | "programmeName") { const spend = state.transactions.filter((item) => item.category === "apprenticeship_spend" && item[key]); const total = spend.reduce((sum,item)=>sum+Math.abs(item.amountPence),0); const grouped = new Map<string,number>(); spend.forEach((item)=>grouped.set(item[key] as string,(grouped.get(item[key] as string)??0)+Math.abs(item.amountPence))); return [...grouped].map(([name,amount])=>({name,amount,share:total?Math.round(amount/total*100):0})).sort((a,b)=>b.amount-a.amount); }
function displayDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", year:"numeric" }).format(new Date(value)); }
