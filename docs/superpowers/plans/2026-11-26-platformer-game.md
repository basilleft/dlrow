# Platformer Test Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A small original 2.5D jump-and-run game in three.js, playable at `https://www.dlrow.de/game/`: run, jump, collect coins, stomp or avoid enemies, reach a flag.

**Architecture:** Game rules are plain JavaScript modules with no three.js and no DOM (`level`, `physics`, `player`, `enemy`, `game`), tested in Node. One module, `render.js`, holds all three.js code and only reads game state. `main.js` wires them together with a fixed 60 Hz simulation step.

**Tech Stack:** Plain JavaScript ES modules, three.js 0.187.0 (self-hosted, loaded through an import map), Node 24 built-in test runner (`node --test`). No npm packages, no build step.

**Spec:** `docs/superpowers/specs/2026-11-26-platformer-game-design.md`

## Global Constraints

- Work on the existing local branch `game`. Do not push to `main`; a guardrail blocks it and merging to `main` publishes the site.
- No npm packages, no build step, no CDN or other third-party requests at runtime. three.js is self-hosted in `public/game/vendor/`.
- Do not change `.github/workflows/deploy.yml` or the deploy target.
- Everything under `public/` is deployed. Tests, `package.json` and docs stay outside `public/`.
- Only `public/game/js/render.js` may import three.js. `level.js`, `physics.js`, `player.js`, `enemy.js` and `game.js` must not import three.js or touch `document`/`window`.
- All on-screen text is German. The page uses `lang="de"`.
- The game is an original platformer. Do not copy names, characters, art or levels of any existing game.
- Coordinates everywhere in game logic: x to the right, y **up**, one unit = one tile. A box is `{ x, y, w, h }` with `(x, y)` its bottom-left corner.
- Code in this plan was run in a prototype: 36 tests pass on Node 24.3. Copy it exactly; if a test fails, the copy differs from the plan.
- End every commit message with the attribution line required by the session, if one is configured.

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Marks the repo as ES modules for Node and defines `npm test`. No dependencies |
| `public/game/index.html` | Page shell: canvas, HUD elements, import map, loads `js/main.js` |
| `public/game/game.css` | Full-window canvas and HUD styling |
| `public/game/vendor/three.module.js`, `three.core.js`, `LICENSE`, `README.md` | three.js 0.187.0, unmodified, with its licence and a note on its source |
| `public/game/js/level.js` | Level text grid, parser, `isSolid` |
| `public/game/js/physics.js` | Box overlap test and box-versus-tiles movement |
| `public/game/js/player.js` | Player movement, gravity, jump |
| `public/game/js/enemy.js` | Enemy patrol |
| `public/game/js/game.js` | Game state and the rules for one time step (stomp, coins, flag, pit, restart) |
| `public/game/js/input.js` | Keyboard state |
| `public/game/js/hud.js` | HUD texts and DOM updates |
| `public/game/js/render.js` | All three.js: scene, meshes, lights, shadows, camera |
| `public/game/js/main.js` | Bootstrap and game loop |
| `tests/*.test.js` | Node tests for the seven logic modules |

`game.js` is not in the spec's original file table. It exists because the stomp, coin, flag and pit rules must be testable in Node, and `main.js` touches the DOM. The spec table is updated in Task 9.

---

### Task 1: Test setup and level parser

**Files:**
- Create: `package.json`
- Create: `public/game/js/level.js`
- Test: `tests/level.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LEVEL_1: string[]` (12 rows of 80 characters).
  - `parseLevel(rows: string[]) -> { width, height, solid: boolean[][], coins: {x,y}[], enemies: {x,y}[], player: {x,y}, flag: {x,y} }`. `solid[y][x]` with `y = 0` the bottom row. Positions are tile coordinates. Throws `Error` on bad input.
  - `isSolid(level, tx, ty) -> boolean`. Columns outside the level are solid; rows outside are empty.

- [ ] **Step 1: Confirm the branch**

Run: `git branch --show-current`
Expected: `game`. If not, run `git checkout game`.

- [ ] **Step 2: Create `package.json`**

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

This adds no packages. `"type": "module"` makes Node treat the `.js` files under `public/game/js/` as ES modules, the same way the browser loads them.

- [ ] **Step 3: Write the failing test**

Create `tests/level.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_1, parseLevel, isSolid } from '../public/game/js/level.js';

const SMALL = [
  '....',
  'P.oF',
  '#E.#',
];

test('parseLevel reads size and flips y so the bottom row is y = 0', () => {
  const level = parseLevel(SMALL);
  assert.equal(level.width, 4);
  assert.equal(level.height, 3);
  assert.deepEqual(level.player, { x: 0, y: 1 });
  assert.deepEqual(level.flag, { x: 3, y: 1 });
  assert.deepEqual(level.coins, [{ x: 2, y: 1 }]);
  assert.deepEqual(level.enemies, [{ x: 1, y: 0 }]);
  assert.equal(level.solid[0][0], true);
  assert.equal(level.solid[0][1], false);
  assert.equal(level.solid[1][0], false);
});

test('parseLevel rejects rows of different length', () => {
  assert.throws(() => parseLevel(['P.F', '##']), /length 2, expected 3/);
});

test('parseLevel rejects a missing or duplicated player start', () => {
  assert.throws(() => parseLevel(['..F']), /no player start/);
  assert.throws(() => parseLevel(['PPF']), /more than one player start/);
});

test('parseLevel rejects a missing or duplicated flag', () => {
  assert.throws(() => parseLevel(['P..']), /no flag/);
  assert.throws(() => parseLevel(['PFF']), /more than one flag/);
});

test('parseLevel rejects unknown characters', () => {
  assert.throws(() => parseLevel(['P?F']), /unknown character "\?"/);
});

test('isSolid treats the sides as walls and above/below as empty', () => {
  const level = parseLevel(SMALL);
  assert.equal(isSolid(level, -1, 1), true);
  assert.equal(isSolid(level, 4, 1), true);
  assert.equal(isSolid(level, 1, -1), false);
  assert.equal(isSolid(level, 1, 3), false);
  assert.equal(isSolid(level, 3, 0), true);
  assert.equal(isSolid(level, 2, 0), false);
});

test('LEVEL_1 meets the spec', () => {
  const level = parseLevel(LEVEL_1);
  assert.equal(level.width, 80);
  assert.equal(level.height, 12);
  assert.ok(level.coins.length >= 8, 'at least 8 coins');
  assert.equal(level.enemies.length, 3);
  for (const e of level.enemies) {
    assert.equal(isSolid(level, e.x, e.y - 1), true, `enemy at ${e.x},${e.y} stands on a block`);
  }
  assert.equal(isSolid(level, level.player.x, level.player.y - 1), true, 'player starts on a block');
  const pitColumns = level.solid[0].filter((s) => !s).length;
  assert.ok(pitColumns >= 6, 'at least two pits in the floor');
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test tests/level.test.js`
Expected: FAIL with `Cannot find module` naming `public/game/js/level.js`

