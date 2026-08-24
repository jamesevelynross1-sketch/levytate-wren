import { NextResponse } from "next/server";
import { refreshProviderIntelligence } from "@/lib/server/levytate-provider-intelligence";
import { readRuntimeEnv } from "@/lib/server/levytate-supabase";
function authorised(request:Request){const expected=readRuntimeEnv("PROVIDER_INTELLIGENCE_REFRESH_SECRET")||readRuntimeEnv("CRON_SECRET");return Boolean(expected&&request.headers.get("authorization")===`Bearer ${expected}`);}
async function run(request:Request){if(!authorised(request))return NextResponse.json({message:"Unauthorised."},{status:401});return NextResponse.json({ok:true,outcomes:await refreshProviderIntelligence()});}
export const GET=run; export const POST=run;
