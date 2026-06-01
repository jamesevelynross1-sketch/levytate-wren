import { NextResponse } from "next/server";
import {
  isValidEmail,
  normaliseEmail,
  unsubscribeSubscriber,
  unsubscribeSubscriberByToken,
} from "@/lib/server/subscribers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const email = normaliseEmail(body.email);

    if (token) {
      await unsubscribeSubscriberByToken(token);
      return NextResponse.json({
        ok: true,
        message: "You’ve been unsubscribed from the MPR Intelligence Briefing.",
      });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    // TODO: Remove email-only unsubscribe once all legacy subscribers have tokens.
    await unsubscribeSubscriber(email);

    return NextResponse.json({
      ok: true,
      message: "You’ve been unsubscribed from the MPR Intelligence Briefing.",
    });
  } catch (error) {
    console.error("Unsubscribe route failed", error);
    return NextResponse.json(
      { message: "We could not complete the unsubscribe request." },
      { status: 500 },
    );
  }
}
