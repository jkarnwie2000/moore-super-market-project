/**
 * Generates a branded SVG packshot for every product in server/data/catalog.js
 * into public/images/products/<slug>.svg. Re-run after editing the catalogue:
 *   npm run generate:art
 * Admins can replace any of these with a real photo via the dashboard upload.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { products } = require('../../server/data/catalog.js');
const OUT = resolve(here, '../public/images/products');
mkdirSync(OUT, { recursive: true });

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function wrap(text, max) {
  const words = text.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].replace(/\s?\S*$/, '') + '…';
  }
  return lines;
}

const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;

/** Kente-inspired stripe band. */
function kente(x, y, w) {
  const colors = ['#1F5135', '#E2A92B', '#D9692B', '#1F5135', '#E2A92B'];
  const seg = w / 10;
  let out = '';
  for (let i = 0; i < 10; i++) out += `<rect x="${x + i * seg}" y="${y}" width="${seg}" height="6" fill="${colors[i % colors.length]}"/>`;
  return out;
}

function label({ cx, top, width, brand, name, size, maxChars, dark }) {
  const lines = wrap(name, maxChars);
  const fs = lines.some((l) => l.length > maxChars - 2) ? 15 : 17;
  const ink = dark ? '#FBF6EC' : '#1D2420';
  const sub = dark ? 'rgba(251,246,236,.75)' : '#5B6158';
  let t = `<text x="${cx}" y="${top + 22}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="12" letter-spacing="2" fill="${sub}">${esc(brand.toUpperCase())}</text>`;
  lines.forEach((l, i) => {
    t += `<text x="${cx}" y="${top + 46 + i * (fs + 4)}" text-anchor="middle" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="700" font-size="${fs}" fill="${ink}">${esc(l)}</text>`;
  });
  const sy = top + 46 + lines.length * (fs + 4) + 4;
  t += kente(cx - width / 2 + 14, sy - 6, width - 28);
  t += `<text x="${cx}" y="${sy + 20}" text-anchor="middle" font-family="'Trebuchet MS', Arial, sans-serif" font-size="13" font-weight="700" fill="${dark ? '#E2A92B' : '#1F5135'}">${esc(size)}</text>`;
  return t;
}