- [ ] **Step 5: Write the implementation**

Create `public/game/js/level.js`:

```js
// The level as text. Row 0 is the top. One character is one 1x1 tile.
//   .  empty      #  solid block     o  coin
//   E  enemy      P  player start    F  goal flag
export const LEVEL_1 = [
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '.............................................................ooo................',
  '.............oo...................ooo.......................#####...............',
  '......ooo...####...............#.................o..............................',
  '..P.......#.......E...........##....E.....#.............#.....E.....#......F....',
  '########################...##################...###...##########################',
  '########################...##################.........##########################',
];

// Turns the text rows into data. All positions are tile coordinates with
// x to the right and y UP, so y = 0 is the bottom row of the text.
export function parseLevel(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const solid = [];
  const coins = [];
  const enemies = [];
  let player = null;
  let flag = null;

  for (let y = 0; y < height; y++) {
    const row = rows[height - 1 - y];
    if (row.length !== width) {
      throw new Error(`Level row ${height - 1 - y} has length ${row.length}, expected ${width}`);
    }
    solid.push([]);
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      solid[y].push(ch === '#');
      if (ch === 'o') coins.push({ x, y });
      else if (ch === 'E') enemies.push({ x, y });
      else if (ch === 'P') {
        if (player) throw new Error('Level has more than one player start (P)');
        player = { x, y };
      } else if (ch === 'F') {
        if (flag) throw new Error('Level has more than one flag (F)');
        flag = { x, y };
      } else if (ch !== '.' && ch !== '#') {
        throw new Error(`Level has unknown character "${ch}" at column ${x}, row ${height - 1 - y}`);
      }
    }
  }
  if (!player) throw new Error('Level has no player start (P)');
  if (!flag) throw new Error('Level has no flag (F)');
  return { width, height, solid, coins, enemies, player, flag };
}

// Left and right of the level counts as solid, so nothing can walk out.
// Below and above the level is empty, so pits are open.
export function isSolid(level, tx, ty) {
  if (tx < 0 || tx >= level.width) return true;
  if (ty < 0 || ty >= level.height) return false;
  return level.solid[ty][tx];
}
```

Every row of `LEVEL_1` must be exactly 80 characters. The `LEVEL_1 meets the spec` test catches a miscounted row.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `pass 7` and `fail 0`

- [ ] **Step 7: Commit**

```bash
git add package.json public/game/js/level.js tests/level.test.js
git commit -m "Add level format, parser and test setup for the game"
```

---

### Task 2: Collision physics

**Files:**
- Create: `public/game/js/physics.js`
- Test: `tests/physics.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: 
  - `overlaps(a, b) -> boolean` for two boxes. Touching edges do not count.
  - `moveBox(box, dx, dy, solidAt) -> { left, right, floor, ceiling }` (all booleans). Mutates `box.x` and `box.y`. `solidAt(tx, ty) -> boolean`. Resolves x first, then y. `|dx|` and `|dy|` must be below 1.

- [ ] **Step 1: Write the failing test**

Create `tests/physics.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, moveBox } from '../public/game/js/physics.js';

// A floor along y = 0, a wall at x = 5 (tiles y 1..3), a ceiling tile at (2, 3).
const solidAt = (tx, ty) => ty === 0 || (tx === 5 && ty >= 1 && ty <= 3) || (tx === 2 && ty === 3);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('overlaps is true only when boxes intersect', () => {
  const a = { x: 0, y: 0, w: 1, h: 1 };
  assert.equal(overlaps(a, { x: 0.5, y: 0.5, w: 1, h: 1 }), true);
  assert.equal(overlaps(a, { x: 1, y: 0, w: 1, h: 1 }), false, 'touching edges do not overlap');
  assert.equal(overlaps(a, { x: 0, y: 2, w: 1, h: 1 }), false);
});

test('a falling box lands on the floor', () => {
  const box = { x: 1.1, y: 1.2, w: 0.7, h: 0.9 };
  const hit = moveBox(box, 0, -0.3, solidAt);
  assert.equal(hit.floor, true);
  assert.ok(near(box.y, 1));
});

test('a box standing on the floor can walk without snagging on it', () => {
  const box = { x: 1.1, y: 1, w: 0.7, h: 0.9 };
  const hit = moveBox(box, 0.1, 0, solidAt);
  assert.equal(hit.right, false);
  assert.ok(near(box.x, 1.2));
});

test('a box moving right stops at a wall', () => {
  const box = { x: 4.2, y: 1, w: 0.7, h: 0.9 };
  const hit = moveBox(box, 0.2, 0, solidAt);
  assert.equal(hit.right, true);
  assert.ok(near(box.x, 4.3));
});

test('a box moving left stops at a wall', () => {
  const box = { x: 6.1, y: 1, w: 0.7, h: 0.9 };
  const hit = moveBox(box, -0.2, 0, solidAt);
  assert.equal(hit.left, true);
  assert.ok(near(box.x, 6));
});

test('a rising box stops at a ceiling', () => {
  const box = { x: 2.1, y: 2, w: 0.7, h: 0.9 };
  const hit = moveBox(box, 0, 0.3, solidAt);
  assert.equal(hit.ceiling, true);
  assert.ok(near(box.y, 2.1));
});

