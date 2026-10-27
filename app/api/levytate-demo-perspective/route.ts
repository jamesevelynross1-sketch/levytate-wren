import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  levytateBetaSessionCookie,
  levytateBetaSessionMaxAge,
} from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { setLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import {
  getDemoRoleSwitcherState,
  isDemoRoleSwitcherRuntimeEnabled,
  levytateDemoControllerCookie,
  LevyTateDemoRoleSwitcherError,
  switchDemoPerspective,
} from "@/lib/server/levytate-demo-role-switcher";

export async function GET() {
  if (!isDemoRoleSwitcherRuntimeEnabled()) return response({ message: "Not found." }, 404);
  try {
    const session = await currentSession();
    if (!session) return response({ message: "Not found." }, 404);
    const store = await cookies();
    const state = await getDemoRoleSwitcherState(
      session,
      store.get(levytateDemoControllerCookie)?.value,
    );
    return response({ ok: true, switcher: state });
  } catch (error) {
    return roleSwitcherError(error, true);
  }
}

export async function POST(request: Request) {
  if (!isDemoRoleSwitcherRuntimeEnabled()) return response({ message: "Not found." }, 404);
  if (!isSameOriginRequest(request)) {
    return response({ message: "The demo perspective request could not be verified." }, 403);
  }

  try {
    const session = await currentSession();
    if (!session) return response({ message: "Your session has ended. Sign in again." }, 401);
    const body = await readBody(request);
    const store = await cookies();
    const result = await switchDemoPerspective(
      session,
      store.get(levytateDemoControllerCookie)?.value,
      body.perspective,
    );
    const next = response({ ok: true, switcher: result.state });
    setLevyTateAuthCookies(next, request.headers.get("host"), [
      { name: levytateBetaSessionCookie, value: result.sessionToken, maxAge: levytateBetaSessionMaxAge },
    ]);
    return next;
  } catch (error) {
    return roleSwitcherError(error, false);
  }
}

async function currentSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

async function readBody(request: Request): Promise<{ perspective?: unknown }> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new LevyTateDemoRoleSwitcherError("invalid_request", "Choose an available demo perspective.", 400);
  }
  try {
    return await request.json() as { perspective?: unknown };
  } catch {
    throw new LevyTateDemoRoleSwitcherError("invalid_request", "Choose an available demo perspective.", 400);
  }
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function roleSwitcherError(error: unknown, concealEligibility: boolean) {
  if (error instanceof LevyTateDemoRoleSwitcherError) {
    if (concealEligibility && ["disabled", "unauthorised"].includes(error.code)) {
      return response({ message: "Not found." }, 404);
    }
    return response({ message: error.message }, error.status);
  }
  console.error("LevyTate demo perspective switch failed", { outcome: "unavailable" });
  return response({ message: "Demo perspectives are temporarily unavailable." }, 503);
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
