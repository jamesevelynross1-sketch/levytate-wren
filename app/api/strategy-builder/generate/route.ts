import { NextResponse } from "next/server";
import {
  buildGeneratePrompt,
  callOpenAI,
  type StrategyGeneratePayload,
} from "@/lib/strategy-builder";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StrategyGeneratePayload;
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

    const strategy = await callOpenAI(buildGeneratePrompt(payload));

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
