import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie } from "@/lib/server/levytate-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(levytateBetaSessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  for (const name of [levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie]) {
    response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
  }
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}
