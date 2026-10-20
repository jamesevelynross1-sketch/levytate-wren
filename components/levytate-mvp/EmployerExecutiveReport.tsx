import { formatGbp } from "@/lib/levytate/finance/calculations";
import * as React from "react";

import type { EmployerExecutiveReportContract } from "@/lib/levytate/intelligence/executive-report";

export function EmployerExecutiveReport({ report }: { report: EmployerExecutiveReportContract }) {
  return <article className="employer-intelligence-report hidden" aria-label={`${report.organisationName} executive intelligence report`}>
    <header><p>LEVYTATE · EMPLOYER INTELLIGENCE</p><h1>{report.organisationName}</h1><h2>Executive operating brief</h2><p>Reporting date: {dateTime(report.generatedAt)}</p></header>
    <section><h2>Current operating position</h2><div className="print-metrics">{report.signals.map((signal) => <div key={signal.id}><b>{signal.value ?? "Unavailable"}</b><span>{signal.label}</span><small>{signal.detail}</small></div>)}</div></section>
    <section><h2>Key exceptions and decisions</h2>{report.priorities.length ? <ol>{report.priorities.map((priority) => <li key={priority.id}><b>{priority.title}</b><p>{priority.evidence}</p><small>Owner: {priority.ownerRole} · Next action: {priority.nextAction}</small></li>)}</ol> : <p>No current decision or operational priority was identified.</p>}</section>
    {report.workforce ? <section className="print-break"><h2>Workforce development</h2><p><b>{report.workforce.frameworkTitle}</b> · {report.workforce.submitted} of {report.workforce.invited} submitted ({report.workforce.participationPercent}%).</p><p>{report.workforce.limitation}</p>{report.workforce.dimensions.length ? <><h3>Six-dimension evidence</h3><ul>{report.workforce.dimensions.map((item) => <li key={item.id}>{item.label}: {item.value}/100</li>)}</ul><h3>Proposed priorities</h3><ol>{report.workforce.priorities.map((item) => <li key={item.id}><b>{item.finding}</b><p>{item.evidence} {item.intervention}</p></li>)}</ol></> : null}</section> : null}
    <section className="print-break"><h2>Levy financial position</h2><p>Recorded balance: {moneyOrUnavailable(report.finance.currentBalancePence)}{report.finance.balanceEvidenceAt ? ` (evidence dated ${date(report.finance.balanceEvidenceAt)})` : ""}.</p><p>{report.finance.importedPeriod ? `Persisted imported transaction history covers ${date(report.finance.importedPeriod.from)} to ${date(report.finance.importedPeriod.to)}.` : "No imported transaction period is available."}</p><ul><li>Imported contributions: {moneyOrUnavailable(report.finance.contributionsPence)}</li><li>Recorded apprenticeship spend: {moneyOrUnavailable(report.finance.apprenticeshipSpendPence)}</li><li>Recorded expiry transactions: {moneyOrUnavailable(report.finance.expiredPence)}</li><li>Unclassified transactions: {report.finance.unclassifiedCount}</li></ul></section>
    <footer><h2>Evidence definitions and material limitations</h2><ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul><p>Aggregate employer report. Named employees, learners, action owners, free-text operational notes and private assessment records are deliberately excluded.</p></footer>
  </article>;
}

function moneyOrUnavailable(value: number | null) { return value === null ? "Unavailable" : formatGbp(value); }
function date(value: string) { const input = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value; return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(input)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
