import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { applyEmployerDeliveryAction, getEmployerDeliveryWorkspace, LevyTateProviderDeliveryError } from "@/lib/server/levytate-provider-delivery";
import { assertExpectedWorkspace, ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";

async function currentSession() {
  const store=await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}
const respond=(body:unknown,status=200)=>NextResponse.json(body,{
  status,headers:{"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow"},
});
function fail(error:unknown) {
  if (error instanceof ClientRequestError || error instanceof LevyTateProviderDeliveryError)
    return respond({message:error.message},error.status);
  return respond({message:"Provider delivery is temporarily unavailable."},503);
}
export async function GET(request:Request) {
  try {
    const session=await currentSession();
    if (!session) return respond({message:"Unauthorised."},401);
    await assertExpectedWorkspace(request,session.email);
    const workspace=await getEmployerDeliveryWorkspace(session);
    if (!workspace) return respond({message:"Provider delivery is not enabled."},404);
    return respond({ok:true,workspace});
  } catch(error) { return fail(error); }
}
export async function POST(request:Request) {
  try {
    const session=await currentSession();
    if (!session) return respond({message:"Unauthorised."},401);
    const body=await readAuthenticatedJson(request,session.email,8*1024);
    await applyEmployerDeliveryAction(session,body);
    const workspace=await getEmployerDeliveryWorkspace(session);
    return respond({ok:true,workspace});
  } catch(error) { return fail(error); }
}
