// Pose solver: turns animator-friendly controls (pelvis, spine, arm swing
// parameters, foot placement) into R15 Motor6D Transforms using analytic
// two-bone IK, so planted feet never slide and hands stay on the chest lid.
import * as THREE from 'three';
import { J, H0, childWorld, v3 } from './rig.mjs';
import { clamp, lerp } from './curves.mjs';

const DEG = Math.PI / 180;
const ONE = new THREE.Vector3(1, 1, 1);
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);

// Distance from the wrist pivot to the fingertip face of the block hand.
export const HAND_REACH = 0.26;

export const quatYXZ = (pitch, yaw, roll) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * DEG, yaw * DEG, roll * DEG, 'YXZ'));
export const quatXYZ = (rx, ry, rz) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx * DEG, ry * DEG, rz * DEG, 'XYZ'));
const quatAxis = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis, deg * DEG);

function limbConstants(j1, j2, j3) {
  const b1 = v3(j2.c0).sub(v3(j1.c1)); // joint1 pivot -> joint2 pivot (segment 1 space)
  const b2 = v3(j3.c0).sub(v3(j2.c1)); // joint2 pivot -> joint3 pivot (segment 2 space)
  return { b1, b2, L1sq: b1.lengthSq(), L2sq: b2.lengthSq(), k: 2 * b1.y * b2.y };
}

const ARM = limbConstants(J.RightUpperArm, J.RightLowerArm, J.RightHand);
const LEG = limbConstants(J.RightUpperLeg, J.RightLowerLeg, J.RightFoot);
export const ARM_MAX_REACH = Math.sqrt(ARM.L1sq + ARM.L2sq + ARM.k);
export const LEG_MAX_REACH = Math.sqrt(LEG.L1sq + LEG.L2sq + LEG.k);

// Analytic two-bone IK with offset bones. The hinge is the X axis of the
// second segment; `sign` picks the bend direction (+ arms, - knees).
// `refLocal` is the axis of segment 1 that should point at the pole.
export function solveLimb({ parentWorld, j1, j2, j3, target, poleLocal, sign, refLocal, twist2 = 0, maxBend = 155 }) {
  const { b1, b2, L1sq, L2sq, k } = limbConstants(j1, j2, j3);
  const inv = parentWorld.clone().invert();
  const tLocal = target.clone().applyMatrix4(inv).sub(v3(j1.c0));
  const d = tLocal.length();
  const cRaw = (d * d - L1sq - L2sq) / k;
  const c = clamp(cRaw, Math.cos(maxBend * DEG), 1);
  const theta = sign * Math.acos(c);
  const qBend = quatAxis(AX, theta / DEG);
  const w = b2.clone().applyQuaternion(qBend).add(b1);

  const e1 = w.clone().normalize();
  const e2 = refLocal.clone().addScaledVector(e1, -refLocal.dot(e1)).normalize();
  const e3 = new THREE.Vector3().crossVectors(e1, e2);
  const f1 = tLocal.clone().normalize();
  let p = poleLocal.clone().addScaledVector(f1, -poleLocal.dot(f1));
  if (p.lengthSq() < 1e-6) p = refLocal.clone().addScaledVector(f1, -refLocal.dot(f1));
  const f2 = p.normalize();
  const f3 = new THREE.Vector3().crossVectors(f1, f2);
  const E = new THREE.Matrix4().makeBasis(e1, e2, e3);
  const F = new THREE.Matrix4().makeBasis(f1, f2, f3);
  const R = F.multiply(E.transpose());
  const q1 = new THREE.Quaternion().setFromRotationMatrix(R);
  const q2 = qBend.clone().multiply(quatAxis(AY, twist2));
  return { q1, q2, theta, reachable: cRaw <= 1.0005, dist: d };
}

// Arm swing parameters <-> wrist target (UpperTorso space, from the shoulder pivot).
// yaw: 0 = forward, 90 = out to the side, 180 = back. pitch: -90 down .. +90 up.
export function armVector(side, yaw, pitch, bend) {
  const s = side === 'Right' ? 1 : -1;
  const dist = Math.sqrt(ARM.L1sq + ARM.L2sq + ARM.k * Math.cos(bend * DEG));
  const cp = Math.cos(pitch * DEG);
  return new THREE.Vector3(s * cp * Math.sin(yaw * DEG), Math.sin(pitch * DEG), -cp * Math.cos(yaw * DEG)).multiplyScalar(dist);
}