test('a box with no floor under it keeps falling', () => {
  const noFloor = () => false;
  const box = { x: 1, y: 1, w: 0.7, h: 0.9 };
  const hit = moveBox(box, 0, -0.3, noFloor);
  assert.equal(hit.floor, false);
  assert.ok(near(box.y, 0.7));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/physics.test.js`
Expected: FAIL with `Cannot find module`

- [ ] **Step 3: Write the implementation**

Create `public/game/js/physics.js`:

```js
// Collision maths. A "box" is { x, y, w, h } where (x, y) is its bottom-left
// corner, y points up, and one unit is one tile.

const EPS = 1e-6;

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves the box by (dx, dy), stopping at solid tiles. Changes box.x and box.y.
// solidAt(tx, ty) must return true for solid tiles.
// Each move must be shorter than one tile, which holds at 60 steps per second.
export function moveBox(box, dx, dy, solidAt) {
  const hit = { left: false, right: false, floor: false, ceiling: false };

  if (dx !== 0) {
    box.x += dx;
    const y0 = Math.floor(box.y + EPS);
    const y1 = Math.floor(box.y + box.h - EPS);
    const tx = dx > 0 ? Math.floor(box.x + box.w - EPS) : Math.floor(box.x + EPS);
    for (let ty = y0; ty <= y1; ty++) {
      if (!solidAt(tx, ty)) continue;
      if (dx > 0) { box.x = tx - box.w; hit.right = true; }
      else { box.x = tx + 1; hit.left = true; }
      break;
    }
  }

  if (dy !== 0) {
    box.y += dy;
    const x0 = Math.floor(box.x + EPS);
    const x1 = Math.floor(box.x + box.w - EPS);
    const ty = dy > 0 ? Math.floor(box.y + box.h - EPS) : Math.floor(box.y + EPS);
    for (let tx = x0; tx <= x1; tx++) {
      if (!solidAt(tx, ty)) continue;
      if (dy > 0) { box.y = ty - box.h; hit.ceiling = true; }
      else { box.y = ty + 1; hit.floor = true; }
      break;
    }
  }

  return hit;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `pass 14` and `fail 0`

- [ ] **Step 5: Commit**

```bash
git add public/game/js/physics.js tests/physics.test.js
git commit -m "Add box collision against the tile grid"
```

---

### Task 3: Player movement

**Files:**
- Create: `public/game/js/player.js`
- Test: `tests/player.test.js`

**Interfaces:**
- Consumes: `moveBox` from Task 2.
- Produces: 
  - Constants `MOVE_SPEED = 6`, `GRAVITY = 40`, `JUMP_SPEED = 15`, `JUMP_CUT_SPEED = 6`, `MAX_FALL_SPEED = 20`.
  - `createPlayer(start: {x,y}) -> { x, y, w: 0.7, h: 0.9, vx, vy, onGround, jumpHeld }`.
  - `updatePlayer(player, input: { left, right, jump }, dt, solidAt)`. Mutates the player.

- [ ] **Step 1: Write the failing test**

Create `tests/player.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, updatePlayer, JUMP_SPEED, JUMP_CUT_SPEED } from '../public/game/js/player.js';

const DT = 1 / 60;
const floor = (tx, ty) => ty === 0;
const NONE = { left: false, right: false, jump: false };

function standingPlayer() {
  const p = createPlayer({ x: 3, y: 1 });
  updatePlayer(p, NONE, DT, floor); // one step so onGround is set
  return p;
}

test('a player on the floor is on the ground and does not sink', () => {
  const p = standingPlayer();
  assert.equal(p.onGround, true);
  assert.equal(p.y, 1);
});

test('right and left move the player', () => {
  const p = standingPlayer();
  const x0 = p.x;
  updatePlayer(p, { ...NONE, right: true }, DT, floor);
  assert.ok(p.x > x0);
  updatePlayer(p, { ...NONE, left: true }, DT, floor);
  updatePlayer(p, { ...NONE, left: true }, DT, floor);
  assert.ok(p.x < x0);
});

test('jump lifts the player off the ground', () => {
  const p = standingPlayer();
  updatePlayer(p, { ...NONE, jump: true }, DT, floor);
  assert.ok(p.y > 1);
  assert.equal(p.onGround, false);
  assert.ok(p.vy > 0 && p.vy < JUMP_SPEED);
});

test('holding jump does not jump again after landing', () => {
  const p = standingPlayer();
  const held = { ...NONE, jump: true };
  let landed = false;
  for (let i = 0; i < 200; i++) {
    updatePlayer(p, held, DT, floor);
    if (i > 5 && p.onGround) landed = true;
    if (landed) assert.equal(p.y, 1, 'stays on the floor while the key is still held');
  }
  assert.equal(landed, true);
});

test('a full jump goes higher than a short tap', () => {
  const peak = (holdSteps) => {
    const p = standingPlayer();
    let max = p.y;
    for (let i = 0; i < 120; i++) {
      updatePlayer(p, { ...NONE, jump: i < holdSteps }, DT, floor);
      max = Math.max(max, p.y);
    }
    return max;
  };
  const full = peak(120);
  const tap = peak(2);
  assert.ok(full > 3.5 && full < 4, `full jump peaks about 2.8 tiles up, got ${full - 1}`);
  assert.ok(tap < full - 1, 'tap is clearly lower');
});

test('releasing jump caps the upward speed', () => {
  const p = standingPlayer();
  updatePlayer(p, { ...NONE, jump: true }, DT, floor);
  updatePlayer(p, NONE, DT, floor);
  assert.ok(p.vy <= JUMP_CUT_SPEED);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/player.test.js`
Expected: FAIL with `Cannot find module`

- [ ] **Step 3: Write the implementation**

Create `public/game/js/player.js`:

```js
import { moveBox } from './physics.js';

export const MOVE_SPEED = 6;      // tiles per second
export const GRAVITY = 40;        // tiles per second squared
export const JUMP_SPEED = 15;     // full jump reaches about 2.8 tiles
export const JUMP_CUT_SPEED = 6;  // upward speed is capped to this once jump is released
export const MAX_FALL_SPEED = 20;

export function createPlayer(start) {
  return {
    x: start.x + 0.15, y: start.y, w: 0.7, h: 0.9,
    vx: 0, vy: 0, onGround: false, jumpHeld: false,
  };
}

// input is { left, right, jump } booleans.
export function updatePlayer(player, input, dt, solidAt) {
  player.vx = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * MOVE_SPEED;

  // Jump only on a fresh key press, not while the key stays held.
  if (input.jump && !player.jumpHeld && player.onGround) player.vy = JUMP_SPEED;
  // Releasing the key early cuts the jump short.
  if (!input.jump && player.vy > JUMP_CUT_SPEED) player.vy = JUMP_CUT_SPEED;
  player.jumpHeld = input.jump;

  player.vy = Math.max(player.vy - GRAVITY * dt, -MAX_FALL_SPEED);

  const hit = moveBox(player, player.vx * dt, player.vy * dt, solidAt);
  if (hit.floor || hit.ceiling) player.vy = 0;
  player.onGround = hit.floor;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `pass 20` and `fail 0`

- [ ] **Step 5: Commit**

```bash
git add public/game/js/player.js tests/player.test.js
git commit -m "Add player movement and variable-height jump"
```

---

### Task 4: Enemy patrol

**Files:**
- Create: `public/game/js/enemy.js`
- Test: `tests/enemy.test.js`

**Interfaces:**
- Consumes: `moveBox` from Task 2.
- Produces: 
  - Constant `ENEMY_SPEED = 2`.
  - `createEnemy(start: {x,y}) -> { x, y, w: 0.8, h: 0.8, dir: -1, alive: true }`.
  - `updateEnemy(enemy, dt, solidAt)`. Mutates the enemy; does nothing if `alive` is false.

- [ ] **Step 1: Write the failing test**

Create `tests/enemy.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, updateEnemy } from '../public/game/js/enemy.js';

const DT = 1 / 60;

function run(enemy, solidAt, steps) {
  let minX = enemy.x;
  let maxX = enemy.x;
  for (let i = 0; i < steps; i++) {
    updateEnemy(enemy, DT, solidAt);
    minX = Math.min(minX, enemy.x);
    maxX = Math.max(maxX, enemy.x);
  }
  return { minX, maxX };
}

test('an enemy starts walking left', () => {
  const floor = (tx, ty) => ty === 0;
  const e = createEnemy({ x: 5, y: 1 });
  const x0 = e.x;
  updateEnemy(e, DT, floor);
  assert.ok(e.x < x0);
});

test('an enemy turns around at walls', () => {
  // Floor at y = 0, walls at x = 2 and x = 8.
  const solidAt = (tx, ty) => ty === 0 || ((tx === 2 || tx === 8) && ty === 1);
  const e = createEnemy({ x: 5, y: 1 });
  const { minX, maxX } = run(e, solidAt, 1200);
  assert.ok(minX >= 3 - 1e-9, `never enters the left wall, got ${minX}`);
  assert.ok(maxX + e.w <= 8 + 1e-9, `never enters the right wall, got ${maxX + e.w}`);
  assert.ok(maxX - minX > 3, 'covers the space between the walls');
});

test('an enemy turns around at platform edges', () => {
  // A platform of tiles x = 3..7 at y = 0, nothing else.
  const solidAt = (tx, ty) => ty === 0 && tx >= 3 && tx <= 7;
  const e = createEnemy({ x: 5, y: 1 });
  const { minX, maxX } = run(e, solidAt, 1200);
  assert.ok(minX > 2.9, `stays on the platform on the left, got ${minX}`);
  assert.ok(maxX + e.w < 8.1, `stays on the platform on the right, got ${maxX + e.w}`);
  assert.equal(e.y, 1, 'does not fall');
});

test('a dead enemy does not move', () => {
  const floor = (tx, ty) => ty === 0;
  const e = createEnemy({ x: 5, y: 1 });
  e.alive = false;
  const x0 = e.x;
  updateEnemy(e, DT, floor);
  assert.equal(e.x, x0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/enemy.test.js`
Expected: FAIL with `Cannot find module`

- [ ] **Step 3: Write the implementation**

Create `public/game/js/enemy.js`:

```js
import { moveBox } from './physics.js';

export const ENEMY_SPEED = 2; // tiles per second

export function createEnemy(start) {
  return { x: start.x + 0.1, y: start.y, w: 0.8, h: 0.8, dir: -1, alive: true };
}

// Walks sideways. Turns around at walls and at platform edges. Enemies have no
// gravity; they must start on top of a solid tile.
export function updateEnemy(enemy, dt, solidAt) {
  if (!enemy.alive) return;

  const hit = moveBox(enemy, enemy.dir * ENEMY_SPEED * dt, 0, solidAt);
  if (hit.left || hit.right) {
    enemy.dir = -enemy.dir;
    return;
  }

  const frontX = enemy.dir > 0 ? enemy.x + enemy.w : enemy.x;
  const tileBelow = Math.round(enemy.y) - 1;
  if (!solidAt(Math.floor(frontX), tileBelow)) enemy.dir = -enemy.dir;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `pass 24` and `fail 0`

- [ ] **Step 5: Commit**

```bash
git add public/game/js/enemy.js tests/enemy.test.js
git commit -m "Add enemy patrol with wall and edge turning"
```

---

### Task 5: Game rules

**Files:**
- Create: `public/game/js/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: `isSolid`, `parseLevel`, `LEVEL_1` (Task 1); `overlaps` (Task 2); `createPlayer`, `updatePlayer` (Task 3); `createEnemy`, `updateEnemy` (Task 4).
- Produces: 
  - Constant `BOUNCE_SPEED = 10`.
  - `createGame(level) -> { level, player, enemies, coins, flag, coinCount, status }`. `coins[i]` is `{ x, y, w: 0.5, h: 0.5, collected }`. `flag` is a box. `status` is `'playing'` or `'won'`.
  - `resetGame(game)`: restores the start state in place (same object).
  - `stepGame(game, input: { left, right, jump, confirm }, dt)`.

The last test runs a simple bot through `LEVEL_1`. It proves the level can be finished with the tuned jump values. If you later change the level or the constants in `player.js` and this test fails, the level has become impossible or the bot's look-ahead no longer suits it.

- [ ] **Step 1: Write the failing test**

Create `tests/game.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, LEVEL_1, isSolid } from '../public/game/js/level.js';
import { createGame, stepGame, BOUNCE_SPEED } from '../public/game/js/game.js';

const DT = 1 / 60;
const NONE = { left: false, right: false, jump: false, confirm: false };
const RIGHT = { ...NONE, right: true };

function steps(game, input, n) {
  for (let i = 0; i < n; i++) stepGame(game, input, DT);
}

test('createGame sets up player, coins, enemies and status', () => {
  const game = createGame(parseLevel(['P.oEF', '#####']));
  assert.equal(game.status, 'playing');
  assert.equal(game.coinCount, 0);
  assert.equal(game.coins.length, 1);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.coins[0].collected, false);
});

test('walking into a coin collects it once', () => {
  const game = createGame(parseLevel(['P.o....F', '########']));
  steps(game, RIGHT, 40);
  assert.equal(game.coins[0].collected, true);
  assert.equal(game.coinCount, 1);
});

test('touching the flag wins, and Enter restarts', () => {
  const game = createGame(parseLevel(['P.o.F', '#####']));
  steps(game, RIGHT, 60);
  assert.equal(game.status, 'won');
  assert.equal(game.coinCount, 1);
  const frozenX = game.player.x;
  steps(game, RIGHT, 10);
  assert.equal(game.player.x, frozenX, 'nothing moves after winning');
  stepGame(game, { ...NONE, confirm: true }, DT);
  assert.equal(game.status, 'playing');
  assert.equal(game.coinCount, 0);
  assert.equal(game.coins[0].collected, false);
});

test('falling into a pit restarts the level and restores coins', () => {
  const game = createGame(parseLevel(['Po...F', '##..##']));
  const startX = game.player.x;
  steps(game, RIGHT, 20);
  assert.equal(game.coinCount, 1);
  let reset = false;
  for (let i = 0; i < 200 && !reset; i++) {
    stepGame(game, RIGHT, DT);
    if (game.coinCount === 0) reset = true;
  }
  assert.equal(reset, true, 'level restarted after the fall');
  assert.equal(game.player.x, startX);
  assert.equal(game.coins[0].collected, false);
  assert.equal(game.status, 'playing');
});

test('touching an enemy from the side restarts the level', () => {
  const game = createGame(parseLevel(['P..E..F', '#######']));
  const startX = game.player.x;
  let wentRight = false;
  let reset = false;
  for (let i = 0; i < 120 && !reset; i++) {
    stepGame(game, RIGHT, DT);
    if (game.player.x > startX + 0.5) wentRight = true;
    if (wentRight && game.player.x === startX) reset = true;
  }
  assert.equal(reset, true);
  assert.equal(game.enemies[0].alive, true);
});

test('landing on an enemy removes it and bounces the player', () => {
  const game = createGame(parseLevel(['.......', 'P..E..F', '#######']));
  const enemy = game.enemies[0];
  // Drop the player from above the enemy.
  game.player.x = enemy.x;
  game.player.y = enemy.y + 2;
  let bounced = false;
  for (let i = 0; i < 60 && !bounced; i++) {
    stepGame(game, NONE, DT);
    if (!game.enemies[0].alive) bounced = true;
  }
  assert.equal(bounced, true);
  assert.equal(game.player.vy, BOUNCE_SPEED);
  assert.equal(game.status, 'playing');
});

test('LEVEL_1 can be finished: a look-ahead bot reaches the flag without dying', () => {
  const game = createGame(parseLevel(LEVEL_1));
  const startX = game.player.x;
  let died = false;
  for (let i = 0; i < 60 * 60 && game.status === 'playing'; i++) {
    const p = game.player;
    const solid = (tx, ty) => isSolid(game.level, tx, ty);
    const front = p.x + p.w;
    const feet = Math.round(p.y);
    const wallAhead = solid(Math.floor(front + 0.3), feet);
    const pitAhead = !solid(Math.floor(front + 0.1), feet - 1) && !solid(Math.floor(front + 0.1), feet - 2);
    const enemyAhead = game.enemies.some(
      (e) => e.alive && e.x > p.x && e.x - front < 1.2 && Math.abs(e.y - p.y) < 1,
    );
    // Start a jump when something is in the way, and hold the key while rising.
    const jump = (p.onGround && (wallAhead || pitAhead || enemyAhead)) || (!p.onGround && p.vy > 0);
    stepGame(game, { ...NONE, right: true, jump }, DT);
    if (i > 30 && game.player.x === startX) died = true;
  }
  assert.equal(died, false, 'bot never had to restart');
  assert.equal(game.status, 'won');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/game.test.js`
Expected: FAIL with `Cannot find module`

- [ ] **Step 3: Write the implementation**

Create `public/game/js/game.js`:

```js
import { isSolid } from './level.js';
import { overlaps } from './physics.js';
import { createPlayer, updatePlayer } from './player.js';
import { createEnemy, updateEnemy } from './enemy.js';

export const BOUNCE_SPEED = 10; // upward speed after stomping an enemy

// Builds a fresh game state from a parsed level.
export function createGame(level) {
  return {
    level,
    player: createPlayer(level.player),
    enemies: level.enemies.map(createEnemy),
    coins: level.coins.map((c) => ({ x: c.x + 0.25, y: c.y + 0.25, w: 0.5, h: 0.5, collected: false })),
    flag: { x: level.flag.x + 0.3, y: level.flag.y, w: 0.4, h: 3 },
    coinCount: 0,
    status: 'playing', // 'playing' or 'won'
  };
}

// Puts everything back to the start, keeping the same game object.
export function resetGame(game) {
  Object.assign(game, createGame(game.level));
}

// Advances the game by one fixed time step.
// input is { left, right, jump, confirm } booleans.
export function stepGame(game, input, dt) {
  if (game.status === 'won') {
    if (input.confirm) resetGame(game);
    return;
  }

  const solidAt = (tx, ty) => isSolid(game.level, tx, ty);
  const player = game.player;

  updatePlayer(player, input, dt, solidAt);
  for (const enemy of game.enemies) updateEnemy(enemy, dt, solidAt);

  for (const enemy of game.enemies) {
    if (!enemy.alive || !overlaps(player, enemy)) continue;
    const fromAbove = player.vy < 0 && player.y > enemy.y + enemy.h / 2;
    if (!fromAbove) {
      resetGame(game);
      return;
    }
    enemy.alive = false;
    player.vy = BOUNCE_SPEED;
  }

  for (const coin of game.coins) {
    if (coin.collected || !overlaps(player, coin)) continue;
    coin.collected = true;
    game.coinCount += 1;
  }

  if (overlaps(player, game.flag)) {
    game.status = 'won';
    return;
  }

  // Fell into a pit: the whole player is below the bottom of the level.
  if (player.y + player.h < 0) resetGame(game);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `pass 31` and `fail 0`

- [ ] **Step 5: Commit**

```bash
git add public/game/js/game.js tests/game.test.js
git commit -m "Add game rules: stomp, coins, flag, pit and restart"
```

---

### Task 6: Keyboard input and HUD texts

**Files:**
- Create: `public/game/js/input.js`
- Create: `public/game/js/hud.js`
- Test: `tests/input.test.js`
- Test: `tests/hud.test.js`

**Interfaces:**
- Consumes: the game state shape from Task 5 (`coins`, `coinCount`, `status`).
- Produces:
  - `createInput(target = window) -> { left, right, jump, confirm }` (getters returning booleans). Left: `ArrowLeft`, `KeyA`. Right: `ArrowRight`, `KeyD`. Jump: `Space`, `ArrowUp`, `KeyW`. Confirm: `Enter`.
  - `hudText(game) -> { coins: string, message: string }`.
  - `createHud(doc = document) -> { update(game) }`. Needs elements with ids `coins` and `message`.

- [ ] **Step 1: Write the failing tests**

Create `tests/input.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../public/game/js/input.js';

function key(type, code) {
  const event = new Event(type, { cancelable: true });
  event.code = code;
  return event;
}

test('keys map to actions while held and release on keyup', () => {
  const target = new EventTarget();
  const input = createInput(target);
  assert.equal(input.left, false);

  target.dispatchEvent(key('keydown', 'KeyA'));
  assert.equal(input.left, true);
  target.dispatchEvent(key('keyup', 'KeyA'));
  assert.equal(input.left, false);

  target.dispatchEvent(key('keydown', 'ArrowRight'));
  target.dispatchEvent(key('keydown', 'Space'));
  target.dispatchEvent(key('keydown', 'Enter'));
  assert.equal(input.right, true);
  assert.equal(input.jump, true);
  assert.equal(input.confirm, true);
});

test('game keys do not scroll the page, other keys are left alone', () => {
  const target = new EventTarget();
  createInput(target);
  const space = key('keydown', 'Space');
  const tab = key('keydown', 'Tab');
  target.dispatchEvent(space);
  target.dispatchEvent(tab);
  assert.equal(space.defaultPrevented, true);
  assert.equal(tab.defaultPrevented, false);
});

test('losing focus releases all keys', () => {
  const target = new EventTarget();
  const input = createInput(target);
  target.dispatchEvent(key('keydown', 'KeyD'));
  target.dispatchEvent(new Event('blur'));
  assert.equal(input.right, false);
});
```

Create `tests/hud.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { hudText } from '../public/game/js/hud.js';

const coins = [{}, {}, {}];

test('while playing, shows the coin counter and no message', () => {
  const text = hudText({ coins, coinCount: 1, status: 'playing' });
  assert.equal(text.coins, 'Münzen: 1 / 3');
  assert.equal(text.message, '');
});

test('after winning, shows the result and how to restart', () => {
  const text = hudText({ coins, coinCount: 2, status: 'won' });
  assert.equal(text.message, 'Level geschafft!\n2 von 3 Münzen gesammelt\nEnter: noch einmal spielen');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/input.test.js tests/hud.test.js`
Expected: FAIL with `Cannot find module` for both files

- [ ] **Step 3: Write the implementations**

Create `public/game/js/input.js`:

```js
// Keyboard state. Reports which actions are currently held down.

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const JUMP = ['Space', 'ArrowUp', 'KeyW'];
const CONFIRM = ['Enter'];
const USED = new Set([...LEFT, ...RIGHT, ...JUMP, ...CONFIRM]);

export function createInput(target = window) {
  const held = new Set();

  target.addEventListener('keydown', (event) => {
    if (!USED.has(event.code)) return;
    event.preventDefault(); // stop space and arrows from scrolling the page
    held.add(event.code);
  });
  target.addEventListener('keyup', (event) => held.delete(event.code));
  // If the window loses focus we never see the keyup, so release everything.
  target.addEventListener('blur', () => held.clear());

  const any = (codes) => codes.some((code) => held.has(code));
  return {
    get left() { return any(LEFT); },
    get right() { return any(RIGHT); },
    get jump() { return any(JUMP); },
    get confirm() { return any(CONFIRM); },
  };
}
```

Create `public/game/js/hud.js`:

```js
// The text overlay on top of the canvas: coin counter and end-of-level message.

// Returns the texts to show for a game state. message is '' while playing.
export function hudText(game) {
  const total = game.coins.length;
  const coins = `Münzen: ${game.coinCount} / ${total}`;
  const message = game.status === 'won'
    ? `Level geschafft!\n${game.coinCount} von ${total} Münzen gesammelt\nEnter: noch einmal spielen`
    : '';
  return { coins, message };
}

export function createHud(doc = document) {
  const coinsEl = doc.getElementById('coins');
  const messageEl = doc.getElementById('message');
  let shown = { coins: null, message: null };

  return {
    // Call once per frame. Only touches the page when a text changed.
    update(game) {
      const next = hudText(game);
      if (next.coins !== shown.coins) coinsEl.textContent = next.coins;
      if (next.message !== shown.message) {
        messageEl.textContent = next.message;
        messageEl.hidden = next.message === '';
      }
      shown = next;
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `pass 36` and `fail 0`

- [ ] **Step 5: Commit**

```bash
git add public/game/js/input.js public/game/js/hud.js tests/input.test.js tests/hud.test.js
git commit -m "Add keyboard input and HUD texts"
```

---

### Task 7: Add three.js to the repo

**Files:**
- Create: `public/game/vendor/three.module.js`
- Create: `public/game/vendor/three.core.js`
- Create: `public/game/vendor/LICENSE`
- Create: `public/game/vendor/README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `public/game/vendor/three.module.js`, an ES module exporting the three.js API. It imports `./three.core.js`, so both files must sit in the same folder.

`npm pack` is used here only as a download tool. It fetches the published package archive; it does not install anything or create `node_modules`.

- [ ] **Step 1: Download and unpack three.js 0.187.0 into a temporary folder**

```bash
TMP=$(mktemp -d)
(cd "$TMP" && npm pack three@0.187.0 --silent && tar -xzf three-0.187.0.tgz)
ls "$TMP/package/build"
```

Expected output includes `three.core.js` and `three.module.js`.

- [ ] **Step 2: Copy the three needed files**

```bash
mkdir -p public/game/vendor
cp "$TMP/package/build/three.module.js" "$TMP/package/build/three.core.js" "$TMP/package/LICENSE" public/game/vendor/
rm -rf "$TMP"
ls -l public/game/vendor
```

Expected: `LICENSE` (about 1 KB), `three.core.js` (about 1.5 MB), `three.module.js` (about 0.66 MB).

- [ ] **Step 3: Write `public/game/vendor/README.md`**

```markdown
# Vendored three.js

- Library: three.js, https://threejs.org
- Version: 0.187.0 (revision 187)
- Source: npm package `three@0.187.0`, files `build/three.module.js`, `build/three.core.js` and `LICENSE`
- Licence: MIT, see `LICENSE`

The files are unmodified. `three.module.js` imports `./three.core.js`, so both must stay
in this folder. To update: download the new package version, replace both files and the
licence, update the version here, then play through the game.
```

- [ ] **Step 4: Verify the files load and are the expected version**

Run:

```bash
node -e "import('./public/game/vendor/three.module.js').then(T => console.log(T.REVISION, typeof T.WebGLRenderer, typeof T.CapsuleGeometry))"
```

Expected: `187 function function`

- [ ] **Step 5: Run all tests to confirm nothing else changed**

Run: `node --test`
Expected: PASS, `pass 36` and `fail 0`

- [ ] **Step 6: Commit**

```bash
git add public/game/vendor
git commit -m "Vendor three.js 0.187.0 for the game"
```

---

### Task 8: Page, rendering and game loop

**Files:**
- Create: `public/game/index.html`
- Create: `public/game/game.css`
- Create: `public/game/js/render.js`
- Create: `public/game/js/main.js`

**Interfaces:**
- Consumes: `LEVEL_1`, `parseLevel` (Task 1); `createGame`, `stepGame` (Task 5); `createInput`, `createHud` (Task 6); the `three` module (Task 7).
- Produces:
  - `isWebGLAvailable() -> boolean`.
  - `createView(canvas, level) -> { render(game, dt, time), resize() }`. `dt` is seconds since the last frame, `time` is seconds since page load.
  - Page element ids: `game` (canvas), `coins`, `help`, `message`, `no-webgl`.

This task has no automated test: it needs a real browser with WebGL. It is verified by the checks in Steps 5 to 7.

- [ ] **Step 1: Create `public/game/index.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Jump &amp; Run – dlrow.de</title>
  <meta name="robots" content="noindex">
  <link rel="stylesheet" href="game.css">
  <script type="importmap">
    { "imports": { "three": "./vendor/three.module.js" } }
  </script>
</head>
<body>
  <canvas id="game" aria-label="Jump-and-Run-Spiel"></canvas>
  <p id="coins" class="hud"></p>
  <p id="help" class="hud">← → oder A / D: laufen · Leertaste: springen · Gegner von oben treffen</p>
  <p id="message" hidden></p>
  <p id="no-webgl" hidden>Dieses Spiel benötigt WebGL 2. Bitte einen aktuellen Browser verwenden.</p>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

The import map lets `render.js` write `import * as THREE from 'three'`, the same line every three.js tutorial uses, while the file actually comes from `vendor/`.

- [ ] **Step 2: Create `public/game/game.css`**

```css
html, body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: #8ecae6;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

#game {
  display: block;
  width: 100%;
  height: 100%;
}

.hud {
  position: fixed;
  margin: 0;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font-size: 1rem;
  pointer-events: none;
}

#coins {
  top: 1rem;
  left: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

#help {
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 2rem);
  text-align: center;
  font-size: 0.9rem;
}

#message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  padding: 1.5rem 2rem;
  border-radius: 0.75rem;
  background: rgb(0 0 0 / 0.75);
  color: #fff;
  font-size: 1.25rem;
  line-height: 1.6;
  text-align: center;
  white-space: pre-line;
}

#message::first-line {
  font-size: 1.75rem;
  font-weight: 700;
}

#no-webgl {
  margin: 2rem;
  font-size: 1.1rem;
  color: #1b1b1b;
}

[hidden] {
  display: none !important;
}
```

- [ ] **Step 3: Create `public/game/js/render.js`**

```js
// Everything three.js lives here. This module only READS the game state and
// draws it; it never changes it.
//
// Coordinates: the game uses x to the right and y up, one unit per tile, and
// boxes are described by their bottom-left corner. three.js positions meshes
// by their centre, so every mesh is placed at (x + w/2, y + h/2). The whole
// game sits on the plane z = 0 and the camera looks at it from positive z.

import * as THREE from 'three';

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ecae6);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);
  const cameraY = level.height / 2;
  let cameraX = level.player.x;

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

  // --- player: a capsule 0.7 wide and 0.9 tall ---------------------------------
  const playerMesh = addMesh(new THREE.CapsuleGeometry(0.35, 0.2, 8, 16), 0x2a9d8f);

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
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // Half of the level width that is visible on the play plane.
  function visibleHalfWidth() {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * CAMERA_DISTANCE;
    return halfHeight * camera.aspect;
  }

  function place(mesh, box) {
    mesh.position.set(box.x + box.w / 2, box.y + box.h / 2, 0);
  }

  // --- draw one frame --------------------------------------------------------------
  // dt: seconds since the last frame. time: seconds since the page loaded.
  function render(game, dt, time) {
    place(playerMesh, game.player);

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
    const half = visibleHalfWidth();
    const playerX = game.player.x + game.player.w / 2;
    const targetX = level.width <= half * 2
      ? level.width / 2
      : THREE.MathUtils.clamp(playerX, half, level.width - half);
    cameraX += (targetX - cameraX) * Math.min(1, CAMERA_FOLLOW * dt);
    camera.position.set(cameraX, cameraY + 1, CAMERA_DISTANCE);
    camera.lookAt(cameraX, cameraY, 0);

    sun.position.set(cameraX + 10, cameraY + 20, 15);
    sun.target.position.set(cameraX, cameraY, 0);

    renderer.render(scene, camera);
  }

  return { render, resize };
}
```

- [ ] **Step 4: Create `public/game/js/main.js`**

```js
// Entry point: builds everything and runs the game loop.

