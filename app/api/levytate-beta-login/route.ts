import { NextResponse } from "next/server";
import {
  createLevyTateBetaSession,
  getLevyTateBetaAccessCode,
  isAllowedBetaEmail,
  levytateBetaAccessLevel,
  levytateBetaSessionCookie,
  levytateBetaSessionMaxAge,
} from "@/lib/levytate/config/beta-access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!isAllowedBetaEmail(email)) {
      return NextResponse.json(
        { ok: false, message: "Beta access is currently invite-only. Please use the approved LevyTate beta email or request access." },
        { status: 403 },
      );
    }

    if (code !== getLevyTateBetaAccessCode().trim()) {
      return NextResponse.json({ ok: false, message: "Invalid beta access code." }, { status: 401 });
    }

    const sessionToken = await createLevyTateBetaSession(email);
    const response = NextResponse.json({ ok: true, user: { email, accessLevel: levytateBetaAccessLevel } });
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
