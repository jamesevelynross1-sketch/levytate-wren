import { NextResponse } from "next/server";

// Local development keeps these routes open for the documented debug workflow.
// Production builds, including Vercel preview, do not expose provider diagnostics.
export function stockDebugDisabledResponse() {
  if (process.env.NODE_ENV !== "production") return null;

  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