export function armParams(side, vec) {
  const s = side === 'Right' ? 1 : -1;
  const d = vec.length();
  const pitch = Math.asin(clamp(vec.y / d, -1, 1)) / DEG;
  const yaw = Math.atan2(s * vec.x, -vec.z) / DEG;
  const bend = Math.acos(clamp((d * d - ARM.L1sq - ARM.L2sq) / ARM.k, -1, 1)) / DEG;
  return { yaw, pitch, bend };
}

// World transform of a foot block. (x, z) = foot centre on the ground,
// heel = heel raise in degrees, rolling over the toe edge.
export function footWorld({ x, z, lift = 0, yaw = 0, heel = 0 }) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, lift + 0.15, z), quatAxis(AY, yaw), ONE);
  if (heel) {
    const piv = new THREE.Vector3(0, -0.15, -0.5);
    m.multiply(new THREE.Matrix4().makeTranslation(piv.x, piv.y, piv.z));
    m.multiply(new THREE.Matrix4().makeRotationX(-heel * DEG));
    m.multiply(new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z));
  }
  return m;
}

const rotOf = (m) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m));

// c = control values for one instant (see choreo.mjs).
export function solvePose(c) {
  const pose = {};
  const W = { HumanoidRootPart: new THREE.Matrix4().makeTranslation(0, H0, 0) };
  const diag = { unreachable: [] };
  const set = (name, q, p = new THREE.Vector3()) => {
    pose[name] = { q, p };
    W[name] = childWorld(W[J[name].parent], J[name], new THREE.Matrix4().compose(p, q, ONE));
  };

  set('LowerTorso', quatYXZ(c.pelvis.pitch, c.pelvis.yaw, c.pelvis.roll), new THREE.Vector3(c.pelvis.x, c.pelvis.y, c.pelvis.z));
  set('UpperTorso', quatYXZ(c.spine.pitch, c.spine.yaw, c.spine.roll));
  set('Head', quatYXZ(c.neck.pitch, c.neck.yaw, c.neck.roll));

  const invUT = W.UpperTorso.clone().invert();
  for (const side of ['Left', 'Right']) {
    const a = c.arms[side];
    const sh = J[side + 'UpperArm'];
    let { yaw, pitch, bend } = a;
    if (a.contact && a.contact.weight > 1e-4) {
      const w = clamp(a.contact.weight, 0, 1);
      const shoulderWorld = v3(sh.c0).applyMatrix4(W.UpperTorso);
      const back = shoulderWorld.clone().sub(a.contact.point).normalize();
      const wristWorld = a.contact.point.clone().addScaledVector(back, HAND_REACH);
      const cp = armParams(side, wristWorld.applyMatrix4(invUT).sub(v3(sh.c0)));
      yaw = lerp(yaw, cp.yaw, w);
      pitch = lerp(pitch, cp.pitch, w);
      bend = lerp(bend, cp.bend, w);
    }
    const targetLocal = armVector(side, yaw, pitch, bend).add(v3(sh.c0));
    const r = solveLimb({
      parentWorld: W.UpperTorso,
      j1: sh,
      j2: J[side + 'LowerArm'],
      j3: J[side + 'Hand'],
      target: targetLocal.applyMatrix4(W.UpperTorso),
      poleLocal: new THREE.Vector3(...a.pole).normalize(),
      sign: 1,
      refLocal: new THREE.Vector3(0, 0, 1),
      twist2: a.twist || 0,
    });
    if (!r.reachable) diag.unreachable.push(side + 'Arm');
    set(side + 'UpperArm', r.q1);
    set(side + 'LowerArm', r.q2);
    set(side + 'Hand', quatXYZ(...a.wrist));
  }

  const invLT = W.LowerTorso.clone().invert();
  for (const side of ['Left', 'Right']) {
    const l = c.legs[side];
    const s = side === 'Left' ? 1 : -1;
    const F = footWorld(l);
    const ankle = v3(J[side + 'Foot'].c1).applyMatrix4(F);
    const poleWorld = new THREE.Vector3(0, 0, -1).applyQuaternion(quatAxis(AY, l.yaw + s * (l.kneeOut || 0)));
    const r = solveLimb({
      parentWorld: W.LowerTorso,
      j1: J[side + 'UpperLeg'],
      j2: J[side + 'LowerLeg'],
      j3: J[side + 'Foot'],
      target: ankle,
      poleLocal: poleWorld.transformDirection(invLT),
      sign: -1,
      refLocal: new THREE.Vector3(0, 0, -1),
    });
    if (!r.reachable) diag.unreachable.push(side + 'Leg');
    set(side + 'UpperLeg', r.q1);
    set(side + 'LowerLeg', r.q2);
    const qAnkle = rotOf(W[side + 'LowerLeg']).invert().multiply(rotOf(F));
    set(side + 'Foot', qAnkle);
  }
  return { pose, W, diag };
}
