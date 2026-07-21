import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { startManagerAction } from "@/lib/server/levytate-manager-actions";
import { managerActionErrorResponse } from "@/lib/server/levytate-manager-action-response";
import { LevyTateOperationalActionError } from "@/lib/server/levytate-operational-actions";

export async function POST(request: Request, { params }: { params: Promise<{ actionId: string }> }) {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { actionId } = await params;
    const body = await request.json() as { expectedVersion?: number; note?: string };
    if (!Number.isInteger(body.expectedVersion)) throw new LevyTateOperationalActionError("A valid expectedVersion is required.");
    return NextResponse.json({ ok: true, action: await startManagerAction(session, actionId, body.expectedVersion!, body.note ?? "") });
  } catch (error) {
    return managerActionErrorResponse("manager-action-start", error);
  }
}
