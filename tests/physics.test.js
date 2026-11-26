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
