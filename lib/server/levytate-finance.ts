import { createHash } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { DasFinanceCategory, DasFinanceTransaction, DasImportResult, LevyFinanceImportRecord, LevyFinanceState } from "@/lib/levytate/finance/types";
import { parseDasDate, sanitiseFinanceFileName } from "@/lib/levytate/finance/das-import";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseFetchJson, supabaseSelect, supabaseSelectAll } from "@/lib/server/levytate-supabase";

const importsTable = "levytate_finance_imports";
const transactionsTable = "levytate_finance_transactions";
const balancesTable = "levytate_finance_balances";
const categories = new Set<DasFinanceCategory>(["levy_in", "apprenticeship_spend", "levy_expiry", "transfer_out", "transfer_in", "refund_or_adjustment", "other"]);

type FinanceImportRow = { organisation_id:string; id:string; file_name:string; source_rows:number; new_transactions:number; duplicate_rows:number; review_rows:number; date_range_from:string|null; date_range_to:string|null; imported_by:string; imported_at:string };
type FinanceTransactionRow = { organisation_id:string; fingerprint:string; transaction_id:string; transaction_date:string; description:string; category:DasFinanceCategory; amount_pence:number; provider_name:string; apprentice_name:string; programme_name:string; paye_scheme:string; payroll_month:string; reported_balance_pence:number|null; source_row:number; import_id:string|null; created_at:string };
type FinanceBalanceRow = { organisation_id:string; amount_pence:number; confirmed_by:string; confirmed_at:string; updated_at:string };

export class LevyTateFinanceError extends Error { constructor(message:string,readonly status=400){super(message);this.name="LevyTateFinanceError";} }

function config(){const value=getLevyTateSupabaseConfig();if(!value)throw new LevyTateFinanceError("Finance persistence is unavailable.");return value;}
async function contextFor(session:LevyTateBetaSession,write=false){const context=await getLearnerLifecycleServerContext(session);const permission=write?"finance:manage":"finance:read";if(!hasMvpPermission(context.user.role,permission))throw new LevyTateLearnerLifecyclePermissionError(`${normaliseMvpUserRole(context.user.role)} cannot access organisation Finance.`);return context;}

export async function getOrganisationFinanceState(session:LevyTateBetaSession):Promise<LevyFinanceState>{
  const context=await contextFor(session);
  // Compare the transactionally advanced revision around all pages. Never show
  // reconciled totals assembled across concurrent imports or balance updates.
  const revision=async()=> (await supabaseSelect<{revision:number|string}>(config(),"levytate_finance_versions",new URLSearchParams({select:"revision",organisation_id:`eq.${context.organisation.id}`,limit:"1"})))[0]?.revision??0;
  for(let attempt=0;attempt<3;attempt++){
    const before=await revision();
    const [transactions,imports,balances]=await Promise.all([
      supabaseSelectAll<FinanceTransactionRow>(config(),transactionsTable,new URLSearchParams({select:"*",organisation_id:`eq.${context.organisation.id}`,order:"transaction_date.asc,fingerprint.asc"})),
      supabaseSelectAll<FinanceImportRow>(config(),importsTable,new URLSearchParams({select:"*",organisation_id:`eq.${context.organisation.id}`,order:"imported_at.desc,id.asc"})),
      supabaseSelect<FinanceBalanceRow>(config(),balancesTable,new URLSearchParams({select:"*",organisation_id:`eq.${context.organisation.id}`,limit:"1"})),
    ]);
    if(String(before)===String(await revision()))return {version:1,mode:"persistent",transactions:transactions.map(transactionFromRow),imports:imports.map(importFromRow),manualBalancePence:balances[0]?Number(balances[0].amount_pence):undefined,manualBalanceConfirmedAt:balances[0]?.confirmed_at};
  }
  throw new LevyTateFinanceError("Finance changed during reconciliation. Retry to load a consistent evidence set.",503);
}

export async function importOrganisationFinance(session:LevyTateBetaSession,fileName:string,result:Pick<DasImportResult,"transactions"|"sourceRows"|"dateRange">){
  const context=await contextFor(session,true);
  if(!Array.isArray(result.transactions)||result.transactions.length<1||result.transactions.length>10000)throw new LevyTateFinanceError("The finance import must contain between 1 and 10,000 valid transactions.");
  if(!Number.isInteger(result.sourceRows)||result.sourceRows!==result.transactions.length)throw new LevyTateFinanceError("Correct malformed source rows before importing. Partial Finance imports are not accepted.");
  const normalised=result.transactions.map(validateTransaction);
  const input={fileName:sanitiseFinanceFileName(fileName),sourceRows:result.sourceRows,transactions:normalised.map(transactionToInput)};
  const requestId=createHash("sha256").update(JSON.stringify({actor:context.user.id,input})).digest("hex");
  const record=await financeCommand<FinanceImportRow>(context,"import",requestId,input);
  return {record:importFromRow(record),state:await getOrganisationFinanceState(session)};
}

