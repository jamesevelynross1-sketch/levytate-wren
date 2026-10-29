import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { levyTateAuthCallbackUrl } from "@/lib/levytate/hosts";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientWorkspaceAdminError, inviteClientWorkspaceUser, listWorkspaceUsers, provisionClientWorkspaceUser, updateClientWorkspaceUser } from "@/lib/server/levytate-client-workspace-admin";
import { ClientRequestError, readBrowserJson, requireActionKeys, assertAuthenticatedWrite } from "@/lib/server/levytate-request-boundary";
import { applicationRequestUrl } from "@/lib/server/levytate-request-origin";

async function session() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
export async function GET() {
  try { const current = await session(); if (!current) return reply({ message: "Unauthorised." }, 401); return reply({ ok: true, ...await listWorkspaceUsers(current) }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readBrowserJson(request, 8192);
    const current = await session();
    if (!current) return reply({ message: "Unauthorised." }, 401);
    await assertAuthenticatedWrite(request, current.email);
    if (body.action === "provision_user") {
      requireActionKeys(body, ["action", "email", "displayName", "role"]);
      const scope = await listWorkspaceUsers(current);
      return reply({ ok: true, user: await provisionClientWorkspaceUser(current, { ...body, organisationId: scope.organisationId }) }, 201);
    }
    if (body.action === "invite_user") {
      requireActionKeys(body, ["action", "userId", "requestId", "expectedGeneration"]);
      return reply({ ok: true, user: await inviteClientWorkspaceUser(current, body, levyTateAuthCallbackUrl(applicationRequestUrl(request).href, "/levytate/auth/callback"), request) });
    }
    if (body.action === "revoke_user") {
      requireActionKeys(body, ["action", "userId"]);
      return reply({ ok: true, user: await updateClientWorkspaceUser(current, { userId: body.userId, active: false }) });
    }
    return reply({ message: "Choose a supported invitation action." }, 400);
  } catch (error) { return failure(error); }
}
function failure(error: unknown) { const known = error instanceof ClientWorkspaceAdminError || error instanceof ClientRequestError; return reply({ message: known ? error.message : "Workspace access is temporarily unavailable." }, known ? error.status : 503); }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
