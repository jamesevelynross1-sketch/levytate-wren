import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { calculateLevyFinance, formatGbp } from "../lib/levytate/finance/calculations.ts";
import { classifyDasTransaction, detectDasColumns, mergeFinanceTransactions, normaliseDasHeader, parseDasCsv, parseDasDate, parseMoneyToPence, sanitiseFinanceFileName } from "../lib/levytate/finance/das-import.ts";
import { createIllustrativeFinanceFixture } from "../lib/levytate/finance/fixtures.ts";
import { hasMvpPermission } from "../lib/levytate/mvp/rbac.ts";

let passed = 0;
function check(label, condition) { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); }

check("normalises headings defensively", normaliseDasHeader(" Transaction_Date ") === "transaction date");
check("detects common DAS headings", detectDasColumns(["Transaction Date", "Description", "Amount"]).date === "Transaction Date");
check("accepts ISO dates", parseDasDate("2026-08-18") === "2026-08-18");
check("accepts UK dates", parseDasDate("18/08/2026") === "2026-08-18");
check("rejects ambiguous US dates", parseDasDate("08-18-2026") === null);
check("rejects impossible dates", parseDasDate("31/02/2026") === null);
check("parses pounds to pennies", parseMoneyToPence("£1,234.56") === 123456);
check("parses bracketed negatives", parseMoneyToPence("(42.10)") === -4210);
check("rejects malformed money", parseMoneyToPence("12.345") === null);
check("classifies levy received", classifyDasTransaction("Monthly levy contribution") === "levy_in");
check("classifies provider spend", classifyDasTransaction("Apprenticeship payment to provider") === "apprenticeship_spend");
check("classifies expiry", classifyDasTransaction("Levy funds expired") === "levy_expiry");
check("classifies transfer in", classifyDasTransaction("Transfer received") === "transfer_in");
check("classifies transfer out", classifyDasTransaction("Transfer sent") === "transfer_out");
check("classifies adjustments", classifyDasTransaction("Payment adjustment") === "refund_or_adjustment");
check("unknown descriptions need review", classifyDasTransaction("Unrecognised activity") === "other");

const csv = `Transaction Date,Description,Amount,Balance,Provider,Learner,Programme\n01/08/2026,Monthly levy contribution,"£10,000.00","£32,000",,,\n15/08/2026,Apprenticeship payment to provider,-2500.00,29500,Northstar,Fictional learner,Data Analyst\n24/08/2026,Levy funds expired,250.00,29250,,,\n25/08/2026,Unrecognised activity,10.00,29260,,,`;
const parsed = parseDasCsv(csv);
check("parses a valid CSV", parsed.transactions.length === 4 && parsed.issues.length === 0);
check("normalises spend direction", parsed.transactions[1].amountPence === -250000);
check("normalises expiry direction", parsed.transactions[2].amountPence === -25000);
check("retains reported balance", parsed.transactions[3].reportedBalancePence === 2926000);
check("reports imported date range", parsed.dateRange?.from === "2026-08-01" && parsed.dateRange.to === "2026-08-25");
check("flags missing mappings", parseDasCsv("When,What,Value\n01/08/2026,Test,10").needsMapping);
check("supports manual mapping", parseDasCsv("When,What,Value\n01/08/2026,Levy contribution,10", { date: "When", description: "What", amount: "Value" }).transactions.length === 1);
check("supports debit and credit columns", parseDasCsv("Date,Description,Debit,Credit\n01/08/2026,Levy contribution,,100\n02/08/2026,Provider payment,50,").transactions.map((item) => item.amountPence).join() === "10000,-5000");
check("reports malformed rows", parseDasCsv("Date,Description,Amount\n31/02/2026,Test,nope").issues.length === 2);
check("handles quoted descriptions", parseDasCsv('Date,Description,Amount\n01/08/2026,"Provider payment, August",100').transactions[0].description.includes(","));
check("sanitises uploaded file names", sanitiseFinanceFileName("../../das<script>.csv") === "das_script_.csv");
const merged = mergeFinanceTransactions(parsed.transactions, parsed.transactions);
check("ignores duplicate fingerprints", merged.newCount === 0 && merged.duplicateCount === 4);

