import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { assertExpectedAccount, ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { personalProgrammeState } from "@/lib/server/levytate-programme-discovery";

async function session() { const jar = await cookies(); return readAuthorisedLevyTateBetaSession(jar.get(levytateBetaSessionCookie)?.value); }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } }); }
function failure(error: unknown) { return reply({ message: error instanceof ClientRequestError ? error.message : "Personal programmes are temporarily unavailable." }, error instanceof ClientRequestError ? error.status : 503); }
export async function GET(request: Request) {
  try { const actor = await session(); if (!actor) return reply({ message: "Unauthorised." }, 401); assertExpectedAccount(request, actor.email); return reply({ choices: await personalProgrammeState(actor) }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { const actor = await session(); if (!actor) return reply({ message: "Unauthorised." }, 401); const command = await readAuthenticatedJson(request, actor.email, 4096); return reply({ choices: await personalProgrammeState(actor, command) }); }
  catch (error) { return failure(error); }
}
