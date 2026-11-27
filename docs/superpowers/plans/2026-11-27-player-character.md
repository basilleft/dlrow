# Spiky Hero Player Character Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the player's teal capsule with the toon-shaded chibi "Spiky Hero" and animate it from game state, per the approved spec `docs/superpowers/specs/2026-11-27-player-character-design.md`.

**Architecture:** One new module `public/game/js/character.js` (imports three.js) builds the hero mesh and poses it each frame from the player state; `render.js` swaps the capsule for it. One new game-state field `facing` in `player.js`, unit-tested. Collision box and physics unchanged.

**Tech Stack:** Vanilla ES modules, self-hosted three.js 0.187.0 (`import * as THREE from 'three'` resolves via the import map in `public/game/index.html`), `node --test` for game-rule tests.

## Global Constraints

- No new dependencies, assets, textures or CDN requests — three.js primitives only.
- Only `render.js` and `character.js` may import three.js (this plan updates CLAUDE.md to say so). Game rules stay free of three.js and the DOM.
- The collision box stays exactly `w: 0.7, h: 0.9`; do not touch physics.js, game.js, level.js.
- Run `npm test` before every commit that touches `public/game/js/` — all existing 42 tests must stay green.
- Never write the game's access code anywhere (code, tests, docs, commit messages).
- Work on the existing `character` branch (the spec is already committed there).

**Local game check (used by several verify steps):** run
`python3 -m http.server 8000 --directory public` in the repo root, open
`http://localhost:8000/game/`. The page asks for an access code; bypass it
locally via the browser console: `sessionStorage.setItem('game-unlocked', '1')`
then reload (the key is per-tab, from `boot.js`). Controls: arrow keys / A-D
to move, Space / W / Up to jump.

---

### Task 1: `facing` field in the player state

**Files:**
- Modify: `public/game/js/player.js` (createPlayer at lines 9–14, updatePlayer at lines 17–31)
- Test: `tests/player.test.js` (append)

**Interfaces:**
- Consumes: existing `createPlayer(start)` / `updatePlayer(player, input, dt, solidAt)`.
- Produces: `player.facing` — `1` (right, the initial value) or `-1` (left); follows `vx` while moving, keeps its last value when `vx === 0`. Task 3 reads it.

- [ ] **Step 1: Write the failing tests**

Append to `tests/player.test.js` (it already defines `DT`, `floor`, `NONE`, `standingPlayer`):

```js
test('a new player faces right', () => {
  const p = createPlayer({ x: 3, y: 1 });
  assert.equal(p.facing, 1);
});

test('facing follows the movement direction', () => {
  const p = standingPlayer();
  updatePlayer(p, { ...NONE, left: true }, DT, floor);
  assert.equal(p.facing, -1);
  updatePlayer(p, { ...NONE, right: true }, DT, floor);
  assert.equal(p.facing, 1);
});

test('facing keeps its last direction after stopping', () => {
  const p = standingPlayer();
  updatePlayer(p, { ...NONE, left: true }, DT, floor);
  updatePlayer(p, NONE, DT, floor);
  assert.equal(p.facing, -1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the three new tests FAIL (`p.facing` is `undefined`); the other 42 pass.

- [ ] **Step 3: Implement**

In `public/game/js/player.js`, add `facing: 1` to the object returned by `createPlayer`:

```js
    x: start.x + 0.15, y: start.y, w: 0.7, h: 0.9,
    vx: 0, vy: 0, onGround: false, jumpHeld: false, facing: 1,
```

In `updatePlayer`, directly after the line that sets `player.vx`:

```js
  // Which way the player last moved; the renderer turns the character with it.
  if (player.vx > 0) player.facing = 1;
  else if (player.vx < 0) player.facing = -1;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: 45 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add public/game/js/player.js tests/player.test.js
git commit -m "Add facing direction to the player state"
```

---

### Task 2: `createHero()` — the model, standing in the game

**Files:**
- Create: `public/game/js/character.js`
- Modify: `public/game/js/render.js` (player mesh at line 85–86, and the `place(playerMesh, …)` call at line 135)
- Modify: `CLAUDE.md` (repository structure + conventions)

**Interfaces:**
- Consumes: `MOVE_SPEED` from `./player.js` (re-exported constant, value 6); three.js via the `three` import-map name.
- Produces: `createHero()` returning `{ group, model, head, body, armL, armR, legL, legR, facingEase, wasOnGround, runPhase, squashLeft }`. `group` is a `THREE.Group` whose origin is the **bottom-center of the collision box**; `model` is the inner group that carries the base scale. Task 3 adds `poseHero(hero, player, time, dt)` to this same file and relies on these exact field names.

- [ ] **Step 1: Create `public/game/js/character.js`**

```js
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
    // Animation state, owned by the render layer (never game state):
    facingEase: FACING_ANGLE, wasOnGround: false, runPhase: 0, squashLeft: 0,
  };
}
```

- [ ] **Step 2: Swap the capsule in `render.js`**

Add to the imports at the top of `public/game/js/render.js` (after the THREE import):

```js
import { createHero } from './character.js';
```

Replace these two lines:

```js
  // --- player: a capsule 0.7 wide and 0.9 tall ---------------------------------
  const playerMesh = addMesh(new THREE.CapsuleGeometry(0.35, 0.2, 8, 16), 0x2a9d8f);
