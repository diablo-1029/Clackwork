// Renders the app icons and the share image from src/app/icon.svg. Run with `npm run icons`
// after changing the icon; the PNGs it writes into public/ are committed.
import { readFileSync } from "node:fs";
import sharp from "sharp";

const icon = readFileSync("src/app/icon.svg", "utf8");
const inner = icon.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// "Maskable" icons are cropped to a circle or squircle by the phone, so the art sits
// inside the safe middle of a full-bleed background.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0f55a8"/>
  <g transform="translate(9.6 9.6) scale(0.7)">${inner}</g>
</svg>`;

const share = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eaf4ff"/>
      <stop offset="1" stop-color="#c9e2fb"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <rect y="500" width="1200" height="130" fill="#8fb0d6"/>
  <rect y="492" width="1200" height="26" fill="#27425f"/>
  <g transform="translate(70 165) scale(4)">${inner}</g>
  <text x="370" y="305" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="92" fill="#10233f">CLACKWORK</text>
  <text x="374" y="370" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="38" fill="#4a6285">Beat the clock in a tiny factory.</text>
</svg>`;

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(file);

await png(icon, 192, "public/icons/icon-192.png");
await png(icon, 512, "public/icons/icon-512.png");
await png(maskable, 512, "public/icons/maskable-512.png");
await png(maskable, 180, "public/icons/apple-touch-icon.png");
await sharp(Buffer.from(share), { density: 144 }).resize(1200, 630).png().toFile("public/og.png");
console.log("Icons and share image written to public/.");
