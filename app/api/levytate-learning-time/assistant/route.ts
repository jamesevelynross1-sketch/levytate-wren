import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import type { LearningTimeAssistantRequest } from "@/lib/levytate/off-the-job/api";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import { LevyTateLearningTimeError } from "@/lib/server/levytate-off-the-job";
import { runLearningTimeAssistant } from "@/lib/server/levytate-off-the-job-assistant";

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Forbidden." }, 403);
  try {
    const body = await readBoundedJson(request, 24 * 1024) as LearningTimeAssistantRequest;
    if (!body.learnerRecordId || !["eligibility_check", "planning", "capture_support"].includes(body.mode) || !body.prompt) return reply({ message: "A learner, assistant mode and prompt are required." }, 400);
    return reply(await runLearningTimeAssistant(session, body));
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) return reply({ message: error.tooLarge ? "The assistant request is too large." : "A valid assistant request is required." }, error.tooLarge ? 413 : 400);
    const status = error instanceof LevyTateLearningTimeError ? error.status : 500;
    if (!(error instanceof LevyTateLearningTimeError)) console.error("Learning Time assistant failed", error instanceof Error ? error.name : "unknown");
    return reply({ message: error instanceof LevyTateLearningTimeError ? error.message : "The Off-the-Job Assistant is temporarily unavailable." }, status);
  }
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
}
