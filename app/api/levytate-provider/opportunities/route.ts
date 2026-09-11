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
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";

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
  if (!hasSameOrigin(request)) return noStore({ message: "Forbidden." }, 403);
  try {
    const action = await readJson(request);
    return noStore({ ok: true, opportunity: await applyProviderRequestActionForSession(session, action) });
  } catch (error) {
    return safeError(error);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await readBoundedJson(request, 64 * 1024);
  } catch (error) {
    if (error instanceof BoundedJsonBodyError && error.tooLarge) {
      throw new LevyTateServiceRequestError("The Opportunity action is too large.", 413);
    }
    throw new LevyTateServiceRequestError("A valid Opportunity action is required.", 400);
  }
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

async function providerSession() {
  const store = await cookies();
  return readAuthorisedLevyTateProviderSession(store.get(levytateProviderSessionCookie)?.value);
}

function safeError(error: unknown) {
  if (error instanceof LevyTateServiceRequestError) return noStore({ message: error.message }, error.status);
  console.error("LevyTate provider Opportunities route failed", error instanceof Error ? error.name : "unknown");
  return noStore({ message: "Opportunities are temporarily unavailable." }, 503);
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
