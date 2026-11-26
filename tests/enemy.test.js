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
