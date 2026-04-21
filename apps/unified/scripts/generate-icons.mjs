/**
 * scripts/generate-icons.mjs
 *
 * Generuje PNG fallbacki dla ikon PWA i splash screeny dla iOS.
 * Wymaga: npm install sharp (już w devDependencies)
 *
 * Uruchomienie: npm run generate-icons
 * Wynikowe pliki trafiają do public/
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const sharp   = require('sharp');

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SVG_192    = path.join(PUBLIC_DIR, 'icon-192.svg');
const SVG_512    = path.join(PUBLIC_DIR, 'icon-512.svg');

// ── PWA ikony (Android + ogólne) ──────────────────────────────
const ICONS = [
  { src: SVG_192, out: 'icon-192.png', size: 192 },
  { src: SVG_512, out: 'icon-512.png', size: 512 },
  { src: SVG_192, out: 'apple-touch-icon.png', size: 180 },
];

// ── iOS Splash Screens ────────────────────────────────────────
// Format: [width, height, scale, device]
const SPLASH = [
  [1290, 2796, 3, 'iPhone 15 Pro Max'],
  [1179, 2556, 3, 'iPhone 15 / 14 Pro'],
  [1284, 2778, 3, 'iPhone 14 Plus / 13 Pro Max'],
  [1170, 2532, 3, 'iPhone 14 / 13 / 12'],
  [1080, 2340, 3, 'iPhone 13 mini / 12 mini'],
  [828,  1792, 2, 'iPhone 11 / XR'],
  [750,  1334, 2, 'iPhone SE / 8 / 7'],
  [2048, 2732, 2, 'iPad Pro 12.9"'],
  [1668, 2388, 2, 'iPad Pro 11"'],
  [1536, 2048, 2, 'iPad 10.2"'],
];

async function generateIcon({ src, out, size }) {
  const outPath = path.join(PUBLIC_DIR, out);
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ ${out} (${size}×${size})`);
}

async function generateSplash([w, h, _scale, device]) {
  // Splash: tło w kolorze marki + wycentrowane logo
  const logoSize = Math.min(w, h) * 0.25;
  const svgBuf   = fs.readFileSync(SVG_512);
  const logo     = await sharp(svgBuf).resize(Math.round(logoSize)).toBuffer();

  const filename = `splash-${w}x${h}.png`;
  const outPath  = path.join(PUBLIC_DIR, 'splash', filename);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  await sharp({
    create: {
      width:      w,
      height:     h,
      channels:   4,
      background: { r: 9, g: 9, b: 15, alpha: 1 },  // bg-zinc-950
    },
  })
    .composite([{
      input:     logo,
      gravity:   'center',
    }])
    .png()
    .toFile(outPath);

  console.log(`✓ splash/${filename} — ${device}`);
  return { w, h, filename };
}

(async () => {
  console.log('Generating PWA icons...\n');

  // Icons
  for (const icon of ICONS) {
    await generateIcon(icon);
  }

  // Splash screens
  console.log('\nGenerating iOS splash screens...\n');
  const splashResults = [];
  for (const spec of SPLASH) {
    const r = await generateSplash(spec);
    splashResults.push(r);
  }

  // Print <link> tags for index.html
  console.log('\n── Add to index.html <head>: ──────────────────────────────\n');
  for (const { w, h, filename } of splashResults) {
    console.log(
      `<link rel="apple-touch-startup-image" href="/splash/${filename}" ` +
      `media="(device-width: ${Math.round(w / 3)}px) and (device-height: ${Math.round(h / 3)}px) and (-webkit-device-pixel-ratio: 3)">`
    );
  }

  console.log('\nDone. Copy splash <link> tags to apps/unified/index.html.');
})().catch(err => { console.error(err); process.exit(1); });
