import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getManagerAction } from "@/lib/server/levytate-manager-actions";
import { managerActionErrorResponse } from "@/lib/server/levytate-manager-action-response";

export async function GET(_: Request, { params }: { params: Promise<{ actionId: string }> }) {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { actionId } = await params;
    return NextResponse.json({ ok: true, action: await getManagerAction(session, actionId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return managerActionErrorResponse("manager-action-detail", error);
  }
}
