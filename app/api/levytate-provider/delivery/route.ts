import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateProviderSessionCookie, readAuthorisedLevyTateProviderSession } from "@/lib/server/levytate-provider-auth";
import { getProviderDeliveryWorkspace, submitProviderDeliveryUpdate, LevyTateProviderDeliveryError } from "@/lib/server/levytate-provider-delivery";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";

async function currentSession() {
  const store = await cookies();
  return readAuthorisedLevyTateProviderSession(store.get(levytateProviderSessionCookie)?.value);
}
const respond = (body:unknown,status=200)=>NextResponse.json(body,{
  status,headers:{"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow"},
});
function fail(error:unknown) {
  if (error instanceof ClientRequestError || error instanceof LevyTateProviderDeliveryError)
    return respond({message:error.message},error.status);
  // Never leak tenant or learner detail in an unauthorised response.
  return respond({message:"Provider delivery is temporarily unavailable."},503);
}
export async function GET() {
  try {
    const session=await currentSession();
    if (!session) return respond({message:"Unauthorised."},401);
    const workspace=await getProviderDeliveryWorkspace(session);
    if (!workspace) return respond({message:"Provider delivery is not available."},404);
    return respond({ok:true,workspace});
  } catch(error) { return fail(error); }
}
export async function POST(request:Request) {
  try {
    const session=await currentSession();
    if (!session) return respond({message:"Unauthorised."},401);
    const body=await readAuthenticatedJson(request,session.email,8*1024);
    return respond({ok:true,update:await submitProviderDeliveryUpdate(session,body)},201);
  } catch(error) { return fail(error); }
}
