import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { levytateManifest } from "../lib/levytate/pwa-manifest";

const root = process.cwd();
const checks: string[] = [];
const check = (label: string, condition: boolean) => {
  if (!condition) throw new Error(`PWA validation failed: ${label}`);
  checks.push(label);
};

async function main() {
const appManifest = levytateManifest;
const worker = await readFile(path.join(root, "public", "levytate-sw.js"), "utf8");
const client = await readFile(path.join(root, "components", "levytate-pwa", "LevyTatePwa.tsx"), "utf8");
const layout = await readFile(path.join(root, "app", "levytate", "layout.tsx"), "utf8");
const nextConfig = await readFile(path.join(root, "next.config.ts"), "utf8");
const microsoftValidation = await readFile(path.join(root, "scripts", "validate-microsoft-copilot-connector.ts"), "utf8");

check("manifest name", appManifest.name === "LevyTate");
check("manifest short name", appManifest.short_name === "LevyTate");
check("manifest description", appManifest.description === "The apprenticeship operations platform for employers.");
check("manifest identity is LevyTate-scoped", appManifest.id === "/levytate/");
check("manifest starts at safe login route", appManifest.start_url === "/levytate/login");
check("manifest scope is LevyTate only", appManifest.scope === "/levytate/");
check("manifest uses standalone display", appManifest.display === "standalone");
check("manifest uses LevyTate theme", appManifest.theme_color === "#17325C");
check("manifest uses white launch background", appManifest.background_color === "#FFFFFF");
check("manifest includes four icon declarations", appManifest.icons?.length === 4);
check("layout links only the LevyTate manifest", layout.includes('manifest: "/levytate/manifest.webmanifest"'));
check("layout registers LevyTate PWA bootstrap", layout.includes("<LevyTatePwaBootstrap />"));

for (const [filename, size] of [
  ["levytate-192.png", 192],
  ["levytate-512.png", 512],
  ["levytate-maskable-192.png", 192],
  ["levytate-maskable-512.png", 512],
] as const) {
  const metadata = await sharp(path.join(root, "public", "brand", "pwa", filename)).metadata();
  check(`${filename} is an exact square PNG`, metadata.format === "png" && metadata.width === size && metadata.height === size);
}

check("install prompt is captured without an intrusive popup", client.includes('window.addEventListener("beforeinstallprompt"') && client.includes("event.preventDefault()"));
check("install CTA only prompts on user action", client.includes("await prompt.prompt()") && client.includes("onClick={() => void beginInstall()}"));
check("standalone mode is detected", client.includes('(display-mode: standalone)') && client.includes("navigatorWithStandalone.standalone"));
check("installed mode hides the install button", client.includes("installed ?") && client.includes("LevyTate is installed"));
check("manual browser installation is explained", client.includes("Install app or Add to Dock"));
check("normal browser use remains available", client.includes("Browser access remains available"));
check("offline state uses approved live-data wording", client.includes("LevyTate needs an internet connection to load live apprenticeship data."));
check("service worker is LevyTate-scoped", client.includes('scope: "/levytate/"'));
check("service worker has no Cache API writes", !worker.includes("caches.open") && !worker.includes("cache.put") && !worker.includes("cache.add"));
check("service worker only handles navigations", worker.includes('request.mode !== "navigate"'));
check("service worker is same-origin and LevyTate-only", worker.includes("url.origin !== self.location.origin") && worker.includes('url.pathname.startsWith("/levytate/")'));
check("offline response cannot be cached", worker.includes('"Cache-Control": "no-store"'));
check("service worker never references authenticated APIs", !worker.includes("/api/") && !worker.toLowerCase().includes("supabase"));
check("service worker file is served no-store", nextConfig.includes('source: "/levytate-sw.js"') && nextConfig.includes("no-cache, no-store, must-revalidate"));
check("Microsoft Operations canonical link remains protected", microsoftValidation.includes('microsoftCopilotCanonicalUrl("/levytate/app", { module: "Operations" })'));
check("Microsoft canonical application base remains server-configured", microsoftValidation.includes('"LEVYTATE_APP_BASE_URL"'));

const browserVisible = `${JSON.stringify(appManifest)}\n${worker}\n${client}`;
for (const secretName of ["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "MICROSOFT_CLIENT_SECRET", "DATABASE_URL", "LEVYTATE_BETA_CODE"]) {
  check(`${secretName} is absent from browser-visible PWA assets`, !browserVisible.includes(secretName));
}

console.log(`LevyTate PWA validation passed (${checks.length}/${checks.length}).`);
}

void main();
