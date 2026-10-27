import { NextResponse } from "next/server";
import { checkStrategyBuilderLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import { readRequestLevyTateBetaSession } from "@/lib/server/levytate-request-session";
import {
  buildGeneratePrompt,
  callOpenAI,
  clampGeneratePayload,
  type StrategyGeneratePayload,
} from "@/lib/strategy-builder";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const session = await readRequestLevyTateBetaSession(request);
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers: noStore });
  }

  let payload: StrategyGeneratePayload;
  try {
    payload = (await request.json()) as StrategyGeneratePayload;
  } catch {
    return NextResponse.json(
      { message: "Organisation context or valid scorecard context is required." },
      { status: 400 },
    );
  }

  const hasOrganisationContext = Boolean(
    payload.context?.organisationName?.trim() && payload.context?.industry?.trim(),
  );
  const hasScorecardContext = Boolean(
    typeof payload.scorecardContext?.score === "number" &&
      Number.isFinite(payload.scorecardContext.score) &&
      payload.scorecardContext?.position?.trim() &&
      Array.isArray(payload.scorecardContext?.blindSpots) &&
      Array.isArray(payload.scorecardContext?.selectedPriorities),
  );

  if (!hasOrganisationContext && !hasScorecardContext) {
    return NextResponse.json(
      { message: "Organisation context or valid scorecard context is required." },
      { status: 400 },
    );
  }

  const limited = await strategyLimitResponse(request, session.email, "/api/strategy-builder/generate");
  if (limited) return limited;

  try {
    const strategy = await callOpenAI(buildGeneratePrompt(clampGeneratePayload(payload)));
    return NextResponse.json({ strategy });
  } catch (error) {
    console.error("Strategy generation failed", {
      error,
    });

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Strategy generation failed.",
      },
      { status: 500 },
    );
  }
}

async function strategyLimitResponse(
  request: Request,
  email: string,
  route: "/api/strategy-builder/generate" | "/api/strategy-builder/refine",
) {
  try {
    const rateLimit = await checkStrategyBuilderLimits(request, email, route);
    if (rateLimit.allowed) return null;
    return NextResponse.json(
      { message: "Please wait before requesting another strategy." },
      { status: 429, headers: noStore },
    );
  } catch (error) {
    if (error instanceof LevyTateRateLimitStoreError) {
      return NextResponse.json(
        { message: "Strategy generation is temporarily unavailable." },
        { status: 503, headers: noStore },
      );
    }
    throw error;
  }
}
