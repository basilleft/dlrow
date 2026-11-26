# Platformer test game – design

Date: 2026-11-26
Status: approved by owner, not yet implemented

## Purpose

A first three.js project for the owner, who wants to learn three.js in order to build
3D things later. The game is the exercise; it should be small, playable, and keep the
three.js code easy to find and read.

It is an original platformer in the jump-and-run genre. It does not copy the
characters, levels, art or names of any existing game.

## Decisions

| Topic | Decision |
|---|---|
| Rendering library | three.js |
| View | 2.5D side-scroller: 3D blocks, movement only left/right and up/down, camera follows from the side |
| Location | `public/game/`, live at `https://www.dlrow.de/game/` via the normal deploy |
| Dependencies | three.js self-hosted in the repo. No npm, no build step, no CDN, no change to the deploy workflow |
| Physics | Hand-written axis-aligned box collision against a tile grid. No physics engine |
| Assets | None. Everything is built from three.js primitives |
| UI language | German, matching the site (`lang="de"`) |
| Discoverability | Not linked from the start page; reachable by URL only |

## Game rules

- **Controls:** left/right arrow or A/D to move. Space, up arrow or W to jump.
  Releasing the jump key early cuts the jump short, so a longer press jumps higher.
- **Coins:** removed when the player touches them; each raises the coin counter by one.
- **Enemies:** one type. It walks horizontally at constant speed and reverses direction
  when it hits a solid tile or when the tile ahead of it has no solid tile underneath
  (platform edge). It never leaves its platform.
- **Stomp:** if the player overlaps an enemy while moving downward and the player's
  bottom edge is above the enemy's vertical centre, the enemy is removed and the player
  gets a small upward bounce. Any other overlap with an enemy restarts the level.
- **Pits:** if the player's top edge falls below the bottom row of the level, the level
  restarts.
- **Restart:** resets the player to the start position and restores all coins and
  enemies. The coin counter returns to zero. There are no lives.
- **Goal:** touching the flag ends the level and shows "Level geschafft!" with the
  number of coins collected out of the total. Enter restarts the level.
- The player cannot leave the level on the left or right edge.

## Level format

One level, defined in `js/level.js` as an array of equal-length strings. Row 0 is the
top. Each character is one tile of 1×1 world units.

| Character | Meaning |
|---|---|
| `.` | empty |
| `#` | solid block |
| `o` | coin |
| `E` | enemy start position |
| `P` | player start position (exactly one) |
| `F` | goal flag (exactly one) |

The parser returns: the solid-tile grid, the list of coin positions, the list of enemy
start positions, the player start position, the flag position, and the level width and
height. It throws a descriptive error if rows differ in length, if `P` or `F` is
missing or duplicated, or if an unknown character appears.

The level is about 80 tiles wide and 12 tiles high and contains at least: two pits,
raised platforms, eight or more coins, and three enemies.

## Files

All under `public/game/`.

| File | Responsibility | Depends on |
|---|---|---|
| `index.html` | Page shell: canvas, HUD overlay elements, loads `js/main.js` as a module | – |
| `game.css` | Full-window canvas, HUD and message styling | – |
| `vendor/` | three.js module files, unmodified, plus its MIT `LICENSE` | – |
| `js/main.js` | Bootstraps, owns the game state, runs the fixed-step loop, wires the other modules | all below |
| `js/level.js` | Level text grid and parser | – |
| `js/physics.js` | Pure functions: move a box through the tile grid with collision; box overlap test | – |
| `js/player.js` | Player update: input to velocity, gravity, jump, uses physics | physics |
| `js/enemy.js` | Enemy update: patrol and turn rules, uses physics | physics |
| `js/input.js` | Tracks which keys are held; exposes left/right/jump/confirm | DOM |
| `js/render.js` | The only module that imports three.js: scene, meshes, lights, shadows, camera follow | three.js |
| `js/hud.js` | Updates coin counter and message overlay | DOM |

Rule: game logic (`level`, `physics`, `player`, `enemy`) never imports three.js or
touches the DOM. `render.js` reads game state and draws it; it never changes it.
This keeps the rules testable in Node and keeps all three.js code in one file.

## Game state

A single plain object owned by `main.js`:

- `level`: parsed level (static)
- `player`: position, velocity, size, `onGround`
- `enemies`: list of position, direction, `alive`
- `coins`: list of position, `collected`
- `coinCount`: number
- `status`: `"playing"` or `"won"`

Restart rebuilds this object from the parsed level.

## Loop

- Fixed simulation step of 1/60 s using an accumulator; rendering happens once per
  animation frame.
- Frame time is clamped to 0.1 s so a long pause cannot cause a large jump in the
  simulation.
- The loop does not advance the simulation while `document.hidden` is true.
- Order within a step: read input → update player → update enemies → resolve
  player/enemy, player/coin and player/flag overlaps → check pit.

## Rendering

- Perspective camera looking along the negative Z axis at the play plane; it follows
  the player horizontally with smoothing and is clamped so it never shows beyond the
  level's left and right ends.
- Solid tiles: boxes, drawn with one `InstancedMesh`.
- Player: capsule. Enemies: boxes of a contrasting colour. Coins: thin cylinders that
  spin. Flag: a pole with a coloured box.
- One directional light casting shadows plus one ambient or hemisphere light. A plain
  sky-coloured background.
- The renderer resizes with the window and caps the device pixel ratio at 2.

## Error handling

- If WebGL is not available, the page shows a German text message instead of the
  canvas and does not start the loop.
- Level format errors throw at startup with a message naming the problem; they are
  developer errors and are not shown to players beyond the console.

## Hosting details

- three.js is loaded through an import map in `index.html` that maps `three` to the
  file in `vendor/`, so `render.js` uses the standard `import * as THREE from 'three'`.
- ES modules do not load from `file://`. Local testing uses a static server, for
  example `python3 -m http.server` run in `public/`.
- `.htaccess` currently sets no cache lifetime for JavaScript, so browsers revalidate
  on each visit. That is kept for now; it avoids stale game code during development.
- The three.js version is pinned by the vendored files and recorded in
  `vendor/README.md` together with the download source.

## Testing

- **Automated:** `tests/*.test.js` at the repo root, outside `public/`, never deployed.
  Run with `node --test`, using only Node's built-in test runner and assertions (Node
  24 is installed locally). A minimal root `package.json` containing only
  `"type": "module"` and a `test` script is added so Node treats the game files as ES
  modules; it adds no packages.
  Covered:
  - level parser: valid level, and each error case
  - physics: landing on a floor, hitting a wall, hitting a ceiling, falling off an edge
  - enemy: turns at a wall, turns at a platform edge
  - stomp rule: from above removes the enemy, from the side restarts
  - coin pickup and counter; pit restart; flag sets `status` to `"won"`
- **Manual:** play through the level in a browser on a local server before pushing:
  reach the flag, die in a pit, die to an enemy, stomp an enemy, collect all coins,
  switch tabs and return, resize the window.

## Out of scope

Sound, touch controls, multiple levels, lives, score beyond the coin count, a link
from the start page, saving progress, a build step or npm packages.

## Delivery

Work happens on the `game` branch. Merging to `main` publishes the game. The branch is
only merged once the manual play-through passes.