import { LEVEL_1, parseLevel } from './level.js';
import { createGame, stepGame } from './game.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createView, isWebGLAvailable } from './render.js';

const STEP = 1 / 60;     // the simulation always advances in steps of this size
const MAX_FRAME = 0.1;   // never simulate more than this much time per frame

const canvas = document.getElementById('game');

if (isWebGLAvailable()) {
  start();
} else {
  canvas.hidden = true;
  document.getElementById('help').hidden = true;
  document.getElementById('no-webgl').hidden = false;
}

function start() {
  const game = createGame(parseLevel(LEVEL_1));
  const input = createInput();
  const hud = createHud();
  const view = createView(canvas, game.level);

  window.addEventListener('resize', view.resize);
  view.resize();

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // Fixed time step: the screen may refresh at any rate, but the game rules
    // always run in equal steps, so jumps behave the same on every machine.
    if (!document.hidden) {
      accumulator += dt;
      while (accumulator >= STEP) {
        stepGame(game, input, STEP);
        accumulator -= STEP;
      }
    }

    view.render(game, dt, now / 1000);
    hud.update(game);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
```

- [ ] **Step 5: Check that the logic tests still pass and the rule about three.js imports holds**

Run: `node --test`
Expected: PASS, `pass 36` and `fail 0`

Run: `grep -l "from 'three'" public/game/js/*.js`
Expected: exactly one line, `public/game/js/render.js`

Run: `grep -n "document\|window" public/game/js/level.js public/game/js/physics.js public/game/js/player.js public/game/js/enemy.js public/game/js/game.js`
Expected: no output

- [ ] **Step 6: Serve the site locally and check every file is reachable**

ES modules do not load from `file://`, so a local web server is needed.

Run in the background: `python3 -m http.server 8000 --directory public`

Then run:

```bash
for p in game/ game/game.css game/js/main.js game/js/level.js game/js/physics.js game/js/player.js game/js/enemy.js game/js/game.js game/js/input.js game/js/hud.js game/js/render.js game/vendor/three.module.js game/vendor/three.core.js; do
  printf '%s -> ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8000/$p"
done
```

Expected: `200` on every line.

- [ ] **Step 7: Play-through in a browser**

Open `http://localhost:8000/game/` and open the browser's developer console. Check each item; all must hold:

1. The console shows no errors or warnings from the game files.
2. A blue sky, brown blocks with shadows, a green capsule (player), three red boxes (enemies), spinning gold coins. The counter reads `Münzen: 0 / 12`.
3. Left/right arrows and A/D move the player; the camera follows and stops at the level ends.
4. A short tap on space gives a small hop; holding space gives a clearly higher jump.
5. Touching a coin removes it and raises the counter.
6. Running into an enemy from the side puts the player back at the start with the counter at 0 and all coins back.
7. Landing on an enemy removes it and bounces the player.
8. Falling into a pit restarts the level.
9. Touching the flag shows `Level geschafft!` with the coin count; Enter restarts.
10. Resizing the window keeps the picture undistorted and sharp.
11. Switching to another tab for ten seconds and returning: the player is where it was.

An agent without a browser cannot do this step. In that case stop here, report that Steps 1 to 6 passed, and hand Step 7 to the owner. Do not mark the task complete without it.

If something is wrong, fix it in the file responsible (`render.js` for anything visual, `main.js` for the loop) and repeat Steps 5 to 7.

Stop the local server when done.

- [ ] **Step 8: Commit**

```bash
git add public/game/index.html public/game/game.css public/game/js/render.js public/game/js/main.js
git commit -m "Add game page, three.js rendering and game loop"
```

---

### Task 9: Documentation and handover

**Files:**
- Modify: `CLAUDE.md` (sections "Repository structure" and "Conventions")
- Modify: `README.md` (append a section)
- Modify: `docs/superpowers/specs/2026-11-26-platformer-game-design.md` (file table and game-state section)

**Interfaces:**
- Consumes: the finished file layout from Tasks 1 to 8.
- Produces: nothing used by code.

- [ ] **Step 1: Update the structure block in `CLAUDE.md`**

In the code block under `## Repository structure`, insert these lines after the `robots.txt` line:

```
  game/              -> three.js platformer test game, live at /game/ (not linked from the start page)
    index.html, game.css
    js/              -> level, physics, player, enemy, game (rules, no three.js) + input, hud, render, main
    vendor/          -> self-hosted three.js 0.187.0 (unmodified) + LICENSE
tests/               -> Node tests for the game rules (`node --test`), never deployed
package.json         -> only "type": "module" and the test script; NO dependencies
docs/superpowers/    -> design specs and implementation plans
```

- [ ] **Step 2: Update the conventions in `CLAUDE.md`**

Replace the line

```
- Keep it dependency-free unless a framework is explicitly agreed.
```

with

```
- Keep it dependency-free unless a framework is explicitly agreed. Agreed so far:
  three.js for `public/game/`, self-hosted in `public/game/vendor/` (no npm install, no CDN).
- Game code: only `public/game/js/render.js` imports three.js. Game rules stay free of
  three.js and the DOM so they can be tested with `node --test`. Run the tests before
  every commit that touches `public/game/js/`.
- ES modules do not load from `file://`. To try the site locally:
  `python3 -m http.server 8000 --directory public`, then open http://localhost:8000/game/.
```

- [ ] **Step 3: Append a game section to `README.md`**

Add at the end of the file:

```markdown

## Game

A small three.js jump-and-run lives in `public/game/` and is published at `/game/`.

- Try it locally: `python3 -m http.server 8000 --directory public`, then open
  http://localhost:8000/game/
- Run the tests: `node --test` (needs Node 20 or newer, no packages to install)
- Edit the level: the text grid `LEVEL_1` in `public/game/js/level.js`
- three.js is self-hosted in `public/game/vendor/`; see the README there for the version
```

- [ ] **Step 4: Bring the spec in line with what was built**

In `docs/superpowers/specs/2026-11-26-platformer-game-design.md`:

Replace the table row

```
| `js/main.js` | Bootstraps, owns the game state, runs the fixed-step loop, wires the other modules | all below |
```

with

```
| `js/main.js` | Bootstraps, runs the fixed-step loop, wires the other modules | all below |
| `js/game.js` | Game state and the rules of one time step: stomp, coins, flag, pit, restart | level, physics, player, enemy |
```

Replace the sentence

```
Rule: game logic (`level`, `physics`, `player`, `enemy`) never imports three.js or
```

with

```
Rule: game logic (`level`, `physics`, `player`, `enemy`, `game`) never imports three.js or
```

Replace the line

```
A single plain object owned by `main.js`:
```

with

```
A single plain object created by `createGame` in `game.js` and held by `main.js`:
```

- [ ] **Step 5: Final verification**

Run: `node --test`
Expected: PASS, `pass 36` and `fail 0`

Run: `git status --short`
Expected: only the three modified documentation files.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-11-26-platformer-game-design.md
git commit -m "Document the game in CLAUDE.md, README and spec"
```

- [ ] **Step 7: Hand over to the owner**

Do not push to `main` and do not merge. Tell the owner:

- the branch `game` is ready locally and what was verified (test count, play-through result);
- to publish it they run `git push -u origin game`, open a pull request at `https://github.com/basilleft/dlrow/compare/game`, and merge it; the merge deploys the game to `https://www.dlrow.de/game/`;
- the first deploy uploads about 2.1 MB of three.js, and the previous deploy of seven small files took ten minutes for reasons not yet understood, so this one may be slow.

After the owner reports the deploy as done, check `https://www.dlrow.de/game/` and the two vendor files return HTTP 200.

---

## Spec coverage

| Spec section | Task |
|---|---|
| Decisions (three.js, 2.5D, location, no build, primitives, German) | Global Constraints, 7, 8 |
| Game rules: controls, variable jump | 3, 6 |
| Game rules: coins, stomp, side hit, pit, restart, goal, Enter | 5 |
| Game rules: enemy patrol and turning | 4 |
| Game rules: cannot leave the level sideways | 1 (`isSolid`) |
| Level format, parser errors, level size and contents | 1 |
| Files and the logic/rendering separation rule | 1 to 8, checked in Task 8 Step 5 |
| Game state object | 5 |
| Loop: fixed step, 0.1 s clamp, pause when hidden, step order | 5 (order), 8 (`main.js`) |
| Rendering: camera follow and clamp, InstancedMesh, shapes, lights, shadows, resize, pixel ratio | 8 |
| Error handling: no WebGL, level errors | 8, 1 |
| Hosting: import map, local server, vendored version note | 7, 8, 9 |
| Testing: automated list and manual play-through | 1 to 6, 8 Step 7 |
| Delivery: `game` branch, merge only after play-through | Global Constraints, 9 Step 7 |

One spec line is deliberately not implemented as a separate item: "`.htaccess` currently sets no cache lifetime for JavaScript ... kept for now". No change is needed. The server already compresses responses (Brotli), so the two three.js files transfer as roughly 0.4 MB.
