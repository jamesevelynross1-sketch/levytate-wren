import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { syncPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import {
  createEarlyAccessRequest,
  EarlyAccessStoreError,
  isValidEarlyAccessEmail,
  listEarlyAccessRequests,
  normaliseEarlyAccessEmail,
} from "@/lib/server/levytate-early-access";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);

  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const leads = await listEarlyAccessRequests();
    return NextResponse.json({ ok: true, leads });
  } catch (error) {
    return NextResponse.json(
      { message: getUserFacingError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = normaliseEarlyAccessEmail(body.email);

    if (!isValidEarlyAccessEmail(email)) {
      return NextResponse.json(
        { message: "Please enter a valid work email." },
        { status: 400 },
      );
    }

    const created = await createEarlyAccessRequest({
      organisation: typeof body.organisation === "string" ? body.organisation : "",
      contactName: typeof body.contactName === "string" ? body.contactName : "",
      email,
      employeeCount: typeof body.employeeCount === "string" ? body.employeeCount : "",
      biggestChallenge: typeof body.biggestChallenge === "string" ? body.biggestChallenge : "",
      consent: body.consent === true,
    });

    try {
      await syncPersistentEarlyAccessState(created.email, created.status);
    } catch {
      // Allow the Early Access flow to continue when no shared store is configured.
    }

    return NextResponse.json({
      ok: true,
      lead: created,
      message:
        "Your Early Access request has been received. We will review your request and be in touch shortly.",
    });
  } catch (error) {
    const status = error instanceof EarlyAccessStoreError ? 400 : 500;
    return NextResponse.json(
      { message: getUserFacingError(error) },
      { status },
    );
  }
}

function getUserFacingError(error: unknown) {
  if (error instanceof EarlyAccessStoreError) {
    return error.message;
  }

  return "Early access is temporarily unavailable. Please try again shortly.";
}
