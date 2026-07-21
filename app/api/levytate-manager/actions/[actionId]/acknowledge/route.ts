import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { acknowledgeManagerAction } from "@/lib/server/levytate-manager-actions";
import { managerActionErrorResponse } from "@/lib/server/levytate-manager-action-response";
import { LevyTateOperationalActionError } from "@/lib/server/levytate-operational-actions";

export async function POST(request: Request, { params }: { params: Promise<{ actionId: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { actionId } = await params;
    const body = await request.json() as { expectedVersion?: number };
    if (!Number.isInteger(body.expectedVersion)) throw new LevyTateOperationalActionError("A valid expectedVersion is required.");
    return NextResponse.json({ ok: true, action: await acknowledgeManagerAction(session, actionId, body.expectedVersion!) });
  } catch (error) {
    return managerActionErrorResponse("manager-action-acknowledge", error);
  }
}
