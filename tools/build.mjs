// Builds every deliverable from the choreography source:
//   animations/ChestOpenUltraRare.json   baked data (also embedded in the preview)
//   animations/ChestOpenUltraRare.rbxmx  KeyframeSequence for Roblox Studio
//   roblox/...                            Luau kit (see export-roblox.mjs)
//   preview/index.html                    phone preview page
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bake, validate, toData } from './anim/bake.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const out = (p) => path.join(repo, p);

const frames = bake();
const report = validate(frames);
const problems = [];
if (report.footSlide > 0.002) problems.push(`planted foot slides ${report.footSlide.toFixed(4)} studs at ${report.footSlideAt}`);
if (report.handGap > 0.002) problems.push(`hand leaves lid by ${report.handGap.toFixed(4)} studs at ${report.handGapAt}`);
if (report.belowGround < -0.01) problems.push(`foot below ground ${report.belowGround.toFixed(3)} at ${report.belowAt}`);
if (report.unreachable.length) problems.push(`unreachable IK targets: ${report.unreachable.join(', ')}`);
console.log('validation:', problems.length ? problems : 'OK (feet planted, hands on lid, all targets reachable)');
if (problems.length && !process.argv.includes('--force')) process.exit(1);

const data = toData(frames);
fs.mkdirSync(out('animations'), { recursive: true });
fs.writeFileSync(out('animations/ChestOpenUltraRare.json'), JSON.stringify(data));

const { writeRoblox } = await import('./export-roblox.mjs').catch(() => ({ writeRoblox: null }));
if (writeRoblox) writeRoblox(frames, data, out);

const tpl = fs.readFileSync(path.join(here, 'preview/template.html'), 'utf8');
const html = tpl.replace('/*__DATA__*/null', JSON.stringify(data));
fs.mkdirSync(out('preview'), { recursive: true });
fs.writeFileSync(out('preview/index.html'), html);
console.log(`preview/index.html ${(html.length / 1024).toFixed(1)} KB, frames ${data.frameCount}`);
