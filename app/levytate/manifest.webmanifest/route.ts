import { levytateManifest } from "@/lib/levytate/pwa-manifest";

export const dynamic = "force-static";

export function GET() {
  return Response.json(levytateManifest, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/manifest+json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
