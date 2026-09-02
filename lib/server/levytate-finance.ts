import { createHash, randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { DasFinanceCategory, DasFinanceTransaction, DasImportResult, LevyFinanceImportRecord, LevyFinanceState } from "@/lib/levytate/finance/types";
import { sanitiseFinanceFileName } from "@/lib/levytate/finance/das-import";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseDelete, supabaseInsert, supabaseSelect } from "@/lib/server/levytate-supabase";

const importsTable = "levytate_finance_imports";
const transactionsTable = "levytate_finance_transactions";
const balancesTable = "levytate_finance_balances";
const categories = new Set<DasFinanceCategory>(["levy_in", "apprenticeship_spend", "levy_expiry", "transfer_out", "transfer_in", "refund_or_adjustment", "other"]);

type FinanceImportRow = { organisation_id:string; id:string; file_name:string; source_rows:number; new_transactions:number; duplicate_rows:number; review_rows:number; date_range_from:string|null; date_range_to:string|null; imported_by:string; imported_at:string };
type FinanceTransactionRow = { organisation_id:string; fingerprint:string; transaction_id:string; transaction_date:string; description:string; category:DasFinanceCategory; amount_pence:number; provider_name:string; apprentice_name:string; programme_name:string; paye_scheme:string; payroll_month:string; reported_balance_pence:number|null; source_row:number; import_id:string|null; created_at:string };
type FinanceBalanceRow = { organisation_id:string; amount_pence:number; confirmed_by:string; confirmed_at:string; updated_at:string };

export class LevyTateFinanceError extends Error { constructor(message:string){super(message);this.name="LevyTateFinanceError";} }

function config(){const value=getLevyTateSupabaseConfig();if(!value)throw new LevyTateFinanceError("Finance persistence is unavailable.");return value;}
async function contextFor(session:LevyTateBetaSession,write=false){const context=await getLearnerLifecycleServerContext(session);const permission=write?"finance:manage":"finance:read";if(!hasMvpPermission(context.user.role,permission))throw new LevyTateLearnerLifecyclePermissionError(`${normaliseMvpUserRole(context.user.role)} cannot access organisation Finance.`);return context;}

export async function getOrganisationFinanceState(session:LevyTateBetaSession):Promise<LevyFinanceState>{
  const context=await contextFor(session);
  const [transactions,imports,balances]=await Promise.all([
    supabaseSelect<FinanceTransactionRow>(config(),transactionsTable,new URLSearchParams({select:"*",organisation_id:`eq.${context.organisation.id}`,order:"transaction_date.asc",limit:"10000"})),
    supabaseSelect<FinanceImportRow>(config(),importsTable,new URLSearchParams({select:"*",organisation_id:`eq.${context.organisation.id}`,order:"imported_at.desc",limit:"100"})),
    supabaseSelect<FinanceBalanceRow>(config(),balancesTable,new URLSearchParams({select:"*",organisation_id:`eq.${context.organisation.id}`,limit:"1"})),
  ]);
  return {version:1,mode:"persistent",transactions:transactions.map(transactionFromRow),imports:imports.map(importFromRow),manualBalancePence:balances[0]?.amount_pence,manualBalanceConfirmedAt:balances[0]?.confirmed_at};
}