const fixture = createIllustrativeFinanceFixture();
const summary = calculateLevyFinance(fixture, new Date("2026-08-18T00:00:00Z"));
check("fixture covers 18 to 24 months", summary.monthly.length >= 18 && summary.monthly.length <= 24);
check("fixture is explicitly illustrative", fixture.mode === "fixture" && fixture.imports[0].fileName.includes("illustrative"));
check("fixture uses fictional labels", fixture.transactions.filter((item) => item.apprenticeName).every((item) => item.apprenticeName.startsWith("Fictional learner")));
check("monthly received is calculated", (summary.latest?.levyReceivedPence ?? 0) > 0);
check("monthly spend is calculated", (summary.latest?.apprenticeshipSpendPence ?? 0) > 0);
check("monthly expiry is calculated", (summary.latest?.expiredPence ?? 0) > 0);
check("spend comparison is exact", summary.latest.spendVsContributionsPence === summary.latest.levyReceivedPence - summary.latest.apprenticeshipSpendPence);
check("reported balance takes priority", summary.currentBalance.source === "reported");
check("manual balance is second priority", calculateLevyFinance({ ...fixture, transactions: fixture.transactions.map(({ reportedBalancePence: _, ...item }) => item), manualBalancePence: 12300 }).currentBalance.source === "manual");
check("balance can remain unconfirmed", calculateLevyFinance({ ...fixture, transactions: fixture.transactions.map(({ reportedBalancePence: _, ...item }) => item), manualBalancePence: undefined }).currentBalance.source === "unavailable");
check("currency formatting is GBP", formatGbp(123456).startsWith("£1,235"));
check("Apprenticeship Lead can read Finance", hasMvpPermission("Apprenticeship Lead", "finance:read"));
check("Apprenticeship Lead can manage Finance", hasMvpPermission("Apprenticeship Lead", "finance:manage"));
check("Employer Admin can read Finance", hasMvpPermission("Employer Admin", "finance:read"));
check("Employee cannot read Finance", !hasMvpPermission("Employee", "finance:read"));
check("Line Manager cannot read Finance", !hasMvpPermission("Line Manager", "finance:read"));
check("Platform Admin cannot read employer Finance", !hasMvpPermission("Platform Admin", "finance:read"));

const policy = await fs.readFile("lib/levytate/core-early-access-policy.ts", "utf8");
const shell = await fs.readFile("components/levytate-mvp/LevyTateMvpApp.tsx", "utf8");
const copilot = await fs.readFile("components/levytate-mvp/AskLevyTateAiWorkspace.tsx", "utf8");
const financeCopilot = await fs.readFile("lib/levytate/finance/copilot.ts", "utf8");
check("Finance is primary for Apprenticeship Lead", policy.slice(policy.indexOf('"Apprenticeship Lead":'), policy.indexOf('"Platform Admin":')).includes('item("Finance", "Finance", "enabled", "primary", "core")'));
check("Platform Admin Finance deep links are denied", policy.slice(policy.indexOf('"Platform Admin":'), policy.indexOf('"Employer Admin":')).includes('item("Finance", "Finance", "hidden", undefined, "role-denied")'));
check("Finance module is wired into the shell", shell.includes('<LevyFinanceModule organisationId='));
check("Finance Copilot bypasses the AI endpoint", copilot.indexOf('context?.module === "Finance"') < copilot.indexOf('fetch("/api/levytate-ai"'));
check("Finance Copilot covers the six deterministic intents", ["spend", "received", "balance", "expired", "comparison", "summary"].every((intent) => financeCopilot.includes(`\"${intent}\"`)));
check("Finance Copilot uses calculated summaries", financeCopilot.includes("calculateLevyFinance(state)") && !financeCopilot.includes("fetch("));
check("no database migration was added", !(await fs.readdir("supabase/migrations")).some((file) => /finance/i.test(file)));

console.log(`\nLevy Finance validation: ${passed}/${passed} checks passed`);
