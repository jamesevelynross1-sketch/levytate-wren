import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { listWorkspaceAccessUsers, WorkspaceAccessError } from "@/lib/server/levytate-workspace-access";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return response({ message: "Unauthorised." }, 401);
  try {
    return response({ users: await listWorkspaceAccessUsers(session) });
  } catch (error) {
    return response(
      { message: error instanceof Error ? error.message : "Workspace access information is unavailable." },
      error instanceof WorkspaceAccessError ? error.status : 500,
    );
  }
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
