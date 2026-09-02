import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import type { DasImportResult } from "@/lib/levytate/finance/types";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { confirmOrganisationFinanceBalance, getOrganisationFinanceState, importOrganisationFinance, LevyTateFinanceError } from "@/lib/server/levytate-finance";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";

async function sessionFromCookie(){const store=await cookies();return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);}
export async function GET(){const session=await sessionFromCookie();if(!session)return response({message:"Unauthorised."},401);try{return response({ok:true,state:await getOrganisationFinanceState(session)});}catch(error){return errorResponse(error);}}
export async function POST(request:Request){const session=await sessionFromCookie();if(!session)return response({message:"Unauthorised."},401);try{const body=await request.json() as {action?:"import"|"balance";fileName?:string;result?:Pick<DasImportResult,"transactions"|"sourceRows"|"dateRange">;amountPence?:number};if(body.action==="import"&&body.fileName&&body.result)return response({ok:true,...await importOrganisationFinance(session,body.fileName,body.result)});if(body.action==="balance"&&typeof body.amountPence==="number")return response({ok:true,state:await confirmOrganisationFinanceBalance(session,body.amountPence)});return response({message:"A valid finance action is required."},400);}catch(error){return errorResponse(error);}}
function errorResponse(error:unknown){const status=error instanceof LevyTateLearnerLifecyclePermissionError?403:error instanceof LevyTateFinanceError?400:500;return response({message:status===403?"You do not have access to organisation Finance.":status===400?(error as Error).message:"LevyTate Finance is temporarily unavailable."},status);}
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store, max-age=0"}});}
