// Bakes the choreography into per-frame Motor6D Transforms and validates
// contacts (planted feet must not slide, hands must stay on the lid).
import * as THREE from 'three';
import { JOINTS, H0, HIP_HEIGHT, forwardKinematics, PARTS, J, v3 } from './rig.mjs';
import { controlsAt, DURATION, FPS, MARKERS, PHASES, TURN, T_OFF, T_LAND } from './choreo.mjs';
import { solvePose, footWorld, HAND_REACH } from './solve.mjs';
import { CHEST, lidAngle, gripPoint } from './scene.mjs';

const r = (x, d = 5) => Math.round(x * 10 ** d) / 10 ** d;

export function bake({ fps = FPS } = {}) {
  const n = Math.round(DURATION * fps) + 1;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const c = controlsAt(t);
    const { pose, diag } = solvePose(c);
    frames.push({ t, pose, c, diag });
  }
  return frames;
}

export function validate(frames) {
  const report = { footSlide: 0, footSlideAt: null, handGap: 0, handGapAt: null, belowGround: 0, belowAt: null, unreachable: [] };
  const root = new THREE.Matrix4().makeTranslation(0, H0, 0);
  let prevFeet = null;
  for (const f of frames) {
    const W = forwardKinematics(f.pose, root);
    if (f.diag.unreachable.length) report.unreachable.push(`${f.t.toFixed(3)}:${f.diag.unreachable.join('+')}`);
    const feet = {};
    for (const side of ['Left', 'Right']) {
      const m = W[side + 'Foot'];
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      feet[side] = p;
      // lowest corner
      for (const sx of [-0.5, 0.5])
        for (const sz of [-0.5, 0.5]) {
          const y = new THREE.Vector3(sx, -0.15, sz).applyMatrix4(m).y;
          if (y < report.belowGround) {
            report.belowGround = y;
            report.belowAt = `${f.t.toFixed(3)} ${side}`;
          }
        }
      const l = f.c.legs[side];
      const planted = l.lift < 1e-4 && l.heel < 1e-4;
      if (prevFeet && planted && prevFeet.planted[side]) {
        const d = p.distanceTo(prevFeet[side]);
        if (d > report.footSlide) {
          report.footSlide = d;
          report.footSlideAt = `${f.t.toFixed(3)} ${side}`;
        }
      }
      feet.planted = feet.planted || {};
      feet.planted[side] = planted;
      // hand contact
      const a = f.c.arms[side];
      if (a.contact.weight > 0.999) {
        const wrist = v3(J[side + 'Hand'].c0).applyMatrix4(W[side + 'LowerArm']);
        const gap = Math.abs(wrist.distanceTo(a.contact.point) - HAND_REACH);
        if (gap > report.handGap) {
          report.handGap = gap;
          report.handGapAt = `${f.t.toFixed(3)} ${side}`;
        }
      }
    }
    prevFeet = feet;
  }
  return report;
}

// Compact JSON consumed by the preview page and the exporters.
export function toData(frames, fps = FPS) {
  const names = JOINTS.map((j) => j.name);
  const rot = Object.fromEntries(names.map((n) => [n, []]));
  const rootPos = [];
  for (const f of frames) {
    for (const n of names) {
      const q = f.pose[n].q;
      rot[n].push([r(q.x), r(q.y), r(q.z), r(q.w)]);
    }
    const p = f.pose.LowerTorso.p;
    rootPos.push([r(p.x), r(p.y), r(p.z)]);
  }
  const lid60 = [];
  for (let i = 0; i <= Math.round(DURATION * 60); i++) lid60.push(r(lidAngle(i / 60), 3));
  return {
    name: 'ChestOpenUltraRare',
    fps,
    duration: DURATION,
    frameCount: frames.length,
    priority: 'Action',
    looped: false,
    turn: TURN,
    takeoff: T_OFF,
    landing: T_LAND,
    hipHeight: r(HIP_HEIGHT, 4),
    rootHeight: r(H0, 4),
    joints: JOINTS.map((j) => ({ name: j.name, motor: j.motor, parent: j.parent, c0: j.c0, c1: j.c1 })),
    parts: PARTS,
    chest: {
      width: CHEST.width,
      depth: CHEST.depth,
      baseHeight: CHEST.baseHeight,
      lidHeight: CHEST.lidHeight,
      frontZ: CHEST.frontZ,
      hinge: CHEST.hinge.toArray(),
    },
    markers: MARKERS.map((m) => ({ ...m, time: r(m.frame / fps, 4) })),
    phases: PHASES,
    lid60,
    rootPos,
    rot,
  };
}
