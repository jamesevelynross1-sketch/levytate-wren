import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createLevyTateApprovalToken, isLevyTateApprovalStatus, levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { isEarlyAccessStatus } from "@/lib/levytate/early-access/domain";
import { syncPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import { EarlyAccessStoreError, updateEarlyAccessStatus } from "@/lib/server/levytate-early-access";

type PatchBody = {
  status?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);

  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  if (session.accessLevel !== "beta_admin") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as PatchBody;
    if (!isEarlyAccessStatus(body.status)) {
      return NextResponse.json(
        { message: "Status is not recognised." },
        { status: 400 },
      );
    }

    const { id } = await params;
    const leadForAccess = await updateEarlyAccessStatus(id, body.status);
    await syncPersistentEarlyAccessState(leadForAccess.email, body.status);

    const approvalToken = isLevyTateApprovalStatus(body.status)
      ? await createLevyTateApprovalToken(leadForAccess.email, body.status)
      : null;

    return NextResponse.json({ ok: true, lead: leadForAccess, approvalToken });
  } catch (error) {
    const status = error instanceof EarlyAccessStoreError ? 400 : 500;
    return NextResponse.json(
      {
        message:
          error instanceof EarlyAccessStoreError
            ? error.message
            : "Early access lead could not be updated.",
      },
      { status },
    );
  }
}
