// Re-reads the exported .rbxmx and checks it reproduces the baked pose exactly.
import fs from 'node:fs';
import * as THREE from 'three';
import { bake } from '../anim/bake.mjs';
import { forwardKinematics, H0, JOINTS } from '../anim/rig.mjs';
const xml = fs.readFileSync('../animations/ChestOpenUltraRare.rbxmx', 'utf8');
const kfs = xml.split('<Item class="Keyframe"').slice(1);
const frames = bake();
console.log('keyframes in file:', kfs.length, 'baked:', frames.length);
const priority = /<token name="Priority">(\d+)<\/token>/.exec(xml)[1];
const loop = /<bool name="Loop">(\w+)<\/bool>/.exec(xml)[1];
console.log('Priority token', priority, '(2 = Action) Loop', loop);
const markers = [...xml.matchAll(/<Item class="KeyframeMarker"[^>]*><Properties><string name="Name">(\w+)<\/string>/g)].map((m) => m[1]);
console.log('markers:', markers.join(', '));
const root = new THREE.Matrix4().makeTranslation(0, H0, 0);
let maxErr = 0, maxOrtho = 0;
kfs.forEach((chunk, i) => {
  const time = Number(/<float name="Time">([^<]+)<\/float>/.exec(chunk)[1]);
  const pose = {};
  for (const m of chunk.matchAll(/<CoordinateFrame name="CFrame">(.*?)<\/CoordinateFrame>.*?<string name="Name">(\w+)<\/string>/g)) {
    const v = [...m[1].matchAll(/>([-\d.e]+)</g)].map((x) => Number(x[1]));
    const [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22] = v;
    const mat = new THREE.Matrix4().set(r00, r01, r02, 0, r10, r11, r12, 0, r20, r21, r22, 0, 0, 0, 0, 1);
    const cols = [new THREE.Vector3(r00, r10, r20), new THREE.Vector3(r01, r11, r21), new THREE.Vector3(r02, r12, r22)];
    maxOrtho = Math.max(maxOrtho, Math.abs(cols[0].dot(cols[1])), Math.abs(cols[0].length() - 1), Math.abs(mat.determinant() - 1));
    pose[m[2]] = { p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion().setFromRotationMatrix(mat) };
  }
  if (Math.abs(time - frames[i].t) > 1e-4) throw new Error('time mismatch ' + i);
  const A = forwardKinematics(pose, root), B = forwardKinematics(frames[i].pose, root);
  for (const j of JOINTS) {
    const pa = new THREE.Vector3().setFromMatrixPosition(A[j.name]), pb = new THREE.Vector3().setFromMatrixPosition(B[j.name]);
    maxErr = Math.max(maxErr, pa.distanceTo(pb));
  }
});
console.log('max part position error after round trip (studs):', maxErr.toExponential(2), ' max orthonormality error:', maxOrtho.toExponential(2));
