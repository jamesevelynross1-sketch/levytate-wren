import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { startManagerAction } from "@/lib/server/levytate-manager-actions";
import { managerActionErrorResponse } from "@/lib/server/levytate-manager-action-response";
import { readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { managerStartInput, parseAction } from "@/lib/server/levytate-operational-input";

export async function POST(request: Request, { params }: { params: Promise<{ actionId: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { actionId } = await params;
    const body = parseAction(managerStartInput, await readAuthenticatedJson(request, session.email));
    return NextResponse.json({ ok: true, action: await startManagerAction(session, actionId, body.expectedVersion!, body.note ?? "") });
  } catch (error) {
    return managerActionErrorResponse("manager-action-start", error);
  }
}
