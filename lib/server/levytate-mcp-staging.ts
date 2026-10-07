import { NextResponse } from "next/server";

const stagingMcpPath = "/api/mcp/levytate";
const stagingHealthPath = "/api/mcp/health";

export function isLevyTateMcpStagingOnly() {
  return process.env.LEVYTATE_MCP_STAGING_ONLY?.trim().toLowerCase() === "true";
}

export function isAllowedLevyTateMcpStagingRequest(pathname: string, method: string) {
  return (pathname === stagingMcpPath && method === "POST")
    || (pathname === stagingHealthPath && method === "GET");
}

export function levyTateMcpStagingNotFound() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
