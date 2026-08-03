import { NextResponse } from "next/server";
import { genericSignInRequestMessage, requestEmployerSignIn } from "@/lib/server/levytate-auth";
import { authRateLimitKey, isLevyTateAuthRateLimited } from "@/lib/server/levytate-auth-rate-limit";

export async function POST(request: Request) {
  const generic = NextResponse.json({ ok: true, message: genericSignInRequestMessage });
  if (isLevyTateAuthRateLimited(authRateLimitKey(request, "request"), 5, 15 * 60_000)) return generic;
  try {
    const body = await request.json() as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.trim()) return generic;
    const origin = new URL(request.url).origin;
    await requestEmployerSignIn(body.email, `${origin}/levytate/auth/callback`);
  } catch (error) {
    console.error("LevyTate secure sign-in request failed", error instanceof Error ? error.name : "unknown");
  }
  return generic;
}
