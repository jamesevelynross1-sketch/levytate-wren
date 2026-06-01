import { NextResponse } from "next/server";
import {
  buildRefinePrompt,
  callOpenAI,
  type StrategyRefinePayload,
} from "@/lib/strategy-builder";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StrategyRefinePayload;

    if (!payload.currentStrategy || !payload.instruction) {
      return NextResponse.json(
        { message: "Current strategy and refinement instruction are required." },
        { status: 400 },
      );
    }

    const strategy = await callOpenAI(buildRefinePrompt(payload));

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
