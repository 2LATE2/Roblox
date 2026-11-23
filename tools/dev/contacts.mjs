import * as THREE from 'three';
import { bake } from '../anim/bake.mjs';
import { H0, J, v3, forwardKinematics } from '../anim/rig.mjs';
import { HAND_REACH } from '../anim/solve.mjs';
const frames = bake();
const root = new THREE.Matrix4().makeTranslation(0, H0, 0);
for (const f of frames) {
  if (f.t < 0.2 || f.t > 0.85) continue;
  const W = forwardKinematics(f.pose, root);
  const out = [f.t.toFixed(3)];
  for (const side of ['Left','Right']) {
    const a = f.c.arms[side];
    const wrist = v3(J[side + 'Hand'].c0).applyMatrix4(W[side + 'LowerArm']);
    const sh = v3(J[side+'UpperArm'].c0).applyMatrix4(W.UpperTorso);
    out.push(side[0], 'w', a.contact.weight.toFixed(2), 'gap', (wrist.distanceTo(a.contact.point)-HAND_REACH).toFixed(3), 'sh->c', sh.distanceTo(a.contact.point).toFixed(3));
  }
  out.push('lid', f.c.arms.Left.contact.point.toArray().map(x=>x.toFixed(2)).join(','));
  console.log(out.join(' '));
}
