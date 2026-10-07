#!/usr/bin/env node
// Kusik — генератор іконок: тека SVG → типізований TSX + сторінка-перегляд.
//
//   node scripts/build-icons.mjs            — зібрати всі паки
//   node scripts/build-icons.mjs icon       — лише один пак
//
// Джерело правди — SVG-файли. Згенеровані *.generated.tsx не редагуються вручну.
// Після перенесення в apps/web поправ шляхи в PACKS (відносно цього файлу) — один раз.
// Залежностей немає: лише Node 18+.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const PACKS = {
  icon: {
    svgDir: '../src/icon/svg',
    outFile: '../src/icon/icon.generated.tsx',
    previewFile: '../src/icon/icon.preview.html',
    constName: 'ICON_PATHS',
    namesConst: 'ICON_NAMES',
    typeName: 'IconName',
    viewBox: '0 0 24 24',
    // UI-іконки одноколірні: колір лише currentColor (або var(...) для вирізів).
    isMonochrome: true,
  },
  food: {
    svgDir: '../src/food/svg',
    outFile: '../src/food/food-icons.generated.tsx',
    previewFile: '../src/food/food-icons.preview.html',
    constName: 'FOOD_ICON_PATHS',
    namesConst: 'FOOD_ICON_NAMES',
    typeName: 'FoodIconName',
    viewBox: '0 0 32 32',
    isMonochrome: false,
  },
};

const NAME_PATTERN = { icon: /^[a-z0-9]+(-[a-z0-9]+)*$/, food: /^[a-z0-9]+(_[a-z0-9]+)*$/ };

const ATTR_TO_JSX = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'stop-color': 'stopColor',
  'text-anchor': 'textAnchor',
  'font-family': 'fontFamily',
  'font-weight': 'fontWeight',
  'font-size': 'fontSize',
  class: 'className',
};

const fail = (file, message) => {
  console.error(`✗ ${file}: ${message}`);
  process.exitCode = 1;
};

const readInner = (packName, pack, file) => {
  const source = readFileSync(file, 'utf8').trim();
  const root = source.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/);
  if (!root) return fail(file, 'файл має бути одним <svg>…</svg>');
  const [, rootAttrs, inner] = root;

  if (!rootAttrs.includes(`viewBox="${pack.viewBox}"`)) return fail(file, `viewBox має бути "${pack.viewBox}"`);
  if (/<(script|style|image|foreignObject)\b/i.test(inner)) return fail(file, 'заборонені <script>, <style>, <image>, <foreignObject>');
  if (/\sid="/.test(inner)) return fail(file, 'id заборонені: вони дублюються, коли іконок кілька на сторінці');
  if (/\son[a-z]+="/i.test(inner)) return fail(file, 'обробники подій заборонені');
  if (pack.isMonochrome) {
    const allowed = ['none', 'currentColor'];
    for (const [, , color] of inner.matchAll(/(fill|stroke)="([^"]*)"/g)) {
      if (!allowed.includes(color) && !color.startsWith('var(')) {
        return fail(file, `UI-іконка не може мати колір ${color} — лише currentColor або var(...)`);
      }
    }
  }
  return inner.trim();
};

const toJsx = (inner) =>
  inner
    .replace(/\s([a-z-]+)="/g, (match, attr) => (ATTR_TO_JSX[attr] ? ` ${ATTR_TO_JSX[attr]}="` : match))
    .replace(/<(\w+)([^>]*?)\s*\/>/g, '<$1$2 />')
    .replace(/<(\w+)([^>]*)><\/\1>/g, '<$1$2 />')
    .replace(/>\s*</g, '>\n      <');

const buildPack = (packName) => {
  const pack = PACKS[packName];
  const svgDir = join(HERE, pack.svgDir);
  if (!existsSync(svgDir)) return fail(svgDir, 'немає теки з SVG');

  const files = readdirSync(svgDir).filter((f) => f.endsWith('.svg')).sort();
  const entries = [];
  for (const fileName of files) {
    const name = basename(fileName, '.svg');
    const file = join(svgDir, fileName);
    if (!NAME_PATTERN[packName].test(name)) {
      fail(file, packName === 'icon' ? 'назва — kebab-case (chevron-left)' : 'назва — snake_case як у enum (dried_fruit)');
      continue;
    }
    const inner = readInner(packName, pack, file);
    if (inner) entries.push({ name, inner });
  }
  if (process.exitCode) return;

  const body = entries.map(({ name, inner }) => `  '${name}': (\n    <>\n      ${toJsx(inner)}\n    </>\n  ),`).join('\n');
  const names = entries.map(({ name }) => `  '${name}',`).join('\n');
  writeFileSync(
    join(HERE, pack.outFile),
    `// ЗГЕНЕРОВАНО scripts/build-icons.mjs з ${pack.svgDir.replace('../', '')}/*.svg — не редагувати вручну.\n` +
      `// Щоб змінити іконку: правиш SVG і запускаєш генератор. Ліміт розміру файлу на згенероване не поширюється.\n` +
      `import type { ReactNode } from 'react';\n\n` +
      `export const ${pack.namesConst} = [\n${names}\n] as const;\n\n` +
      `export type ${pack.typeName} = (typeof ${pack.namesConst})[number];\n\n` +
      `export const ${pack.constName}: Record<${pack.typeName}, ReactNode> = {\n${body}\n};\n`,
  );

  const cells = entries
    .map(
      ({ name, inner }) =>
        `<figure><svg viewBox="${pack.viewBox}" width="40" height="40"${pack.isMonochrome ? ' fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"' : ''}>${inner}</svg><figcaption>${name}</figcaption></figure>`,
    )
    .join('\n');
  writeFileSync(
    join(HERE, pack.previewFile),
    `<!doctype html><meta charset="utf-8"><title>${packName} — ${entries.length}</title>` +
      `<style>body{margin:0;padding:24px;font:600 12px system-ui;background:#FBF6EE;color:#2A2118;display:flex;flex-wrap:wrap;gap:12px}` +
      `figure{margin:0;width:96px;padding:12px 4px;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;gap:8px}` +
      `figcaption{text-align:center;word-break:break-word;color:#6B5D50}</style>\n${cells}\n`,
  );
  console.log(`✓ ${packName}: ${entries.length} → ${pack.outFile}`);
};

const requested = process.argv.slice(2);
const packNames = requested.length ? requested : Object.keys(PACKS);
for (const name of packNames) {
  if (!PACKS[name]) fail(name, `невідомий пак. Є: ${Object.keys(PACKS).join(', ')}`);
  else buildPack(name);
}
