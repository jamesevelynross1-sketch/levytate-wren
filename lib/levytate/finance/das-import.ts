import type { DasColumnKey, DasColumnMapping, DasFinanceCategory, DasFinanceTransaction, DasImportIssue, DasImportResult } from "./types";

const aliases: Record<DasColumnKey, readonly string[]> = {
  date: ["transaction date", "date", "payment date"],
  description: ["transaction type", "type", "description", "transaction description"],
  amount: ["amount", "transaction amount", "value"],
  debit: ["debit", "debit amount", "money out"],
  credit: ["credit", "credit amount", "money in"],
  balance: ["balance", "account balance", "current balance"],
  provider: ["provider", "provider name", "training provider"],
  learner: ["learner", "learner name", "apprentice", "apprentice name"],
  programme: ["programme", "programme name", "course", "course name"],
  paye: ["paye", "paye scheme", "paye scheme reference"],
  payrollMonth: ["payroll month", "payroll period", "month"],
};

export const financeUploadMaxBytes = 5 * 1024 * 1024;

export function normaliseDasHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_.\-/]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

export function detectDasColumns(headers: string[]): DasColumnMapping {
  const normalised = new Map(headers.map((header) => [normaliseDasHeader(header), header]));
  return Object.fromEntries(Object.entries(aliases).flatMap(([key, candidates]) => {
    const match = candidates.map((candidate) => normalised.get(candidate)).find(Boolean);
    return match ? [[key, match]] : [];
  })) as DasColumnMapping;
}

export function parseDasDate(value: string) {
  const trimmed = value.trim();
  let year: number; let month: number; let day: number;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const uk = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (uk) [, day, month, year] = uk.map(Number);
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMoneyToPence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed) || /^-/.test(trimmed);
  const cleaned = trimmed.replace(/[£,$()\s]/g, "").replace(/^[-+]/, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, decimals = ""] = cleaned.split(".");
  const pence = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return negative ? -pence : pence;
}

export function classifyDasTransaction(description: string): DasFinanceCategory {
  const text = description.trim().toLowerCase().replace(/\s+/g, " ");
  if (/\b(expir(?:y|ed|ation)|funds expired)\b/.test(text)) return "levy_expiry";
  if (/\b(transfer).{0,24}\b(received|in|credit)\b|\btransfer received\b/.test(text)) return "transfer_in";
  if (/\b(transfer).{0,24}\b(sent|out|debit)\b|\btransfer sent\b/.test(text)) return "transfer_out";
  if (/\b(refund|reversal|adjustment|correction)\b/.test(text)) return "refund_or_adjustment";
  if (/\b(provider payment|apprenticeship payment|training payment|payment to provider)\b/.test(text)) return "apprenticeship_spend";
  if (/\b(levy credit|levy payment|levy contribution|funding received|credit into levy)\b/.test(text)) return "levy_in";
  return "other";
}

export function parseDasCsv(csv: string, suppliedMapping?: DasColumnMapping): DasImportResult {
  const table = parseCsvTable(csv.replace(/^\uFEFF/, ""));
  if (!table.length || !table[0].some((cell) => cell.trim())) return { headers: [], detectedMapping: {}, needsMapping: true, transactions: [], issues: [{ sourceRow: 1, field: "file", message: "The CSV is empty." }], sourceRows: 0, dateRange: null };
  const headers = table[0].map((header) => header.trim());
  const detectedMapping = detectDasColumns(headers);
  const mapping = { ...detectedMapping, ...suppliedMapping };
  const hasMoney = Boolean(mapping.amount || mapping.debit || mapping.credit);
  const needsMapping = !mapping.date || !mapping.description || !hasMoney;
  if (needsMapping && !suppliedMapping) return { headers, detectedMapping, needsMapping: true, transactions: [], issues: [], sourceRows: Math.max(0, table.length - 1), dateRange: null };

  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const transactions: DasFinanceTransaction[] = [];
  const issues: DasImportIssue[] = [];
  table.slice(1).forEach((cells, offset) => {
    const sourceRow = offset + 2;
    if (!cells.some((cell) => cell.trim())) return;
    const read = (key: DasColumnKey) => mapping[key] ? cells[index[mapping[key] as string]]?.trim() ?? "" : "";
    const transactionDate = parseDasDate(read("date"));
    const description = read("description");
    const amountValue = mapping.amount ? parseMoneyToPence(read("amount")) : null;
    const debit = mapping.debit ? parseMoneyToPence(read("debit")) : null;
    const credit = mapping.credit ? parseMoneyToPence(read("credit")) : null;
    const rawAmount = amountValue ?? (credit !== null ? Math.abs(credit) : debit !== null ? -Math.abs(debit) : null);
    if (!transactionDate) issues.push({ sourceRow, field: "date", message: "Use DD/MM/YYYY or YYYY-MM-DD." });
    if (!description) issues.push({ sourceRow, field: "description", message: "Transaction description is missing." });
    if (rawAmount === null) issues.push({ sourceRow, field: "amount", message: "Amount is missing or malformed." });
    if (!transactionDate || !description || rawAmount === null) return;
    const category = classifyDasTransaction(description);
    const amountPence = normaliseDirection(rawAmount, category);
    const reportedBalance = mapping.balance ? parseMoneyToPence(read("balance")) : null;
    const identity = [transactionDate, normaliseDasHeader(description), amountPence, read("provider"), read("learner"), read("programme")].join("|");
    transactions.push({
      transactionId: fingerprint(identity), transactionDate, description, category, amountPence,
      providerName: read("provider") || undefined, apprenticeName: read("learner") || undefined,
      programmeName: read("programme") || undefined, payeScheme: read("paye") || undefined,
      payrollMonth: read("payrollMonth") || undefined, reportedBalancePence: reportedBalance ?? undefined,
      sourceRow, fingerprint: fingerprint(identity),
    });
  });
  const dates = transactions.map((item) => item.transactionDate).sort();
  return { headers, detectedMapping, needsMapping: false, transactions, issues, sourceRows: Math.max(0, table.length - 1), dateRange: dates.length ? { from: dates[0], to: dates.at(-1) as string } : null };
}

export function sanitiseFinanceFileName(value: string) {
  return value.split(/[\\/]/).at(-1)?.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "das-transactions.csv";
}

export function mergeFinanceTransactions(existing: DasFinanceTransaction[], incoming: DasFinanceTransaction[]) {
  const seen = new Set(existing.map((item) => item.fingerprint));
  const added = incoming.filter((item) => !seen.has(item.fingerprint) && seen.add(item.fingerprint));
  return { transactions: [...existing, ...added].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate)), newCount: added.length, duplicateCount: incoming.length - added.length };
}

function normaliseDirection(amount: number, category: DasFinanceCategory) {
  if (["apprenticeship_spend", "levy_expiry", "transfer_out"].includes(category)) return -Math.abs(amount);
  if (["levy_in", "transfer_in"].includes(category)) return Math.abs(amount);
  return amount;
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `das-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function parseCsvTable(value: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '"' && quoted && value[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && value[index + 1] === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
