import { NextResponse } from "next/server";
import { getLevyTateBetaAccessCode, isAllowedBetaEmail, levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!isAllowedBetaEmail(email) || code !== getLevyTateBetaAccessCode()) {
      return NextResponse.json({ ok: false, message: "Beta access is currently invite-only. Please check your access code or request access." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(levytateBetaSessionCookie, Buffer.from(JSON.stringify({ email, issuedAt: Date.now() })).toString("base64url"), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "We could not check beta access. Please try again." }, { status: 400 });
  }
}

