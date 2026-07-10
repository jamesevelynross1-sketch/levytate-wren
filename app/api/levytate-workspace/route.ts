import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import {
  LevyTateWorkspacePermissionError,
  LevyTateWorkspacePersistenceError,
  applyWorkspaceMutationForSession,
  getWorkspaceBootstrapForSession,
} from "@/lib/server/levytate-workspace";

async function getSession() {
  const cookieStore = await cookies();
  return readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const workspace = await getWorkspaceBootstrapForSession(session);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    const status = error instanceof LevyTateWorkspacePermissionError ? 403 : 500;
    return NextResponse.json(
      { message: getMessage(error) },
      { status },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const mutation = (await request.json()) as LevyTateWorkspaceMutation;
    const workspace = await applyWorkspaceMutationForSession(session, mutation);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    const status = error instanceof LevyTateWorkspacePermissionError
      ? 403
      : error instanceof LevyTateWorkspacePersistenceError
        ? 503
        : 500;
    return NextResponse.json(
      { message: getMessage(error) },
      { status },
    );
  }
}

function getMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "LevyTate workspace persistence is temporarily unavailable.";
}
