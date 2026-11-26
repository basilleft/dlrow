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
