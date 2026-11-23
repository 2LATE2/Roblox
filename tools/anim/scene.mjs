// The treasure chest the character interacts with, in "ground space":
// origin on the ground under the HumanoidRootPart, character facing -Z.
import * as THREE from 'three';
import { K } from './curves.mjs';

export const CHEST = {
  width: 4.4, // X
  depth: 2.6, // Z
  baseHeight: 2.0,
  lidHeight: 1.0,
  frontZ: -1.4, // front face of the chest (towards the character)
  get backZ() {
    return this.frontZ - this.depth;
  },
  get centerZ() {
    return this.frontZ - this.depth / 2;
  },
  // Hinge axis runs along X at the top back edge of the base.
  get hinge() {
    return new THREE.Vector3(0, this.baseHeight, this.backZ);
  },
};

// Where the fingertips touch the lid (closed), on its front face.
export const GRIP = {
  Left: new THREE.Vector3(-1.15, CHEST.baseHeight + 0.22, CHEST.frontZ),
  Right: new THREE.Vector3(1.15, CHEST.baseHeight + 0.22, CHEST.frontZ),
};

// Lid opening angle in degrees (0 = closed). Heavy first tug, a slip back,
// a straining heave with tremble, then the magical burst and bounce.
const LID_KEYS = K(
  [0.0, 0],
  [0.42, 0],
  [0.5, 5.5],
  [0.56, 4.0],
  [0.62, 4.4],
  [0.7, 9.5],
  [0.78, 14],
  [0.8, 15.5],
  [0.833, 60],
  [0.88, 110],
  [0.93, 121],
  [1.0, 104],
  [1.08, 113],
  [1.16, 108.5],
  [1.26, 111],
  [1.4, 110],
);

export function lidAngle(t) {
  let a = LID_KEYS.at(t);
  // straining tremble while the character heaves
  if (t > 0.6 && t < 0.8) {
    const w = Math.sin(Math.PI * ((t - 0.6) / 0.2));
    a += 0.55 * w * Math.sin(2 * Math.PI * 9 * t);
  }
  return a;
}

// Rigid transform of the lid relative to its closed placement.
export function lidMatrix(angleDeg) {
  const h = CHEST.hinge;
  return new THREE.Matrix4()
    .makeTranslation(h.x, h.y, h.z)
    .multiply(new THREE.Matrix4().makeRotationX((-angleDeg * Math.PI) / 180))
    .multiply(new THREE.Matrix4().makeTranslation(-h.x, -h.y, -h.z));
}

export function gripPoint(side, t) {
  return GRIP[side].clone().applyMatrix4(lidMatrix(lidAngle(t)));
}
