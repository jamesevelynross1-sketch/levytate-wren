import { NextResponse } from "next/server";
import { ClientRequestError, readBrowserJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";
import { levyTateAuthCallbackUrl } from "@/lib/levytate/hosts";
import { checkMagicLinkRequestLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import { genericProviderSignInMessage, requestProviderSignIn } from "@/lib/server/levytate-provider-auth";

const waitMessage = "Please wait before requesting another sign-in link.";
const unavailableMessage = "Secure sign-in is temporarily unavailable. Please try again shortly.";

export async function POST(request: Request) {
  const generic = noStore({ ok: true, message: genericProviderSignInMessage });
  try {
    const body = await readBrowserJson(request, 2 * 1024);
    requireActionKeys(body, ["email"]);
    if (typeof body.email !== "string" || !body.email.trim() || body.email.length > 254) return generic;
    const limit = await checkMagicLinkRequestLimits(request, body.email);
    if (!limit.allowed) return noStore({ ok: false, message: waitMessage }, 429);
    await requestProviderSignIn(body.email, levyTateAuthCallbackUrl(request.url, "/levytate/provider/auth/callback"));
  } catch (error) {
    if (error instanceof ClientRequestError) return noStore({ ok: false, message: error.message }, error.status);
    if (error instanceof LevyTateRateLimitStoreError) {
      return noStore({ ok: false, message: unavailableMessage }, 503);
    }
    console.error("LevyTate provider sign-in request failed", error instanceof Error ? error.name : "unknown");
  }
  return generic;
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
