import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import { LevyTatePastoralError } from "@/lib/server/levytate-pastoral";
import { runPastoralAssistant } from "@/lib/server/levytate-pastoral-assistant";

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Forbidden." }, 403);
  try {
    const input = await readBoundedJson(request, 32 * 1024);
    return reply({ ok: true, response: await runPastoralAssistant(session, input) });
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) return reply({ message: error.tooLarge ? "The My Support message is too large." : "A valid My Support message is required." }, error.tooLarge ? 413 : 400);
    if (error instanceof LevyTatePastoralError) return reply({ message: error.message }, error.status);
    console.error("LevyTate pastoral assistant failed", error instanceof Error ? error.name : "unknown");
    return reply({ message: "The AI conversation is temporarily unavailable. You can still request support from an approved person." }, 503);
  }
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
}
