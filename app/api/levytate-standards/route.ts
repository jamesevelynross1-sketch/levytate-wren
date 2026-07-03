import { NextRequest, NextResponse } from "next/server";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const payload = await loadLevyTateStandards({
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    programmeType: searchParams.get("programmeType") ?? undefined,
  });

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
