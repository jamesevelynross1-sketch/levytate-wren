import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, assertAuthenticatedWrite, readBrowserJson } from "@/lib/server/levytate-request-boundary";
import { listTenantOffboarding, runTenantOffboarding, tenantLifecycleControls } from "@/lib/server/levytate-tenant-offboarding";

async function currentSession() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
export async function GET() {
  try { const session = await currentSession(); if (!session) return reply({ message: "Unauthorised." }, 401);
    const [cases, controls] = await Promise.all([listTenantOffboarding(session), tenantLifecycleControls(session)]); return reply({ cases, ...controls }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readBrowserJson(request, 32768);
    const session = await currentSession(); if (!session) return reply({ message: "Unauthorised." }, 401);
    await assertAuthenticatedWrite(request, session.email);
    return reply(await runTenantOffboarding(session, body));
  } catch (error) { return failure(error); }
}
function failure(error: unknown) { return reply({ message: error instanceof ClientRequestError ? error.message : "Offboarding could not be confirmed. The employer remains suspended; inspect the case before retrying." }, error instanceof ClientRequestError ? error.status : 503); }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } }); }
