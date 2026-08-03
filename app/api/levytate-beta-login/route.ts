import { NextResponse } from "next/server";
import {
  createLevyTateBetaSession,
  getLevyTateBetaAccessCode,
  isInternalBetaLoginEnabled,
  isInternalValidationEmail,
  isAdminBetaEmail,
  normaliseBetaEmail,
  readLevyTateApprovalToken,
  type LevyTateBetaAccessLevel,
  levytateBetaSessionCookie,
  levytateBetaSessionMaxAge,
} from "@/lib/levytate/config/beta-access";
import { isBetaApprovedEarlyAccessStatus } from "@/lib/levytate/early-access/domain";
import { getPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import { getEarlyAccessRequestByEmail } from "@/lib/server/levytate-early-access";
import { ProspectAccessError, assertProspectLoginAccess, recordProspectFirstLogin } from "@/lib/server/levytate-prospect-access";
import { checkBetaLoginLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";

type LoginRequestBody = {
  email?: unknown;
  code?: unknown;
  approvalToken?: unknown;
};

export async function POST(request: Request) {
  try {
    if (!isInternalBetaLoginEnabled()) {
      return NextResponse.json({ ok: false, message: "Internal demonstration sign-in is not available." }, { status: 404 });
    }
    const body = await parseLoginRequestBody(request);
    const email = typeof body.email === "string" ? normaliseBetaEmail(body.email) : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const approvalToken = typeof body.approvalToken === "string" ? body.approvalToken : "";

    const rateLimit = await checkBetaLoginLimits(request, email);
    if (!rateLimit.allowed) {
      return NextResponse.json({ ok: false, message: "Please wait before trying to sign in again." }, { status: 429 });
    }

    if (!email) {
      throw new BetaLoginError("Please enter your email address.", 400);
    }

    if (!isInternalValidationEmail(email)) {
      throw new BetaLoginError("Internal demonstration sign-in is available only for fictional validation identities.", 403);
    }

    if (!code) {
      throw new BetaLoginError("Please enter your beta access code.", 400);
    }

    if (code !== getLevyTateBetaAccessCode().trim()) {
      throw new BetaLoginError("Invalid beta access code.", 401);
    }

    await assertProspectLoginAccess(email);
    const accessLevel = await resolveAccessLevel(email, approvalToken);
    const prospectAccess = await recordProspectFirstLogin(email);
    const sessionToken = await createLevyTateBetaSession(email, accessLevel, { authMode: "internal_beta" });
    const response = NextResponse.json({ ok: true, user: { email, accessLevel }, prospectAccess });

    response.cookies.set(levytateBetaSessionCookie, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: levytateBetaSessionMaxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof LevyTateRateLimitStoreError) {
      return NextResponse.json({ ok: false, message: "Internal sign-in is temporarily unavailable." }, { status: 503 });
    }
    if (!(error instanceof BetaLoginError) && !(error instanceof ProspectAccessError)) {
      console.error("LevyTate beta login failed", error);
    }

    return NextResponse.json(
      { ok: false, message: getLoginErrorMessage(error) },
      { status: getLoginErrorStatus(error) },
    );
  }
}

async function parseLoginRequestBody(request: Request): Promise<LoginRequestBody> {
  try {
    return (await request.json()) as LoginRequestBody;
  } catch {
    throw new BetaLoginError("We could not read your login request. Please try again.", 400);
  }
}

async function resolveAccessLevel(email: string, approvalToken: string): Promise<LevyTateBetaAccessLevel> {
  if (isAdminBetaEmail(email)) {
    return "beta_admin";
  }

  const [lead, persistentState, localApproval] = await Promise.all([
    getEarlyAccessRequestByEmail(email),
    getPersistentEarlyAccessState(email),
    readLevyTateApprovalToken(approvalToken),
  ]);

  const hasLocalApproval = Boolean(localApproval && localApproval.email === email);

  if (hasLocalApproval || persistentState === "approved" || (lead && isBetaApprovedEarlyAccessStatus(lead.status))) {
    return "beta_user";
  }

  if (lead || persistentState === "pending" || persistentState === "declined") {
    throw new BetaLoginError("Your Early Access request has been received and is currently under review.", 403);
  }

  throw new BetaLoginError("Beta access is currently invite-only. Please request Early Access first.", 403);
}

class BetaLoginError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BetaLoginError";
    this.status = status;
  }
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ProspectAccessError) {
    return error.message;
  }
  if (error instanceof BetaLoginError) {
    return error.message;
  }

  return "We could not check beta access. Please try again.";
}

function getLoginErrorStatus(error: unknown) {
  if (error instanceof ProspectAccessError) {
    return error.status;
  }
  if (error instanceof BetaLoginError) {
    return error.status;
  }

  return 500;
}
