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
