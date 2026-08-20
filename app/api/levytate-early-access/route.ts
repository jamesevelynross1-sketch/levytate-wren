import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { syncPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import {
  buildEarlyAccessConfirmationEmail,
  buildEarlyAccessNotificationEmail,
  getEarlyAccessNotificationEmail,
  levytateEmailSender,
} from "@/lib/email/levytate-early-access";
import { sendEmail } from "@/lib/server/resend";
import {
  createEarlyAccessRequest,
  EarlyAccessStoreError,
  isValidEarlyAccessEmail,
  listEarlyAccessRequests,
  normaliseEarlyAccessEmail,
} from "@/lib/server/levytate-early-access";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);

  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  if (session.accessLevel !== "beta_admin") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
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

    await sendEarlyAccessEmails(created);

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

async function sendEarlyAccessEmails(lead: Awaited<ReturnType<typeof createEarlyAccessRequest>>) {
  const notification = buildEarlyAccessNotificationEmail(lead);
  const confirmation = buildEarlyAccessConfirmationEmail(lead);
  const results = await Promise.allSettled([
    sendEmail({
      from: levytateEmailSender,
      to: getEarlyAccessNotificationEmail(),
      ...notification,
    }),
    sendEmail({
      from: levytateEmailSender,
      to: lead.email,
      ...confirmation,
    }),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("LevyTate Early Access email failed", {
        leadId: lead.id,
        emailType: index === 0 ? "internal_notification" : "applicant_confirmation",
        error: result.reason instanceof Error ? result.reason.message : "Unknown email error",
      });
    }
  });
}

function getUserFacingError(error: unknown) {
  if (error instanceof EarlyAccessStoreError) {
    return error.message;
  }

  return "Early access is temporarily unavailable. Please try again shortly.";
}
