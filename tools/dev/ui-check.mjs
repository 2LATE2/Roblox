// Phone-layout screenshots with UI, including the info sheet; prints page errors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const msgs = [];
page.on('pageerror', (e) => msgs.push('PAGEERROR ' + e));
page.on('console', (m) => { if (m.type() === 'error') msgs.push('console.error ' + m.text()); });
await page.route('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', (r) => r.fulfill({ path: path.join(here, '../node_modules/three-r147/build/three.min.js'), contentType: 'application/javascript' }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto('file://' + path.join(here, 'out-wrapped.html'));
await page.waitForTimeout(2500); // autoplay runs
await page.screenshot({ path: path.join(out, 'ui_autoplay.png') });
await page.evaluate(() => window.__preview.still(1.45));
await page.screenshot({ path: path.join(out, 'ui_awe.png') });
await page.click('#infoBtn');
await page.waitForTimeout(100);
await page.screenshot({ path: path.join(out, 'ui_info.png') });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log('horizontal overflow:', overflow);
console.log(msgs.filter((m) => !m.includes('ERR_FAILED')).slice(0, 10));
await browser.close();
