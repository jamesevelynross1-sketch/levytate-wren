import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  levytateBetaSessionCookie,
  levytateBetaSessionMaxAge,
} from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { setLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import { ClientRequestError, readAuthenticatedJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";
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
  try {
    const session = await currentSession();
    if (!session) return response({ message: "Your session has ended. Sign in again." }, 401);
    const body = await readAuthenticatedJson(request, session.email, 2048);
    requireActionKeys(body, ["perspective"]);
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

function roleSwitcherError(error: unknown, concealEligibility: boolean) {
  if (error instanceof ClientRequestError) return response({ message: error.message }, error.status);
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
