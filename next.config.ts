import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next",
  // A nested engineering worktree is still one standalone application. Do not
  // infer a user's home directory from an unrelated parent lockfile.
  outputFileTracingRoot: __dirname,
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