export async function importOrganisationFinance(session:LevyTateBetaSession,fileName:string,result:Pick<DasImportResult,"transactions"|"sourceRows"|"dateRange">){
  const context=await contextFor(session,true);
  if(!Array.isArray(result.transactions)||result.transactions.length<1||result.transactions.length>10000)throw new LevyTateFinanceError("The finance import must contain between 1 and 10,000 valid transactions.");
  const normalised=result.transactions.map(validateTransaction);
  const unique=[...new Map(normalised.map(item=>[item.fingerprint,item])).values()];
  const existing=await supabaseSelect<{fingerprint:string}>(config(),transactionsTable,new URLSearchParams({select:"fingerprint",organisation_id:`eq.${context.organisation.id}`,limit:"10000"}));
  const existingFingerprints=new Set(existing.map(item=>item.fingerprint));
  const added=unique.filter(item=>!existingFingerprints.has(item.fingerprint));
  const now=new Date().toISOString();const importId=randomUUID();
  const record:FinanceImportRow={organisation_id:context.organisation.id,id:importId,file_name:sanitiseFinanceFileName(fileName),source_rows:Math.max(0,Math.floor(result.sourceRows)),new_transactions:added.length,duplicate_rows:result.transactions.length-added.length,review_rows:unique.filter(item=>item.category==="other").length,date_range_from:result.dateRange?.from??null,date_range_to:result.dateRange?.to??null,imported_by:context.user.email,imported_at:now};
  await supabaseInsert(config(),importsTable,[record]);
  try{if(added.length)await supabaseInsert(config(),transactionsTable,added.map(item=>transactionToRow(context.organisation.id,importId,item,now)),{query:"on_conflict=organisation_id,fingerprint",prefer:"resolution=ignore-duplicates,return=minimal"});}
  catch(error){await supabaseDelete(config(),importsTable,`organisation_id=eq.${context.organisation.id}&id=eq.${importId}`);throw error;}
  return {record:importFromRow(record),state:await getOrganisationFinanceState(session)};
}

export async function confirmOrganisationFinanceBalance(session:LevyTateBetaSession,amountPence:number){
  const context=await contextFor(session,true);if(!Number.isSafeInteger(amountPence)||amountPence<0)throw new LevyTateFinanceError("Enter a valid non-negative DAS balance.");
  const now=new Date().toISOString();
  await supabaseInsert<FinanceBalanceRow>(config(),balancesTable,[{organisation_id:context.organisation.id,amount_pence:amountPence,confirmed_by:context.user.email,confirmed_at:now,updated_at:now}],{query:"on_conflict=organisation_id",prefer:"resolution=merge-duplicates,return=minimal"});
  return getOrganisationFinanceState(session);
}

function validateTransaction(item:DasFinanceTransaction){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.transactionDate)||!item.description?.trim()||!categories.has(item.category)||!Number.isSafeInteger(item.amountPence)||!Number.isInteger(item.sourceRow)||item.sourceRow<1)throw new LevyTateFinanceError("The finance import contains an invalid transaction.");
  const canonical=[item.transactionDate,item.description.trim().toLowerCase().replace(/\s+/g," "),item.amountPence,item.providerName??"",item.apprenticeName??"",item.programmeName??""].join("|");
  return {...item,description:item.description.trim().slice(0,500),fingerprint:createHash("sha256").update(canonical).digest("hex")};
}
function transactionToRow(organisationId:string,importId:string,item:ReturnType<typeof validateTransaction>,createdAt:string):FinanceTransactionRow{return{organisation_id:organisationId,fingerprint:item.fingerprint,transaction_id:item.transactionId||item.fingerprint,transaction_date:item.transactionDate,description:item.description,category:item.category,amount_pence:item.amountPence,provider_name:(item.providerName??"").slice(0,240),apprentice_name:(item.apprenticeName??"").slice(0,240),programme_name:(item.programmeName??"").slice(0,240),paye_scheme:(item.payeScheme??"").slice(0,120),payroll_month:(item.payrollMonth??"").slice(0,120),reported_balance_pence:item.reportedBalancePence??null,source_row:item.sourceRow,import_id:importId,created_at:createdAt};}
function transactionFromRow(row:FinanceTransactionRow):DasFinanceTransaction{return{transactionId:row.transaction_id,transactionDate:row.transaction_date,description:row.description,category:row.category,amountPence:Number(row.amount_pence),providerName:row.provider_name||undefined,apprenticeName:row.apprentice_name||undefined,programmeName:row.programme_name||undefined,payeScheme:row.paye_scheme||undefined,payrollMonth:row.payroll_month||undefined,reportedBalancePence:row.reported_balance_pence===null?undefined:Number(row.reported_balance_pence),sourceRow:row.source_row,fingerprint:row.fingerprint};}
function importFromRow(row:FinanceImportRow):LevyFinanceImportRecord{return{id:row.id,importedAt:row.imported_at,fileName:row.file_name,sourceRows:row.source_rows,newTransactions:row.new_transactions,duplicateRows:row.duplicate_rows,reviewRows:row.review_rows,dateRange:row.date_range_from&&row.date_range_to?{from:row.date_range_from,to:row.date_range_to}:null};}
