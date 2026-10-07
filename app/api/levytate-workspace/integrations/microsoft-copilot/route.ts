import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getMicrosoftCopilotConnectionStatus } from "@/lib/server/levytate-microsoft-copilot-identity";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return response({ message: "Unauthorised." }, 401);
  try {
    const context = await getLearnerLifecycleServerContext(session);
    if (context.user.role !== "Employer Admin") return response({ message: "Employer Admin access is required." }, 403);
    return response({ connection: await getMicrosoftCopilotConnectionStatus(context.organisation.id) });
  } catch {
    return response({ message: "Microsoft 365 Copilot connection status is temporarily unavailable." }, 503);
  }
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
