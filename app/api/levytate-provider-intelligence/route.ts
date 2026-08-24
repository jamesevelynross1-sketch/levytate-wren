import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getProviderIntelligence } from "@/lib/server/levytate-provider-intelligence";
export async function GET(){const store=await cookies();const session=await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);if(!session)return NextResponse.json({message:"Unauthorised."},{status:401});return NextResponse.json(await getProviderIntelligence(),{headers:{"Cache-Control":"private, max-age=300"}});}
