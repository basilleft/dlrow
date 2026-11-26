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
