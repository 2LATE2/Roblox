// Standard Roblox R15 rig (Rig Builder -> R15 -> Block).
// Every Motor6D in this rig has identity rotation in C0/C1, so a Pose CFrame
// (= Motor6D.Transform) is a rotation about the joint pivot expressed in the
// parent part's axes. Part1.CFrame = Part0.CFrame * C0 * Transform * C1:Inverse()
import * as THREE from 'three';

export const PARTS = {
  HumanoidRootPart: { size: [2, 2, 1] },
  LowerTorso: { size: [2, 0.4, 1] },
  UpperTorso: { size: [2, 1.6, 1] },
  Head: { size: [1.2, 1.2, 1.2] }, // visual size of the block head mesh
  LeftUpperArm: { size: [1, 1.169, 1] },
  LeftLowerArm: { size: [1, 1.052, 1] },
  LeftHand: { size: [1, 0.3, 1] },
  RightUpperArm: { size: [1, 1.169, 1] },
  RightLowerArm: { size: [1, 1.052, 1] },
  RightHand: { size: [1, 0.3, 1] },
  LeftUpperLeg: { size: [1, 1.217, 1] },
  LeftLowerLeg: { size: [1, 1.193, 1] },
  LeftFoot: { size: [1, 0.3, 1] },
  RightUpperLeg: { size: [1, 1.217, 1] },
  RightLowerLeg: { size: [1, 1.193, 1] },
  RightFoot: { size: [1, 0.3, 1] },
};

// Ordered parent-first. name = Part1 = Pose name.
export const JOINTS = [
  { name: 'LowerTorso', motor: 'Root', parent: 'HumanoidRootPart', c0: [0, -1, 0], c1: [0, -0.2, 0] },
  { name: 'UpperTorso', motor: 'Waist', parent: 'LowerTorso', c0: [0, 0.2, 0], c1: [0, -0.8, 0] },
  { name: 'Head', motor: 'Neck', parent: 'UpperTorso', c0: [0, 0.8, 0], c1: [0, -0.5, 0] },
  { name: 'LeftUpperArm', motor: 'LeftShoulder', parent: 'UpperTorso', c0: [-1, 0.563, 0], c1: [0.5, 0.42, 0] },
  { name: 'LeftLowerArm', motor: 'LeftElbow', parent: 'LeftUpperArm', c0: [0, -0.334, 0], c1: [0, 0.259, 0] },
  { name: 'LeftHand', motor: 'LeftWrist', parent: 'LeftLowerArm', c0: [0, -0.501, 0], c1: [0, 0.125, 0] },
  { name: 'RightUpperArm', motor: 'RightShoulder', parent: 'UpperTorso', c0: [1, 0.563, 0], c1: [-0.5, 0.42, 0] },
  { name: 'RightLowerArm', motor: 'RightElbow', parent: 'RightUpperArm', c0: [0, -0.334, 0], c1: [0, 0.259, 0] },
  { name: 'RightHand', motor: 'RightWrist', parent: 'RightLowerArm', c0: [0, -0.501, 0], c1: [0, 0.125, 0] },
  { name: 'LeftUpperLeg', motor: 'LeftHip', parent: 'LowerTorso', c0: [-0.5, -0.2, 0], c1: [0, 0.421, 0] },
  { name: 'LeftLowerLeg', motor: 'LeftKnee', parent: 'LeftUpperLeg', c0: [0, -0.408, 0], c1: [0, 0.294, 0] },
  { name: 'LeftFoot', motor: 'LeftAnkle', parent: 'LeftLowerLeg', c0: [0, -0.547, 0], c1: [0, 0.101, 0] },
  { name: 'RightUpperLeg', motor: 'RightHip', parent: 'LowerTorso', c0: [0.5, -0.2, 0], c1: [0, 0.421, 0] },
  { name: 'RightLowerLeg', motor: 'RightKnee', parent: 'RightUpperLeg', c0: [0, -0.408, 0], c1: [0, 0.294, 0] },
  { name: 'RightFoot', motor: 'RightAnkle', parent: 'RightLowerLeg', c0: [0, -0.547, 0], c1: [0, 0.101, 0] },
];

export const J = Object.fromEntries(JOINTS.map((j) => [j.name, j]));
export const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// Height of the HumanoidRootPart centre above the ground in the rest pose
// (ground = bottom of the feet in the rest pose).
export const H0 = (() => {
  const chain = ['LowerTorso', 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot'];
  let y = 0;
  for (const n of chain) y += J[n].c0[1] - J[n].c1[1];
  return -(y - PARTS.LeftFoot.size[1] / 2);
})();

// Hip height as Roblox defines it: ground -> bottom of the HumanoidRootPart.
export const HIP_HEIGHT = H0 - PARTS.HumanoidRootPart.size[1] / 2;

export function childWorld(parentWorld, joint, transformMatrix) {
  const m = parentWorld.clone();
  m.multiply(new THREE.Matrix4().makeTranslation(joint.c0[0], joint.c0[1], joint.c0[2]));
  m.multiply(transformMatrix);
  m.multiply(new THREE.Matrix4().makeTranslation(-joint.c1[0], -joint.c1[1], -joint.c1[2]));
  return m;
}

// Forward kinematics for a full pose {name: {q: Quaternion, p: Vector3}}.
export function forwardKinematics(pose, rootWorld) {
  const W = { HumanoidRootPart: rootWorld.clone() };
  for (const j of JOINTS) {
    const tr = pose[j.name];
    const tm = new THREE.Matrix4().compose(tr.p, tr.q, new THREE.Vector3(1, 1, 1));
    W[j.name] = childWorld(W[j.parent], j, tm);
  }
  return W;
}
