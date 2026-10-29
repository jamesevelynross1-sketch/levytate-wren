import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  levytateProviderSessionCookie,
  readAuthorisedLevyTateProviderSession,
} from "@/lib/server/levytate-provider-auth";
import {
  LevyTateServiceRequestError,
  applyProviderRequestActionForSession,
  getProviderWorkspaceBootstrapForSession,
} from "@/lib/server/levytate-service-requests";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";

export async function GET() {
  const session = await providerSession();
  if (!session) return noStore({ message: "Unauthorised." }, 401);
  try {
    const workspace = await getProviderWorkspaceBootstrapForSession(session);
    if (!workspace) return noStore({ message: "Opportunities are unavailable." }, 404);
    return noStore({ ok: true, workspace });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  const session = await providerSession();
  if (!session) return noStore({ message: "Unauthorised." }, 401);
  try {
    const action = await readAuthenticatedJson(request, session.email, 64 * 1024);
    return noStore({ ok: true, opportunity: await applyProviderRequestActionForSession(session, action) });
  } catch (error) {
    return safeError(error);
  }
}

async function providerSession() {
  const store = await cookies();
  return readAuthorisedLevyTateProviderSession(store.get(levytateProviderSessionCookie)?.value);
}

function safeError(error: unknown) {
  if (error instanceof ClientRequestError) return noStore({ message: error.message }, error.status);
  if (error instanceof LevyTateServiceRequestError) return noStore({ message: error.message }, error.status);
  console.error("LevyTate provider Opportunities route failed", error instanceof Error ? error.name : "unknown");
  return noStore({ message: "Opportunities are temporarily unavailable." }, 503);
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
