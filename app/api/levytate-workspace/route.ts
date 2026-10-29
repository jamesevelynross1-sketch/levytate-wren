import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readBrowserJson } from "@/lib/server/levytate-request-boundary";
import { parseWorkspaceMutation } from "@/lib/server/levytate-mutation-input";
import {
  LevyTateWorkspacePermissionError,
  applyWorkspaceMutationForSession,
  getWorkspaceBootstrapForSession,
} from "@/lib/server/levytate-workspace";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return noStore({ message: "Unauthorised." }, 401);
  }

  try {
    const workspace = await getWorkspaceBootstrapForSession(session);
    return noStore({ ok: true, workspace });
  } catch (error) {
    const status = error instanceof LevyTateWorkspacePermissionError ? 403 : 503;
    return noStore(
      { message: status === 403 ? "You do not have access to this workspace." : "LevyTate workspace is temporarily unavailable." },
      status,
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return noStore({ message: "Unauthorised." }, 401);
  }

  try {
    const mutation = parseWorkspaceMutation(await readBrowserJson(request, 1024 * 1024));
    const workspace = await applyWorkspaceMutationForSession(session, mutation);
    return noStore({ ok: true, workspace });
  } catch (error) {
    if (error instanceof ClientRequestError) return noStore({ message: error.message }, error.status);
    const status = error instanceof LevyTateWorkspacePermissionError ? 403 : 503;
    return noStore(
      { message: status === 403 ? "You do not have permission to perform this action." : "LevyTate could not confirm the change. Reload before retrying." },
      status,
    );
  }
}
function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
