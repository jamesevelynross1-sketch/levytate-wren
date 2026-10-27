import { headers } from "next/headers";
import { levytateManifestForHost } from "@/lib/levytate/pwa-manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = (await headers()).get("host");
  return Response.json(levytateManifestForHost(host), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/manifest+json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
