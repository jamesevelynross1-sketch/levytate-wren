import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { providerIntelligenceSources } from "@/lib/levytate/provider-intelligence/sources";
export async function GET(){const store=await cookies();const session=await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);if(!session||session.accessLevel!=="beta_admin")return NextResponse.json({message:"Forbidden."},{status:403});return NextResponse.json({sources:providerIntelligenceSources.map(({id,providerId,label,status,lastAttemptAt,lastSuccessfulFetchAt,lastError})=>({id,providerId,label,status,lastAttemptAt:lastAttemptAt??null,lastSuccessfulFetchAt:lastSuccessfulFetchAt??null,lastError:lastError??null}))});}
