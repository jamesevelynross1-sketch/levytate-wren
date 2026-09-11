import { NextResponse } from "next/server";
import { checkMagicLinkRequestLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import { genericProviderSignInMessage, requestProviderSignIn } from "@/lib/server/levytate-provider-auth";
import { readBoundedJson } from "@/lib/server/bounded-json";

const waitMessage = "Please wait before requesting another sign-in link.";
const unavailableMessage = "Secure sign-in is temporarily unavailable. Please try again shortly.";

export async function POST(request: Request) {
  const generic = noStore({ ok: true, message: genericProviderSignInMessage });
  try {
    if (!hasSameOrigin(request)) return noStore({ ok: false, message: "Forbidden." }, 403);
    const body = await readBoundedJson(request, 2 * 1024) as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.trim() || body.email.length > 254) return generic;
    const limit = await checkMagicLinkRequestLimits(request, body.email);
    if (!limit.allowed) return noStore({ ok: false, message: waitMessage }, 429);
    const origin = new URL(request.url).origin;
    await requestProviderSignIn(body.email, `${origin}/levytate/provider/auth/callback`);
  } catch (error) {
    if (error instanceof LevyTateRateLimitStoreError) {
      return noStore({ ok: false, message: unavailableMessage }, 503);
    }
    console.error("LevyTate provider sign-in request failed", error instanceof Error ? error.name : "unknown");
  }
  return generic;
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