const shapes = {
  sack: (c, a) => `
    <path d="M110 120 Q200 92 290 120 L312 330 Q200 356 88 330 Z" fill="${c.main}"/>
    <path d="M110 120 Q200 92 290 120 L284 140 Q200 116 116 140 Z" fill="${c.dark}"/>
    <path d="M150 96 Q200 70 250 96" stroke="${c.dark}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="122" y="160" width="156" height="${a.labelH}" rx="10" fill="#FBF6EC"/>
    ${label({ cx: 200, top: 160, width: 156, ...a, maxChars: 14 })}`,
  bag: (c, a) => `
    <path d="M118 100 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l12 10 L292 330 Q200 344 108 330 Z" fill="${c.main}"/>
    <rect x="118" y="100" width="164" height="16" fill="${c.dark}"/>
    <rect x="126" y="150" width="148" height="${a.labelH}" rx="10" fill="#FBF6EC"/>
    ${label({ cx: 200, top: 150, width: 148, ...a, maxChars: 13 })}`,
  pouch: (c, a) => `
    <path d="M124 92 H276 V300 Q276 336 240 336 H160 Q124 336 124 300 Z" fill="${c.main}"/>
    <rect x="124" y="92" width="152" height="22" fill="${c.dark}"/>
    <circle cx="146" cy="103" r="5" fill="#FBF6EC" opacity=".8"/>
    <rect x="134" y="140" width="132" height="${a.labelH}" rx="10" fill="#FBF6EC"/>
    ${label({ cx: 200, top: 140, width: 132, ...a, maxChars: 12 })}`,
  jar: (c, a) => `
    <rect x="138" y="84" width="124" height="38" rx="8" fill="${c.dark}"/>
    <rect x="138" y="96" width="124" height="4" fill="rgba(255,255,255,.25)"/>
    <path d="M128 128 Q128 118 140 118 H260 Q272 118 272 128 V318 Q272 338 252 338 H148 Q128 338 128 318 Z" fill="${c.main}"/>
    <rect x="134" y="150" width="132" height="${a.labelH}" rx="8" fill="#FBF6EC"/>
    ${label({ cx: 200, top: 150, width: 132, ...a, maxChars: 12 })}`,
  bottle: (c, a) => `
    <rect x="182" y="58" width="36" height="26" rx="5" fill="${c.dark}"/>
    <path d="M186 84 H214 V118 Q262 138 262 186 V322 Q262 340 244 340 H156 Q138 340 138 322 V186 Q138 138 186 118 Z" fill="${c.main}"/>
    <path d="M150 190 Q150 160 176 146" stroke="rgba(255,255,255,.35)" stroke-width="6" fill="none" stroke-linecap="round"/>
    <rect x="144" y="190" width="112" height="${a.labelH}" rx="8" fill="#FBF6EC"/>
    ${label({ cx: 200, top: 190, width: 112, ...a, maxChars: 10 })}`,
  can: (c, a) => `
    <path d="M124 104 V320 A76 18 0 0 0 276 320 V104 Z" fill="${c.main}"/>
    <ellipse cx="200" cy="104" rx="76" ry="18" fill="${c.dark}"/>
    <ellipse cx="200" cy="104" rx="64" ry="12" fill="#C9CCC4"/>
    <rect x="124" y="140" width="152" height="${a.labelH}" fill="#FBF6EC"/>
    ${label({ cx: 200, top: 140, width: 152, ...a, maxChars: 13 })}`,
  box: (c, a) => `
    <path d="M110 120 L280 120 L310 98 L140 98 Z" fill="${c.light}"/>
    <path d="M280 120 L310 98 V308 L280 334 Z" fill="${c.dark}"/>
    <rect x="110" y="120" width="170" height="214" fill="${c.main}"/>
    <rect x="120" y="140" width="150" height="${a.labelH}" rx="8" fill="#FBF6EC"/>
    ${label({ cx: 195, top: 140, width: 150, ...a, maxChars: 13 })}`,
  produce: (c, a) => `
    <ellipse cx="160" cy="150" rx="44" ry="40" fill="${c.main}"/>
    <ellipse cx="240" cy="146" rx="46" ry="42" fill="${c.light}"/>
    <ellipse cx="200" cy="128" rx="44" ry="40" fill="${c.mid}"/>
    <path d="M200 92 q10 -22 28 -24" stroke="#2E6B3F" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="228" cy="70" rx="14" ry="7" fill="#3D8A52" transform="rotate(-25 228 70)"/>
    <path d="M96 168 H304 L284 336 H116 Z" fill="#8A5A2B"/>
    <path d="M100 196 H300 M104 230 H296 M108 264 H292 M112 298 H288" stroke="#6E4520" stroke-width="5"/>
    <rect x="124" y="200" width="152" height="${a.labelH - 20}" rx="10" fill="#FBF6EC" stroke="#E2A92B" stroke-width="3"/>
    ${label({ cx: 200, top: 196, width: 152, ...a, maxChars: 14 })}`,
};

let count = 0;
for (const prod of products) {
  const slug = slugify(prod.name);
  const h = prod.hue ?? 30;
  const c = { main: hsl(h, 55, 40), dark: hsl(h, 55, 28), light: hsl(h, 60, 55), mid: hsl(h, 58, 47), bg1: hsl(h, 70, 95), bg2: hsl((h + 30) % 360, 60, 88) };
  const nameLines = wrap(prod.name, 13).length;
  const args = { brand: prod.brand, name: prod.name, size: prod.variants[0][0], labelH: 92 + nameLines * 21 };
  const shape = shapes[prod.pack] || shapes.box;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${esc(prod.name)}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg2}"/></radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <circle cx="330" cy="70" r="90" fill="#E2A92B" opacity=".10"/>
  <circle cx="60" cy="350" r="70" fill="#1F5135" opacity=".07"/>
  <ellipse cx="200" cy="352" rx="120" ry="14" fill="rgba(29,36,32,.18)"/>
  ${shape(c, args)}
</svg>
`;
  writeFileSync(resolve(OUT, `${slug}.svg`), svg);
  count++;
}

// A neutral placeholder for products without an image.
writeFileSync(
  resolve(OUT, '../placeholder.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#F3EBDC"/><path d="M130 170 h140 l-14 120 h-112 z" fill="#1F5135" opacity=".85"/><path d="M160 170 q40 -70 80 0" stroke="#E2A92B" stroke-width="12" fill="none"/>${kente(140, 300, 120)}</svg>\n`
);
console.log(`Generated ${count} product images in ${OUT}`);
