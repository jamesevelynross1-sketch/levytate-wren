/**
 * England levy-payer planning model. Rules snapshot reviewed 25 Nov 2026.
 * Deliberately separate actual DAS evidence from estimates. Monetary values are
 * integer pence; monthly timing is an estimate, not an ILR payment calculation.
 */
export const fundingRuleVersion = "England 2026/27 · 25 November 2026";
export const fundingSources = {
  policy: "https://www.gov.uk/government/publications/apprenticeship-funding/apprenticeship-funding",
  technical: "https://www.gov.uk/government/publications/apprenticeship-technical-funding-guide/apprenticeship-technical-funding-guide-from-august-2026",
  reforms: "https://www.gov.uk/government/publications/resources-for-promoting-apprenticeships-and-skills/growth-and-skills-levy-accessible-version-of-gsl-reforms-factsheet",
  rules: "https://www.gov.uk/government/publications/apprenticeship-funding-rules-and-assessment-plan-guidance-2026-to-2027",
};
export const withdrawnStandardIds = new Set(["ST1016","ST0843","ST0386","ST0170","ST1380","ST0384","ST0330","ST0708","ST0192","ST1379","ST0007","ST0385","ST0945","ST0809","ST0272","ST0556"]);
export type OpeningFund = { receiptMonth: string; amountPence: number };
export type PlannedCohort = {
  id: string; name: string; standardId: string; standardTitle: string; level: number;
  startMonth: string; learners: number; pricePence: number; bandPence: number;
  durationMonths: number; assessmentMonths: number; ageAtStart: number;
  exception: "none" | "care-ehcp" | "foundation-other";
  route: "levy" | "private"; fundingChecked: boolean; department: string;
};
export type PlannerInputs = {
  openingMonth: string; openingPence: number; openingFunds: OpeningFund[];
  horizon: 12 | 24 | 36 | 48; monthlyReceiptsPence: number;
  monthlyExistingPence: number; existingMonths: number; existingShortfallRate: 0 | 5 | 25;
  monthlyTransferPence: number; transferMonths: number; cohorts: PlannedCohort[];
};
export type Eligibility = { eligible: boolean; reason: string; shortfallRate: 0 | 25; provisional: boolean };
const monthPattern = /^(20[2-4][0-9])-(0[1-9]|1[0-2])$/;
export function validMonth(month: string) { return monthPattern.test(month); }
export function addMonths(month: string, offset: number) {
  const [y,m] = month.split("-").map(Number);
  const index = y * 12 + m - 1 + offset;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2,"0")}`;
}
export function expiryMonth(receiptMonth: string) { return addMonths(receiptMonth, receiptMonth < "2026-08" ? 24 : 12); }
const money = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000_000;
const integer = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
export function cohortEligibility(c: PlannedCohort): Eligibility {
  const provisional = c.startMonth > "2027-07";
  const shortfallRate = c.ageAtStart < 25 ? 0 : 25;
  const deny = (reason: string): Eligibility => ({ eligible: false, reason, shortfallRate, provisional });
  if (c.route === "private") return deny("Private funding selected");
  if (!c.fundingChecked) return deny("Funding eligibility not confirmed — excluded from levy");
  if (c.startMonth < "2026-08") return deny("Earlier start needs its original funding rules");
  if (withdrawnStandardIds.has(c.standardId.toUpperCase().split("-")[0]) && c.startMonth >= "2026-09") return deny("Government funding withdrawn for new starts");
  if (!c.standardId || c.bandPence <= 0) return deny("Standard and funding band required");
  if (c.level === 7 && c.ageAtStart > 21 && !(c.ageAtStart <= 24 && c.exception === "care-ehcp")) return deny("Level 7 age restriction");
  if (/foundation apprenticeship/i.test(c.standardTitle) && c.ageAtStart > 21 && !(c.ageAtStart <= 24 && c.exception !== "none")) return deny("Foundation apprenticeship age restriction");
  if (c.level === 2 && /^(administrative|administration) assistant\b/i.test(c.standardTitle) && c.ageAtStart > 24) return deny("Level 2 administrative assistant age restriction");
  return { eligible: true, reason: provisional ? "2026/27 rules carried forward as an assumption" : "Modelled as eligible; provider must confirm", shortfallRate, provisional };
}
export function validatePlanner(input: PlannerInputs): string[] {
  const errors: string[] = [];
  if (!validMonth(input.openingMonth) || input.openingMonth < "2026-07") errors.push("Choose an opening month from July 2026 onward.");
  if (![12,24,36,48].includes(input.horizon)) errors.push("Choose a supported forecast horizon.");
  if (![input.openingPence,input.monthlyReceiptsPence,input.monthlyExistingPence,input.monthlyTransferPence].every(money)) errors.push("Enter valid non-negative money amounts (up to £1bn).");
  if (!integer(input.existingMonths,0,48) || !integer(input.transferMonths,0,48) || ![0,5,25].includes(input.existingShortfallRate)) errors.push("Check commitment periods and assumed co-investment.");
  if (input.openingFunds.length > 48 || input.cohorts.length > 50) errors.push("Use at most 48 opening fund rows and 50 cohorts.");
  for (const fund of input.openingFunds) {
    if (!validMonth(fund.receiptMonth) || fund.receiptMonth > input.openingMonth || expiryMonth(fund.receiptMonth) <= input.openingMonth || !money(fund.amountPence)) errors.push("Opening funds must have valid receipt months, remain unexpired at the opening month and have non-negative amounts.");
  }
  if (input.openingFunds.reduce((n,f)=>n+f.amountPence,0)>input.openingPence) errors.push("Opening fund amounts exceed the opening balance.");
  if (new Set(input.cohorts.map(c=>c.id)).size !== input.cohorts.length) errors.push("Duplicate cohort identifier.");
  for (const c of input.cohorts) {
    if (!c.name.trim() || !validMonth(c.startMonth) || c.startMonth <= input.openingMonth || !integer(c.learners,1,10000) || !money(c.pricePence) || c.pricePence === 0 || !money(c.bandPence) || !integer(c.durationMonths,8,72) || !integer(c.assessmentMonths,0,12) || !integer(c.ageAtStart,16,100) || !integer(c.level,2,7) || !["none","care-ehcp","foundation-other"].includes(c.exception) || !["levy","private"].includes(c.route)) errors.push(`Check cohort "${c.name || "Untitled"}": start month, cost, age, duration and learner count are required.`);
  }
  return [...new Set(errors)];
}
type Payment = { cohortId: string; month: string; eligiblePence: number; directPence: number; shortfallRate: 0 | 25 };
export function cohortPayments(c: PlannedCohort): Payment[] {
  const eligibility = cohortEligibility(c);
  const eligiblePerLearner = eligibility.eligible ? Math.min(c.pricePence,c.bandPence) : 0;
  const privatePerLearner = c.pricePence - eligiblePerLearner;
  const training = Math.floor(eligiblePerLearner * 80 / 100);
  const split = (total: number,i: number) => Math.floor(total*(i+1)/c.durationMonths)-Math.floor(total*i/c.durationMonths);
  // One-month payment lag is a planning assumption. Completion is separate;
  // over-band/private costs are assumed spread over training (not a mandated schedule).
  const payments = Array.from({length:c.durationMonths},(_,i)=>({
    cohortId:c.id, month:addMonths(c.startMonth,i+1), eligiblePence:split(training,i)*c.learners,
    directPence:split(privatePerLearner,i)*c.learners, shortfallRate:eligibility.shortfallRate,
  }));
  if (eligiblePerLearner > 0) payments.push({
    cohortId:c.id,month:addMonths(c.startMonth,c.durationMonths+Math.max(1,c.assessmentMonths)),
    eligiblePence:(eligiblePerLearner-training)*c.learners,directPence:0,shortfallRate:eligibility.shortfallRate,
  });
  return payments;
}
export type ForecastMonth = {
  month: string; opening: number; receipts: number; existingDue: number; transfersDue: number;
  transfersUnfunded: number; proposedDue: number; levyUsed: number; expired: number;
  existingCash: number; proposedCash: number; government: number; closing: number; unaged: number;
};
type Bucket = { receiptMonth: string; amountPence: number; expiry: string | null };
export function forecastLevy(input: PlannerInputs, includeCohorts = true) {
  const errors = validatePlanner(input);
  if (errors.length) throw new Error(errors.join(" "));
  const openingUnaged = input.openingPence - input.openingFunds.reduce((n,f)=>n+f.amountPence,0);
  // Unknown age is kept available until spent. This is an optimistic assumption,
  // never treated as confirmed expiry or a decision-ready affordability forecast.
  const buckets: Bucket[] = input.openingFunds.map(f=>({...f,expiry:expiryMonth(f.receiptMonth)})).sort((a,b)=>a.receiptMonth.localeCompare(b.receiptMonth));
  if (openingUnaged) buckets.unshift({receiptMonth:"unknown",amountPence:openingUnaged,expiry:null});
  const payments = includeCohorts ? input.cohorts.flatMap(cohortPayments) : [];
  const balance = () => buckets.reduce((n,b)=>n+b.amountPence,0);
  function consume(amount:number) {
    let remaining = amount;
    for (const bucket of buckets) {
      const used = Math.min(remaining,bucket.amountPence);
      bucket.amountPence -= used; remaining -= used;
      if (!remaining) break;
    }
    return amount-remaining;
  }
  const rows: ForecastMonth[] = [];
  for (let i=1;i<=input.horizon;i++) {
    const month=addMonths(input.openingMonth,i), opening=balance(), receipts=input.monthlyReceiptsPence;
    buckets.push({receiptMonth:month,expiry:expiryMonth(month),amountPence:receipts});
    const transfersDue=i<=input.transferMonths?input.monthlyTransferPence:0;
    const existingDue=i<=input.existingMonths?input.monthlyExistingPence:0;
    const transferUsed=consume(transfersDue), existingUsed=consume(existingDue);
    const existingShortfall=existingDue-existingUsed;
    const existingCash=Math.round(existingShortfall*input.existingShortfallRate/100);
    let levyUsed=transferUsed+existingUsed, proposedDue=0, proposedCash=0, government=existingShortfall-existingCash;
    // Existing transfers first, then existing apprenticeships, then proposed
    // cohorts in displayed order. Actual AS provider ordering may differ.
    for (const p of payments.filter(p=>p.month===month)) {
      proposedDue += p.eligiblePence+p.directPence;
      const used=consume(p.eligiblePence), shortfall=p.eligiblePence-used, cash=Math.round(shortfall*p.shortfallRate/100);
      levyUsed+=used; proposedCash+=cash+p.directPence; government+=shortfall-cash;
    }
    let expired=0;
    for(const b of buckets) if(b.expiry && b.expiry<=month){expired+=b.amountPence;b.amountPence=0;}
    rows.push({month,opening,receipts,existingDue,transfersDue,transfersUnfunded:transfersDue-transferUsed,proposedDue,levyUsed,expired,existingCash,proposedCash,government,closing:balance(),unaged:buckets.filter(b=>b.expiry===null).reduce((n,b)=>n+b.amountPence,0)});
  }
  const sum=(key:keyof Omit<ForecastMonth,"month">)=>rows.reduce((n,r)=>n+r[key],0);
  const last=rows.at(-1)!;
  return {rows,openingUnaged,closing:last.closing,expiry:sum("expired"),cash:sum("existingCash")+sum("proposedCash"),proposedCash:sum("proposedCash"),unfundedTransfers:sum("transfersUnfunded"),government:sum("government"),levyUsed:sum("levyUsed"),proposedDue:sum("proposedDue"),futureProposedDue:payments.filter(p=>p.month>last.month).reduce((n,p)=>n+p.eligiblePence+p.directPence,0),firstShortfallMonth:rows.find(r=>r.existingCash+r.proposedCash+r.transfersUnfunded>0)?.month??null};
}
export function estimateMonthly(values: number[]) { return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0; }
