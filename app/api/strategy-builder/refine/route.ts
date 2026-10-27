import { NextResponse } from "next/server";
import { checkStrategyBuilderLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import { readRequestLevyTateBetaSession } from "@/lib/server/levytate-request-session";
import {
  buildRefinePrompt,
  callOpenAI,
  clampRefinePayload,
  type StrategyRefinePayload,
} from "@/lib/strategy-builder";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const session = await readRequestLevyTateBetaSession(request);
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers: noStore });
  }

  let payload: StrategyRefinePayload;
  try {
    payload = (await request.json()) as StrategyRefinePayload;
  } catch {
    return NextResponse.json(
      { message: "Current strategy and refinement instruction are required." },
      { status: 400 },
    );
  }

  if (!payload.currentStrategy?.trim() || !payload.instruction?.trim()) {
    return NextResponse.json(
      { message: "Current strategy and refinement instruction are required." },
      { status: 400 },
    );
  }

  const limited = await strategyLimitResponse(request, session.email);
  if (limited) return limited;

  try {
    const strategy = await callOpenAI(buildRefinePrompt(clampRefinePayload(payload)));
    return NextResponse.json({ strategy });
  } catch (error) {
    console.error("Strategy refinement failed", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Strategy refinement failed.",
      },
      { status: 500 },
    );
  }
}

async function strategyLimitResponse(request: Request, email: string) {
  try {
    const rateLimit = await checkStrategyBuilderLimits(request, email, "/api/strategy-builder/refine");
    if (rateLimit.allowed) return null;
    return NextResponse.json(
      { message: "Please wait before requesting another strategy." },
      { status: 429, headers: noStore },
    );
  } catch (error) {
    if (error instanceof LevyTateRateLimitStoreError) {
      return NextResponse.json(
        { message: "Strategy refinement is temporarily unavailable." },
        { status: 503, headers: noStore },
      );
    }
    throw error;
  }
}
