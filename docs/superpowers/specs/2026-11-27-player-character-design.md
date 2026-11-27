# Player character: Spiky Hero

Design spec, approved by the owner on 2026-11-27 after visual mockups
(chibi variants and an animation demo, picked in the brainstorming companion).

## Goal

Replace the player's plain teal capsule in `public/game/` with a chibi anime
character — the "Spiky Hero" — built entirely from three.js primitives with
toon (cel) shading, and animate it from the game state. Purely visual: game
rules, physics, levels and the collision box do not change.

## Look

Chibi proportions: big head (roughly half the character's height), small body,
stubby limbs. Large anime eyes with white highlights. Cel-shaded.

| Part | Geometry | Color |
|---|---|---|
| Hair cap + 5 spikes | sphere + cones (tilted outward) | teal `0x2a9d8f` (the current player color) |
| Head | sphere, slightly flattened | skin `0xffe0bd` |
| Eyes | flattened dark spheres `0x203040` + small white highlight spheres | |
| Gi (body) and arms | capsules | orange `0xf4845f` |
| Belt | thin flattened capsule | purple `0x7b2cbf` (matches the flag cloth) |
| Pants/legs | small capsules | dark teal `0x335c67` |

Reference proportions (model units, feet at y = 0, total height ≈ 1.9 — the
numbers the approved mockup used; the whole group is then scaled uniformly to
game size):

- legs: capsules scaled (0.09, 0.11, 0.09) at x = ±0.16, y = 0.22
- body: capsule scaled (0.26, 0.17, 0.22) at y = 0.62; belt (0.27, 0.02, 0.23) at y = 0.50
- arms: capsules scaled (0.08, 0.10, 0.08) at x = ±0.34, y = 0.62, resting tilt ±0.25 rad
- head: sphere scaled (0.55, 0.52, 0.52) at y = 1.35
- in head-local coordinates: eyes at (±0.42, 0.05, 0.85) scaled (0.16, 0.26, 0.10),
  highlights at (±0.36/±0.48, 0.14, 0.94) scaled (0.05, 0.08, 0.04); hair cap
  scaled (1.02, 0.95, 1.00) offset (0, 0.25, −0.15); spikes: cones scaled
  (0.3, 0.75, 0.3) at (−0.5, 1.1, 0.3), (0, 1.3, 0.25), (0.5, 1.1, 0.3),
  (−0.75, 0.75, 0.1), (0.75, 0.75, 0.1), tilted outward (rotation.z = −x-direction)

### Shading

`MeshToonMaterial` with a shared 3-step gradient map
(`DataTexture` of bytes `[90, 180, 255]`, 3×1, `RedFormat`, `NearestFilter`
both ways, `needsUpdate = true`). Toon shading applies to the character only;
blocks, enemies, coins and flag keep their current `MeshStandardMaterial`.
All character parts cast and receive shadows, like the capsule did.

## Size and anchoring

- The collision box stays exactly 0.7 × 0.9 tiles. Physics and tests untouched.
- The character group's origin is the **bottom-center of the collision box**
  (feet at origin). The render layer places it at
  `(player.x + player.w / 2, player.y)` — note: not the box-center `place()`
  helper used for other meshes.
- The model is scaled uniformly so the body fits the box (height ≈ 0.95 of a
  tile; scale factor ≈ 0.5 of the reference numbers above). Hair spikes may
  poke slightly above the box, as the capsule's rounded top already does.
- Origin at the feet makes the landing squash compress toward the ground
  instead of sinking through it.

## Animation

All animation is driven by state the game already computes per frame
(`vx`, `vy`, `onGround`) plus one new field, `facing`. Scale changes preserve
volume: scaling height by `s` scales width/depth by `1/√s`.

| State | Trigger | Motion |
|---|---|---|
| Facing | `facing` (+1 right, −1 left) | mesh eases `rotation.y` toward `facing × 1.05` rad (angled slightly toward the camera); ease rate ≈ 10/s |
| Run | on ground, `vx ≠ 0` | arms/legs swing sinusoidally (legs ±0.75 rad, arms ∓0.6 rad, opposite phase); slight forward lean (≈ 0.14 rad); tiny bob (≈ 0.04 tiles). Swing phase advances at ≈ 13 × (|vx| / MOVE_SPEED) rad/s, so full-speed running has exactly the cadence of the approved demo |
| Jump / fall | `!onGround` | arms up (rotation.z ≈ ±2.6), legs tucked (0.5 / −0.3 rad); vertical stretch ≈ 1.12 while rising (`vy > 0`), ≈ 1.04 while falling |
| Landing squash | `onGround` flips false → true | scale y to ≈ 0.78, easing back to 1 over ≈ 0.25 s. The squash timer lives in the render layer, never in game state |
| Idle breathing | on ground, `vx = 0` | gentle scale pulse, ±0.02 at ≈ 2.5 rad/s |

### The `facing` field (game logic)

`createPlayer` adds `facing: 1`. Each `updatePlayer` step sets `facing = 1`
when `vx > 0` and `facing = -1` when `vx < 0`; when `vx === 0` it keeps its
last value. This is game state, so it gets `node --test` coverage:
initial value, follows movement each direction, and holds after stopping.

## Code structure

- New module `public/game/js/character.js`. It imports three.js and exports:
  - `createHero()` → `{ group, model, head, body, armL, armR, legL, legR }` plus
    render-layer animation state (`facingEase`, `wasOnGround`, `runPhase`,
    `squashLeft`) — the built mesh group with the limbs needed for posing;
    `model` is the inner group carrying the base scale.
  - `poseHero(hero, player, time, dt)` → applies position, facing and the
    animation table above. Keeps its own landing-squash timer internally.
- `render.js` replaces the capsule with `createHero()`, adds `hero.group` to
  the scene, and calls `poseHero` in `render()` instead of `place(playerMesh …)`.
- Convention update in `CLAUDE.md` and the repo docs: **only `render.js` and
  `character.js` import three.js**; game rules stay free of three.js and the DOM.

## Testing and verification

- Unit tests (`node --test`): the `facing` logic in `player.js`. Existing 42
  tests must stay green.
- `character.js` is visual code, verified like `render.js`: run the game via
  `python3 -m http.server 8000 --directory public`, open `/game/`, and check
  idle, run both directions, jump, fall, landing squash, and that shadows and
  performance look right.

## Out of scope (deliberately)

- Enemy, coin, flag or block restyling; scene-wide toon shading.
- Death or flag-win animations (the mesh simply follows game state, as today).
- Any model files, textures or new dependencies — primitives only.
