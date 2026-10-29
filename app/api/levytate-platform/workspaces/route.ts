import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { levyTateAuthCallbackUrl } from "@/lib/levytate/hosts";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientWorkspaceAdminError, createClientWorkspace, inviteClientWorkspaceUser, listClientWorkspaces, provisionClientWorkspaceUser, updateClientWorkspaceUser } from "@/lib/server/levytate-client-workspace-admin";
import { ClientRequestError, readBrowserJson, requireActionKeys, assertAuthenticatedWrite } from "@/lib/server/levytate-request-boundary";
import { applicationRequestUrl } from "@/lib/server/levytate-request-origin";
import { suspendClientTenant } from "@/lib/server/levytate-tenant-lifecycle";

async function session() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
export async function GET() {
  try { const current = await session(); if (!current) return reply({ message: "Unauthorised." }, 401); return reply({ ok: true, workspaces: await listClientWorkspaces(current) }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readBrowserJson(request, 8192);
    const current = await session();
    if (!current) return reply({ message: "Unauthorised." }, 401);
    await assertAuthenticatedWrite(request, current.email);
    if (body.action === "suspend_workspace") return reply({ ok: true, suspension: await suspendClientTenant(current, body) });
    if (body.action === "create_workspace") {
      requireActionKeys(body, ["action", "name", "workspaceName", "primaryContact", "contactEmail", "initialRole"]);
      return reply({ ok: true, workspace: await createClientWorkspace(current, body) }, 201);
    }
    if (body.action === "provision_user") {
      requireActionKeys(body, ["action", "organisationId", "email", "displayName", "role"]);
      return reply({ ok: true, user: await provisionClientWorkspaceUser(current, body) }, 201);
    }
    if (body.action === "invite_user") {
      requireActionKeys(body, ["action", "userId", "requestId", "expectedGeneration"]);
      return reply({ ok: true, user: await inviteClientWorkspaceUser(current, body, levyTateAuthCallbackUrl(applicationRequestUrl(request).href, "/levytate/auth/callback"), request) });
    }
    return reply({ message: "A supported client workspace action is required." }, 400);
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try { const body = await readBrowserJson(request, 4096); requireActionKeys(body, ["userId", "role", "active"]); const current = await session(); if (!current) return reply({ message: "Unauthorised." }, 401); await assertAuthenticatedWrite(request, current.email); return reply({ ok: true, user: await updateClientWorkspaceUser(current, body) }); }
  catch (error) { return failure(error); }
}
function failure(error: unknown) { const known = error instanceof ClientWorkspaceAdminError || error instanceof ClientRequestError; return reply({ message: known ? error.message : "Client workspace administration is temporarily unavailable." }, known ? error.status : 503); }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
