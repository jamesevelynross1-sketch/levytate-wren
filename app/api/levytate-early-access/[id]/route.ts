import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { isEarlyAccessStatus } from "@/lib/levytate/early-access/domain";
import { EarlyAccessStoreError, updateEarlyAccessStatus } from "@/lib/server/levytate-early-access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);

  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { status?: unknown };
    if (!isEarlyAccessStatus(body.status)) {
      return NextResponse.json(
        { message: "Status is not recognised." },
        { status: 400 },
      );
    }

    const { id } = await params;
    const updated = await updateEarlyAccessStatus(id, body.status);

    return NextResponse.json({ ok: true, lead: updated });
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
