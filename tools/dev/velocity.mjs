// Reports per-joint frame-to-frame rotation steps to catch pops.
import { bake } from '../anim/bake.mjs';
import { JOINTS } from '../anim/rig.mjs';
const frames = bake();
const rows = [];
for (const j of JOINTS) {
  let max = 0, at = 0;
  const steps = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].pose[j.name].q, b = frames[i].pose[j.name].q;
    const ang = (2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180) / Math.PI;
    steps.push(ang);
    if (ang > max) { max = ang; at = frames[i].t; }
  }
  // jerk: change of step (acceleration proxy)
  let jmax = 0, jat = 0;
  for (let i = 1; i < steps.length; i++) { const d = Math.abs(steps[i] - steps[i - 1]); if (d > jmax) { jmax = d; jat = frames[i + 1].t; } }
  rows.push(`${j.name.padEnd(14)} maxStep ${max.toFixed(1).padStart(5)}° @${at.toFixed(3)}  maxΔstep ${jmax.toFixed(1).padStart(5)}° @${jat.toFixed(3)}`);
}
console.log(rows.join('\n'));
