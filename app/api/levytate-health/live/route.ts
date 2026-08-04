import { NextResponse } from "next/server";
import { createLivenessResponse } from "@/lib/server/levytate-service-health";

const headers = { "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=5", "X-Robots-Tag": "noindex, nofollow", "Content-Type": "application/json; charset=utf-8" };
export async function GET() { return NextResponse.json(createLivenessResponse(), { status: 200, headers }); }
export async function HEAD() { return new NextResponse(null, { status: 200, headers }); }
