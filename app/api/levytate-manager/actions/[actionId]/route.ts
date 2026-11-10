import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getManagerAction } from "@/lib/server/levytate-manager-actions";
import { managerActionErrorResponse } from "@/lib/server/levytate-manager-action-response";
import { assertExpectedWorkspace } from "@/lib/server/levytate-request-boundary";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET(request: Request, { params }: { params: Promise<{ actionId: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
    if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
    await assertExpectedWorkspace(request, session.email);
    const { actionId } = await params;
    return NextResponse.json({ ok: true, action: await getManagerAction(session, actionId) }, { headers });
  } catch (error) {
    const response = managerActionErrorResponse("manager-action-detail", error);
    return new NextResponse(response.body, { status: response.status === 500 ? 503 : response.status, headers: { ...Object.fromEntries(response.headers), ...headers } });
  }
}
