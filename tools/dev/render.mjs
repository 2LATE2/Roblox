// Renders stills of the preview page headless for review.
// usage: node dev/render.mjs <outDir> <view> <t1,t2,...> [w h] [--ui]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const [outDir, view = 'cine', timesArg = '0', W = '400', H = '520'] = process.argv.slice(2);
const withUi = process.argv.includes('--ui');
const mobile = process.argv.includes('--mobile');
fs.mkdirSync(outDir, { recursive: true });

const body = fs.readFileSync(path.join(repo, 'preview/index.html'), 'utf8');
const hideUi = withUi ? '' : '<style>.panel,.hud,.rarity{display:none!important}</style>';
const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style></head><body>${body}${hideUi}</body></html>`;
const wrapped = path.join(here, 'out-wrapped.html');
fs.writeFileSync(wrapped, doc);

const VIEWS = {
  side: { az: 90, el: 6, dist: 15, target: [0, 2.6, -1.4] },
  front: { az: 25, el: 10, dist: 15, target: [0, 2.6, -0.6] },
  back: { az: 140, el: 14, dist: 15, target: [0, 2.6, -1.0] },
  right: { az: -90, el: 6, dist: 15, target: [0, 2.6, -1.4] },
  hero: { az: 75, el: 6, dist: 12, target: [0, 2.6, -0.3] },
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctxOpts = mobile
  ? { viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 1 };
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await page.route('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', (r) =>
  r.fulfill({ path: path.join(here, '../node_modules/three-r147/build/three.min.js'), contentType: 'application/javascript' }),
);
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.addInitScript(() => { window.__previewNoAutoplay = true; });
await page.goto('file://' + wrapped);
await page.waitForFunction(() => !!window.__preview, null, { timeout: 20000 });

const times = timesArg.split(',').map(Number);
for (const t of times) {
  await page.evaluate(([t, cam]) => {
    if (cam) window.__preview.still(t, cam);
    else { window.__preview.cine(); window.__preview.still(t); }
  }, [t, view === 'cine' ? null : VIEWS[view]]);
  await page.waitForTimeout(30);
  const file = path.join(outDir, `${view}_${t.toFixed(3)}.png`);
  if (withUi) await page.screenshot({ path: file });
  else await (await page.$('#c')).screenshot({ path: file });
}
if (errors.length) console.log('page messages:', errors.slice(0, 10));
await browser.close();
console.log('rendered', times.length, 'stills to', outDir);
