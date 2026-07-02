import { NextResponse } from "next/server";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";

export async function GET() {
  const payload = await loadLevyTateStandards();
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
