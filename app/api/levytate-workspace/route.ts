import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import type { LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import {
  LevyTateWorkspacePermissionError,
  LevyTateWorkspacePersistenceError,
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
    const status = error instanceof LevyTateWorkspacePermissionError ? 403 : 500;
    return noStore(
      { message: getMessage(error) },
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
    const mutation = (await request.json()) as LevyTateWorkspaceMutation;
    const workspace = await applyWorkspaceMutationForSession(session, mutation);
    return noStore({ ok: true, workspace });
  } catch (error) {
    const status = error instanceof LevyTateWorkspacePermissionError
      ? 403
      : error instanceof LevyTateWorkspacePersistenceError
        ? 503
        : 500;
    return noStore(
      { message: getMessage(error) },
      status,
    );
  }
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function getMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "LevyTate workspace persistence is temporarily unavailable.";
}
