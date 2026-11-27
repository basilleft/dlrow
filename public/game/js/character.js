// The player character: a chibi "Spiky Hero" built from three.js primitives
// with toon (cel) shading. Spec: docs/superpowers/specs/2026-11-27-player-character-design.md
//
// Like render.js, this module only READS game state. The model is built in
// model units (about 1.9 tall, feet at y = 0) and scaled by SCALE so the body
// fits the 0.7 x 0.9 collision box; hair spikes may poke slightly above it.
// The group's origin is the bottom-center of the box, so render places it at
// (player.x + w/2, player.y) and the landing squash compresses toward the
// feet instead of sinking into the floor.

import * as THREE from 'three';
import { MOVE_SPEED } from './player.js';

const SCALE = 0.5;          // model units -> tiles (1.9 tall -> 0.95)
const FACING_ANGLE = 1.05;  // radians; angled slightly toward the camera
const FACING_EASE = 10;     // how fast the turn catches up, per second
const RUN_SWING_RATE = 13;  // limb swing in rad/s at full speed
const SQUASH_TIME = 0.25;   // seconds to recover from the landing squash

const COLORS = {
  hair: 0x2a9d8f, skin: 0xffe0bd, eye: 0x203040, highlight: 0xffffff,
  gi: 0xf4845f, belt: 0x7b2cbf, pants: 0x335c67,
};

// One 3-step gradient map shared by every part: this is what turns
// MeshToonMaterial's smooth shading into flat cel bands.
let gradientMap = null;
function getGradientMap() {
  if (!gradientMap) {
    gradientMap = new THREE.DataTexture(new Uint8Array([90, 180, 255]), 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

function part(parent, geometry, color, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() }),
  );
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createHero() {
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const cone = new THREE.ConeGeometry(1, 1, 12);
  const capsule = new THREE.CapsuleGeometry(1, 1, 6, 12);

  // `model` carries the base SCALE; animation re-applies it when squashing.
  const model = new THREE.Group();
  const legL = part(model, capsule, COLORS.pants, -0.16, 0.22, 0, 0.09, 0.11, 0.09);
  const legR = part(model, capsule, COLORS.pants, 0.16, 0.22, 0, 0.09, 0.11, 0.09);
  const body = part(model, capsule, COLORS.gi, 0, 0.62, 0, 0.26, 0.17, 0.22);
  part(model, capsule, COLORS.belt, 0, 0.5, 0, 0.27, 0.02, 0.23);
  const armL = part(model, capsule, COLORS.gi, -0.34, 0.62, 0, 0.08, 0.1, 0.08);
  const armR = part(model, capsule, COLORS.gi, 0.34, 0.62, 0, 0.08, 0.1, 0.08);
  armL.rotation.z = 0.25;
  armR.rotation.z = -0.25;
  const head = part(model, sphere, COLORS.skin, 0, 1.35, 0, 0.55, 0.52, 0.52);

  // Face and hair sit on the head, in head-local coordinates: the head is a
  // scaled unit sphere, so z = 1 is the face surface. The eye highlights are
  // both offset +0.06 to the same side, like one light catching both eyes.
  for (const side of [-1, 1]) {
    part(head, sphere, COLORS.eye, side * 0.42, 0.05, 0.85, 0.16, 0.26, 0.1);
    part(head, sphere, COLORS.highlight, side * 0.42 + 0.06, 0.14, 0.94, 0.05, 0.08, 0.04);
  }
  part(head, sphere, COLORS.hair, 0, 0.25, -0.15, 1.02, 0.95, 1.0);
  const spikes = [
    [-0.5, 1.1, 0.3, -0.5], [0, 1.3, 0.25, 0], [0.5, 1.1, 0.3, 0.5],
    [-0.75, 0.75, 0.1, -0.9], [0.75, 0.75, 0.1, 0.9],
  ];
  for (const [x, y, z, tilt] of spikes) {
    part(head, cone, COLORS.hair, x, y, z, 0.3, 0.75, 0.3).rotation.z = -tilt;
  }

  model.scale.setScalar(SCALE);
  const group = new THREE.Group();
  group.add(model);
  group.rotation.y = FACING_ANGLE; // starts facing right, like player.facing

  return {
    group, model, head, body, armL, armR, legL, legR,
    // Animation state, owned by the render layer (never game state).
    // wasOnGround starts true so the hero does not play a landing squash at spawn.
    facingEase: FACING_ANGLE, wasOnGround: true, runPhase: 0, squashLeft: 0,
  };
}

// Applies position, facing and animation to the hero, from the player state
// alone (vx, vy, onGround, facing) plus time. Called once per frame.
export function poseHero(hero, player, time, dt) {
  const grounded = player.onGround;
  const running = grounded && player.vx !== 0;

  // Turn toward the movement direction, easing so the turn is visible.
  const targetAngle = player.facing * FACING_ANGLE;
  hero.facingEase += (targetAngle - hero.facingEase) * Math.min(1, FACING_EASE * dt);
  hero.group.rotation.y = hero.facingEase;

  // The landing squash starts the moment the ground is regained.
  if (grounded && !hero.wasOnGround) hero.squashLeft = SQUASH_TIME;
  hero.wasOnGround = grounded;
  hero.squashLeft = Math.max(0, hero.squashLeft - dt);

  let stretch = 1; // vertical scale; width compensates below to keep volume
  let bob = 0;
  let lean = 0;

  if (!grounded) {
    // Jump / fall: arms up, legs tucked, slight stretch while rising.
    hero.armL.rotation.set(0, 0, 2.6);
    hero.armR.rotation.set(0, 0, -2.6);
    hero.legL.rotation.set(0.5, 0, 0);
    hero.legR.rotation.set(-0.3, 0, 0);
    stretch = player.vy > 0 ? 1.12 : 1.04;
  } else if (running) {
    // Run cycle: limbs swing with distance covered, full speed = demo cadence.
    hero.runPhase += RUN_SWING_RATE * (Math.abs(player.vx) / MOVE_SPEED) * dt;
    const swing = Math.sin(hero.runPhase);
    hero.legL.rotation.set(swing * 0.75, 0, 0);
    hero.legR.rotation.set(-swing * 0.75, 0, 0);
    hero.armL.rotation.set(-swing * 0.6, 0, 0.25);
    hero.armR.rotation.set(swing * 0.6, 0, -0.25);
    bob = Math.abs(Math.cos(hero.runPhase)) * 0.04;
    lean = 0.14 * player.facing;
  } else {
    // Idle: resting pose with gentle breathing.
    hero.armL.rotation.set(0, 0, 0.25);
    hero.armR.rotation.set(0, 0, -0.25);
    hero.legL.rotation.set(0, 0, 0);
    hero.legR.rotation.set(0, 0, 0);
    stretch = 1 + Math.sin(time * 2.5) * 0.02;
  }

  // The squash overrides the stretch, easing back to full height.
  if (hero.squashLeft > 0) {
    const recovered = 1 - hero.squashLeft / SQUASH_TIME; // 0 -> 1
    stretch = 0.78 + 0.22 * recovered;
  }

  hero.group.rotation.z = -lean; // lean into the running direction
  const widen = 1 / Math.sqrt(stretch);
  hero.model.scale.set(SCALE * widen, SCALE * stretch, SCALE * widen);
  hero.group.position.set(player.x + player.w / 2, player.y + bob, 0);
}
