// Everything three.js lives here. This module only READS the game state and
// draws it; it never changes it.
//
// Coordinates: the game uses x to the right and y up, one unit per tile, and
// boxes are described by their bottom-left corner. three.js positions meshes
// by their centre, so every mesh is placed at (x + w/2, y + h/2). The whole
// game sits on the plane z = 0 and the camera looks at it from positive z.

import * as THREE from 'three';
import { createHero } from './character.js';

const CAMERA_DISTANCE = 22; // how far the camera stands back from the play plane
const CAMERA_FOV = 40;      // vertical field of view in degrees
const CAMERA_FOLLOW = 6;    // higher = camera catches up with the player faster

export function isWebGLAvailable() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function createView(canvas, level) {
  // --- renderer, scene, camera -------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ecae6);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);
  const cameraY = level.height / 2;
  // Unknown until the first frame: the aspect ratio is only known after resize().
  let cameraX = null;

  // --- lights --------------------------------------------------------------
  // Soft light from the sky and the ground, so shadows are not pitch black.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b705c, 1.2));

  // The sun. It casts the shadows and moves along with the camera, so its
  // shadow area always covers what is on screen.
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  scene.add(sun);
  scene.add(sun.target);

  // --- level blocks ----------------------------------------------------------
  // One InstancedMesh draws every block in a single draw call.
  const blockPositions = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (level.solid[y][x]) blockPositions.push([x, y]);
    }
  }
  const blocks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x9c6644 }),
    blockPositions.length,
  );
  const matrix = new THREE.Matrix4();
  blockPositions.forEach(([x, y], i) => {
    matrix.makeTranslation(x + 0.5, y + 0.5, 0);
    blocks.setMatrixAt(i, matrix);
  });
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  scene.add(blocks);

  // --- helper for the moving things -------------------------------------------
  function addMesh(geometry, color) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // --- player: the Spiky Hero (see character.js) --------------------------------
  const hero = createHero();
  scene.add(hero.group);

  // --- enemies and coins: one mesh per entry in the level ----------------------
  const enemyGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const enemyMeshes = level.enemies.map(() => addMesh(enemyGeometry, 0xd62828));

  // A flat disc standing upright. The rotation is baked into the geometry so
  // that spinning the mesh around y makes the coin turn like a real one.
  const coinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 24);
  coinGeometry.rotateX(Math.PI / 2);
  const coinMeshes = level.coins.map(() => addMesh(coinGeometry, 0xffb703));

  // --- flag: a pole and a cloth -------------------------------------------------
  const pole = addMesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 12), 0xf1faee);
  pole.position.set(level.flag.x + 0.5, level.flag.y + 1.5, 0);
  const cloth = addMesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), 0x7b2cbf);
  cloth.position.set(level.flag.x + 0.5 + 0.45, level.flag.y + 2.65, 0);

  // --- size handling -------------------------------------------------------------
  function resize() {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight); // never 0, so the aspect stays finite
    // Read again on every resize: the window may move to a screen with another pixel ratio.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // Half of the level width that is visible on the play plane.
  function visibleHalfWidth() {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * CAMERA_DISTANCE;
    return halfHeight * camera.aspect;
  }

  // Keeps a camera x inside the level, so the view never shows beyond its ends.
  function clampCameraX(x) {
    const half = visibleHalfWidth();
    if (level.width <= half * 2) return level.width / 2; // level narrower than the view: centre it
    return THREE.MathUtils.clamp(x, half, level.width - half);
  }

  function place(mesh, box) {
    mesh.position.set(box.x + box.w / 2, box.y + box.h / 2, 0);
  }

  // --- draw one frame --------------------------------------------------------------
  // dt: seconds since the last frame. time: seconds since the page loaded.
  function render(game, dt, time) {
    hero.group.position.set(game.player.x + game.player.w / 2, game.player.y, 0);

    game.enemies.forEach((enemy, i) => {
      enemyMeshes[i].visible = enemy.alive;
      place(enemyMeshes[i], enemy);
    });

    game.coins.forEach((coin, i) => {
      coinMeshes[i].visible = !coin.collected;
      place(coinMeshes[i], coin);
      coinMeshes[i].rotation.y = time * 3;
    });

    // The camera follows the player sideways but stops at the level ends.
    const playerX = game.player.x + game.player.w / 2;
    const targetX = clampCameraX(playerX);
    if (cameraX === null) {
      cameraX = targetX; // first frame: start in place, no pan
    } else {
      cameraX += (targetX - cameraX) * Math.min(1, CAMERA_FOLLOW * dt);
      cameraX = clampCameraX(cameraX); // also holds when the window gets wider
    }
    camera.position.set(cameraX, cameraY + 1, CAMERA_DISTANCE);
    camera.lookAt(cameraX, cameraY, 0);

    sun.position.set(cameraX + 10, cameraY + 20, 15);
    sun.target.position.set(cameraX, cameraY, 0);

    renderer.render(scene, camera);
  }

  return { render, resize };
}