```

with:

```js
  // --- player: the Spiky Hero (see character.js) --------------------------------
  const hero = createHero();
  scene.add(hero.group);
```

In `render()`, replace `place(playerMesh, game.player);` with (static for now; Task 3 animates it):

```js
    hero.group.position.set(game.player.x + game.player.w / 2, game.player.y, 0);
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: 45 PASS (nothing here touches game rules, but the convention is tests before every commit touching `public/game/js/`).

- [ ] **Step 4: Verify in the browser**

Serve and open the game as described under Global Constraints (incl. the sessionStorage bypass). Expected: the hero stands on the ground where the capsule was — teal spiky hair, orange gi, purple belt, big eyes, flat cel-shaded colors, casting a shadow. Feet on the floor, not buried in it. He does not yet animate; moving slides him around rigidly. No console errors.

- [ ] **Step 5: Update CLAUDE.md**

In the repository-structure block, change

```
    js/              -> boot + gate (access code), level, physics, player, enemy, game (rules,
                        no three.js) + input, hud, render, main
```

to

```
    js/              -> boot + gate (access code), level, physics, player, enemy, game (rules,
                        no three.js) + input, hud, render, character, main
```

In Conventions, change

```
- Game code: only `public/game/js/render.js` imports three.js. Game rules stay free of
```

to

```
- Game code: only `public/game/js/render.js` and `public/game/js/character.js` import
  three.js. Game rules stay free of
```

- [ ] **Step 6: Commit**

```bash
git add public/game/js/character.js public/game/js/render.js CLAUDE.md
git commit -m "Replace the player capsule with the toon-shaded Spiky Hero"
```

---

### Task 3: `poseHero()` — the animation set

**Files:**
- Modify: `public/game/js/character.js` (append `poseHero`)
- Modify: `public/game/js/render.js` (the import line and the hero position line from Task 2)

**Interfaces:**
- Consumes: the `hero` object from `createHero()` (exact field names in Task 2); `player` state `{ x, y, w, vx, vy, onGround, facing }`; `MOVE_SPEED` (already imported).
- Produces: `poseHero(hero, player, time, dt)` — `time` is seconds since page load, `dt` seconds since the last frame (both already flow into `render(game, dt, time)`).

- [ ] **Step 1: Append `poseHero` to `public/game/js/character.js`**

```js
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
```

- [ ] **Step 2: Call it from `render.js`**

Change the import from Task 2 to:

```js
import { createHero, poseHero } from './character.js';
```

In `render()`, replace the static line
`hero.group.position.set(game.player.x + game.player.w / 2, game.player.y, 0);`
with:

```js
    poseHero(hero, game.player, time, dt);
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: 45 PASS.

- [ ] **Step 4: Verify every animation state in the browser**

Serve and open the game (Global Constraints). Check each row of the spec's animation table:
- Standing still: gentle breathing pulse, resting arms.
- Run right, then left: legs/arms swing, slight lean, small bob; he turns smoothly (not instantly) to face each direction and stays turned after stopping.
- Jump: arms up, legs tucked, slightly stretched; falling off a ledge looks the same without a jump.
- Land from a jump AND from a plain fall off a ledge: brief squash toward the floor, smooth recovery, feet never sink into the ground.
- Stomp an enemy: the bounce gives a squash-then-air sequence that looks right.
- No console errors; motion stays smooth.

- [ ] **Step 5: Commit**

```bash
git add public/game/js/character.js public/game/js/render.js
git commit -m "Animate the hero: run cycle, facing, jump stretch, landing squash"
```

---

### Task 4: Final check and docs consistency

**Files:**
- Modify: none expected (verification; README already describes the game without mentioning the player's look, and the spec needs no update)

**Interfaces:**
- Consumes: everything above.
- Produces: a branch ready to merge to `main` (merging deploys).

- [ ] **Step 1: Full test run and docs grep**

Run: `npm test` (expected: 45 PASS) and
`grep -rn "capsule" README.md CLAUDE.md docs/ public/game/index.html`
Expected: no stale claim that the player is a capsule (the spec's historical mentions are fine — it documents the replacement). If a stale mention appears somewhere unexpected, fix that file and amend/commit.

- [ ] **Step 2: Play the game start to finish**

Reach the flag once, die once (enemy or pit), collect coins. Expected: everything behaves as before the change; only the player's look differs.

- [ ] **Step 3: Confirm the working tree is clean**

Run: `git status`
Expected: clean; all work committed on the `character` branch. Do NOT merge or push — the owner decides (merging to `main` deploys to the live site).
