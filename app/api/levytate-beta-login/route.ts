import { NextResponse } from "next/server";
import {
  createLevyTateBetaSession,
  getLevyTateBetaAccessCode,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? normaliseBetaEmail(body.email) : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const approvalToken = typeof body.approvalToken === "string" ? body.approvalToken : "";

    if (code !== getLevyTateBetaAccessCode().trim()) {
      return NextResponse.json({ ok: false, message: "Invalid beta access code." }, { status: 401 });
    }

    let accessLevel: LevyTateBetaAccessLevel;

    if (isAdminBetaEmail(email)) {
      accessLevel = "beta_admin";
    } else {
      const [lead, persistentState, localApproval] = await Promise.all([
        getEarlyAccessRequestByEmail(email),
        getPersistentEarlyAccessState(email),
        readLevyTateApprovalToken(approvalToken),
      ]);

      const hasLocalApproval = Boolean(localApproval && localApproval.email === email);

      if (hasLocalApproval || persistentState === "approved" || (lead && isBetaApprovedEarlyAccessStatus(lead.status))) {
        accessLevel = "beta_user";
      } else if (lead || persistentState === "pending" || persistentState === "declined") {
        return NextResponse.json(
          { ok: false, message: "Your Early Access request has been received and is currently under review." },
          { status: 403 },
        );
      } else {
        return NextResponse.json(
          { ok: false, message: "Beta access is currently invite-only. Please request Early Access first." },
          { status: 403 },
        );
      }
    }

    const sessionToken = await createLevyTateBetaSession(email, accessLevel);
    const response = NextResponse.json({ ok: true, user: { email, accessLevel } });
    response.cookies.set(levytateBetaSessionCookie, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: levytateBetaSessionMaxAge,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "We could not check beta access. Please try again." }, { status: 400 });
  }
}
