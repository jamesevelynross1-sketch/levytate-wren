import type { NextConfig } from "next";

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (process.env.VERCEL_ENV === "production") {
  let projectRef = "[not-configured]";
  try {
    if (configuredSupabaseUrl) {
      const hostname = new URL(configuredSupabaseUrl).hostname;
      projectRef = hostname.endsWith(".supabase.co")
        ? hostname.slice(0, -".supabase.co".length)
        : "[custom-domain]";
    }
  } catch {
    projectRef = "[invalid-url]";
  }
  console.info("[LEVYTATE_TEMP_DIAGNOSTIC] Supabase project reference:", projectRef);
}

const nextConfig: NextConfig = {
  distDir: ".next",
  async headers() {
    return [
      {
        source: "/levytate-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/levytate/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
