import { mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const packageDirectory = path.join(root, "microsoft", "levytate-copilot");
const assetsDirectory = path.join(packageDirectory, "assets");
const previewDirectory = path.join(packageDirectory, "preview");
const colorPath = path.join(assetsDirectory, "color.png");
const outlinePath = path.join(assetsDirectory, "outline.png");
const contactSheetPath = path.join(previewDirectory, "brand-contact-sheet.png");
const zipPath = path.join(packageDirectory, "levytate-microsoft-copilot-1.0.0.zip");

const navy = "#17325C";
const shadow = "#0C2446";
const mint = "#C7F0E4";
const coral = "#FF8E95";

await mkdir(assetsDirectory, { recursive: true });
await mkdir(previewDirectory, { recursive: true });

await sharp(Buffer.from(colorIconSvg())).png().toFile(colorPath);
await sharp(Buffer.from(outlineIconSvg())).png().toFile(outlinePath);
await buildContactSheet();
await validateGeneratedFiles();
await buildZip();
await validateZip();

console.log("LevyTate Microsoft 365 Copilot package built and validated.");
console.log(path.relative(root, zipPath));
console.log(path.relative(root, contactSheetPath));

function colorIconSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
      <rect width="192" height="192" fill="${navy}"/>
      <g fill="none" stroke="${shadow}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" transform="translate(3 3)">
        <path d="M56 48v78h44"/>
        <path d="M91 51h51M118 51v91"/>
      </g>
      <path d="M56 48v78h44" fill="none" stroke="${mint}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M91 51h51M118 51v91" fill="none" stroke="${coral}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function outlineIconSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <g fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 4v22h8"/>
        <path d="M15 5h14M22 5v23"/>
      </g>
    </svg>
  `;
}

async function buildContactSheet() {
  const width = 1320;
  const height = 720;
  const colorSizes = [192, 96, 48, 32, 24, 20, 16];
  const outlineSizes = [32, 24, 20, 16];
  const colorIcon = await readFile(colorPath);
  const outlineIcon = await readFile(outlinePath);
  const wordmark = await readFile(path.join(root, "public", "logos", "levytate-transparent.png"));
  const composites = [
    { input: svgText("Microsoft 365 Copilot brand QA", 48, 54, 28, 700, navy), left: 0, top: 0 },
    { input: svgText("Existing LevyTate wordmark", 48, 110, 15, 700, "#557080"), left: 0, top: 0 },
    { input: await sharp(wordmark).resize({ width: 330 }).png().toBuffer(), left: 48, top: 135 },
    { input: svgText("Colour icon — Microsoft safe-zone and small-size checks", 48, 260, 18, 700, navy), left: 0, top: 0 },
    { input: svgText("Outline icon — transparent, white-only", 48, 565, 18, 700, navy), left: 0, top: 0 },
  ];

  let x = 48;
  for (const size of colorSizes) {
    const swatch = Math.max(size, 48);
    composites.push({ input: await sharp(colorIcon).resize(size, size).png().toBuffer(), left: x + Math.floor((swatch - size) / 2), top: 322 + Math.floor((192 - size) / 2) });
    composites.push({ input: svgText(`${size}px`, x, 528, 13, 600, "#557080"), left: 0, top: 0 });
    x += swatch + 34;
  }
  composites.push({ input: safeZoneSvg(), left: 40, top: 290 });

  x = 48;
  for (const size of outlineSizes) {
    const swatch = 72;
    composites.push({ input: roundedSwatchSvg(swatch), left: x, top: 590 });
    composites.push({ input: await sharp(outlineIcon).resize(size, size).png().toBuffer(), left: x + Math.floor((swatch - size) / 2), top: 590 + Math.floor((swatch - size) / 2) });
    composites.push({ input: svgText(`${size}px`, x + 14, 690, 13, 600, "#557080"), left: 0, top: 0 });
    x += 108;
  }

  composites.push({ input: svgText("Mint Levy element  #C7F0E4", 760, 114, 15, 650, "#557080"), left: 0, top: 0 });
  composites.push({ input: svgText("Coral Tate element  #FF8E95", 760, 144, 15, 650, "#557080"), left: 0, top: 0 });
  composites.push({ input: svgText("Deep navy canvas  #17325C", 760, 174, 15, 650, "#557080"), left: 0, top: 0 });
  composites.push({ input: svgText("Primary symbol: 120 × 120 centred safe region", 760, 204, 15, 650, "#557080"), left: 0, top: 0 });

  await sharp({
    create: { width, height, channels: 4, background: "#F7FAF9" },
  }).composite(composites).png().toFile(contactSheetPath);
}

function safeZoneSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="208" height="208" viewBox="0 0 208 208">
      <rect x="8" y="8" width="192" height="192" rx="10" fill="none" stroke="#D6E2DE" stroke-width="2"/>
      <rect x="44" y="44" width="120" height="120" rx="4" fill="none" stroke="#159B8F" stroke-width="2" stroke-dasharray="6 5"/>
    </svg>
  `);
}

function roundedSwatchSvg(size) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="14" fill="${navy}"/>
    </svg>
  `);
}

function svgText(value, x, y, size, weight, color) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1320" height="720">
      <text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escaped}</text>
    </svg>
  `);
}

async function validateGeneratedFiles() {
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const color = await sharp(colorPath).metadata();
  const outline = await sharp(outlinePath).metadata();
  const expectedEndpoint = "https://levytate-mcp-staging.vercel.app/api/mcp/levytate";
  const connector = manifest.agentConnectors?.[0]?.toolSource?.remoteMcpServer;

  assert(manifest.manifestVersion === "1.30", "manifest version must be 1.30");
  assert(manifest.icons?.color === "assets/color.png", "colour icon path must match exactly");
  assert(manifest.icons?.outline === "assets/outline.png", "outline icon path must match exactly");
  assert(connector?.mcpServerUrl === expectedEndpoint, "remote MCP reference must remain unchanged");
  assert(connector?.authorization?.type === "OAuthPluginVault", "existing SSO registration must use OAuthPluginVault");
  assert(Boolean(connector?.authorization?.referenceId), "existing SSO registration reference is required");
  assert(color.width === 192 && color.height === 192 && color.format === "png", "colour icon must be 192 x 192 PNG");
  assert(outline.width === 32 && outline.height === 32 && outline.format === "png" && outline.hasAlpha, "outline icon must be 32 x 32 PNG with alpha");
  assert(!connector.mcpToolDescription, "dynamic discovery must remain enabled for the existing MCP tools");

  const packageText = JSON.stringify(manifest);
  const forbidden = [
    /SUPABASE_SERVICE_ROLE_KEY/i,
    /DATABASE_URL/i,
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /LEVYTATE_BETA_CODE/i,
    /LEVYTATE_BETA_SESSION_SECRET/i,
  ];
  assert(forbidden.every((pattern) => !pattern.test(packageText)), "manifest must not contain secrets or credentials");
}

async function buildZip() {
  await rm(zipPath, { force: true });
  const result = spawnSync("zip", ["-X", "-q", zipPath, "manifest.json", "assets/color.png", "assets/outline.png"], {
    cwd: packageDirectory,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "zip failed");
}

async function validateZip() {
  const result = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "zip inspection failed");
  const entries = result.stdout.trim().split("\n").sort();
  const expected = ["assets/color.png", "assets/outline.png", "manifest.json"].sort();
  assert(JSON.stringify(entries) === JSON.stringify(expected), `unexpected ZIP contents: ${entries.join(", ")}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