export async function confirmOrganisationFinanceBalance(session:LevyTateBetaSession,amountPence:number,options?:{expectedConfirmedAt:string|null;requestId:string}){
  const context=await contextFor(session,true);if(!Number.isSafeInteger(amountPence)||amountPence<0)throw new LevyTateFinanceError("Enter a valid non-negative DAS balance.");
  if(!options||!Object.hasOwn(options,"expectedConfirmedAt")||(options.expectedConfirmedAt!==null&&(typeof options.expectedConfirmedAt!=="string"||!Number.isFinite(Date.parse(options.expectedConfirmedAt))))||! /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(options.requestId))throw new LevyTateFinanceError("Refresh Finance before confirming a balance; a current version and request ID are required.",409);
  await financeCommand<FinanceBalanceRow>(context,"balance",options.requestId,{amountPence,expectedConfirmedAt:options.expectedConfirmedAt});
  return getOrganisationFinanceState(session);
}

async function financeCommand<T>(context:Awaited<ReturnType<typeof contextFor>>,action:"import"|"balance",requestId:string,input:unknown):Promise<T>{
  try{return await supabaseFetchJson<T>(config(),"rpc/levytate_apply_finance_command",{method:"POST",body:JSON.stringify({p_organisation_id:context.organisation.id,p_actor_user_id:context.user.id,p_request_id:requestId,p_action:action,p_input:input})});}
  catch(error){const message=error instanceof Error?error.message:"";
    if(message.startsWith("PT409"))throw new LevyTateFinanceError("Finance evidence changed or conflicts with an existing transaction. Refresh and review; your input has been retained.",409);
    if(message.startsWith("PT403"))throw new LevyTateFinanceError("You cannot change Finance evidence in this workspace.",403);
    if(message.startsWith("PT422"))throw new LevyTateFinanceError("Check every source row, date and balance value before retrying.",422);
    throw new LevyTateFinanceError("Finance persistence is temporarily unavailable. Retry the same request safely.",503);
  }
}

function validateTransaction(item:DasFinanceTransaction){
  if(!item||typeof item!=="object"||typeof item.transactionDate!=="string"||parseDasDate(item.transactionDate)!==item.transactionDate||typeof item.description!=="string"||!item.description.trim()||item.description.length>500||!categories.has(item.category)||!Number.isSafeInteger(item.amountPence)||!Number.isInteger(item.sourceRow)||item.sourceRow<1||item.sourceRow>10001)throw new LevyTateFinanceError("The finance import contains an invalid transaction.");
  for(const [key,max] of [["transactionId",500],["providerName",240],["apprenticeName",240],["programmeName",240],["payeScheme",120],["payrollMonth",120]] as const){const value=item[key];if(value!==undefined&&(typeof value!=="string"||value.length>max))throw new LevyTateFinanceError("A Finance field exceeds its allowed length or has an invalid type.");}
  if(item.reportedBalancePence!==undefined&&!Number.isSafeInteger(item.reportedBalancePence))throw new LevyTateFinanceError("A reported Finance balance is invalid.");
  const canonical=[item.transactionDate,item.description.trim().toLowerCase().replace(/\s+/g," "),item.amountPence,item.providerName??"",item.apprenticeName??"",item.programmeName??""].join("|");
  return {...item,description:item.description.trim().slice(0,500),fingerprint:createHash("sha256").update(canonical).digest("hex")};
}
function transactionToInput(item:ReturnType<typeof validateTransaction>){return{fingerprint:item.fingerprint,transaction_id:item.transactionId||item.fingerprint,transaction_date:item.transactionDate,description:item.description,category:item.category,amount_pence:item.amountPence,provider_name:item.providerName??"",apprentice_name:item.apprenticeName??"",programme_name:item.programmeName??"",paye_scheme:item.payeScheme??"",payroll_month:item.payrollMonth??"",reported_balance_pence:item.reportedBalancePence??null,source_row:item.sourceRow};}
function transactionFromRow(row:FinanceTransactionRow):DasFinanceTransaction{return{transactionId:row.transaction_id,transactionDate:row.transaction_date,description:row.description,category:row.category,amountPence:Number(row.amount_pence),providerName:row.provider_name||undefined,apprenticeName:row.apprentice_name||undefined,programmeName:row.programme_name||undefined,payeScheme:row.paye_scheme||undefined,payrollMonth:row.payroll_month||undefined,reportedBalancePence:row.reported_balance_pence===null?undefined:Number(row.reported_balance_pence),sourceRow:row.source_row,fingerprint:row.fingerprint};}
function importFromRow(row:FinanceImportRow):LevyFinanceImportRecord{return{id:row.id,importedAt:row.imported_at,fileName:row.file_name,sourceRows:row.source_rows,newTransactions:row.new_transactions,duplicateRows:row.duplicate_rows,reviewRows:row.review_rows,dateRange:row.date_range_from&&row.date_range_to?{from:row.date_range_from,to:row.date_range_to}:null};}
