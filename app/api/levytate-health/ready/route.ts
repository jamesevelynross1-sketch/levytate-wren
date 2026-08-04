import { NextResponse } from "next/server";
import { getPublicReadiness } from "@/lib/server/levytate-service-health";

const headers = { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=5", "X-Robots-Tag": "noindex, nofollow", "Content-Type": "application/json; charset=utf-8" };
export async function GET() { const result = await getPublicReadiness(); return NextResponse.json(result, { status: result.status === "unavailable" ? 503 : 200, headers }); }
export async function HEAD() { const result = await getPublicReadiness(); return new NextResponse(null, { status: result.status === "unavailable" ? 503 : 200, headers }); }
