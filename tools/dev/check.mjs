import { bake, validate } from '../anim/bake.mjs';
import { H0, HIP_HEIGHT } from '../anim/rig.mjs';
import { ARM_MAX_REACH, LEG_MAX_REACH } from '../anim/solve.mjs';
console.log({ H0, HIP_HEIGHT, ARM_MAX_REACH, LEG_MAX_REACH });
const t0 = Date.now();
const frames = bake();
console.log('baked', frames.length, 'frames in', Date.now() - t0, 'ms');
console.log(validate(frames));
// rest check at t=0
const p0 = frames[0].pose;
for (const [k, v] of Object.entries(p0)) {
  const ang = 2 * Math.acos(Math.min(1, Math.abs(v.q.w))) * 180 / Math.PI;
  if (ang > 0.5 || v.p.length() > 1e-3) console.log('t0 non-rest', k, ang.toFixed(2), v.p.toArray().map(x=>x.toFixed(3)));
}
