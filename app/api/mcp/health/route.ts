import {
  isLevyTateMcpStagingOnly,
  levyTateMcpStagingNotFound,
} from "@/lib/server/levytate-mcp-staging";

export const dynamic = "force-dynamic";

export function GET() {
  if (!isLevyTateMcpStagingOnly()) return levyTateMcpStagingNotFound();

  return Response.json({
    service: "levytate-mcp",
    environment: "staging",
    status: "ready",
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function POST() {
  return levyTateMcpStagingNotFound();
}
