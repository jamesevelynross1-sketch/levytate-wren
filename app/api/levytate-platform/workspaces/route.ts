import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientWorkspaceAdminError, createClientWorkspace, listClientWorkspaces, provisionClientWorkspaceUser, updateClientWorkspaceUser } from "@/lib/server/levytate-client-workspace-admin";

async function session() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
export async function GET() { const current = await session(); if (!current) return reply({ message: "Unauthorised." }, 401); try { return reply({ ok: true, workspaces: await listClientWorkspaces(current) }); } catch (error) { return failure(error); } }
export async function POST(request: Request) { const current = await session(); if (!current) return reply({ message: "Unauthorised." }, 401); try { const body = await request.json() as Record<string, unknown>; if (body.action === "create_workspace") return reply({ ok: true, workspace: await createClientWorkspace(current, body) }, 201); if (body.action === "provision_user") return reply({ ok: true, user: await provisionClientWorkspaceUser(current, body) }, 201); return reply({ message: "A supported client workspace action is required." }, 400); } catch (error) { return failure(error); } }
export async function PATCH(request: Request) { const current = await session(); if (!current) return reply({ message: "Unauthorised." }, 401); try { return reply({ ok: true, user: await updateClientWorkspaceUser(current, await request.json() as Record<string, unknown>) }); } catch (error) { return failure(error); } }
function failure(error: unknown) { const status = error instanceof ClientWorkspaceAdminError ? error.status : 500; return reply({ message: error instanceof ClientWorkspaceAdminError ? error.message : "Client workspace administration is temporarily unavailable." }, status); }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
