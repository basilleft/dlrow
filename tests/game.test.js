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
