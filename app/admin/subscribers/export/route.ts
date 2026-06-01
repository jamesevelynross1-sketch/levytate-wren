import { NextResponse } from "next/server";
import { getSegmentLabel, isIntelligenceSegment } from "@/lib/segments";
import { isAdminAuthenticated } from "@/lib/server/admin-auth";
import { getSubscribersForAdmin } from "@/lib/server/subscribers";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const segmentParam = url.searchParams.get("segment") ?? "";
  const segment = isIntelligenceSegment(segmentParam) ? segmentParam : "";
  const subscribers = await getSubscribersForAdmin(search, segment);
  const csv = [
    ["email", "status", "created_at", "source_page", "segments"],
    ...subscribers.map((subscriber) => [
      subscriber.email,
      subscriber.status,
      subscriber.createdAt,
      subscriber.sourcePage ?? "",
      subscriber.segments.map(getSegmentLabel).join("; "),
    ]),
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Disposition": "attachment; filename=\"mpr-subscribers.csv\"",
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
