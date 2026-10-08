import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const outputDirectory = path.join(process.cwd(), "public", "brand", "pwa");
await mkdir(outputDirectory, { recursive: true });

for (const size of [192, 512]) {
  await sharp(Buffer.from(iconSvg(size, false))).png().toFile(path.join(outputDirectory, `levytate-${size}.png`));
  await sharp(Buffer.from(iconSvg(size, true))).png().toFile(path.join(outputDirectory, `levytate-maskable-${size}.png`));
}

console.log("Generated LevyTate PWA icons at 192px and 512px, including maskable variants.");

function iconSvg(size, maskable) {
  const scale = size / 512;
  const tileInset = maskable ? 0 : 24;
  const tileSize = 512 - (tileInset * 2);
  const radius = maskable ? 0 : 112;
  const markScale = maskable ? 0.9 : 1;
  const markOffset = maskable ? 26 : 0;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${maskable ? "#17325C" : "transparent"}"/>
      <rect x="${tileInset}" y="${tileInset}" width="${tileSize}" height="${tileSize}" rx="${radius}" fill="#17325C"/>
      <g transform="translate(${markOffset} ${markOffset}) scale(${markScale})">
        <g fill="none" stroke="#0C2446" stroke-width="68" stroke-linecap="round" stroke-linejoin="round" transform="translate(11 13)" opacity="0.95">
          <path d="M154 132v222h126"/>
          <path d="M248 142h142M319 142v245"/>
        </g>
        <path d="M154 132v222h126" fill="none" stroke="#C7F0E4" stroke-width="68" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M248 142h142M319 142v245" fill="none" stroke="#FF8E95" stroke-width="68" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <metadata>LevyTate PWA icon; deterministic ${size}px render; scale ${scale}</metadata>
    </svg>`;
}
