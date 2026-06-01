import { NextResponse } from "next/server";
import {
  buildGeneratePrompt,
  callOpenAI,
  type StrategyGeneratePayload,
} from "@/lib/strategy-builder";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StrategyGeneratePayload;

    if (!payload.context?.organisationName || !payload.context?.industry) {
      return NextResponse.json(
        { message: "Organisation name and industry are required." },
        { status: 400 },
      );
    }

    const strategy = await callOpenAI(buildGeneratePrompt(payload));

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error("Strategy generation failed", error);

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
