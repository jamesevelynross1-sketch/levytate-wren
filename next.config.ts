import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next",
  async headers() {
    return [
      {
        source: "/levytate-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/levytate/" },
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
