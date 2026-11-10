import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { applyLevyTatePublicCors } from "@/lib/levytate/hosts";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { syncPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import {
  buildEarlyAccessConfirmationEmail,
  buildEarlyAccessNotificationEmail,
  getEarlyAccessNotificationEmail,
  levytateEmailSender,
} from "@/lib/email/levytate-early-access";
import { sendEmail } from "@/lib/server/resend";
import { z } from "zod";
import { ClientRequestError, readPublicBrowserJson } from "@/lib/server/levytate-request-boundary";
import { checkEarlyAccessSubmissionLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import {
  createEarlyAccessRequest,
  EarlyAccessStoreError,
  isValidEarlyAccessEmail,
  listEarlyAccessRequests,
  normaliseEarlyAccessEmail,
} from "@/lib/server/levytate-early-access";

const earlyAccessInput = z.strictObject({
  organisation: z.string().trim().min(1).max(200), contactName: z.string().trim().min(1).max(200),
  email: z.string().trim().min(3).max(254), employeeCount: z.string().trim().min(1).max(80),
  biggestChallenge: z.string().trim().max(2000).optional(), consent: z.literal(true),
});

export function OPTIONS(request: Request) {
  return applyLevyTatePublicCors(request, new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);

  if (!session) return json(request, { message: "Unauthorised." }, 401);

  if (session.accessLevel !== "beta_admin") return json(request, { message: "Forbidden." }, 403);

  try {
    const leads = await listEarlyAccessRequests();
    return json(request, { ok: true, leads });
  } catch (error) {
    return json(request, { message: getUserFacingError(error) }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = earlyAccessInput.safeParse(await readPublicBrowserJson(request, 8192));
    if (!parsed.success) throw new ClientRequestError("Check the required contact details, field lengths and consent before submitting.", 400);
    const body = parsed.data;
    const email = normaliseEarlyAccessEmail(body.email);

    if (!isValidEarlyAccessEmail(email)) {
      return json(request, { message: "Please enter a valid work email." }, 400);
    }
    if (!(await checkEarlyAccessSubmissionLimits(request, email)).allowed) return json(request, { message: "Too many requests. Please wait before submitting again." }, 429);

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

    return json(request, {
      ok: true,
      lead: created,
      message:
        "Your Early Access request has been received. We will review your request and be in touch shortly.",
    });
  } catch (error) {
    if (error instanceof ClientRequestError) return json(request, { message: error.message }, error.status);
    if (error instanceof LevyTateRateLimitStoreError) return json(request, { message: "Early access is temporarily unavailable. Please try again shortly." }, 503);
    const status = error instanceof EarlyAccessStoreError ? error.status : 503;
    return json(request, { message: getUserFacingError(error) }, status);
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
        outcome: "delivery_not_confirmed",
      });
    }
  });
}

function json(request: Request, body: unknown, status = 200) {
  return applyLevyTatePublicCors(request, NextResponse.json(body, { status }));
}

function getUserFacingError(error: unknown) {
  if (error instanceof EarlyAccessStoreError) {
    return error.message;
  }

  return "Early access is temporarily unavailable. Please try again shortly.";
}
