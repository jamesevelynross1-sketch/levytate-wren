import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import {
  ProspectAccessError,
  completeProspectGuidance,
  controlProspectAccess,
  getProspectAccessForSession,
  listProspectAccessForAdmin,
} from "@/lib/server/levytate-prospect-access";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });

  try {
    if (session.accessLevel === "beta_admin") {
      return NextResponse.json({ ok: true, access: await listProspectAccessForAdmin() });
    }
    const access = await getProspectAccessForSession(session);
    if (!access) return NextResponse.json({ message: "Prospect access is not available for this account." }, { status: 403 });
    return NextResponse.json({ ok: true, access });
  } catch (error) {
    return responseFor(error);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.operation === "complete_guidance") {
      return NextResponse.json({ ok: true, access: await completeProspectGuidance(session) });
    }
    if (session.accessLevel !== "beta_admin") {
      throw new ProspectAccessError("forbidden", "Only LevyTate Platform Admin can control prospect access.");
    }
    const access = await controlProspectAccess({
      operation: body.operation as "activate" | "revoke" | "reactivate" | "update_expiry" | "reset_guidance",
      accessId: String(body.accessId ?? ""),
      actorEmail: session.email,
      actorRole: "Platform Admin",
      confirmation: typeof body.confirmation === "string" ? body.confirmation : undefined,
      accessStartAt: typeof body.accessStartAt === "string" ? body.accessStartAt : undefined,
      accessExpiresAt: body.accessExpiresAt === null || typeof body.accessExpiresAt === "string" ? body.accessExpiresAt : undefined,
      internalOwnerName: typeof body.internalOwnerName === "string" ? body.internalOwnerName : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
      version: typeof body.version === "number" ? body.version : undefined,
    });
    return NextResponse.json({ ok: true, access });
  } catch (error) {
    return responseFor(error);
  }
}

function responseFor(error: unknown) {
  const status = error instanceof ProspectAccessError ? error.status : 500;
  const message = error instanceof ProspectAccessError ? error.message : "Prospect access could not be updated.";
  return NextResponse.json({ message }, { status });
}
