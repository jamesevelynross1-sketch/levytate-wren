import { NextResponse } from "next/server";
import { levyTateAuthCallbackUrl } from "@/lib/levytate/hosts";
import { genericSignInRequestMessage, requestEmployerSignIn } from "@/lib/server/levytate-auth";
import { checkMagicLinkRequestLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";

const waitMessage = "Please wait before requesting another sign-in link.";
const unavailableMessage = "Secure sign-in is temporarily unavailable. Please try again shortly.";

export async function POST(request: Request) {
  const generic = NextResponse.json({ ok: true, message: genericSignInRequestMessage });
  try {
    const body = await request.json() as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.trim()) return generic;
    const rateLimit = await checkMagicLinkRequestLimits(request, body.email);
    if (!rateLimit.allowed) return NextResponse.json({ ok: false, message: waitMessage }, { status: 429 });
    await requestEmployerSignIn(body.email, levyTateAuthCallbackUrl(request.url, "/levytate/auth/callback"));
  } catch (error) {
    if (error instanceof LevyTateRateLimitStoreError) {
      return NextResponse.json({ ok: false, message: unavailableMessage }, { status: 503 });
    }
    console.error("LevyTate secure sign-in request failed", error instanceof Error ? error.name : "unknown");
  }
  return generic;
}
