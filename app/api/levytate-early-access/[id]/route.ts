import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createLevyTateApprovalToken, isLevyTateApprovalStatus, levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { isEarlyAccessStatus, type EarlyAccessRequest, type EarlyAccessStatus } from "@/lib/levytate/early-access/domain";
import { syncPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import { EarlyAccessStoreError, updateEarlyAccessStatus } from "@/lib/server/levytate-early-access";

type PatchBody = {
  status?: unknown;
  lead?: Partial<EarlyAccessRequest>;
};

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
    const body = (await request.json()) as PatchBody;
    if (!isEarlyAccessStatus(body.status)) {
      return NextResponse.json(
        { message: "Status is not recognised." },
        { status: 400 },
      );
    }

    const fallbackLead = buildFallbackLead(body.lead, body.status);
    let updated: EarlyAccessRequest | null = null;

    try {
      const { id } = await params;
      updated = await updateEarlyAccessStatus(id, body.status);
    } catch (error) {
      if (!(error instanceof EarlyAccessStoreError) || !fallbackLead) {
        throw error;
      }
    }

    const leadForAccess = updated ?? fallbackLead;
    if (!leadForAccess) {
      throw new EarlyAccessStoreError("Lead could not be found.");
    }

    try {
      await syncPersistentEarlyAccessState(leadForAccess.email, body.status);
    } catch {
      // The demo can still issue a signed approval token when server-side persistence is unavailable.
    }

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

function buildFallbackLead(lead: Partial<EarlyAccessRequest> | undefined, status: EarlyAccessStatus) {
  if (!lead || typeof lead.email !== "string") return null;

  const email = lead.email.trim().toLowerCase();
  if (!email) return null;

  return {
    id: typeof lead.id === "string" && lead.id.trim() ? lead.id : `local-${email}`,
    organisation: typeof lead.organisation === "string" ? lead.organisation : "",
    contactName: typeof lead.contactName === "string" ? lead.contactName : "",
    email,
    employeeCount: typeof lead.employeeCount === "string" ? lead.employeeCount : "",
    biggestChallenge: typeof lead.biggestChallenge === "string" ? lead.biggestChallenge : "",
    consent: lead.consent !== false,
    submittedAt: typeof lead.submittedAt === "string" && lead.submittedAt ? lead.submittedAt : new Date().toISOString(),
    status,
  } satisfies EarlyAccessRequest;
}
