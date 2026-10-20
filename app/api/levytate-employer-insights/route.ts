import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getEmployerIntelligenceForSession, LevyTateEmployerIntelligenceError } from "@/lib/server/levytate-employer-intelligence";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";

export async function GET() {
  const store = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
  if (!session) return response({ message: "Unauthorised." }, 401);
  try {
    return response({ ok: true, intelligence: await getEmployerIntelligenceForSession(session) });
  } catch (error) {
    if (error instanceof LevyTateLearnerLifecyclePermissionError) return response({ message: "You do not have access to organisation-wide employer intelligence." }, 403);
    const status = error instanceof LevyTateEmployerIntelligenceError ? error.status : 500;
    if (status === 500) console.error("Employer intelligence route failed", error instanceof Error ? error.name : "unknown");
    return response({ message: "Employer intelligence is temporarily unavailable." }, status);
  }
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
